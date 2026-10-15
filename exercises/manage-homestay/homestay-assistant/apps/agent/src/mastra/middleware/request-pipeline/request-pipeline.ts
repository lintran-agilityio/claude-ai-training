import type {
  AgentRequestPipelineResult,
  AgentRequestPipelineSuccess,
  AgentRequestState,
} from "./request-pipeline.types";
import { buildAgentRequestContext } from "../build-request-context";
import {
  extractClientIdentity,
  reconcileClientIdentity,
} from "../client-identity";
import { AUTH_ERRORS } from "../constants";
import { detectPromptFlowHint } from "../prompt-flow-hint";
import { extractClerkToken, verifyClerkAuth } from "../verify-clerk-auth";

export { getCurrentAgentRequest, runWithAgentRequest } from "./agent-request-als";

type RunAgentRequestPipelineInput = {
  request: Request;
  sessionUserId?: string | null;
  sessionId?: string | null;
  /**
   * JWT from Clerk session (`auth().getToken()`), used when the request does
   * not carry `x-clerk-token` / Authorization — required for Nest forwarding.
   */
  sessionClerkToken?: string | null;
};

export const runAgentRequestPipeline = async ({
  request,
  sessionUserId,
  sessionId,
  sessionClerkToken,
}: RunAgentRequestPipelineInput): Promise<AgentRequestPipelineResult> => {
  // Prefer a fresh server-side session JWT over the browser `x-clerk-token`
  // header — CopilotKit may forward a stale client token that Nest rejects.
  const clerkToken =
    sessionClerkToken?.trim() || extractClerkToken(request) || null;

  const result = await verifyClerkAuth({
    clerkToken,
    sessionUserId,
    sessionId,
  });

  if (!result.ok) {
    return {
      ok: false,
      status: result.failure.status,
      error: result.failure.error,
    };
  }

  // Nest booking APIs require a forwardable JWT; session userId alone is not enough.
  if (!result.auth.clerkToken?.trim()) {
    return {
      ok: false,
      status: 401,
      error: AUTH_ERRORS.REQUIRED,
    };
  }

  const promptFlowHint = await detectPromptFlowHint(request);

  const clientIdentity = reconcileClientIdentity(
    await extractClientIdentity(request),
    result.auth.userId,
  );

  const requestContext = buildAgentRequestContext({
    auth: result.auth,
    promptFlowHint,
    clientIdentity,
  });

  return {
    ok: true,
    auth: result.auth,
    requestContext,
  };
};

export const toAgentRequestState = (
  result: AgentRequestPipelineSuccess,
): AgentRequestState => ({
  auth: result.auth,
  requestContext: result.requestContext,
});
