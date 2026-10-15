/**
 * Booking step machine.
 *
 * After every tool step the agent takes, `enforceBookingStep` (wired as the
 * agent's `prepareStep`) inspects the last tool result and decides, purely
 * from that result's documented shape, whether to force a specific next tool
 * call or to stop the turn. This keeps the deterministic booking routing
 * (find → confirm → mutate; availability is probed inside find_room /
 * find_booking_by_id, never a separate tool step) off the model's judgement.
 *
 * The file is organized in three layers:
 *   1. Transition resolution — `resolveEnforcedTransition` and its per-tool
 *      helpers. Given the last tool result (and, for `find_room`, the chat
 *      messages) they return a {@link Transition}. These are decision-only,
 *      with the single documented exception of `resolveFindRoomBookTransition`
 *      stashing a Booking Form stay hint.
 *   2. Transition side effects — request-context candidate pinning applied
 *      once a forced-tool transition is committed.
 *   3. Enforcement — `enforceBookingStep` ties the two together and emits the
 *      Mastra `forceTool` / `stopToolExecution` envelope.
 */
import type {
  ProcessInputStepArgs,
  ProcessInputStepResult,
} from "@mastra/core/processors";
import { TOOL_KEYS, TOOL_PURPOSE } from "@repo/constants";
import { getCurrentTurn, resolveStayWindow } from "@repo/utils";

import { REQUEST_CONTEXT_KEYS } from "@/mastra/middleware/constants";
import {
  resolveContinuityStayHint,
  resolveCorroboratedBookFacts,
  stashBookingFormStayHint,
} from "@/mastra/utils/book-form-prefill";
import { parseConfirmedStay } from "@/mastra/utils/confirmed-stay";
import { asRecord, asUnknownRecord, type JsonValue } from "@/mastra/utils/json-value";
import {
  forceTool,
  hasTool,
  stopToolExecution,
} from "@/mastra/utils/parse-tool-output";

// --- Types ----------------------------------------------------------------

/**
 * Raw shape of one completed tool step, as it arrives on
 * `args.steps[].toolResults[]`.
 */
export type ToolStepResult = {
  toolName?: string;
  input?: unknown;
  output?: unknown;
};

/**
 * A resolved step-machine decision:
 *   - `call` — force exactly this tool as the next model step. `pin` carries an
 *     optional request-context candidate to stash first (see
 *     {@link applyTransitionSideEffects}).
 *   - `stop` — end the turn now, letting no tool run.
 */
export type Transition =
  | { type: "call"; toolName: string; pin?: unknown }
  | { type: "stop" };

/** The `call` branch of {@link Transition}. */
type ForcedToolTransition = Extract<Transition, { type: "call" }>;

/** Applies request-context state that a committed forced-tool transition implies. */
type TransitionSideEffect = (
  args: ProcessInputStepArgs,
  result: ToolStepResult,
) => void;

/**
 * The last tool result of the most recent step, or `null` when there is none.
 *
 * ⚠️ Fallback only — do NOT route off this directly. On @mastra/core 1.43
 * (`StepResult.toolResults` is a getter over `StepResult.content`) every step
 * object handed to `prepareStep` arrives with `content: []`, so this returns
 * `null` on EVERY step and the whole routing table silently never fires. See
 * {@link trailingToolStep} for the transcript-based source of truth.
 */
const lastToolStepResult = (
  args: ProcessInputStepArgs,
): ToolStepResult | null =>
  (args.steps?.at(-1)?.toolResults?.at(-1) as ToolStepResult | undefined) ??
  null;

// --- Routing tables ------------------------------------------------------

const FIND_BY_ID_REQUESTED_FIELDS = [
  "requestedCheckInDate",
  "requestedCheckOutDate",
  "requestedGuests",
] as const;

/**
 * Tools that pause for a guest decision, mapped to the tool to force once the
 * guest confirms. A `confirmed:false` result on any of them stops the turn.
 */
