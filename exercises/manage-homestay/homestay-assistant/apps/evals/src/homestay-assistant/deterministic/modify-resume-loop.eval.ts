import { evalite } from "evalite";

import type {
  ProcessInputStepArgs,
  ProcessInputStepResult,
} from "@mastra/core/processors";
import { RequestContext } from "@mastra/core/request-context";
import { TOOL_KEYS, TOOL_PURPOSE } from "@repo/constants";

import { enforceBookingStep } from "@agent/mastra/utils/step-machine";
import { scoreResult } from "../../support/checks";

/**
 * MODIFY resume loop — no LLM.
 *
 * A client HITL tool (`edit_modify_booking`, `confirm_modify_booking`, …) is
 * resolved via Mastra suspend/resume, NOT as a fresh agent step. On a run that
 * already resumed once — an ambiguous multi-booking MODIFY, whose
 * `show_modify_dialog_select` pick forces `find_booking_by_id` before the edit
 * form — the loop then hands `prepareStep` a `steps.at(-1)` that still points at
 * that intermediate `find_booking_by_id`. Without reconciliation the step
 * machine re-decides the junction and re-forces `edit_modify_booking` on every
 * guest action → the modify form reopens forever.
 *
 * `enforceBookingStep` repairs the stale trailing step from the turn transcript
 * (`reconcileTrailingToolStep`), so these assert the whole
 * `prepareStep` envelope, not just `resolveEnforcedTransition`.
 */

const BOOKING = {
  bookingId: "booking-1",
  roomId: "room-riverside-twin",
  checkInDate: "2026-10-05",
  checkOutDate: "2026-10-08",
  guests: 2,
};

const ROOM = {
  id: BOOKING.roomId,
  name: "Riverside Twin Room",
  capacity: 4,
  pricePerNight: 120,
};

/** Every tool key present, so `isForcedToolAvailable` never short-circuits. */
const ALL_TOOLS = Object.fromEntries(
  [
    TOOL_KEYS.BOOKING.FIND_BY_ID,
    TOOL_KEYS.BOOKING.FIND,
    TOOL_KEYS.BOOKING.UPDATE_BOOKING,
    TOOL_KEYS.BOOKING.CANCEL,
    TOOL_KEYS.ACTION.EDIT_MODIFY_BOOKING,
    TOOL_KEYS.ACTION.CONFIRM_MODIFY_BOOKING,
    TOOL_KEYS.BOOKING.SHOW_MODIFY_DIALOG_SELECT,
  ].map((name) => [name, { id: name }]),
);

type ToolInvocation = {
  toolName: string;
  args?: Record<string, unknown>;
  result?: Record<string, unknown>;
  state?: "result" | "call";
};

const userMessage = (text: string) => ({
  role: "user" as const,
  content: { format: 2, parts: [{ type: "text", text }] },
});

const assistantToolMessage = (invocation: ToolInvocation) => ({
  role: "assistant" as const,
  content: {
    format: 2,
    parts: [
      {
        type: "tool-invocation",
        toolInvocation: {
          state: invocation.state ?? "result",
          toolName: invocation.toolName,
          args: invocation.args ?? {},
          result: invocation.result ?? {},
        },
      },
    ],
  },
});

type Case = {
  name: string;
  /** Oldest → newest tool activity for the current turn's transcript. */
  transcript: ToolInvocation[];
  /** What Mastra hands `prepareStep` as the (possibly stale) trailing step. */
  trailingStep: { toolName: string; input?: unknown; output?: unknown };
  expected: `force:${string}` | "stop" | "pass";
};

const toOutcome = (result: ProcessInputStepResult | undefined | void) => {
  if (!result) return "pass";
  if (result.toolChoice === "none") return "stop";
  const forced =
    (typeof result.toolChoice === "object" &&
      result.toolChoice?.type === "tool" &&
      result.toolChoice.toolName) ||
    result.activeTools?.[0];
  return forced ? `force:${forced}` : "pass";
};

const runCase = (testCase: Case) => {
  const args = {
    steps: [{ toolResults: [testCase.trailingStep] }],
    messages: [
      userMessage("modify my Riverside Twin Room booking"),
      ...testCase.transcript.map(assistantToolMessage),
    ],
    tools: ALL_TOOLS,
    requestContext: new RequestContext(),
  } as unknown as ProcessInputStepArgs;

  return toOutcome(enforceBookingStep(args));
};

