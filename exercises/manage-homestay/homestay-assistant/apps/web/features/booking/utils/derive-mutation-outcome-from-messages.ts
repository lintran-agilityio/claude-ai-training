import { MESSAGE_ROLE, TOOL_KEYS } from "@repo/constants";
import { parseToolResult, type ModifyEpisodeUpdate } from "@repo/utils";
import { z } from "zod";

import {
  BOOKING_MUTATION_PHASE,
  type BookingMutationPhase,
} from "@/features/booking/constants";
import type {
  CreateBookingCardOutcome,
  CancelBookingCardOutcome,
  ModifyBookingCardOutcome,
} from "@/features/booking/stores";
import type {
  CancelBookingResult,
  CreateBookingResult,
  UpdateBookingResult,
} from "@/features/booking/types";
import type { MessageLike, ToolArgumentsLike } from "@/features/chatbot/types";
import {
  isCancelBookingSuccess,
  isCreateBookingSuccess,
  isUpdateBookingSuccess,
  buildCancelBookingCorrelationKey,
  buildCreateStayCorrelationKey,
  getCancelBookingFailureMessage,
  getCreateBookingFailureMessage,
  getModifyBookingFailureMessage,
} from "@/features/booking/utils";

type MutationToolHit = {
  toolCallId: string;
  args: MutationToolArguments;
  resultContent: string | null;
};

const mutationToolArgumentsSchema = z.object({
  bookingId: z.string().optional().catch(undefined),
  roomId: z.string().optional().catch(undefined),
  checkInDate: z.string().optional().catch(undefined),
  checkOutDate: z.string().optional().catch(undefined),
  guests: z.number().finite().optional().catch(undefined),
});

type MutationToolArguments = z.infer<typeof mutationToolArgumentsSchema>;

/**
 * Presentation-only: read mutation tool results from the CopilotKit transcript
 * so HITL cards can recover success/failed after refresh when Zustand is empty.
 * Does not rewrite agent.messages.
 */
const parseToolArguments = (
  raw: ToolArgumentsLike,
): MutationToolArguments | null => {
  if (raw == null) {
    return null;
  }

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) {
      return null;
    }

    try {
      const parsed = mutationToolArgumentsSchema.safeParse(JSON.parse(trimmed));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  const parsed = mutationToolArgumentsSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
};

const readToolResultContent = (
  messages: MessageLike[],
  toolCallId: string,
): string | null => {
  const toolMessage = messages.find(
    (message) =>
      message.role === MESSAGE_ROLE.TOOL && message.toolCallId === toolCallId,
  );

  if (!toolMessage || toolMessage.content == null) {
    return null;
  }

  if (typeof toolMessage.content === "string") {
    return toolMessage.content;
  }

  try {
    return JSON.stringify(toolMessage.content);
  } catch {
    return null;
  }
};

const collectMutationToolHits = (
  messages: MessageLike[] | undefined,
  toolName: string,
): MutationToolHit[] => {
  if (!messages?.length) {
    return [];
  }

  const hits: MutationToolHit[] = [];

  for (const message of messages) {
    if (message.role !== MESSAGE_ROLE.ASSISTANT) {
      continue;
    }

    for (const toolCall of message.toolCalls ?? []) {
      if (toolCall.function?.name !== toolName || !toolCall.id) {
        continue;
      }

      hits.push({
        toolCallId: toolCall.id,
        args: parseToolArguments(toolCall.function.arguments) ?? {},
        resultContent: readToolResultContent(messages, toolCall.id),
      });
    }
  }

  return hits;
};

const findLastHit = (
  hits: MutationToolHit[],
  predicate: (hit: MutationToolHit) => boolean,
): MutationToolHit | null => {
  for (let index = hits.length - 1; index >= 0; index -= 1) {
    const hit = hits[index];

    if (hit && predicate(hit)) {
      return hit;
    }
  }

  return null;
};

/**
 * Resolve the transcript hit that settled *this* card.
 *
 * Exact correlation-key match always wins. The "latest settled hit" fallback is
 * only safe when there is no correlation key to match against (args too sparse
 * to rebuild one — e.g. post-refresh recovery of a lone booking).
 *
 * When this card already has a key, an unmatched hit belongs to a different
 * stay. Borrowing it is what made a second create HITL card inherit the first
 * booking's price and jump straight to "Booking confirmed" — including the
 * common case of exactly one prior settled `create_booking` in the transcript.
 */
const pickHit = (
  hits: MutationToolHit[],
  hasCorrelationKey: boolean,
  matchesCorrelationKey: (hit: MutationToolHit) => boolean,
): MutationToolHit | null => {
  const settledHits = hits.filter((hit) => hit.resultContent != null);

  const matched = findLastHit(settledHits, matchesCorrelationKey);
  if (matched) {
    return matched;
  }

  if (!hasCorrelationKey) {
    return settledHits[settledHits.length - 1] ?? null;
  }

  return null;
};