const CONFIRMATION_FOLLOW_UPS: Record<string, string> = {
  [TOOL_KEYS.ACTION.EDIT_MODIFY_BOOKING]:
    TOOL_KEYS.ACTION.CONFIRM_MODIFY_BOOKING,
  [TOOL_KEYS.ACTION.CONFIRM_BOOKING]: TOOL_KEYS.BOOKING.CREATE_BOOKING,
  [TOOL_KEYS.ACTION.CONFIRM_MODIFY_BOOKING]: TOOL_KEYS.BOOKING.UPDATE_BOOKING,
  [TOOL_KEYS.BOOKING.SHOW_CANCEL_DIALOG_CONFIRM]: TOOL_KEYS.BOOKING.CANCEL,
  [TOOL_KEYS.BOOKING.SHOW_MODIFY_DIALOG_SELECT]: TOOL_KEYS.BOOKING.FIND_BY_ID,
};

/** Mutation tools — once one returns, the turn is done. */
const TERMINAL_TOOLS: readonly string[] = [
  TOOL_KEYS.BOOKING.CREATE_BOOKING,
  TOOL_KEYS.BOOKING.UPDATE_BOOKING,
  TOOL_KEYS.BOOKING.CANCEL,
];

// --- Trailing-step reconciliation (HITL resume) ------------------------

/**
 * Client HITL tools whose `respond()` Mastra applies via suspend/resume rather
 * than as a fresh agent step. On the resume continuation the loop can therefore
 * hand `prepareStep` a `steps.at(-1)` that still points at the backend tool
 * which ran right BEFORE the HITL — e.g. the `find_booking_by_id` the modify
 * picker forced. Their results still land in the turn transcript, so
 * {@link reconcileTrailingToolStep} recovers the real last step from there.
 */
const SELF_RESOLVING_HITL_TOOLS: ReadonlySet<string> = new Set([
  TOOL_KEYS.ACTION.CONFIRM_BOOKING,
  TOOL_KEYS.ACTION.EDIT_MODIFY_BOOKING,
  TOOL_KEYS.ACTION.CONFIRM_MODIFY_BOOKING,
  TOOL_KEYS.BOOKING.SHOW_CANCEL_DIALOG_CONFIRM,
  TOOL_KEYS.BOOKING.SHOW_MODIFY_DIALOG_SELECT,
]);

/** `{ toolName, input, output }` for every settled `tool-invocation` part in
 *  the current turn's recalled transcript, oldest → newest. Carries the client
 *  HITL results a resume did not re-expose on `args.steps`. */
const currentTurnTranscriptToolResults = (
  args: ProcessInputStepArgs,
): ToolStepResult[] => {
  const messages = args.messages;
  if (!messages?.length) return [];

  const turn = getCurrentTurn(
    messages as unknown as { role?: string }[],
  ) as unknown as ProcessInputStepArgs["messages"];

  const results: ToolStepResult[] = [];
  for (const message of turn) {
    const content = asUnknownRecord(message?.content);
    const parts = Array.isArray(content?.parts) ? content.parts : null;
    if (!parts) continue;

    for (const part of parts) {
      const record = asRecord(part as JsonValue);
      if (record?.type !== "tool-invocation") continue;

      const invocation = asRecord(record.toolInvocation);
      const toolName =
        typeof invocation?.toolName === "string"
          ? invocation.toolName
          : undefined;
      if (!toolName || invocation?.state !== "result") continue;

      results.push({
        toolName,
        input: invocation.args as unknown,
        output: invocation.result as unknown,
      });
    }
  }
  return results;
};

/** Newest settled self-resolving HITL result in the current turn, from the
 *  transcript first (fullest on a resume) then this run's own steps. */
const latestSelfResolvingHitlResult = (
  args: ProcessInputStepArgs,
): ToolStepResult | null => {
  const scan = (results: ToolStepResult[]): ToolStepResult | null => {
    for (let index = results.length - 1; index >= 0; index -= 1) {
      const result = results[index];
      if (
        result?.toolName &&
        SELF_RESOLVING_HITL_TOOLS.has(result.toolName) &&
        asUnknownRecord(result.output)
      ) {
        return result;
      }
    }
    return null;
  };

  const fromSteps = (args.steps ?? []).flatMap(
    (step) => (step?.toolResults ?? []) as ToolStepResult[],
  );

  return scan(currentTurnTranscriptToolResults(args)) ?? scan(fromSteps);
};

