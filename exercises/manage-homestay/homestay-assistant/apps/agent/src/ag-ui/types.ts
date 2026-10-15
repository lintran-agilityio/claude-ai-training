import type { RequestContext } from "@mastra/core/request-context";
import type { BlockedMessageMetadata } from "@repo/constants";

export type AgUiToolCall = {
  id?: string;
};

/** Message content shapes we read in transcript filters. */
export type AgUiMessageContent =
  | string
  | Array<{ type?: string; text?: string }>
  | null
  | undefined;

export type AgUiMessage = {
  id?: string;
  role?: string;
  metadata?: BlockedMessageMetadata;
  content?: AgUiMessageContent;
  toolCalls?: AgUiToolCall[];
  toolCallId?: string;
};

export type MastraAgentLike = {
  getMemory?: (args: {
    requestContext?: RequestContext;
  }) => Promise<{
    getThreadById?: (args: { threadId: string }) => Promise<{
      title?: string;
      metadata?: Record<string, unknown>;
    } | null>;
    updateThread?: (args: {
      id: string;
      title: string;
      metadata: Record<string, unknown>;
    }) => Promise<unknown>;
  } | null>;
  stream?: (
    messages: unknown,
    options?: Record<string, unknown>,
  ) => Promise<unknown>;
  abortRunStream?: (runId: string) => boolean;
};

export type AgUiRunInput = {
  runId?: string;
  threadId?: string;
  messages?: AgUiMessage[];
  /** Opaque AG-UI run bag — vendor fields beyond runId/threadId/messages. */
  [key: string]: unknown;
};

export type AgUiStreamTextPartFn = (text: string) => void;
export type AgUiStreamFinishMessagePartFn = () => void;
export type AgUiStreamToolCallStartFn = (payload: {
  toolCallId: string;
  toolName: string;
}) => void;
export type AgUiStreamToolCallArgsFn = (payload: {
  toolCallId: string;
  argsTextDelta: string;
}) => void;
export type AgUiStreamToolCallEndFn = (payload: {
  toolCallId: string;
}) => void;
export type AgUiStreamRunFinishedFn = (
  traceId?: string,
) => void | Promise<void>;

/**
 * Callbacks we read/patch on @ag-ui/mastra processFullStream / streamMastraAgent.
 * Extra vendor callbacks remain allowed via index signature.
 */
export type AgUiStreamCallbacks = {
  onTextPart?: AgUiStreamTextPartFn;
  onFinishMessagePart?: AgUiStreamFinishMessagePartFn;
  onToolCallStart?: AgUiStreamToolCallStartFn;
  onToolCallArgs?: AgUiStreamToolCallArgsFn;
  onToolCallEnd?: AgUiStreamToolCallEndFn;
  onRunFinished?: AgUiStreamRunFinishedFn;
  [key: string]: unknown;
};

export type AgUiMastraAgent = {
  resourceId?: string;
  requestContext?: RequestContext;
  agent?: MastraAgentLike | null;
  processFullStream?: (
    stream: AsyncIterable<unknown>,
    callbacks: AgUiStreamCallbacks,
    excludedToolNames?: Set<string>,
    workingMemoryState?: Record<string, unknown>,
  ) => Promise<boolean>;
  streamMastraAgent?: (
    input: {
      threadId: string;
      messages: AgUiMessage[];
    },
    callbacks: AgUiStreamCallbacks,
  ) => Promise<unknown>;
  clone?: () => AgUiMastraAgent;
  run?: (input: AgUiRunInput) => unknown;
  /**
   * AbstractAgent.abortRun is a no-op; Intelligence runner stop relies on it.
   * We override it to abort the Mastra stream via abortSignal (not detachActiveRun,
   * which drops the Phoenix runner socket and surfaces RUNNER_CONNECTION_DROPPED).
   */
  abortRun?: () => void;
};

export type MastraStreamChunk = {
  type?: string;
  payload?: {
    reason?: string;
    processorId?: string;
    retry?: boolean;
    metadata?: Record<string, unknown>;
  };
};

/**
 * Type guard for Mastra fullStream tripwire chunks.
 */
export const isMastraTripwireChunk = (
  chunk: unknown,
): chunk is MastraStreamChunk & { type: "tripwire" } => {
  if (!chunk || typeof chunk !== "object" || Array.isArray(chunk)) {
    return false;
  }

  return (chunk as MastraStreamChunk).type === "tripwire";
};

/**
 * Small port so AG-UI stream wiring does not import Mastra memory loaders.
 * CopilotKit BFF injects the concrete loaders at `enableProcessorTripwireHandling`.
 */
export type ThreadMemoryPort = {
  loadBlockedMessageIds: (args: {
    mastraAgent: MastraAgentLike | null | undefined;
    threadId: string;
    requestContext?: RequestContext;
  }) => Promise<string[]>;

  loadRecalledMessageIds: (args: {
    mastraAgent: MastraAgentLike | null | undefined;
    threadId: string;
    resourceId: string | undefined;
    requestContext?: RequestContext;
  }) => Promise<{
    resolvedToolCallIds: ReadonlySet<string>;
    persistedMessageIds: ReadonlySet<string>;
  }>;
};
