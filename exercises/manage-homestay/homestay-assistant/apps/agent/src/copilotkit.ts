import { MastraAgent } from "@ag-ui/mastra";
import type { RequestContext } from "@mastra/core/request-context";
import { AGENT_KEYS } from "@repo/constants";
import { getAgentResourceId } from "@repo/utils";

import {
  enableProcessorTripwireHandling,
  type ThreadMemoryPort,
} from "./ag-ui";
import { runtimeMastra } from "@/mastra/runtime";
import {
  loadBlockedMessageIdsForThread,
  loadRecalledMessageIdsForThread,
} from "@/mastra/utils";

export { runtimeMastra as mastra } from "@/mastra/runtime";
export { abortThreadRuns, latchThreadStop } from "./ag-ui";

type GetCopilotkitAgentsInput = {
  userId: string;
  requestContext?: RequestContext;
};

/** Mastra memory loaders — injected into AG-UI so the bridge stays free of `@/mastra` imports. */
const threadMemoryPort: ThreadMemoryPort = {
  loadBlockedMessageIds: loadBlockedMessageIdsForThread,
  loadRecalledMessageIds: loadRecalledMessageIdsForThread,
};

/**
 * CopilotKit BFF entry: adapt local Mastra agents to AG-UI.
 * Business tools / prompts stay in Mastra; this layer only bridges transport.
 */
export const getCopilotkitAgents = ({
  userId,
  requestContext,
}: GetCopilotkitAgentsInput) =>
  enableProcessorTripwireHandling(
    MastraAgent.getLocalAgents({
      mastra: runtimeMastra,
      resourceId: getAgentResourceId(userId, AGENT_KEYS.HOMESTAY_ASSISTANT),
      requestContext,
    }),
    threadMemoryPort,
  );