/**
 * Repairs a stale trailing step on a HITL-resume continuation.
 *
 * When a client HITL tool ({@link SELF_RESOLVING_HITL_TOOLS}) is answered,
 * Mastra resolves it via suspend/resume, not a fresh agent step. On a run that
 * already resumed once (an ambiguous MODIFY match whose `show_modify_dialog_select`
 * pick forces `find_booking_by_id` before the edit form) the loop then exposes
 * `steps.at(-1)` as that intermediate `find_booking_by_id` again — so
 * `resolveEnforcedTransition` re-decides an already-consumed junction and
 * re-forces `edit_modify_booking`, reopening the modify form after every guest
 * action ("modify form loop").
 *
 * If the current turn already carries a settled self-resolving HITL result and
 * the trailing step is NOT that HITL, the tool it legitimately forces next, or a
 * terminal mutation, the trailing step is stale — route from the HITL instead so
 * the normal `CONFIRMATION_FOLLOW_UPS` path runs (edit → confirm, confirm →
 * mutate, or stop on decline). No settled HITL in the turn (the common first
 * pass) → return the trailing step untouched.
 */
const reconcileTrailingToolStep = (
  args: ProcessInputStepArgs,
  fromSteps: ToolStepResult | null,
): ToolStepResult | null => {
  const hitl = latestSelfResolvingHitlResult(args);
  if (!hitl?.toolName) return fromSteps;

  const trailingName = fromSteps?.toolName;
  if (
    trailingName &&
    (trailingName === hitl.toolName ||
      CONFIRMATION_FOLLOW_UPS[hitl.toolName] === trailingName ||
      TERMINAL_TOOLS.includes(trailingName))
  ) {
    return fromSteps;
  }

  return hitl;
};

/**
 * The tool step the machine routes off — the newest settled tool result in the
 * current turn's transcript.
 *
 * The transcript, not `args.steps`, is the source of truth. `args.steps[]`
 * exposes tool results through `StepResult.toolResults`, a getter over
 * `StepResult.content` — and on @mastra/core 1.43 every step object handed to
 * `prepareStep` arrives with `content: []`. `lastToolStepResult` therefore
 * returned `null` on every step, which made `resolveEnforcedTransition` a no-op
 * for every backend junction: `find_booking_by_id` never forced the modify edit
 * form or confirm card, `find_room(book_resolve)` never forced `confirm_booking`,
 * and the terminal mutations never stopped the turn. The only routing that still
 * fired came from {@link reconcileTrailingToolStep}'s HITL fallback, which by
 * design only ever returns a self-resolving HITL result — so once the modify
 * picker settled, `show_modify_dialog_select` stayed the newest HITL forever and
 * the machine re-forced `find_booking_by_id` on every step (an ambiguous MODIFY
 * looped until the step budget ran out, and no card ever opened).
 *
 * `currentTurnTranscriptToolResults` carries every settled tool result of the
 * turn — backend tools and client HITL results alike, in execution order — so
 * taking its last entry is both the correct trailing step AND subsumes the
 * resume-staleness repair `reconcileTrailingToolStep` was written for.
 *
 * `args.steps` stays the fallback for a runtime that does populate it but gives
 * us no transcript, and keeps the pre-existing reconciliation behavior there.
 */
const trailingToolStep = (args: ProcessInputStepArgs): ToolStepResult | null =>
  currentTurnTranscriptToolResults(args).at(-1) ??
  reconcileTrailingToolStep(args, lastToolStepResult(args));

// --- Transition resolution: per-tool junctions --------------------------

/**
 * MODIFY only: after find_booking_by_id resolves exactly one booking, decide
 * deterministically what runs next — based on which requested* fields resolved
 * on the OUTPUT (findBookingByIdTool echoes back its own args merged with
 * whatever was pinned from an earlier show_modify_dialog_select pick — see
 * PENDING_MODIFY_REQUESTED_FIELDS), never on this call's raw `input` alone or
 * on re-reading the guest's phrasing a step later:
 *   - no stated change → open edit_modify_booking (the form runs its own
 *     client-side availability check before it confirms).
 *   - stated change → findBookingByIdTool ALREADY probed availability for the
 *     merged stay (excluding this booking) and attached `availability` /
 *     `stayUnchanged`. The MODIFY flow no longer routes through
 *     check_room_availability: force confirm_modify_booking when free, or stop
 *     the turn on a no-op / taken / over-capacity result (FindBookingByIdNotice
 *     renders BookingUnavailable off the same raw result).
 */
