import { randomUUID } from "node:crypto";

import { RequestContext } from "@mastra/core/request-context";
import { AGENT_KEYS } from "@repo/constants";
import type { ClientIdentity } from "@repo/schemas";
import { getAgentResourceId } from "@repo/utils";

import type { MastraAuthContext } from "@agent/mastra/middleware/authentication/authentication.types";
import { REQUEST_CONTEXT_KEYS } from "@agent/mastra/middleware/constants";
import { runWithAgentRequest } from "@agent/mastra/middleware/request-pipeline/agent-request-als";
// `runtime.ts` is the same Mastra instance apps/web's CopilotKit route uses
// (`getCopilotkitAgents` in src/copilotkit.ts) — evaluating this instance,
// not the Studio one in `mastra/index.ts`, is what makes these evals
// faithful to production behavior (same tools, prompts, processors,
// step-machine) without going through AG-UI/CopilotKit transport at all.
import { mastra } from "@agent/mastra/runtime";

import {
  buildResolvingHitlTools,
  HITL_CLIENT_TOOLS,
  type HitlResolution,
} from "./client-tools";
import { EVAL_USER_ID } from "./fixtures";

export const getHomestayAgent = () => {
  const agent = mastra.getAgent(AGENT_KEYS.HOMESTAY_ASSISTANT);
  if (!agent) {
    throw new Error(
      `Agent "${AGENT_KEYS.HOMESTAY_ASSISTANT}" is not registered on the runtime Mastra instance — check apps/agent/src/mastra/runtime.ts`,
    );
  }
  return agent;
};

const buildFakeAuth = (userId: string): MastraAuthContext => ({
  userId,
  clerkToken: `eval-fake-jwt-${userId}`,
});

export type AgentTurnOptions = {
  /** Reuse a thread id to simulate a multi-turn conversation; defaults to a fresh thread per call. */
  threadId?: string;
  userId?: string;
  /**
   * Resolve every HITL card IN-TURN instead of stopping the turn at it —
   * `"confirm"` clicks confirm, `"decline"` dismisses. Omit for the default
   * emit-and-stop behavior (`HITL_CLIENT_TOOLS`). See `client-tools.ts` for
   * why this switches the tools from `clientTools` to `toolsets`.
   */
  hitlResolution?: HitlResolution;
  /**
   * Simulates the browser-forwarded `ClientIdentity` (see
   * `withGuestContext`/`getClientIdentity`) so a case can exercise the
   * per-guest `## GUEST` system-prompt block. Every other eval leaves this
   * unset — matching production's `forwardedProps`-absent default — so this
   * option cannot shift any other case's deterministic behavior. Currently
   * only used by `prompt-cache.eval.ts`.
   */
  identity?: ClientIdentity;
};

/**
 * Runs one user message through the real homestay agent — real system
 * prompt, real tools, real input/output processors, real booking
 * step-machine. Only the outbound HTTP calls to apps/api are faked (see
 * `fake-api.ts`); callers must have `installFakeApi()` active first.
 *
 * Auth is set both on the `requestContext` passed to `generate()` and via
 * `runWithAgentRequest` (AsyncLocalStorage) because
 * `services/common.ts::resolveAuthForApi` checks the former first and falls
 * back to the latter — mirroring how the request-pipeline middleware
 * populates both in production, without going through that middleware.
 */
export const runAgentTurn = async (
  message: string,
  options: AgentTurnOptions = {},
) => {
  const userId = options.userId ?? EVAL_USER_ID;
  const threadId = options.threadId ?? `eval-${randomUUID()}`;
  const resourceId = getAgentResourceId(userId, AGENT_KEYS.HOMESTAY_ASSISTANT);

  const auth = buildFakeAuth(userId);
  const requestContext = new RequestContext();
  requestContext.set(REQUEST_CONTEXT_KEYS.AUTH, auth);
  if (options.identity) {
    requestContext.set(REQUEST_CONTEXT_KEYS.CLIENT_IDENTITY, options.identity);
  }

  const agent = getHomestayAgent();

  // Default: HITL tools as `clientTools` with no `execute` — the turn stops at
  // the card (what "never mutates before the gate" evals assert). When
  // `hitlResolution` is set, the same tools go in via `toolsets` WITH an
  // `execute` that answers the card in-turn, so the whole chain through the
  // terminal mutation runs in one call (see client-tools.ts).
  const hitlToolOptions = options.hitlResolution
    ? { toolsets: { hitl: buildResolvingHitlTools(options.hitlResolution) } }
    : { clientTools: HITL_CLIENT_TOOLS };

  const result = await runWithAgentRequest({ auth, requestContext }, () =>
    agent.generate(message, {
      memory: { thread: threadId, resource: resourceId },
      requestContext,
      ...hitlToolOptions,
    }),
  );

  return { result, threadId, resourceId };
};
