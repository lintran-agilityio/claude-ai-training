"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth, useUser } from "@clerk/nextjs";
import {
  CopilotKitProvider,
  useCopilotKit,
  type CopilotKitProviderProps,
} from "@copilotkit/react-core/v2";

import { AGENT_URLS } from "@repo/constants";
import type { ClientIdentity } from "@repo/schemas";
import { ROUTES } from "@/constants";
import { homestayA2UICatalog } from "@/features/chatbot/declarative-ui/a2ui/homestay-a2ui-catalog";
import { RATE_LIMIT_MESSAGE } from "@/features/chatbot/constants";
import {
  isExpectedAgentError,
  isRateLimitAgentError,
} from "@/features/chatbot/utils/agent-run";
import { useChatStore } from "@/features/chatbot/stores/chat-store";
import { AppProvider } from "@/providers/app-provider";
import { AuthLoadingFallback } from "@/components/fallback";

type CopilotErrorEvent = Parameters<
  NonNullable<CopilotKitProviderProps["onError"]>
>[0];

type ChatbotProviderProps = {
  children: React.ReactNode;
};

const TOKEN_REFRESH_MS = 50_000;
const CLERK_TOKEN_HEADER = "x-clerk-token";

const isLoginRoute = (pathname: string) =>
  pathname === ROUTES.LOGIN || pathname.startsWith(`${ROUTES.LOGIN}/`);

/** BCP 47 browser locale (e.g. `vi-VN`); null outside the browser. */
const getBrowserLocale = () =>
  typeof navigator === "undefined" ? null : navigator.language || null;

/**
 * Replaces CopilotKit's built-in fallback logger so Stop / thread reset does
 * not log as a failure. Aborting a pending human-in-the-loop card rejects its
 * handler, which CopilotKit emits as `tool_handler_failed` — expected, not an
 * error. Post-Stop Intelligence 409 (thread locked) is also expected until the
 * platform lock TTL expires. Everything else keeps the library's original format.
 */
const handleCopilotError = (event: CopilotErrorEvent) => {
  if (isExpectedAgentError(event.error, event.code, event.context)) {
    return;
  }

  // Model-provider rate limit (e.g. Cerebras tokens-per-minute). Surface a
  // retriable notice in the chat footer instead of a raw console failure —
  // `handleCopilotError` is the one error sink that always fires, so own it here.
  if (isRateLimitAgentError(event.error, event.context)) {
    useChatStore.getState().setActionError(RATE_LIMIT_MESSAGE, {
      retriable: true,
    });
    console.warn(
      "[CopilotKit] Model provider rate limit:",
      event.error.message,
    );
    return;
  }

  console.error(
    `[CopilotKit] Error (${event.code}):`,
    event.error,
    event.context ?? {},
  );
};

/** Keeps rotating Clerk JWTs on an already-mounted CopilotKitProvider. */
const ClerkTokenSync = ({ initialToken }: { initialToken: string }) => {
  const { getToken } = useAuth();
  const { copilotkit } = useCopilotKit();
  const [token, setToken] = useState(initialToken);

  useEffect(() => {
    let cancelled = false;

    const sync = async () => {
      const next = await getToken();

      if (!cancelled && next) {
        setToken(next);
      }
    };

    const id = window.setInterval(() => {
      void sync();
    }, TOKEN_REFRESH_MS);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [getToken]);

  useEffect(() => {
    copilotkit.setHeaders({
      ...copilotkit.headers,
      [CLERK_TOKEN_HEADER]: token,
    });
  }, [copilotkit, token]);

  return null;
};

const ChatbotProvider = ({ children }: ChatbotProviderProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();
  const { isLoaded: isUserLoaded, user } = useUser();
  const fullName = user?.fullName || null;
  const [clerkToken, setClerkToken] = useState<string | null>(null);

  // Signing out flips isSignedIn before Clerk's own redirect lands, so the
  // previously-mounted page (bookings query, CopilotKit info fetch, etc.)
  // keeps running with a dead session and spams 401s. Bail out immediately.
  useEffect(() => {
    if (isLoaded && !isSignedIn && !isLoginRoute(pathname)) {
      router.replace(ROUTES.LOGIN);
    }
  }, [isLoaded, isSignedIn, pathname, router]);

  // Resolve the JWT before mounting CopilotKitProvider so the first /info
  // request already carries x-clerk-token (ClerkTokenSync alone races that fetch).
  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      setClerkToken(null);
      return;
    }

    let cancelled = false;

    const loadToken = async () => {
      const next = await getToken();

      if (!cancelled) {
        setClerkToken(next);
      }
    };

    void loadToken();

    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn]);

  // Stable reference — CopilotKitProvider's effect depends on `headers` and
  // re-runs setHeaders when the object identity changes every render.
  const headers = useMemo(
    () =>
      clerkToken ? { [CLERK_TOKEN_HEADER]: clerkToken } : null,
    [clerkToken],
  );

  // Rides every AG-UI run and HITL resume as flat `forwardedProps`; the agent
  // trusts it only after matching `userId` to the verified Clerk token (see
  // apps/agent/src/mastra/middleware/client-identity.ts). Stable reference for
  // the same reason as `headers` — a new one re-runs the provider effect, which
  // also re-applies `headers` over the token ClerkTokenSync rotated in.
  const properties = useMemo<ClientIdentity | null>(
    () => (userId ? { userId, locale: getBrowserLocale(), fullName } : null),
    [userId, fullName],
  );

  // Login has no Copilot hooks. Keep QueryClient for any shared client pages.
  if (isLoginRoute(pathname)) {
    return <AppProvider withCopilot={false}>{children}</AppProvider>;
  }

  // MainLayout / chat children call useCopilotKit() unconditionally.
  // Wait for Clerk session AND the first JWT so /api/copilotkit/info is not
  // fired unauthenticated (which leaves the registry empty → "agent not found").
  // Also wait for the Clerk user so `properties` is final before the first run.
  if (
    !isLoaded ||
    !isSignedIn ||
    !isUserLoaded ||
    !clerkToken ||
    !headers ||
    !properties
  ) {
    return (
      <AppProvider withCopilot={false}>
        <AuthLoadingFallback />
      </AppProvider>
    );
  }

  // CopilotKitProvider, not the v1-compat `CopilotKit` wrapper: that wrapper
  // strips `onError` before rendering the provider and only forwards it to a
  // cloud path that needs a publicApiKey, so the built-in console fallback can
  // never be replaced. Nothing here uses the v1 bridges it adds.
  return (
    <CopilotKitProvider
      credentials="include"
      runtimeUrl={AGENT_URLS.HOMESTAY_ASSISTANT}
      headers={headers}
      properties={properties}
      // Intelligence thread routes (/threads*) require REST transport.
      // Single-endpoint /info always reports threadEndpoints.list=false.
      useSingleEndpoint={false}
      // The catalog renders the RoomComparison surface the agent's
      // `compare_rooms` tool emits as a complete `a2ui_operations` envelope —
      // nothing streams in, so there is no "building" state to skin.
      a2ui={{ catalog: homestayA2UICatalog }}
      onError={handleCopilotError}
      // "auto" mounts the floating inspector only on localhost/127.0.0.1 and
      // evaluates to false everywhere else — safe to leave on in prod builds.
      showDevConsole="auto"
    >
      <ClerkTokenSync initialToken={clerkToken} />
      <AppProvider>{children}</AppProvider>
    </CopilotKitProvider>
  );
};

export default ChatbotProvider;