const resolveFindByIdTransition = (
  input: Record<string, unknown> | null,
  output: Record<string, unknown>,
): Transition | null => {
  if (input?.purpose !== TOOL_PURPOSE.FIND_BOOKING_BY_ID.MODIFY) return null;

  const bookings = Array.isArray(output.bookings) ? output.bookings : [];
  if (bookings.length !== 1) return null;

  const hasStatedChange = FIND_BY_ID_REQUESTED_FIELDS.some((field) => {
    const value = output[field];
    return value !== undefined && value !== null && value !== "";
  });

  if (!hasStatedChange) {
    return { type: "call", toolName: TOOL_KEYS.ACTION.EDIT_MODIFY_BOOKING };
  }

  if (output.stayUnchanged === true) {
    return { type: "stop" };
  }

  const availability = asUnknownRecord(output.availability);
  if (
    availability?.available === false ||
    availability?.guestsWithinCapacity === false
  ) {
    return { type: "stop" };
  }

  // Probe free, or probe absent (call failed) → still force the confirm;
  // update_booking / PATCH /bookings is the authoritative gate.
  return { type: "call", toolName: TOOL_KEYS.ACTION.CONFIRM_MODIFY_BOOKING };
};

/**
 * BOOK only: after find_room(book_resolve) resolves exactly one room, decide
 * deterministically whether the check-in date AND guest count are already
 * known — from this turn's stated values (echoed on the find_room result;
 * see normalizeFindRoomInput/findRoomTool, corroborated against the guest's
 * own latest message via resolveCorroboratedBookFacts — see booking-resolver
 * for why the echoed values alone are not trusted) or from an earlier dated/
 * guest-count find_room this conversation (resolveContinuityStayHint) — so
 * the platform forces exactly ONE of confirm_booking / get_room_by_id
 * as the next call. This is the one BOOK junction that used to rely entirely
 * on prose ("decide from the latest message"), which let the model call both
 * tools in the same step (double UI) or reopen the form despite guests
 * already being known from an earlier turn.
 *
 * Not decision-only: when the stay is not fully known it stashes what it has
 * as a Booking Form stay hint before forcing get_room_by_id.
 *
 * The CREATE flow no longer routes through check_room_availability — when the
 * stay IS fully known, findRoomTool.execute has already probed
 * `/bookings/availability` for the resolved room (`output.availability`), so
 * this forces the HITL confirm directly, or stops the turn when the probe
 * reported the room taken / over capacity (FindRoomNotice renders the
 * BookingUnavailable card off the same result). `output.availability` can
 * also carry a guest-capacity verdict with NO check-in date at all (guest
 * count alone is enough to know a party is too big for the room) — that stops
 * the turn too, before the stay-known check below ever runs, so an
 * over-capacity request never silently opens the Booking Form.
 */

/** `value` when it is a positive number, else `undefined` — the "did the guest actually state a count" guard shared by every echoed numeric field below. */
const asPositiveNumber = (value: unknown): number | undefined =>
  typeof value === "number" && value > 0 ? value : undefined;

