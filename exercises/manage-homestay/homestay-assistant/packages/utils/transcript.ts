/**
 * Minimal message shape for turn-boundary selection.
 * Role is the only field required — works for AG-UI (`selectLatestUserTurn`)
 * and CopilotKit web transcripts (`find-room-turn`, tool-card suppression,
 * chat-visible tool calls).
 */
export type TranscriptMessage = {
  role?: string;
};

/**
 * Index of the last user message — start of the current agent turn.
 * Falls back to 0 when the transcript has no user message yet.
 */
export const getCurrentTurnStartIndex = <T extends TranscriptMessage>(
  messages: T[],
): number => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "user") {
      return index;
    }
  }

  return 0;
};

/**
 * Slice from the last user message through the end of the transcript.
 * When there is no user message, returns the full list (same as start index 0).
 *
 * Canonical “current turn” helper. AG-UI keeps `selectLatestUserTurn` as a
 * typed wrapper over this; web call sites import it directly.
 */
export const getCurrentTurn = <T extends TranscriptMessage>(
  messages: T[],
): T[] => messages.slice(getCurrentTurnStartIndex(messages));
