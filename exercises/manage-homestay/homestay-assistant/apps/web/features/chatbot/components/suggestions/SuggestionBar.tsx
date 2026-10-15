import {
  useAgent,
  useCopilotKit,
  UseAgentUpdate,
} from "@copilotkit/react-core/v2";
import {
  AGENT_KEYS,
  MESSAGE_ROLE,
  getBookingFormDisplayText,
  isBookingFormPrompt,
  parseBookingFormRoomId,
} from "@repo/constants";

import { CopilotSuggestion } from "@/features/chatbot/components/suggestions/CopilotSuggestion";
import { prepareBookingFormMessage } from "@/features/booking/utils";
import { ChatSuggestion } from "@/features/chatbot/types";
import { generateId } from "@/utils";
import {
  scheduleScrollChatToEnd,
  runAgentSafely,
  rejectIfAgentRunning,
} from "@/features/chatbot/utils";

type SuggestionBarProps = {
  suggestions: ChatSuggestion[];
  agentId?: string;
  threadId?: string;
};

const resolveOutboundPrompt = (prompt: string) => {
  if (!isBookingFormPrompt(prompt)) {
    return prompt;
  }

  const roomId = parseBookingFormRoomId(prompt);
  if (!roomId) {
    return prompt;
  }

  const display = getBookingFormDisplayText(prompt);
  const roomName = display.startsWith("Book ")
    ? display.slice("Book ".length).trim()
    : "this room";

  return prepareBookingFormMessage(roomId, roomName).message;
};

export const SuggestionBar = ({
  suggestions,
  agentId = AGENT_KEYS.HOMESTAY_ASSISTANT,
  threadId,
}: SuggestionBarProps) => {
  const { agent } = useAgent({
    agentId,
    updates: [UseAgentUpdate.OnRunStatusChanged],
  });

  const { copilotkit } = useCopilotKit();

  const handleSuggestionClick = async (prompt: string) => {
    if (rejectIfAgentRunning(agent.isRunning)) {
      return;
    }

    if (threadId) {
      agent.threadId = threadId;
    }

    agent.addMessage({
      id: generateId(),
      role: MESSAGE_ROLE.USER,
      content: resolveOutboundPrompt(prompt),
    });

    scheduleScrollChatToEnd("auto");

    try {
      await runAgentSafely(() => copilotkit.runAgent({ agent }));
    } finally {
      scheduleScrollChatToEnd("auto");
    }
  };

  if (agent.isRunning || !suggestions.length) {
    return null;
  }

  return (
    <div className="pointer-events-auto flex flex-wrap gap-2 px-4 pb-2">
      {suggestions.map((suggestion) => (
        <CopilotSuggestion
          key={suggestion.id}
          type="button"
          onClick={() => handleSuggestionClick(suggestion.prompt)}
        >
          {suggestion.label}
        </CopilotSuggestion>
      ))}
    </div>
  );
};