const resolveFindRoomBookTransition = (
  input: Record<string, unknown> | null,
  output: Record<string, unknown>,
  args: ProcessInputStepArgs,
): Transition | null => {
  if (input?.purpose !== TOOL_PURPOSE.FIND_ROOM.BOOK_RESOLVE) return null;

  const rooms = Array.isArray(output.rooms) ? output.rooms : [];
  if (rooms.length !== 1) return null;

  const roomRecord = asUnknownRecord(rooms[0]);
  const roomId = typeof roomRecord?.id === "string" ? roomRecord.id : undefined;
  if (!roomId) return null;

  const echoedCheckIn =
    typeof output.date === "string" && output.date ? output.date : undefined;
  const echoedGuests = asPositiveNumber(output.guests);
  const echoedNights = asPositiveNumber(output.nights);

  const corroborated = resolveCorroboratedBookFacts({
    messages: args.messages,
    statedCheckIn: echoedCheckIn,
    statedGuests: echoedGuests,
    statedNights: echoedNights,
  });
  const statedCheckIn = corroborated.checkInDate;
  const statedGuests = corroborated.guests;
  const statedNights = corroborated.nights;

  const continuityHint =
    statedCheckIn && statedGuests
      ? null
      : resolveContinuityStayHint(args.messages);
  const checkInDate = statedCheckIn ?? continuityHint?.checkInDate;
  const guests = statedGuests ?? continuityHint?.guests;
  const nights = statedNights ?? continuityHint?.nights;

  // A stated stay length ("4 nights") on its own is NOT enough to route on —
  // only a real check-in date is (stated this turn, or carried from an earlier
  // DATED search via Date continuity; never a browse default — see
  // `dateStated`/PENDING_CHECKIN_CUE). The platform never guesses a check-in,
  // not even a plausible one like today: when it is unknown the Booking Form
  // opens for the guest to pick it, and `nights` still travels there so the
  // guest only needs to choose a check-in, not restate the length.
  const stayWindow = resolveStayWindow({ checkInDate, nights });

  const availability = asUnknownRecord(output.availability);

  // findRoomTool's probe (probeBookResolveAvailability) can report a
  // deterministic over-capacity verdict with NO check-in date at all — guest
  // capacity is a static room fact, so it never needs one. That verdict is
  // computed off the RAW echoed/hinted guest count, not the corroborated
  // `guests` above (same trust gap resolveCorroboratedBookFacts exists to
  // close for dates), so it is only trusted here when it agrees with the
  // count the step machine independently corroborated — never on a guest
  // count the model merely echoed with no matching cue in the guest's own
  // text. Checked before the `stayWindow` branch, not only inside it, so an
  // over-capacity party is stopped even with no date yet instead of silently
  // opening the Booking Form.
  const availabilityGuests =
    typeof availability?.guests === "number" ? availability.guests : undefined;
  const hasDatelessCapacityVerdict =
    availability != null &&
    availability.checkInDate === undefined &&
    availability.guestsWithinCapacity === false;

  if (hasDatelessCapacityVerdict && guests && availabilityGuests === guests) {
    return { type: "stop" };
  }

  if (stayWindow && guests) {
    // Only trust `output.availability` here — inside the branch where the
    // step machine's OWN corroborated stay agrees a real check-in date is
    // known. A probe that ran on a model-attached date corroboration
    // rejected (no cue in the guest's own latest message) must NOT stop the
    // turn on that date's verdict; it falls through to the Booking Form like
    // any other not-fully-known stay (FindRoomNotice's defensive check backs
    // this up on the FE side too).
    const probedUnavailable =
      availability?.available === false ||
      availability?.guestsWithinCapacity === false;

    // Probe absent (call failed) → still force the confirm; POST /bookings is
    // the authoritative gate and surfaces a conflict on the same HITL card.
    return probedUnavailable
      ? { type: "stop" }
      : { type: "call", toolName: TOOL_KEYS.ACTION.CONFIRM_BOOKING };
  }

  // `nights` is stashed even with no check-in date — that is the whole point of
  // carrying a stay length separately: "book X for 4 nights" opens the Booking
  // Form with empty dates but must still remember four nights, so the guest
  // picking a check-in resolves check-out to check-in + 4 rather than + 1.
  stashBookingFormStayHint(args.requestContext, {
    ...(stayWindow
      ? {
          checkInDate: stayWindow.checkInDate,
          checkOutDate: stayWindow.checkOutDate,
        }
      : {}),
    ...(guests ? { guests } : {}),
    ...(nights ? { nights } : {}),
  });

  return { type: "call", toolName: TOOL_KEYS.BOOKING.GET_ROOM_BY_ID };
};

// --- Transition resolution: entry point ---------------------------------

/**
 * Generic booking-workflow routing — every junction except `find_room`, which
 * additionally depends on the chat messages and is handled in
 * `resolveEnforcedTransition` directly.
 */
