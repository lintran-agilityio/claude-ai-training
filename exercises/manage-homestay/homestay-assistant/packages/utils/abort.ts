/**
 * Shared Stop / abort error classification for web UI and AG-UI stream handling.
 *
 * Prefer `error.name === "AbortError"`. Exact messages / codes cover platform /
 * fetch / Intelligence variants that omit that name. Keep lists here only —
 * duplicating them in apps breaks Stop classification when wording drifts.
 */

/** Default message for intentional user Stop (`throwIfAborted`). */
export const RUN_STOPPED_BY_USER_MESSAGE = "Run stopped by user" as const;

/**
 * Intelligence / AG-UI RUN_ERROR codes that mean Stop / runner teardown —
 * not a user-facing agent failure.
 */
export const AG_UI_STOP_ERROR_CODES = {
  STOPPED: "STOPPED",
  RUNNER_CONNECTION_DROPPED: "RUNNER_CONNECTION_DROPPED",
} as const;

export type AgUiStopErrorCode =
  (typeof AG_UI_STOP_ERROR_CODES)[keyof typeof AG_UI_STOP_ERROR_CODES];

export const isAgUiStopErrorCode = (
  code: string | null | undefined,
): code is AgUiStopErrorCode =>
  code === AG_UI_STOP_ERROR_CODES.STOPPED ||
  code === AG_UI_STOP_ERROR_CODES.RUNNER_CONNECTION_DROPPED;

/**
 * Exact messages treated as intentional Stop / abort when `name` is not
 * `AbortError` (fetch, AbortSignal, Intelligence runner, HITL).
 */
export const ABORT_LIKE_ERROR_MESSAGES = [
  "Fetch is aborted",
  "signal is aborted without reason",
  "Runner connection dropped",
  RUN_STOPPED_BY_USER_MESSAGE,
  "Human-in-the-loop interaction aborted",
] as const;

const ABORT_LIKE_ERROR_MESSAGE_SET: ReadonlySet<string> = new Set(
  ABORT_LIKE_ERROR_MESSAGES,
);

/**
 * True when an error/event message string is Stop / abort-like.
 * Prefer {@link isAbortError} when you have the thrown value.
 */
export const isAbortLikeErrorMessage = (
  message: string | null | undefined,
): boolean => {
  if (!message) {
    return false;
  }

  return ABORT_LIKE_ERROR_MESSAGE_SET.has(message) || /aborted/i.test(message);
};

const isAbortNamedError = (error: Error): boolean =>
  error.name === "AbortError";

/**
 * True when the error is an intentional abort (user Stop / runner teardown).
 * Safe for browser (`DOMException`) and Node (`Error`) abort shapes.
 */
export const isAbortError = (error: unknown): boolean => {
  if (typeof DOMException !== "undefined" && error instanceof DOMException) {
    return isAbortNamedError(error) || isAbortLikeErrorMessage(error.message);
  }

  if (!(error instanceof Error)) {
    return false;
  }

  return isAbortNamedError(error) || isAbortLikeErrorMessage(error.message);
};
