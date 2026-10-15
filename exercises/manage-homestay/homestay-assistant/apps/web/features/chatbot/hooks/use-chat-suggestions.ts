import { useMemo } from "react";
import { useAgent, useSuggestions } from "@copilotkit/react-core/v2";

import {
  CHAT_SUGGESTIONS_AGENT_UPDATES,
  MAX_SUGGESTION_PILLS,
} from "@/features/chatbot/constants";
import { ChatSuggestion } from "@/features/chatbot/types";
import { normalize } from "@/features/chatbot/utils";

type UseChatSuggestionsOptions = {
  agentId: string;
};

export const useChatSuggestions = ({
  agentId,
}: UseChatSuggestionsOptions): ChatSuggestion[] => {
  const { agent } = useAgent({
    agentId,
    updates: [...CHAT_SUGGESTIONS_AGENT_UPDATES],
  });
  const { suggestions } = useSuggestions({ agentId });

  return useMemo(() => {
    // Match CopilotChatView: hide pills while the agent is running.
    // Clearing suggestion config alone leaves previously published pills in the store.
    if (agent.isRunning) {
      return [];
    }

    const seen = new Set<string>();
    return suggestions.reduce<ChatSuggestion[]>(
      (result, suggestion) => {
        const title = suggestion.title?.trim();
        const message = suggestion.message?.trim();

        if (!title || !message) {
          return result;
        }

        // UI-level deduplication:
        // same visible action = same suggestion.
        const key = normalize(title);

        if (seen.has(key)) {
          return result;
        }

        seen.add(key);

        result.push({
          id: key,
          label: title,
          prompt: message,
        });

        return result;
      },
      [],
    ).slice(0, MAX_SUGGESTION_PILLS);
  }, [agent.isRunning, suggestions]);
};
