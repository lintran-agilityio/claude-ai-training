/**
 * Loose transcript shapes shared by chat normalize / booking derive / picker utils.
 * Permissive optional fields — only what parsers actually read.
 */

import type { BlockedMessageMetadata } from "@repo/constants";

/** JSON string, parsed object, or empty — the shapes tool args arrive in. */
export type ToolArgumentsLike = string | object | null | undefined;

export type ToolCallLike = {
  id?: string;
  type?: string;
  name?: string;
  function?: {
    name?: string;
    /** CopilotKit may leave args as a JSON string or a parsed object until normalize. */
    arguments?: ToolArgumentsLike;
  };
  /** AG-UI / OpenAI-style */
  arguments?: ToolArgumentsLike;
  /** AI SDK tool-call shape */
  args?: ToolArgumentsLike;
};

export type MessageContentPart = {
  type?: string;
  text?: string;
};

export type MessageContentLike =
  | string
  | MessageContentPart[]
  | object
  | null
  | undefined;

export type MessageLike = {
  id?: string;
  role?: string;
  content?: MessageContentLike;
  toolCallId?: string;
  toolCalls?: ToolCallLike[];
  metadata?: BlockedMessageMetadata;
};
