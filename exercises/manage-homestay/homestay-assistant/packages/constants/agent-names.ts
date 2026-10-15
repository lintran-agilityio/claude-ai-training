/**
 * Canonical agent id registry for CopilotKit + Mastra.
 * Prefer importing from here; `agent-keys` remains a shim.
 */
export const AGENT_KEYS = {
  HOMESTAY_ASSISTANT: "homestay-assistant",
} as const;

export const AGENT_URLS = {
  HOMESTAY_ASSISTANT: "/api/copilotkit",
} as const;

