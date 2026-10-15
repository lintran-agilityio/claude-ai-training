const RETRYABLE_ERROR_CODES = new Set(["ECONNRESET", "EPIPE", "ETIMEDOUT"]);
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 150;

const getErrorCode = (error: Error): string | undefined =>
  "code" in error && typeof error.code === "string" ? error.code : undefined;

const isRetryableError = (error: Error): boolean => {
  if (!(error instanceof TypeError) || !(error.cause instanceof Error)) {
    return false;
  }

  const code = getErrorCode(error.cause);
  return Boolean(code && RETRYABLE_ERROR_CODES.has(code));
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * fetch wrapper that retries transient connection-reset errors, which happen
 * when the local Nest API restarts (`nest start --watch`) mid-request.
 */
export const fetchResilient = async (
  input: string | URL,
  init?: RequestInit,
): Promise<Response> => {
  let attempt = 0;

  for (;;) {
    try {
      return await fetch(input, init);
    } catch (error) {
      if (
        !(error instanceof Error) ||
        attempt >= MAX_RETRIES ||
        !isRetryableError(error)
      ) {
        throw error;
      }
      attempt += 1;
      await delay(RETRY_DELAY_MS * attempt);
    }
  }
};