const resolveBookingWorkflowTransition = (
  result: ToolStepResult,
): Transition | undefined => {
  const { toolName, input, output } = result;
  const outputRecord = asUnknownRecord(output);
  if (!toolName || !outputRecord) return undefined;

  if (toolName === TOOL_KEYS.BOOKING.FIND_BY_ID) {
    return (
      resolveFindByIdTransition(asUnknownRecord(input), outputRecord) ??
      undefined
    );
  }

  // A painted RoomComparison owns the turn — stop so the model only adds its
  // pointer sentence (never get_room_by_id per room, never another search).
  // `no_candidates` painted nothing: leave the model free to search or ask.
  if (toolName === TOOL_KEYS.GET.COMPARE_ROOMS) {
    return outputRecord.status === "rendered" ? { type: "stop" } : undefined;
  }

  const followUpTool = CONFIRMATION_FOLLOW_UPS[toolName];
  if (followUpTool) {
    return outputRecord.confirmed === true
      ? { type: "call", toolName: followUpTool }
      : { type: "stop" };
  }

  if (TERMINAL_TOOLS.includes(toolName)) return { type: "stop" };

  return undefined;
};

/**
 * Resolves the transition to enforce after the last tool step.
 *
 * Decision-only, save for `resolveFindRoomBookTransition`'s documented stay-hint
 * stash — all request-context candidate pinning happens later in
 * {@link applyTransitionSideEffects}.
 */
export const resolveEnforcedTransition = (
  args: ProcessInputStepArgs,
  result: ToolStepResult,
): Transition | undefined => {
  if (result.toolName === TOOL_KEYS.GET.FIND_ROOM) {
    return (
      resolveFindRoomBookTransition(
        asUnknownRecord(result.input),
        asUnknownRecord(result.output) ?? {},
        args,
      ) ?? undefined
    );
  }

  return resolveBookingWorkflowTransition(result);
};

// --- Transition side effects: request-context pinning -------------------

const pinConfirmedStay = (
  args: ProcessInputStepArgs,
  result: ToolStepResult,
) => {
  if (!args.requestContext) return;
  const key =
    result.toolName === TOOL_KEYS.ACTION.CONFIRM_MODIFY_BOOKING
      ? REQUEST_CONTEXT_KEYS.PENDING_UPDATE_STAY
      : result.toolName === TOOL_KEYS.ACTION.CONFIRM_BOOKING
        ? REQUEST_CONTEXT_KEYS.PENDING_CREATE_STAY
        : null;
  if (!key) return;
  const stay = parseConfirmedStay(result.output as never);
  if (!stay) return;
  args.requestContext.set(key, stay);
};

/**
 * Pins the picker's chosen booking id so find_booking_by_id prefers it over a
 * possibly-stale model-supplied id. Also carries forward whichever
 * requested* fields the guest already stated when show_modify_dialog_select
 * was called (its own input, from BEFORE the HITL pause) — so the forced
 * find_booking_by_id call right after confirmed:true doesn't have to
 * re-derive them from a guest message several tool-calls back.
 */
const pinModifyBookingId = (
  args: ProcessInputStepArgs,
  result: ToolStepResult,
) => {
  if (!args.requestContext) return;
  const output = asUnknownRecord(result.output);
  const bookingId =
    typeof output?.bookingId === "string" ? output.bookingId : undefined;
  if (!bookingId) return;
  args.requestContext.set(
    REQUEST_CONTEXT_KEYS.PENDING_MODIFY_BOOKING_ID,
    bookingId,
  );

  const input = asUnknownRecord(result.input);
  const requestedCheckInDate =
    typeof input?.requestedCheckInDate === "string"
      ? input.requestedCheckInDate
      : undefined;
  const requestedCheckOutDate =
    typeof input?.requestedCheckOutDate === "string"
      ? input.requestedCheckOutDate
      : undefined;
  const requestedCheckOutDeltaDays =
    typeof input?.requestedCheckOutDeltaDays === "number" &&
    Number.isInteger(input.requestedCheckOutDeltaDays)
      ? input.requestedCheckOutDeltaDays
      : undefined;
  const requestedGuests =
    typeof input?.requestedGuests === "number"
      ? input.requestedGuests
      : undefined;
  if (
    requestedCheckInDate ||
    requestedCheckOutDate ||
    requestedCheckOutDeltaDays !== undefined ||
    requestedGuests !== undefined
  ) {
    args.requestContext.set(
      REQUEST_CONTEXT_KEYS.PENDING_MODIFY_REQUESTED_FIELDS,
      {
        checkInDate: requestedCheckInDate,
        checkOutDate: requestedCheckOutDate,
        checkOutDeltaDays: requestedCheckOutDeltaDays,
        guests: requestedGuests,
      },
    );
  }
};

