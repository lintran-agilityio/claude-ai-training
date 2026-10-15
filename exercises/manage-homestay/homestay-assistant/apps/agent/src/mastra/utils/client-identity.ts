import type { RequestContext } from "@mastra/core/request-context";
import type { ClientIdentity } from "@repo/schemas";

import { REQUEST_CONTEXT_KEYS } from "@/mastra/middleware/constants";

/**
 * Reads the reconciled browser identity for this run from request context, or
 * `undefined` when the request carried none (or one that failed reconciliation).
 *
 * The value was schema-validated and userId-matched against the verified Clerk
 * token in the request pipeline before it was set, so this is a bare read — no
 * re-parse, mirroring `getAuthFromContext` in services/common.ts.
 *
 * Advisory only: use it to greet the guest by name or read their browser
 * locale. Never use it to decide which bookings are theirs — resolve those
 * through tools, which carry the verified JWT.
 */
export const getClientIdentity = (
  requestContext: RequestContext | undefined,
): ClientIdentity | undefined =>
  (requestContext?.get(REQUEST_CONTEXT_KEYS.CLIENT_IDENTITY) as
    | ClientIdentity
    | undefined) ?? undefined;
