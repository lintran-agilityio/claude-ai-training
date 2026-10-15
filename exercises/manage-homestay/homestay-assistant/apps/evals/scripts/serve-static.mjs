/**
 * Minimal static file server for `evalite-export/` — the deploy target for the
 * Render `homestay-evalite` service (`startCommand: pnpm --filter=evals serve:dashboard`).
 *
 * Why not `npx serve`: the Evalite report SPA at `/report` uses a *browser*
 * router (`/report/eval/<name>`), so any unknown path under `/report` must
 * fall back to `/report/index.html` or a deep link 404s. `serve`'s SPA mode is
 * all-or-nothing at the root; here the root is the custom landing page and only
 * the `/report` subtree is a SPA. This 40-line server does exactly that and
 * binds `0.0.0.0:$PORT` for Render's port scan.
 */
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";

const ROOT = path.resolve(process.env.EVALITE_EXPORT_DIR || "evalite-export");
const PORT = Number.parseInt(process.env.PORT ?? "3006", 10) || 3006;
const HOST = process.env.EVALITE_HOST || "0.0.0.0";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8",
};

/** Resolve a request path to a file inside ROOT, or `null` if it escapes. */
const resolveInsideRoot = (urlPath) => {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const resolved = path.resolve(ROOT, `.${decoded}`);
  return resolved === ROOT || resolved.startsWith(ROOT + path.sep)
    ? resolved
    : null;
};

const tryFile = async (filePath) => {
  try {
    const s = await stat(filePath);
    return s.isFile() ? filePath : null;
  } catch {
    return null;
  }
};

const send = (res, status, filePath) => {
  res.writeHead(status, {
    "content-type": MIME[path.extname(filePath)] || "application/octet-stream",
    "cache-control": filePath.includes(`${path.sep}assets${path.sep}`)
      ? "public, max-age=31536000, immutable"
      : "no-cache",
  });
  createReadStream(filePath).pipe(res);
};

const server = http.createServer(async (req, res) => {
  const base = resolveInsideRoot(req.url || "/");
  if (!base) {
    res.writeHead(400).end("Bad request");
    return;
  }

  // Exact file, or directory index.
  let file = await tryFile(base);
  if (!file) file = await tryFile(path.join(base, "index.html"));

  // SPA fallback: unknown paths under /report serve the report shell;
  // anything else serves the landing page.
  if (!file) {
    // const underReport = (req.url || "").replace(/^\/+/, "").startsWith("report/");
    const requestPath = (req.url || "").split("?")[0];
    const underReport =
      requestPath === "/report" ||
      requestPath.startsWith("/report/");
    file = underReport
      ? await tryFile(path.join(ROOT, "report", "index.html"))
      : await tryFile(path.join(ROOT, "index.html"));
  }

  if (!file) {
    res.writeHead(404, { "content-type": "text/plain" }).end("Not found");
    return;
  }
  send(res, 200, file);
});

server.listen(PORT, HOST, () => {
  console.log(`[serve-static] ${ROOT} → http://${HOST}:${PORT}`);
});
