/**
 * Builds the deployable Evalite dashboard into `apps/evals/evalite-export/`:
 *
 *   evalite-export/
 *   ├── index.html        ← the "Evalite Reports" landing page (this script)
 *   └── report/           ← the Evalite report SPA (evalite/export-static)
 *       ├── index.html
 *       ├── assets/
 *       └── data/
 *
 * Flow:
 *   1. run the suite once into a fresh in-memory store (no better-sqlite3);
 *   2. `exportStaticUI` the run to `report/` under basePath `/report`;
 *   3. read the export's own `data/menu-items.json` + the run row and render
 *      `index.html` from `render-landing-page.mjs`.
 *
 * Serve the folder with `scripts/serve-static.mjs` (Render) or any static host
 * that falls back unknown `/report/*` paths to `/report/index.html`.
 *
 * Env:
 *   EVAL_DASHBOARD_PATH   path filter passed to the runner (default "tools").
 *   EVAL_DASHBOARD_TITLE  landing page heading   (default "Evalite Reports").
 *   All the model / rate-limit env from `.env.example` (AI_PROVIDER, MISTRAL_API_KEY, …).
 */
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";

import { exportStaticUI } from "evalite/export-static";
import { createInMemoryStorage } from "evalite/in-memory-storage";
import { runEvalite } from "evalite/runner";

import { renderLandingPage } from "./render-landing-page.mjs";

const OUT_DIR = "evalite-export";
const REPORT_DIR = path.join(OUT_DIR, "report");
const REPORT_BASE_PATH = "/report";

const suitePath = process.env.EVAL_DASHBOARD_PATH ?? "tools";
const title = process.env.EVAL_DASHBOARD_TITLE ?? "Evalite Reports";

async function main() {
  const storage = createInMemoryStorage();

  console.log(`\n▶ Running evals (path filter: "${suitePath}")…\n`);
  await runEvalite({
    cwd: process.cwd(),
    mode: "run-once-and-exit",
    path: suitePath,
    storage,
    disableServer: true,
  });

  // Start from a clean output tree so a removed eval never lingers in the export.
  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(REPORT_DIR, { recursive: true });

  console.log(`\n▶ Exporting report SPA to ${REPORT_DIR} …\n`);
  await exportStaticUI({
    storage,
    outputPath: REPORT_DIR,
    basePath: REPORT_BASE_PATH,
  });

  const menu = JSON.parse(
    await readFile(path.join(REPORT_DIR, "data", "menu-items.json"), "utf8"),
  );
  const [run] = await storage.runs.getMany({ runType: "full", limit: 1 });

  const html = renderLandingPage({
    menu,
    run,
    basePath: REPORT_BASE_PATH,
    title,
  });
  await writeFile(path.join(OUT_DIR, "index.html"), html);

  const pct = Math.round((menu.score ?? 0) * 100);
  console.log(
    `\n✓ Dashboard built: ${OUT_DIR}/index.html  (${menu.evals?.length ?? 0} evals, overall ${pct}%)\n`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
