import { UseAgentUpdate } from "@copilotkit/react-core/v2";

/**
 * Agent store subscriptions for suggestion UI.
 * Swap entries here to change when pills refresh (hook + StaticSuggestionConfig).
 */
export const CHAT_SUGGESTIONS_AGENT_UPDATES = [
  UseAgentUpdate.OnRunStatusChanged,
] as const;
