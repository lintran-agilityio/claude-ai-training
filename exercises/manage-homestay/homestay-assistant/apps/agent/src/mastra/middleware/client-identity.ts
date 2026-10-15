import { RunAgentInputSchema } from "@ag-ui/core";
import { clientIdentitySchema, type ClientIdentity } from "@repo/schemas";

/**
 * Pulls the browser-asserted identity out of this request's AG-UI
 * `forwardedProps` — the flat `{ userId, locale, fullName }` set by
 * `<CopilotKitProvider properties>` on the web app (see
 * apps/web/features/chatbot/provider.tsx). The schema strips CopilotKit's own
 * keys (`a2uiCatalogAvailable`, `a2uiAction`, `command`, …) sharing that object.
 *
 * Fail-open, exactly like {@link detectPromptFlowHint}: a non-run request (GET
 * /info, /threads), a body that is not a RunAgentInput, a missing `userId` or a
 * malformed field — every miss silently yields `undefined`. Callers MUST still
 * reconcile `userId` against the verified Clerk token before trusting the
 * result (see {@link reconcileClientIdentity}).
 *
 * Reads its own `request.clone()` rather than sharing the parse with
 * detectPromptFlowHint — one extra JSON.parse of an in-memory body is cheaper
 * than threading a parsed value through, and keeps each detector independent.
 */
export const extractClientIdentity = async (
  request: Request,
): Promise<ClientIdentity | undefined> => {
  try {
    const body: unknown = await request.clone().json();
    const parsed = RunAgentInputSchema.safeParse(body);
    if (!parsed.success) return undefined;

    const identity = clientIdentitySchema.safeParse(
      parsed.data.forwardedProps,
    );
    return identity.success ? identity.data : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Client identity is trustworthy only insofar as its `userId` matches the
 * server-verified Clerk token for the same request. On a mismatch (a stale tab
 * whose session rotated, or tampering) the whole block is dropped — no field is
 * salvaged — and a warning is logged. An absent claim is not an error.
 */
export const reconcileClientIdentity = (
  claimed: ClientIdentity | undefined,
  verifiedUserId: string,
): ClientIdentity | undefined => {
  if (!claimed) return undefined;

  if (claimed.userId !== verifiedUserId) {
    console.warn(
      "[agent] client identity userId mismatch — ignoring forwarded identity",
    );
    return undefined;
  }

  return claimed;
};
