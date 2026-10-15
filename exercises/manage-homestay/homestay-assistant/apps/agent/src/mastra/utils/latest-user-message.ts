import type { MastraDBMessage } from "@mastra/core/agent";
import { MESSAGE_ROLE } from "@repo/constants";

/** Concatenated text parts of a message, falling back to raw string content. */
export const extractMessageText = (message: MastraDBMessage): string => {
  let text = "";
  const { content, parts } = message.content;
  if (message.content.parts) {
    for (const part of parts) {
      if (
        part.type === "text" &&
        "text" in part &&
        typeof part.text === "string"
      ) {
        text += `${part.text} `;
      }
    }
  }

  if (!text.trim() && typeof content === "string") {
    text = content;
  }

  return text.trim();
};

/** Most recent guest-authored message, scanning backward. */
export const findLatestUserMessage = (
  messages: MastraDBMessage[],
): MastraDBMessage | undefined => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (message?.role === MESSAGE_ROLE.USER) {
      return message;
    }
  }

  return undefined;
};