const CASES: Case[] = [
  {
    name: "picker pick → forced find_booking_by_id legitimately trails show_modify_dialog_select → open the edit form",
    transcript: [
      {
        toolName: TOOL_KEYS.BOOKING.FIND,
        result: { status: "ambiguous", bookings: [BOOKING, { bookingId: "booking-2" }] },
      },
      {
        toolName: TOOL_KEYS.BOOKING.SHOW_MODIFY_DIALOG_SELECT,
        result: { confirmed: true, bookingId: BOOKING.bookingId },
      },
      {
        toolName: TOOL_KEYS.BOOKING.FIND_BY_ID,
        args: { purpose: TOOL_PURPOSE.FIND_BOOKING_BY_ID.MODIFY },
        result: { bookings: [BOOKING], room: ROOM },
      },
    ],
    trailingStep: {
      toolName: TOOL_KEYS.BOOKING.FIND_BY_ID,
      input: { purpose: TOOL_PURPOSE.FIND_BOOKING_BY_ID.MODIFY },
      output: { bookings: [BOOKING], room: ROOM },
    },
    expected: `force:${TOOL_KEYS.ACTION.EDIT_MODIFY_BOOKING}`,
  },
  {
    name: "resume after edit confirm, trailing step re-surfaced as find_booking_by_id → force confirm_modify_booking (not the form again)",
    transcript: [
      {
        toolName: TOOL_KEYS.BOOKING.SHOW_MODIFY_DIALOG_SELECT,
        result: { confirmed: true, bookingId: BOOKING.bookingId },
      },
      {
        toolName: TOOL_KEYS.BOOKING.FIND_BY_ID,
        args: { purpose: TOOL_PURPOSE.FIND_BOOKING_BY_ID.MODIFY },
        result: { bookings: [BOOKING], room: ROOM },
      },
      {
        toolName: TOOL_KEYS.ACTION.EDIT_MODIFY_BOOKING,
        result: {
          confirmed: true,
          bookingId: BOOKING.bookingId,
          roomId: ROOM.id,
          checkInDate: "2026-10-05",
          checkOutDate: "2026-10-10",
          guests: 2,
        },
      },
    ],
    trailingStep: {
      toolName: TOOL_KEYS.BOOKING.FIND_BY_ID,
      input: { purpose: TOOL_PURPOSE.FIND_BOOKING_BY_ID.MODIFY },
      output: { bookings: [BOOKING], room: ROOM },
    },
    expected: `force:${TOOL_KEYS.ACTION.CONFIRM_MODIFY_BOOKING}`,
  },
  {
    name: "resume after modify confirm, trailing step re-surfaced as find_booking_by_id → force update_booking",
    transcript: [
      {
        toolName: TOOL_KEYS.BOOKING.FIND_BY_ID,
        args: { purpose: TOOL_PURPOSE.FIND_BOOKING_BY_ID.MODIFY },
        result: { bookings: [BOOKING], room: ROOM },
      },
      {
        toolName: TOOL_KEYS.ACTION.EDIT_MODIFY_BOOKING,
        result: {
          confirmed: true,
          bookingId: BOOKING.bookingId,
          roomId: ROOM.id,
          checkInDate: "2026-10-05",
          checkOutDate: "2026-10-10",
          guests: 2,
        },
      },
      {
        toolName: TOOL_KEYS.ACTION.CONFIRM_MODIFY_BOOKING,
        result: {
          confirmed: true,
          bookingId: BOOKING.bookingId,
          checkInDate: "2026-10-05",
          checkOutDate: "2026-10-10",
          guests: 2,
        },
      },
    ],
    trailingStep: {
      toolName: TOOL_KEYS.BOOKING.FIND_BY_ID,
      input: { purpose: TOOL_PURPOSE.FIND_BOOKING_BY_ID.MODIFY },
      output: { bookings: [BOOKING], room: ROOM },
    },
    expected: `force:${TOOL_KEYS.BOOKING.UPDATE_BOOKING}`,
  },
  {
    name: "guest declined the edit form on a re-surfaced find_booking_by_id trailing step → stop (never re-open the form)",
    transcript: [
      {
        toolName: TOOL_KEYS.BOOKING.FIND_BY_ID,
        args: { purpose: TOOL_PURPOSE.FIND_BOOKING_BY_ID.MODIFY },
        result: { bookings: [BOOKING], room: ROOM },
      },
      {
        toolName: TOOL_KEYS.ACTION.EDIT_MODIFY_BOOKING,
        result: { confirmed: false },
      },
    ],
    trailingStep: {
      toolName: TOOL_KEYS.BOOKING.FIND_BY_ID,
      input: { purpose: TOOL_PURPOSE.FIND_BOOKING_BY_ID.MODIFY },
      output: { bookings: [BOOKING], room: ROOM },
    },
    expected: "stop",
  },
  {
    name: "first pass — no settled HITL in the turn yet → trailing find_booking_by_id opens the form as normal",
    transcript: [
      {
        toolName: TOOL_KEYS.BOOKING.FIND_BY_ID,
        args: { purpose: TOOL_PURPOSE.FIND_BOOKING_BY_ID.MODIFY },
        result: { bookings: [BOOKING], room: ROOM },
      },
    ],
    trailingStep: {
      toolName: TOOL_KEYS.BOOKING.FIND_BY_ID,
      input: { purpose: TOOL_PURPOSE.FIND_BOOKING_BY_ID.MODIFY },
      output: { bookings: [BOOKING], room: ROOM },
    },
    expected: `force:${TOOL_KEYS.ACTION.EDIT_MODIFY_BOOKING}`,
  },
];

evalite<Case, string, string>("modify resume loop — trailing step reconciliation", {
  data: () => CASES.map((testCase) => ({ input: testCase, expected: testCase.expected })),
  task: (input) => runCase(input),
  scorers: [
    {
      name: "Forces the documented next step after a HITL resume",
      scorer: ({ input, output, expected }) =>
        scoreResult(
          output === expected,
          `${input.name} — expected "${expected}", got "${output}"`,
        ),
    },
  ],
  columns: ({ input, output }) => [
    { label: "Junction", value: input.name },
    { label: "Decision", value: output },
  ],
});
