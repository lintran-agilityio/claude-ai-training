import { Agent } from "@mastra/core/agent";
import { ProviderHistoryCompat } from "@mastra/core/processors";
import { Memory } from "@mastra/memory";
import { PinoLogger } from "@mastra/loggers";

import {
  AGENT_KEYS,
  AGENT_MEMORY_LAST_MESSAGES,
  AGENT_MAX_OUTPUT_TOKEN_LIMIT,
  TOOL_KEYS,
} from "@repo/constants";
import {
  buildHomestayAssistantPrompt,
  getClientIdentity,
  logPromptCacheUsage,
  withDateContext,
  withGuestContext,
} from "@/mastra/utils";
import {
  AI_MODEL,
  BOOKING_WORKING_MEMORY_TEMPLATE,
  IS_CEREBRAS_MODEL,
  IS_OPENAI_MODEL,
} from "@/mastra/constants";
import { REQUEST_CONTEXT_KEYS } from "@/mastra/middleware/constants";
import type { PromptFlowHint } from "@/mastra/middleware/prompt-flow-hint";
import {
  cancelBookingTool,
  createBookingTool,
  findBookingByIdTool,
  findBookingsTool,
  getBookingsTool,
  updateBookingTool,
} from "@/mastra/tools/booking";
import {
  compareRoomsTool,
  findRoomTool,
  getRoomByIdTool,
  getRoomsTool,
} from "@/mastra/tools/rooms";
import { securityInputProcessor } from "@/mastra/processors/security-input.processors";
import { BookingFormPrefillProcessor } from "@/mastra/processors/booking-form-prefill.processor";
import { CompareRoomsCandidatesProcessor } from "@/mastra/processors/compare-rooms-candidates.processor";
import { logOpenAIMissingItemRule } from "@/mastra/processors/log-openai-missing-item.rule";
import { enforceBookingStep } from "@/mastra/utils/step-machine";

const agentSetupLogger = new PinoLogger({
  name: "HomestayAssistant",
  level: "debug",
});
agentSetupLogger.debug("Resolved AI_MODEL", { AI_MODEL });

export const homestayAssistant = new Agent({
  id: AGENT_KEYS.HOMESTAY_ASSISTANT,
  name: "Homestay Assistant",
  description:
    "Public chat agent that coordinates room discovery and booking flows (prompt-guided tool routing + HITL).",
  // Per-request/per-guest content (DATE CONTEXT, GUEST) must stay OUTSIDE and
  // AFTER buildHomestayAssistantPrompt's static, request-independent sections
  // — that keeps the system prompt's prefix byte-identical across guests and
  // days, which is what lets OpenAI's (and Anthropic's) prompt caching share
  // a cache entry across different guests/threads instead of writing a fresh
  // one per request. See withDateContext / withGuestContext, and
  // constants/prompts/PROMPT_CACHING.md for the full invariant.
  instructions: ({ requestContext }) =>
    withGuestContext(
      withDateContext(
        buildHomestayAssistantPrompt(
          requestContext.get(REQUEST_CONTEXT_KEYS.PROMPT_FLOW_HINT) as
            | PromptFlowHint
            | undefined,
        ),
      ),
      getClientIdentity(requestContext),
    ),
  model: AI_MODEL,
  // Rate-limit responses are transient; Mastra applies bounded backoff retries.
  maxRetries: 2,
  defaultOptions: {
    prepareStep: enforceBookingStep,
    modelSettings: {
      maxOutputTokens: AGENT_MAX_OUTPUT_TOKEN_LIMIT,
    },
    onStepFinish: logPromptCacheUsage,
    // OpenAI direct only (not `openrouter/openai/…`, which isn't eligible —
    // see IS_OPENAI_MODEL). A fixed key across every request lets OpenAI
    // route same-prefix requests to the same cache lookup more reliably;
    // see the instructions comment above for why the prefix stays stable.
    ...(IS_OPENAI_MODEL && {
      providerOptions: {
        openai: { promptCacheKey: AGENT_KEYS.HOMESTAY_ASSISTANT },
      },
    }),
  },
  tools: {
    [TOOL_KEYS.GET.ROOMS]: getRoomsTool,
    [TOOL_KEYS.GET.FIND_ROOM]: findRoomTool,
    [TOOL_KEYS.GET.COMPARE_ROOMS]: compareRoomsTool,
    [TOOL_KEYS.BOOKING.GET_ROOM_BY_ID]: getRoomByIdTool,
    [TOOL_KEYS.BOOKING.CREATE_BOOKING]: createBookingTool,
    [TOOL_KEYS.BOOKING.UPDATE_BOOKING]: updateBookingTool,
    [TOOL_KEYS.BOOKING.GET]: getBookingsTool,
    [TOOL_KEYS.BOOKING.FIND]: findBookingsTool,
    [TOOL_KEYS.BOOKING.FIND_BY_ID]: findBookingByIdTool,
    [TOOL_KEYS.BOOKING.CANCEL]: cancelBookingTool,
  },
  inputProcessors: [
    ...securityInputProcessor,
    new BookingFormPrefillProcessor(),
    new CompareRoomsCandidatesProcessor(),
    // Cerebras only (gpt-oss-120b is a reasoning model). @ai-sdk/openai-compatible
    // serializes assistant `reasoning` parts from recalled history as
    // `reasoning_content`, which Cerebras's API rejects (HTTP 400,
    // "property 'messages.N.assistant.reasoning_content' is unsupported").
    // The built-in `cerebras-strip-reasoning-content` rule drops those parts
    // from the outbound prompt only (memory / UI keep the full trace). OpenAI
    // has no such history, so the processor is skipped there.
    ...(IS_CEREBRAS_MODEL ? [new ProviderHistoryCompat()] : []),
    // OpenAI Responses rejects recalled `fc_…` item ids it no longer stores
    // (`Item with id 'fc_…' not found`). Log-only rule: records which recalled
    // messages carry those ids; it does not mutate history or retry.
    ...(IS_OPENAI_MODEL
      ? [
          new ProviderHistoryCompat({
            additionalRules: [logOpenAIMissingItemRule],
          }),
        ]
      : []),
  ],
  memory: new Memory({
    options: {
      lastMessages: AGENT_MEMORY_LAST_MESSAGES,
      workingMemory: {
        enabled: true,
        scope: "thread",
        template: BOOKING_WORKING_MEMORY_TEMPLATE,
      },
    },
  }),
});
