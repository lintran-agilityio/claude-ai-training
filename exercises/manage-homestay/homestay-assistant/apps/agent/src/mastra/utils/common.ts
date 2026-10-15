// Types
import type { JsonValue } from "./json-value";

/**
 * Coerces a JSON field into a positive integer (e.g. guests, capacity).
 *
 * @param value - Numeric JSON field from a tool result
 * @returns Positive integer, or undefined when invalid
 */
export const asPositiveInt = (
  value: JsonValue | undefined,
): number | undefined => {
  const n = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    return undefined;
  }

  return n;
};

/**
 * Coerces a JSON field into a non-empty trimmed string.
 *
 * @param value - String JSON field from a tool result or message
 * @returns Trimmed string, or undefined when missing/blank
 */
export const asNonEmptyString = (
  value: JsonValue | undefined,
): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};
