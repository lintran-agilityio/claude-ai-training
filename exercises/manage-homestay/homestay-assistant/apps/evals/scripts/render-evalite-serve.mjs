/**
 * `node --import` preload for the Render `homestay-evalite` service's start
 * command (`pnpm --filter=evals eval:serve:render`).
 *
 * Evalite 0.19.0's dashboard server calls `fastify().listen({ port })` with no
 * host (`evalite/dist/server.js`), so Fastify defaults the host to `localhost`
 * and binds only the loopback interface. Render only routes to a web service
 * listening on `0.0.0.0:$PORT` — otherwise the deploy fails its port scan and
 * times out:
 *
 *   ==> No open ports detected on 0.0.0.0, continuing to scan...
 *   ==> Port scan timeout reached, no open ports detected on 0.0.0.0.
 *       Detected open ports on localhost -- did you mean to bind one of these to 0.0.0.0?
 *   ==> Timed Out
 *
 * Evalite exposes no `--host` flag or `server.host` config, so this preload
 * rewrites the bind at the `http.Server.prototype.listen` seam Fastify calls:
 * a loopback/default host becomes `0.0.0.0` (override with `EVALITE_HOST`),
 * and — belt-and-suspenders for a service whose `PORT` env didn't reach
 * `evalite.config.ts` — the port becomes `$PORT` when Render has set it.
 *
 * The options object is mutated in place so Fastify's `multipleBindings()`
 * dual-stack pass then sees host `0.0.0.0`, resolves it to itself, and skips
 * the secondary `127.0.0.1` / `::1` binds (which would only `EADDRINUSE`).
 *
 * Scope: this process has exactly one HTTP listener (the Evalite UI). Local
 * `pnpm eval:serve` does NOT load this file and still binds `localhost:3006`.
 */
import http from "node:http";

const HOST = process.env.EVALITE_HOST || "0.0.0.0";
const PORT = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : undefined;
const DEFAULT_HOSTS = new Set([undefined, null, "", "localhost"]);

const originalListen = http.Server.prototype.listen;

http.Server.prototype.listen = function patchedListen(...args) {
  const options = args[0];
  if (
    options &&
    typeof options === "object" &&
    !Array.isArray(options) &&
    options.port != null
  ) {
    const fromHost = options.host;
    const fromPort = options.port;
    if (DEFAULT_HOSTS.has(options.host)) options.host = HOST;
    if (PORT !== undefined && Number.isFinite(PORT)) options.port = PORT;
    if (options.host !== fromHost || options.port !== fromPort) {
      console.log(
        `[render-evalite-serve] binding ${options.host}:${options.port} (Evalite asked for ${fromHost ?? "localhost"}:${fromPort})`,
      );
    }
  }
  return originalListen.apply(this, args);
};
