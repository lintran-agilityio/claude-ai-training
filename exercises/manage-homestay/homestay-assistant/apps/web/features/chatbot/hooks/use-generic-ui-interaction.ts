"use client";

import { useAgent } from "@copilotkit/react-core/v2";
import { AGENT_KEYS } from "@repo/constants";

import {
  GENERIC_UI_INTERACTION,
  type GenericUiInteraction,
} from "@/features/chatbot/constants/generic-ui-interaction";
import {
  isGenericUiActionable,
  resolveGenericUiInteraction,
} from "@/features/chatbot/utils/generic-ui-interaction";

/**
 * Whether Generative UI for this tool call may show action chrome.
 * Derived from the transcript turn boundary — not feature-specific state.
 */
export const useGenericUiInteraction = (toolCallId?: string) => {
  const { agent } = useAgent({ agentId: AGENT_KEYS.HOMESTAY_ASSISTANT });
  const interaction: GenericUiInteraction = resolveGenericUiInteraction(
    agent.messages,
    toolCallId,
  );
  const isActionable = isGenericUiActionable(agent.messages, toolCallId);

  return {
    interaction,
    isActionable,
    isSuperseded: interaction === GENERIC_UI_INTERACTION.SUPERSEDED,
  };
};