/**
 * Pins the cancel dialog's confirmed booking id so cancel_booking prefers it
 * over a possibly-stale model-supplied id — the CANCEL analogue of
 * pinModifyBookingId.
 */
const pinCancelBookingId = (
  args: ProcessInputStepArgs,
  result: ToolStepResult,
) => {
  if (!args.requestContext) return;
  const output = asUnknownRecord(result.output);
  const bookingId =
    typeof output?.bookingId === "string" ? output.bookingId : undefined;
  if (!bookingId) return;
  args.requestContext.set(
    REQUEST_CONTEXT_KEYS.PENDING_CANCEL_BOOKING_ID,
    bookingId,
  );
};

/**
 * `from` tool → `to` forced tool → the extra request-context pinning that
 * transition needs. A junction with no rule falls back to {@link pinConfirmedStay}.
 */
const TRANSITION_SIDE_EFFECT_RULES: readonly {
  from: string;
  to: string;
  effect: TransitionSideEffect;
}[] = [
  {
    from: TOOL_KEYS.BOOKING.SHOW_MODIFY_DIALOG_SELECT,
    to: TOOL_KEYS.BOOKING.FIND_BY_ID,
    effect: pinModifyBookingId,
  },
  {
    from: TOOL_KEYS.BOOKING.SHOW_CANCEL_DIALOG_CONFIRM,
    to: TOOL_KEYS.BOOKING.CANCEL,
    effect: pinCancelBookingId,
  },
];

/**
 * Applies the request-context state a committed forced-tool transition implies.
 *
 * Transition resolution stays (almost) pure; this function owns the
 * request-context mutations / booking-candidate pinning.
 */
const applyTransitionSideEffects = (
  args: ProcessInputStepArgs,
  result: ToolStepResult,
  transition: ForcedToolTransition,
): void => {
  if (transition.pin) {
    args.requestContext?.set(
      REQUEST_CONTEXT_KEYS.PENDING_CREATE_CANDIDATE,
      transition.pin,
    );
  }

  const rule = TRANSITION_SIDE_EFFECT_RULES.find(
    ({ from, to }) => from === result.toolName && to === transition.toolName,
  );

  if (rule) {
    rule.effect(args, result);
    return;
  }

  pinConfirmedStay(args, result);
};

// --- Enforcement -------------------------------------------------------

/**
 * A forced transition silently no-ops when the target tool isn't in
 * `args.tools` — normally because the frontend hasn't mounted the matching
 * `useHumanInTheLoop`/`useRenderTool` registration for this run (see
 * apps/web/features/chatbot/declarative-ui/tools/booking-tools.tsx). That's a real gap:
 * the booking flow just stalls with no forced tool call and no error. Warn
 * so it's visible in logs instead of only showing up as "the agent stopped
 * responding" from the guest's side.
 */
const isForcedToolAvailable = (
  args: ProcessInputStepArgs,
  result: ToolStepResult,
  transition: ForcedToolTransition,
): boolean => {
  if (hasTool(args, transition.toolName)) return true;

  console.warn(
    `[BookingStepMachine] Wanted to force "${transition.toolName}"${result.toolName ? ` after "${result.toolName}"` : ""}, but it isn't registered in this run's tools — is BookingToolsProvider mounted on the frontend? Skipping the forced transition.`,
  );

  return false;
};

/**
 * The agent's `prepareStep` hook: after each tool step, force the next booking
 * step (or stop the turn) per {@link resolveEnforcedTransition}.
 */
export const enforceBookingStep = (
  args: ProcessInputStepArgs,
): ProcessInputStepResult | undefined => {
  if (args.abortSignal?.aborted) {
    return stopToolExecution();
  }

  // Route off the turn transcript, not `args.steps` — see trailingToolStep for
  // why `args.steps[].toolResults` is empty on every step and what that broke.
  const result = trailingToolStep(args);
  if (!result) {
    return undefined;
  }

  const transition = resolveEnforcedTransition(args, result);
  if (!transition) {
    return undefined;
  }

  if (transition.type === "stop") {
    return stopToolExecution();
  }

  if (!isForcedToolAvailable(args, result, transition)) {
    return undefined;
  }

  applyTransitionSideEffects(args, result, transition);

  return forceTool(transition.toolName);
};
