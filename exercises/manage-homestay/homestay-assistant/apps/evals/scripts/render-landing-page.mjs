/**
 * Renders the standalone "Evalite Reports" landing page that sits in front of
 * the Evalite static export.
 *
 * The Evalite export (`evalite/export-static`) only produces the report SPA —
 * it has no cross-eval index page. This module builds that index: one card per
 * eval, an overall score, and the run timestamp, matching the shared
 * dev-space dashboard style. `build-dashboard.mjs` calls `renderLandingPage`
 * with the export's own `data/menu-items.json` payload plus the exported run,
 * and writes the result to `evalite-export/index.html`.
 *
 * Pure string builder — no filesystem, no evalite imports — so it can be unit
 * tested and reused by any deploy target (Render static serve, Vercel, …).
 */

/** `2026-08-03T10:28:04.123Z` -> `2026-08-03 10:28:04` (UTC, matches the reference). */
const formatRunTimestamp = (isoString) => {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "unknown";
  return date.toISOString().slice(0, 19).replace("T", " ");
};

const toPercent = (score) =>
  typeof score === "number" && Number.isFinite(score)
    ? `${Math.round(score * 100)}%`
    : "—";

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * @param {object}  params
 * @param {object}  params.menu       Parsed `data/menu-items.json` from the export:
 *                                    `{ evals: [{ name, score, evalStatus, hasScores }], score, evalStatus }`.
 * @param {object}  params.run        The exported run: `{ id, runType, created_at }`.
 * @param {string} [params.basePath]  URL prefix the Evalite SPA is served under (default `/report`).
 * @param {string} [params.title]     Page + heading title (default `Evalite Reports`).
 * @param {string} [params.subtitle]  Lead line before "overall …%" (default matches the reference).
 * @returns {string} A complete HTML document.
 */
export function renderLandingPage({
  menu,
  run,
  basePath = "/report",
  title = "Evalite Reports",
  subtitle = "LLM agent eval results",
}) {
  const reportBase = basePath === "/" ? "" : basePath.replace(/\/$/, "");
  const evals = Array.isArray(menu?.evals) ? menu.evals : [];
  const overall = toPercent(menu?.score);
  const lastRun = run?.created_at ? formatRunTimestamp(run.created_at) : "unknown";
  const anyFailed = evals.some((entry) => entry.evalStatus === "fail");

  const cards = evals
    .map((entry) => {
      const name = escapeHtml(entry.name);
      const href = `${reportBase}/eval/${encodeURIComponent(entry.name)}`;
      const score = entry.hasScores ? toPercent(entry.score) : "—";
      const failed = entry.evalStatus === "fail";
      return `
        <a class="card${failed ? " card--fail" : ""}" href="${href}">
          <div class="card__head">
            <span class="card__name">${name}</span>
            <span class="card__score">${score}</span>
          </div>
          <span class="card__link">View eval report &rarr;</span>
        </a>`;
    })
    .join("");

  const emptyState = `<p class="empty">No evals in this run.</p>`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap"
    />
    <script>
      // Mirror the Evalite UI: follow the OS colour scheme.
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const applyTheme = (e) => document.documentElement.classList.toggle("dark", e.matches);
      applyTheme(mq);
      mq.addEventListener("change", applyTheme);
    </script>
    <style>
      :root {
        --bg: #ffffff;
        --fg: #0a0a0a;
        --muted: #6b7280;
        --card-bg: #fafafa;
        --card-border: #e5e7eb;
        --card-hover: #f3f4f6;
        --fail: #dc2626;
      }
      html.dark {
        --bg: #0a0a0a;
        --fg: #fafafa;
        --muted: #9ca3af;
        --card-bg: #131313;
        --card-border: #262626;
        --card-hover: #1c1c1c;
        --fail: #f87171;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: var(--bg);
        color: var(--fg);
        font-family: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
        line-height: 1.5;
        -webkit-font-smoothing: antialiased;
      }
      .wrap { max-width: 720px; margin: 0 auto; padding: 64px 24px 96px; }
      h1 { font-size: 30px; font-weight: 700; letter-spacing: -0.02em; margin: 0 0 8px; }
      .lead { color: var(--muted); font-size: 15px; margin: 0 0 40px; }
      .lead strong { color: var(--fg); font-weight: 600; }
      .grid { display: flex; flex-direction: column; gap: 12px; }
      .card {
        display: block;
        text-decoration: none;
        color: inherit;
        background: var(--card-bg);
        border: 1px solid var(--card-border);
        border-radius: 12px;
        padding: 18px 20px;
        transition: background 0.12s ease, border-color 0.12s ease;
      }
      .card:hover { background: var(--card-hover); border-color: var(--muted); }
      .card__head { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; }
      .card__name { font-weight: 600; font-size: 16px; }
      .card__score { color: var(--muted); font-variant-numeric: tabular-nums; font-size: 15px; }
      .card--fail .card__score { color: var(--fail); }
      .card__link { display: inline-block; margin-top: 6px; color: var(--muted); font-size: 13px; }
      .empty { color: var(--muted); }
      footer { margin-top: 48px; color: var(--muted); font-size: 12px; }
    </style>
  </head>
  <body>
    <main class="wrap">
      <h1>${escapeHtml(title)}</h1>
      <p class="lead">
        ${escapeHtml(subtitle)} &middot; overall <strong>${overall}</strong>.
        Last run ${escapeHtml(lastRun)}${anyFailed ? " &middot; <strong>some evals failed</strong>" : ""}.
      </p>
      <div class="grid">
        ${evals.length > 0 ? cards : emptyState}
      </div>
      <footer>Generated by evalite &middot; run #${escapeHtml(run?.id ?? "?")} (${escapeHtml(run?.runType ?? "?")})</footer>
    </main>
  </body>
</html>
`;
}

export { formatRunTimestamp, toPercent };
