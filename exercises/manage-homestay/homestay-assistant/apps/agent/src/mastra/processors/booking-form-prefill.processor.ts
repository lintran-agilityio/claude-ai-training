import type { ProcessInputStepArgs, Processor } from "@mastra/core/processors";

import { getBusinessDates } from "@repo/utils";

import {
  hasStatedCheckInCue,
  hasStatedRoomRankingCue,
  readBookingFormStayHint,
  stashCheckInCueOverride,
  resolveContinuityStayHint,
  resolveStatedRelativeCheckIn,
  stashBookingFormStayHint,
  stashRankingCueOverride,
  stashRelativeCheckInOverride,
} from "@/mastra/utils/book-form-prefill";
import {
  extractMessageText,
  findLatestUserMessage,
} from "@/mastra/utils/latest-user-message";

/**
 * Runs before every step so a later get_room_by_id call (which opens the
 * Booking Form) can fall back to an earlier dated find_room in this
 * conversation when the model doesn't pass its own checkInDate/guests args
 * (see WORKFLOW — BOOK "partial info" — the model states check-in/guests
 * directly on get_room_by_id when the guest's latest message named them).
 *
 * Also re-pins the deterministic relative check-in override (see
 * PENDING_RELATIVE_CHECKIN) from the guest's own latest message, so find_room
 * never has to trust the model's own today/weekend arithmetic, and re-pins
 * whether that message stated any ranking/price cue at all (see
 * PENDING_RANKING_CUE), so find_room can drop an uncorroborated sortBy/maxPrice.
 */
export class BookingFormPrefillProcessor implements Processor {
  id = "booking-form-prefill";

  name = "Booking Form Prefill";

  processInputStep({ messages, requestContext }: ProcessInputStepArgs) {
    // Only fill an EMPTY pin. The BOOK step machine pins its own hint just
    // before forcing get_room_by_id, and that hint is already the merge of this
    // turn's stated values with the same continuity scan (see
    // resolveFindRoomBookTransition) — so it is never worse than what this
    // processor would compute, and may carry a stay length no earlier search
    // mentioned. Overwriting it blindly on the next step dropped that `nights`
    // and silently put the booking back to one night. `resolveRoomStay` clears
    // the pin once the form has consumed it, so a later step still re-pins
    // continuity normally.
    if (!readBookingFormStayHint(requestContext)) {
      stashBookingFormStayHint(requestContext, resolveContinuityStayHint(messages));
    }

    const latestUserMessage = messages?.length
      ? findLatestUserMessage(messages)
      : undefined;
    const latestText = latestUserMessage
      ? extractMessageText(latestUserMessage)
      : "";
    const today = getBusinessDates().today;

    stashRelativeCheckInOverride(
      requestContext,
      resolveStatedRelativeCheckIn(latestText, today),
    );
    stashRankingCueOverride(requestContext, hasStatedRoomRankingCue(latestText));
    // Recorded per step so find_room can stamp its result with whether the
    // guest actually named a date — the prompt makes the model fill in today
    // for undated "available" searches, and without this stamp that default
    // reads back as a real check-in one turn later.
    stashCheckInCueOverride(requestContext, hasStatedCheckInCue(latestText));

    return messages;
  }
}
