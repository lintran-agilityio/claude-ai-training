export const formatPrice = (pricePerNight?: number) => {
  if (pricePerNight == null) {
    return null;
  }

  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(pricePerNight);
};

/** "1 guest" / "3 guests" — the one pluralization rule every guest-count label in the app should share. */
export const guestLabel = (count: number) => `${count} guest${count === 1 ? "" : "s"}`;

/** "1 night" / "3 nights". */
export const nightLabel = (count: number) => `${count} night${count === 1 ? "" : "s"}`;

export const countNightOfDates = (checkIn: string, checkOut: string) => {
  const start = new Date(`${checkIn}T00:00:00`);
  const end = new Date(`${checkOut}T00:00:00`);
  return Math.max(
    1,
    Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
  );
};

type BuildActionPromptArgs = {
  action: string;
  targetName: string;
  identifiers: Record<string, string>;
};

export const buildActionPrompt = ({
  action,
  targetName,
  identifiers,
}: BuildActionPromptArgs) => {
  const metadata = Object.entries(identifiers)
    .map(([key, value]) => `${key}: ${value}`)
    .join(". ");

  return `${action} ${targetName}. ${metadata}`;
};

const UI_ACTION_PROMPT_DISPLAY: Record<
  string,
  (targetName: string) => string
> = {
  "Show booking form for": (targetName) => `Book ${targetName}`,
  "Show detail room for": (targetName) => `View ${targetName}`,
};

/** Guest-facing label for UI-generated action prompts (hides roomId metadata). */
export const getUiActionPromptDisplayText = (content: string): string | null => {
  const trimmed = content.trim();
  for (const [action, formatDisplay] of Object.entries(UI_ACTION_PROMPT_DISPLAY)) {
    if (!trimmed.startsWith(action)) {
      continue;
    }

    const afterAction = trimmed.slice(action.length).trimStart();
    const dotIndex = afterAction.indexOf(".");
    const targetName =
      dotIndex === -1
        ? afterAction.replace(/\s*roomId:\s*.*$/i, "").trim()
        : afterAction.slice(0, dotIndex).trim();

    if (!targetName) {
      return null;
    }

    return formatDisplay(targetName);
  }

  return null;
};

/** Strip trailing punctuation/whitespace LLMs may include when parsing action prompts. */
export const sanitizeBookingId = (raw: string) =>
  raw.trim().replace(/[.,;\s]+$/g, "");

export const parseToolResult = <T>(
  result?: T | string | null,
): T | null => {
  if (result == null) {
    return null;
  }

  if (typeof result === "object") {
    return result;
  }

  try {
    const parsed = JSON.parse(result as string);

    return parsed && typeof parsed === "object"
      ? (parsed as T)
      : null;
  } catch {
    return null;
  }
};
