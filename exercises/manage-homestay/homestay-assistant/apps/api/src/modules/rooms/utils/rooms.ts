/**
 * Coerces a query value to a finite number, or undefined when empty/invalid.
 *
 * @param value - Raw query value (number or string from querystring)
 * @returns Parsed number, or undefined when not usable
 */
export const toOptionalNumber = (
  value?: number | string,
): number | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};
