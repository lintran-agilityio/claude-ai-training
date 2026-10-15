import { getAgentResourceId } from "@repo/utils";
import { AGENT_KEYS } from "@repo/constants";

import type { ContextWithMastra } from "@mastra/core/server";

import { attachAuthToRequestContext } from "../build-request-context";
import { extractClerkToken, verifyClerkAuth } from "../verify-clerk-auth";
import type { MastraMiddlewareHandler } from "../server-middleware.types";
import type { MastraAuthContext } from "./authentication.types";

export const authenticateRequest = async (
  context: ContextWithMastra,
) => {
  return verifyClerkAuth({
    clerkToken: extractClerkToken(context.req.raw),
  });
};

export const authenticationMiddleware: MastraMiddlewareHandler = async (
  context,
  next,
) => {
  const result = await authenticateRequest(context);

  if (!result.ok) {
    return context.json({ error: result.failure.error }, result.failure.status);
  }

  attachAuthToRequestContext(context.get("requestContext"), result.auth);
  await next();
};

export const createMastraServerAuthConfig = () => ({
  authenticateToken: async (token: string) => {
    const result = await verifyClerkAuth({ clerkToken: token });
    return result.ok ? result.auth : null;
  },
  mapUserToResourceId: (auth: MastraAuthContext) =>
    getAgentResourceId(auth.userId, AGENT_KEYS.HOMESTAY_ASSISTANT),
  protected: ["/api/*"],
});
