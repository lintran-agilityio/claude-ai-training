/**
 * Chat transcript message roles (AG-UI / CopilotKit / Mastra all agree on
 * this vocabulary at the wire level). Single source of truth so FE/BE
 * transcript utilities compare against these instead of duplicating the
 * raw strings.
 */
export const MESSAGE_ROLE = {
  USER: "user",
  ASSISTANT: "assistant",
  SYSTEM: "system",
  TOOL: "tool",
} as const;

export type MessageRole = (typeof MESSAGE_ROLE)[keyof typeof MESSAGE_ROLE];
