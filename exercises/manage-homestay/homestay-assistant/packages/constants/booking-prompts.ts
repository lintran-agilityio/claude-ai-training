import {
  BOOKING_CANCEL_CONFIRM_PROMPT_PREFIX,
  BOOKING_CANCEL_METADATA_SEPARATOR,
  BOOKING_CANCEL_PROMPT_PREFIX,
  BOOKING_FORM_PROMPT_PREFIX,
  BOOKING_MODIFY_PROMPT_PREFIX,
  BOOKING_STAY_PROMPT_PREFIX,
} from "./prompt-tags.js";

export const isBookingCancelPrompt = (content: string) =>
  content.startsWith(BOOKING_CANCEL_PROMPT_PREFIX) &&
  !content.startsWith(BOOKING_CANCEL_CONFIRM_PROMPT_PREFIX);

export const isBookingModifyPrompt = (content: string) =>
  content.startsWith(BOOKING_MODIFY_PROMPT_PREFIX);

export const isBookingFormPrompt = (content: string) =>
  content.startsWith(BOOKING_FORM_PROMPT_PREFIX);

export const isBookingStayPrompt = (content: string) =>
  content.startsWith(BOOKING_STAY_PROMPT_PREFIX);

const BOOKING_ID_PREFIX = /^bookingId:\s*[^.]+\.\s*/;
const BOOKING_STAY_METADATA_PREFIX =
  /^roomId:\s*[^.]+\.\s*checkInDate:\s*\S+\.\s*checkOutDate:\s*\S+\.\s*guests:\s*\d+\.\s*/i;

export const getBookingCancelDisplayText = (content: string): string => {
  if (!isBookingCancelPrompt(content)) {
    return content;
  }

  const withoutPrefix = content
    .slice(BOOKING_CANCEL_PROMPT_PREFIX.length)
    .trimStart();
  const separatorIndex = withoutPrefix.indexOf(BOOKING_CANCEL_METADATA_SEPARATOR);
  const withoutBookingId = withoutPrefix.replace(BOOKING_ID_PREFIX, "");

  if (separatorIndex === -1) {
    return withoutBookingId.trim();
  }

  return withoutBookingId.slice(0, separatorIndex).trim();
};

export const getBookingModifyDisplayText = (content: string): string => {
  if (!isBookingModifyPrompt(content)) {
    return content;
  }

  const withoutPrefix = content
    .slice(BOOKING_MODIFY_PROMPT_PREFIX.length)
    .trimStart();

  return withoutPrefix.replace(BOOKING_ID_PREFIX, "").trim();
};

/** Trailing agent metadata on `[book-form]` prompts (roomId + optional artifactId). */
const BOOKING_FORM_METADATA_SUFFIX =
  /\.\s*roomId:\s*[^.]+\.(?:\s*artifactId:\s*[^.]+\.?)?\s*$/i;

export const parseBookingFormArtifactId = (
  content: string,
): string | null => {
  if (!isBookingFormPrompt(content)) {
    return null;
  }

  const match = content.match(/\bartifactId:\s*([^\s.]+)/i);
  return match?.[1] ?? null;
};

export const parseBookingFormRoomId = (content: string): string | null => {
  if (!isBookingFormPrompt(content)) {
    return null;
  }

  const match = content.match(/\broomId:\s*([^\s.]+)/i);
  return match?.[1] ?? null;
};

export const getBookingFormDisplayText = (content: string): string => {
  if (!isBookingFormPrompt(content)) {
    return content;
  }

  const withoutPrefix = content
    .slice(BOOKING_FORM_PROMPT_PREFIX.length)
    .trimStart();
  const withoutMetadata = withoutPrefix.replace(
    BOOKING_FORM_METADATA_SUFFIX,
    "",
  );

  if (withoutMetadata.startsWith("Show booking form for ")) {
    const name = withoutMetadata
      .slice("Show booking form for ".length)
      .replace(/\.$/, "")
      .trim();
    return name ? `Book ${name}` : withoutMetadata.trim();
  }

  return withoutMetadata.trim();
};

export const getBookingStayDisplayText = (content: string): string => {
  if (!isBookingStayPrompt(content)) {
    return content;
  }

  const withoutPrefix = content
    .slice(BOOKING_STAY_PROMPT_PREFIX.length)
    .trimStart();

  return withoutPrefix.replace(BOOKING_STAY_METADATA_PREFIX, "").trim();
};
