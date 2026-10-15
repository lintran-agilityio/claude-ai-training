import type { MastraDBMessage } from "@mastra/core/agent";
import type { Processor } from "@mastra/core/processors";
import { AGENT_MAX_USER_MESSAGE_TOKEN_LIMIT } from "@repo/constants";
import { extractMessageText, findLatestUserMessage } from "@/mastra/utils/latest-user-message";

const estimateTokens = (text: string) => Math.ceil(text.length / 4);

export class UserMessageTokenLimitProcessor implements Processor {
  id = "user-message-token-limit";

  name = "User Message Token Limit";

  processInput({
    messages,
    abort,
  }: {
    messages: MastraDBMessage[];
    abort: (reason?: string) => never;
  }) {
    const latestUserMessage = findLatestUserMessage(messages);

    if (!latestUserMessage) {
      return messages;
    }

    const text = extractMessageText(latestUserMessage);

    if (!text) {
      return messages;
    }

    const tokens = estimateTokens(text);

    if (tokens > AGENT_MAX_USER_MESSAGE_TOKEN_LIMIT) {
      abort(
        `User message exceeds token limit (${tokens} > ${AGENT_MAX_USER_MESSAGE_TOKEN_LIMIT}). Please shorten your message and try again.`,
      );
    }

    return messages;
  }
}
