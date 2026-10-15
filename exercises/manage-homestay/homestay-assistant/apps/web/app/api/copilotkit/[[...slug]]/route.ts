import { auth } from "@clerk/nextjs/server";

import {
  CopilotKitIntelligence,
  CopilotRuntime,
  createCopilotRuntimeHandler,
} from "@copilotkit/runtime/v2";

import {
  abortThreadRuns,
  getCopilotkitAgents,
  latchThreadStop,
} from "agent/copilotkit";
import {
  getCurrentAgentRequest,
  runAgentRequestPipeline,
  runWithAgentRequest,
  toAgentRequestState,
} from "agent/middleware";
import {
  rewriteIntelligenceRealtimeUrlsInBody,
  shouldProxyIntelligenceRealtime,
} from "@/lib/rewrite-intelligence-ws-url";

export const runtime = "nodejs";

const basePath = "/api/copilotkit";

/**
 * On non-localhost hosts, point every managed realtime URL the runtime hands
 * the browser (`/info` intelligence.wsUrl, and the run / connect envelopes'
 * realtime.clientUrl) at the same-origin proxy in apps/web/server.mjs.
 *
 * Matched on the body rather than the path: only JSON responses are inspected,
 * and only the two known URL fields are touched, so a new endpoint that carries
 * a gateway URL is covered without another path allowlist.
 */
const maybeRewriteRealtimeUrls = async (
  req: Request,
  response: Response,
): Promise<Response> => {
  if (!shouldProxyIntelligenceRealtime(req)) {
    return response;
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    return response;
  }

  try {
    const body = await response.clone().json();
    const rewritten = rewriteIntelligenceRealtimeUrlsInBody(req, body);

    if (rewritten === body) {
      return response;
    }

    const headers = new Headers(response.headers);
    headers.delete("content-length");

    return Response.json(rewritten, {
      status: response.status,
      headers,
    });
  } catch {
    return response;
  }
};

const createRuntime = () => {
  const apiUrl = process.env.INTELLIGENCE_API_URL;
  const wsUrl = process.env.INTELLIGENCE_GATEWAY_WS_URL;
  const apiKey = process.env.INTELLIGENCE_API_KEY;

  if (!apiUrl || !wsUrl || !apiKey) {
    throw new Error(
      "Missing CopilotKit Intelligence env"
    );
  }

  const intelligence = new CopilotKitIntelligence({
    apiUrl,
    wsUrl,
    apiKey,
  });

  return new CopilotRuntime({
    intelligence,
    // Advertise A2UI on /info so the client mounts the surface renderer and the
    // run path applies A2UIMiddleware, which paints any tool result carrying
    // `{ a2ui_operations }` — the agent's `compare_rooms` tool builds that
    // RoomComparison envelope in code. `injectA2UITool: false` stops the
    // middleware injecting `render_a2ui` and forwarding the flag that makes the
    // Mastra bridge auto-inject `generate_a2ui`: that designer subagent never
    // receives tool results, so it invented rooms. The catalog itself is
    // supplied client-side via `a2ui={{ catalog }}` in
    // features/chatbot/provider.tsx.
    a2ui: { injectA2UITool: false },
    agents: async () => {
      const agentRequest = getCurrentAgentRequest();

      if (!agentRequest) {
        return {};
      }

      return getCopilotkitAgents({
        userId: agentRequest.auth.userId,
        requestContext: agentRequest.requestContext,
      });
    },
    identifyUser: () => {
      const agentRequest = getCurrentAgentRequest();

      if (!agentRequest?.auth.userId) {
        throw new Error("Authenticated user required for Intelligence threads");
      }

      return {
        id: agentRequest.auth.userId,
        name: agentRequest.auth.userId,
      };
    },
    generateThreadNames: true,
  });
}

// Singleton: the Intelligence runtime's runner tracks in-flight runs in an
// in-memory Map keyed by threadId. Rebuilding the runtime per request gives
// every request (including the later "stop" request) its own empty runner,
// so Stop can never find the run it's supposed to cancel — the server keeps
// generating and the client just reconnects to the still-running stream.
let copilotRuntimeInstance: ReturnType<typeof createRuntime> | undefined;

const getCopilotRuntime = () => {
  copilotRuntimeInstance ??= createRuntime();
  return copilotRuntimeInstance;
};

/**
 * Thread id of a `POST /agent/{agentId}/stop/{threadId}` request.
 *
 * The runner only reaches `agent.abortRun()` when a run is registered for the
 * thread. A visible generation is a chain of runs, so Stop frequently lands in
 * the gap between two of them and aborts nothing — the thread must be latched
 * from the request itself so the next run in the chain cannot continue.
 */
const stoppedThreadIdFromRequest = (req: Request): string | undefined => {
  if (req.method !== "POST") {
    return undefined;
  }

  const segments = new URL(req.url).pathname.split("/").filter(Boolean);
  const stopIndex = segments.lastIndexOf("stop");

  if (stopIndex < 0 || segments[stopIndex - 2] !== "agent") {
    return undefined;
  }

  const threadId = segments[stopIndex + 1];

  return threadId ? decodeURIComponent(threadId) : undefined;
};

const handler = async (req: Request) => {
  const stoppedThreadId = stoppedThreadIdFromRequest(req);

  if (stoppedThreadId) {
    latchThreadStop(stoppedThreadId);
    abortThreadRuns(stoppedThreadId);
  }

  const { userId, sessionId, getToken } = await auth();
  const sessionClerkToken = userId ? await getToken() : null;

  const pipeline = await runAgentRequestPipeline({
    request: req,
    sessionUserId: userId,
    sessionId,
    sessionClerkToken,
  });

  if (!pipeline.ok) {
    return Response.json(
      { error: pipeline.error },
      { status: pipeline.status },
    );
  }

  const dispatchCopilotRequest = createCopilotRuntimeHandler({
    runtime: getCopilotRuntime(),
    basePath,
  });

  const response = await runWithAgentRequest(toAgentRequestState(pipeline), () =>
    dispatchCopilotRequest(req),
  );

  return maybeRewriteRealtimeUrls(req, response);
};

export const GET = handler;

export const POST = handler;

export const PATCH = handler;

export const DELETE = handler;

export const OPTIONS = handler;
