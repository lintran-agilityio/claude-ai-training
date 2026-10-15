/**
 * Rewrites CopilotKit Intelligence realtime URLs to the same-origin proxy
 * served by apps/web/server.mjs.
 *
 * The runtime hands the browser a managed gateway URL in three responses:
 *   - `GET  /info`                    → `intelligence.wsUrl` (thread metadata socket)
 *   - `POST /agent/{id}/run`          → `realtime.clientUrl` (run socket)
 *   - `POST /agent/{id}/connect`      → `realtime.clientUrl` (resume socket)
 * All of them must point at the proxy: the managed gateway enforces a Phoenix
 * check_origin allowlist that only accepts localhost origins, so any other
 * browser Origin is rejected with 403 before auth is considered.
 *
 * Localhost keeps the managed URL — Phoenix already allows that Origin.
 */

const PROXY_SUFFIX = "/api/intelligence-realtime/client";

const isLocalHost = (host: string): boolean => {
  const hostname = host.split(":")[0]?.toLowerCase() ?? "";

  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]"
  );
};

/**
 * Hosts this deployment is actually reachable at. `x-forwarded-host` (and,
 * behind Fly's proxy, `host` itself) is client-suppliable and must not be
 * trusted as-is: it's what decides the WS URL we hand back to the browser,
 * so an unchecked value lets a request pick an arbitrary host for that URL.
 * Defaults to the Fly app's own domain (see fly.web.toml); override/extend
 * with a comma-separated ALLOWED_PUBLIC_HOSTS for custom domains.
 */
const ALLOWED_PUBLIC_HOSTS = (
  process.env.ALLOWED_PUBLIC_HOSTS ?? "homestay-web.fly.dev"
)
  .split(",")
  .map((host) => host.trim().toLowerCase())
  .filter(Boolean);

const isAllowedHost = (host: string): boolean => {
  const hostname = host.split(":")[0]?.toLowerCase() ?? "";

  return isLocalHost(host) || ALLOWED_PUBLIC_HOSTS.includes(hostname);
};

const publicHostFromRequest = (request: Request): string | null => {
  const forwarded = request.headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim();
  const host = forwarded || request.headers.get("host")?.trim();

  return host && isAllowedHost(host) ? host : null;
};

const wsProtocolFromRequest = (request: Request): "ws" | "wss" => {
  const forwarded = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim();

  if (forwarded === "https" || forwarded === "http") {
    return forwarded === "https" ? "wss" : "ws";
  }

  return new URL(request.url).protocol === "https:" ? "wss" : "ws";
};

export const shouldProxyIntelligenceRealtime = (request: Request): boolean => {
  const host = publicHostFromRequest(request);

  if (!host) {
    return false;
  }

  return !isLocalHost(host);
};

export const sameOriginIntelligenceClientWsUrl = (
  request: Request,
): string | null => {
  const host = publicHostFromRequest(request);

  if (!host || isLocalHost(host)) {
    return null;
  }

  return `${wsProtocolFromRequest(request)}://${host}${PROXY_SUFFIX}`;
};

type JsonValue = string | number | boolean | null | JsonValue[] | JsonObject;

type JsonObject = { [key: string]: JsonValue | undefined };

const hasStringField = <TKey extends string>(
  value: JsonValue | undefined,
  key: TKey,
): value is JsonObject & Record<TKey, string> =>
  !!value &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  typeof value[key] === "string";

/**
 * Points every managed realtime URL in a runtime JSON body at our proxy.
 * Returns the original reference when there is nothing to rewrite.
 */
export const rewriteIntelligenceRealtimeUrlsInBody = (
  request: Request,
  body: JsonValue,
): JsonValue => {
  const proxyUrl = sameOriginIntelligenceClientWsUrl(request);

  if (!proxyUrl || !body || typeof body !== "object" || Array.isArray(body)) {
    return body;
  }

  const payload = body;
  const intelligence = hasStringField(payload.intelligence, "wsUrl")
    ? payload.intelligence
    : null;
  const realtime = hasStringField(payload.realtime, "clientUrl")
    ? payload.realtime
    : null;

  if (!intelligence && !realtime) {
    return body;
  }

  return {
    ...payload,
    ...(intelligence
      ? { intelligence: { ...intelligence, wsUrl: proxyUrl } }
      : {}),
    ...(realtime ? { realtime: { ...realtime, clientUrl: proxyUrl } } : {}),
  };
};
