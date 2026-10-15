/**
 * JSON-serializable value union for tool args/results before per-tool schema parse.
 * Prefer this over `unknown` for normalized step/message shells.
 */
export type JsonObject = { [key: string]: JsonValue };

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | JsonObject;

/** Values `JSON.stringify` drops from an object (and writes as `null` in an array). */
const isOmittedByJson = (value: unknown): boolean =>
  value === undefined ||
  typeof value === "function" ||
  typeof value === "symbol";

/**
 * Narrows a value to JsonValue when it is JSON-serializable; otherwise undefined.
 *
 * Follows `JSON.stringify` for the values it skips: an object property holding
 * `undefined` / a function / a symbol is omitted, and such an array element
 * becomes `null`. Live Mastra messages routinely carry these — a HITL answer
 * merged in from an AG-UI `tool` message lands as a `tool-invocation` part with
 * `step: undefined`, and a tool output can hold an optional key set to
 * `undefined`. Rejecting the whole value over one such key made the booking
 * step machine skip every message a HITL answer touched, so nothing after the
 * first guest click was ever forced.
 */
export const asJsonValue = (value: unknown): JsonValue | undefined => {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    const items: JsonValue[] = [];
    for (const item of value) {
      if (isOmittedByJson(item)) {
        items.push(null);
        continue;
      }
      const parsed = asJsonValue(item);
      if (parsed === undefined) {
        return undefined;
      }
      items.push(parsed);
    }
    return items;
  }

  if (value && typeof value === "object") {
    const record: JsonObject = {};
    for (const [key, entry] of Object.entries(value)) {
      if (isOmittedByJson(entry)) {
        continue;
      }
      const parsed = asJsonValue(entry);
      if (parsed === undefined) {
        return undefined;
      }
      record[key] = parsed;
    }
    return record;
  }

  return undefined;
};

export const isJsonObject = (
  value: JsonValue | undefined | null,
): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Narrows a JSON value to a plain object. Also accepts a JSON-string object,
 * matching the string form that sometimes arrives on tool results.
 */
export const asRecord = (
  value: JsonValue | undefined | null,
): JsonObject | null => {
  if (isJsonObject(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(value);
    const jsonValue = asJsonValue(parsed);
    return isJsonObject(jsonValue) ? jsonValue : null;
  } catch {
    return null;
  }
};

/**
 * Narrows an arbitrary unknown value (not yet a JsonValue) to a plain object,
 * combining `asJsonValue` + `asRecord`. Use this for raw tool input/output
 * fields typed `unknown`; use `asRecord` directly when already a JsonValue.
 */
export const asUnknownRecord = (value: unknown): JsonObject | null =>
  asRecord(asJsonValue(value));