/**
 * Prefer a settled (success/failed) outcome over a still-"submitting" one;
 * the store's optimistic submitting placeholder (written on confirm click,
 * before the mutation tool call resolves) must not permanently hide a
 * settled outcome the transcript already has — e.g. when the store never
 * gets its own success/failed update (missed publish, race between
 * concurrent bookings), the card would otherwise stay stuck on "Creating
 * booking…" forever even though the tool result — and the assistant's
 * chat reply — already confirm success.
 */
export const coalesceBookingCardOutcome = <
  T extends { phase: BookingMutationPhase },
>(
  storeOutcome: T | null | undefined,
  transcriptOutcome: T | null | undefined,
): T | null => {
  if (storeOutcome && storeOutcome.phase !== BOOKING_MUTATION_PHASE.SUBMITTING) {
    return storeOutcome;
  }

  return transcriptOutcome ?? storeOutcome ?? null;
};

export const deriveCreateBookingOutcomeFromMessages = (
  messages: MessageLike[] | undefined,
  correlationKey: string | null,
): CreateBookingCardOutcome | null => {
  const hits = collectMutationToolHits(
    messages,
    TOOL_KEYS.BOOKING.CREATE_BOOKING,
  );
  const hit = pickHit(hits, Boolean(correlationKey), (candidate) => {
    const candidateKey = buildCreateStayCorrelationKey({
      roomId: candidate.args.roomId,
      checkInDate: candidate.args.checkInDate,
      checkOutDate: candidate.args.checkOutDate,
      guests: candidate.args.guests,
    });
    return Boolean(correlationKey && candidateKey === correlationKey);
  });

  if (!hit?.resultContent) {
    return null;
  }

  const resolvedCorrelationKey =
    correlationKey ??
    buildCreateStayCorrelationKey({
      roomId: hit.args.roomId,
      checkInDate: hit.args.checkInDate,
      checkOutDate: hit.args.checkOutDate,
      guests: hit.args.guests,
    }) ??
    hit.toolCallId;

  if (isCreateBookingSuccess(hit.resultContent)) {
    const parsed = parseToolResult<CreateBookingResult>(hit.resultContent);
    const bookingId = parsed?.id?.trim();
    if (!bookingId) {
      return null;
    }

    return {
      correlationKey: resolvedCorrelationKey,
      phase: BOOKING_MUTATION_PHASE.SUCCESS,
      bookingId,
      totalPrice:
        typeof parsed?.totalPrice === "number" ? parsed.totalPrice : undefined,
    };
  }

  return {
    correlationKey: resolvedCorrelationKey,
    phase: BOOKING_MUTATION_PHASE.FAILED,
    errorMessage: getCreateBookingFailureMessage(hit.resultContent),
  };
};

export const deriveCancelBookingOutcomeFromMessages = (
  messages: MessageLike[] | undefined,
  correlationKey: string | null,
): CancelBookingCardOutcome | null => {
  const hits = collectMutationToolHits(messages, TOOL_KEYS.BOOKING.CANCEL);
  const hit = pickHit(hits, Boolean(correlationKey), (candidate) => {
    const candidateKey = buildCancelBookingCorrelationKey(
      candidate.args.bookingId,
    );
    return Boolean(correlationKey && candidateKey === correlationKey);
  });

  if (!hit?.resultContent) {
    return null;
  }

  const resolvedCorrelationKey =
    correlationKey ??
    buildCancelBookingCorrelationKey(hit.args.bookingId) ??
    hit.toolCallId;

  if (isCancelBookingSuccess(hit.resultContent)) {
    const parsed = parseToolResult<CancelBookingResult>(hit.resultContent);
    const bookingId = parsed?.id?.trim() ?? resolvedCorrelationKey;
    if (!bookingId) {
      return null;
    }

    return {
      correlationKey: resolvedCorrelationKey,
      phase: BOOKING_MUTATION_PHASE.SUCCESS,
      bookingId,
    };
  }

  return {
    correlationKey: resolvedCorrelationKey,
    phase: BOOKING_MUTATION_PHASE.FAILED,
    errorMessage: getCancelBookingFailureMessage(hit.resultContent),
  };
};

/**
 * Card outcome for the `update_booking` attempt in a confirm_modify_booking
 * card's own episode (see selectModifyEpisode) — a call still running reads as
 * submitting, so a card never adopts another card's mutation.
 */
export const deriveModifyOutcomeFromEpisodeUpdate = (
  update: ModifyEpisodeUpdate | null | undefined,
): ModifyBookingCardOutcome | null => {
  if (!update) {
    return null;
  }

  if (update.result == null) {
    return { phase: BOOKING_MUTATION_PHASE.SUBMITTING };
  }

  const result = update.result as UpdateBookingResult | string;
  if (isUpdateBookingSuccess(result)) {
    return {
      phase: BOOKING_MUTATION_PHASE.SUCCESS,
      bookingId: parseToolResult<UpdateBookingResult>(result)?.id?.trim(),
    };
  }

  return {
    phase: BOOKING_MUTATION_PHASE.FAILED,
    errorMessage: getModifyBookingFailureMessage(result),
  };
};
