import type { RequestContext } from "@mastra/core/request-context";

import type { MastraAuthContext } from "../authentication/authentication.types";

export type { MastraAuthContext };

export type AgentRequestState = {
  auth: MastraAuthContext;
  requestContext: RequestContext;
};

export type AgentRequestPipelineSuccess = {
  ok: true;
} & AgentRequestState;

export type AgentRequestPipelineFailure = {
  ok: false;
  status: 401;
  error: string;
};

export type AgentRequestPipelineResult =
  | AgentRequestPipelineSuccess
  | AgentRequestPipelineFailure;
