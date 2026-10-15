import { z } from "zod";

/**
 * Browser-asserted identity, forwarded to the agent through CopilotKit v2
 * `<CopilotKitProvider properties={{ userId, locale, fullName }}>`. Core spreads
 * `properties` flat into AG-UI `forwardedProps` on every run (and HITL resume),
 * next to its own keys (`a2uiCatalogAvailable`, `a2uiAction`, `command`, …) —
 * parsing `forwardedProps` with this schema strips those.
 *
 * Trust boundary: the agent route handler reconciles `userId` against the
 * server-verified Clerk token before any field is used (see
 * apps/agent/src/mastra/middleware/client-identity.ts). Everything here is
 * advisory display data layered on top of the verified AUTH context — a greeting
 * name, the browser locale. None of it is ever an authorization or ownership
 * signal; booking APIs enforce that in Nest with the verified JWT.
 */
export const clientIdentitySchema = z.object({
  /** Clerk user id as the browser sees it. Must match the verified token. */
  userId: z.string().min(1),
  /**
   * Browser locale (`navigator.language`), a BCP 47 tag such as `vi-VN`. The
   * shape check keeps anything else out of the system prompt.
   */
  locale: z
    .string()
    .regex(/^[A-Za-z]{2,3}(-[A-Za-z0-9]{1,8})*$/)
    .nullish(),
  /** Full display name, for a natural greeting. */
  fullName: z.string().min(1).nullish(),
});

export type ClientIdentity = z.infer<typeof clientIdentitySchema>;
