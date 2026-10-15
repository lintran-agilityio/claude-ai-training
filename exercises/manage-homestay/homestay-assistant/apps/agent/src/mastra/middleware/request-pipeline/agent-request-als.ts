import { AsyncLocalStorage } from "node:async_hooks";

import type { AgentRequestState } from "./request-pipeline.types";

const agentRequestStorage = new AsyncLocalStorage<AgentRequestState>();

export const getCurrentAgentRequest = (): AgentRequestState | undefined =>
  agentRequestStorage.getStore();

export const runWithAgentRequest = <T>(
  state: AgentRequestState,
  fn: () => T,
): T => agentRequestStorage.run(state, fn);
