import {
  MASTRA_RESOURCE_ID_KEY,
  RequestContext,
} from "@mastra/core/request-context";
import { AGENT_KEYS } from "@repo/constants";
import type { ClientIdentity } from "@repo/schemas";
import { getAgentResourceId } from "@repo/utils";

import { REQUEST_CONTEXT_KEYS } from "./constants";
import type { MastraAuthContext } from "./authentication/authentication.types";
import type { PromptFlowHint } from "./prompt-flow-hint";

export const attachAuthToRequestContext = (
  requestContext: RequestContext,
  auth: MastraAuthContext,
): void => {
  requestContext.set(REQUEST_CONTEXT_KEYS.AUTH, auth);
  // Memory/threads persist as `${userId}:homestay-assistant`; keep that contract.
  requestContext.set(
    MASTRA_RESOURCE_ID_KEY,
    getAgentResourceId(auth.userId, AGENT_KEYS.HOMESTAY_ASSISTANT),
  );
};

type BuildRequestContextInput = {
  auth: MastraAuthContext;
  promptFlowHint?: PromptFlowHint;
  /** Reconciled browser identity — see middleware/client-identity.ts. */
  clientIdentity?: ClientIdentity;
};

export const buildAgentRequestContext = ({
  auth,
  promptFlowHint,
  clientIdentity,
}: BuildRequestContextInput): RequestContext => {
  const requestContext = new RequestContext();

  attachAuthToRequestContext(requestContext, auth);

  if (promptFlowHint) {
    requestContext.set(REQUEST_CONTEXT_KEYS.PROMPT_FLOW_HINT, promptFlowHint);
  }

  if (clientIdentity) {
    requestContext.set(REQUEST_CONTEXT_KEYS.CLIENT_IDENTITY, clientIdentity);
  }

  return requestContext;
};
