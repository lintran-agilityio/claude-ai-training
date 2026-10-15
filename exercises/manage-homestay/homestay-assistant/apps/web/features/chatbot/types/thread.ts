import type { MessageRole } from "@repo/constants";

export type ChatThread = {
  id: string;
  agentId: string;
  name: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
  messageCount: number;
};

export type ChatToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type ChatMessage = {
  id: string;
  role: MessageRole;
  content: string;
  /** Required for AG-UI tool-result messages (`role: "tool"`). */
  toolCallId?: string;
  toolCalls?: ChatToolCall[];
  metadata?: {
    blocked?: boolean;
  };
};
