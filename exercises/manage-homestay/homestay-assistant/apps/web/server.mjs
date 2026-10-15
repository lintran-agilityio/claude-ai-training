/**
 * Custom Next.js server with a same-origin WebSocket proxy for CopilotKit
 * Intelligence realtime.
 *
 * Managed Intelligence rejects browser Origin values other than
 * http://localhost:3000 (Phoenix check_origin). The browser therefore connects
 * to /api/intelligence-realtime/* on this host; we bridge to the upstream
 * realtime gateway and present Origin: http://localhost:3000 server-side.
 *
 * next start / next.config rewrites cannot proxy WebSocket upgrades — hence
 * this custom server for production (and optional local) starts.
 */

import { createServer } from "node:http";
import process from "node:process";
import { parse } from "node:url";

import next from "next";
import { WebSocket, WebSocketServer } from "ws";

// Fly / Docker often omit NODE_ENV; treat anything except explicit development
// as production so we don't boot `next` in dev mode without a compiler.
const dev = process.env.NODE_ENV === "development";
/** Next uses this for absolute URL generation — keep localhost, bind separately. */
const hostname = "localhost";
const listenHost = process.env.HOSTNAME || "0.0.0.0";
const port = Number.parseInt(process.env.PORT || "3000", 10);

/** Path prefix exposed to the browser (must match rewrite in the CopilotKit route). */
const PROXY_PREFIX = "/api/intelligence-realtime";

/**
 * Upstream Origin that the managed realtime gateway currently accepts.
 * Spoofed only on the server→CopilotKit hop; the browser keeps its real origin.
 */
const UPSTREAM_ORIGIN = "http://localhost:3000";

const resolveUpstreamBase = () => {
  const configured = process.env.INTELLIGENCE_GATEWAY_WS_URL?.replace(/\/$/, "");

  if (!configured) {
    throw new Error(
      "INTELLIGENCE_GATEWAY_WS_URL is required for the Intelligence realtime proxy",
    );
  }

  return configured;
};

const pipeSockets = (client, upstream) => {
  /** Phoenix may send join frames before the upstream handshake finishes. */
  const pending = [];
  let upstreamOpen = upstream.readyState === WebSocket.OPEN;

  const closeBoth = () => {
    pending.length = 0;
    if (client.readyState === WebSocket.OPEN || client.readyState === WebSocket.CONNECTING) {
      client.close();
    }
    if (
      upstream.readyState === WebSocket.OPEN ||
      upstream.readyState === WebSocket.CONNECTING
    ) {
      upstream.close();
    }
  };

  client.on("message", (data, isBinary) => {
    if (upstreamOpen && upstream.readyState === WebSocket.OPEN) {
      upstream.send(data, { binary: isBinary });
      return;
    }
    pending.push({ data, isBinary });
  });

  upstream.on("open", () => {
    upstreamOpen = true;
    for (const frame of pending) {
      if (upstream.readyState === WebSocket.OPEN) {
        upstream.send(frame.data, { binary: frame.isBinary });
      }
    }
    pending.length = 0;
  });

  upstream.on("message", (data, isBinary) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data, { binary: isBinary });
    }
  });

  client.on("close", closeBoth);
  upstream.on("close", closeBoth);
  client.on("error", closeBoth);
  upstream.on("error", closeBoth);
};

const app = next({ dev, hostname, port });
const wss = new WebSocketServer({ noServer: true });

await app.prepare();

const handle = app.getRequestHandler();
const upgradeHandler = app.getUpgradeHandler();

const upstreamBase = resolveUpstreamBase();
const server = createServer((req, res) => {
  handle(req, res, parse(req.url || "/", true));
});

server.on("upgrade", (req, socket, head) => {
  socket.on("error", () => {
    try {
      socket.destroy();
    } catch {
      /* ignore */
    }
  });

  const { pathname, search } = parse(req.url || "/", true);

  if (!pathname?.startsWith(PROXY_PREFIX)) {
    upgradeHandler(req, socket, head).catch(() => {
      try {
        socket.destroy();
      } catch {
        /* ignore */
      }
    });
    return;
  }

  const upstreamPath = `${pathname.slice(PROXY_PREFIX.length)}${search || ""}`;
  const upstreamUrl = `${upstreamBase}${upstreamPath}`;

  wss.handleUpgrade(req, socket, head, (client) => {
    const upstream = new WebSocket(upstreamUrl, {
      headers: {
        Origin: UPSTREAM_ORIGIN,
      },
    });

    // Attach piping immediately so early client frames are buffered.
    pipeSockets(client, upstream);

    upstream.on("unexpected-response", (_req, res) => {
      console.error(
        `[intelligence-realtime-proxy] upstream rejected upgrade: ${res.statusCode}`,
      );
      try {
        client.close();
      } catch {
        /* ignore */
      }
      res.resume();
    });

    upstream.on("error", (error) => {
      console.error("[intelligence-realtime-proxy] upstream error:", error.message);
      try {
        client.close();
      } catch {
        /* ignore */
      }
    });
  });
});

server.listen(port, listenHost, () => {
  console.log(
    `> Ready on http://${listenHost}:${port} (Intelligence realtime proxy → ${upstreamBase})`,
  );
});
