import path from "node:path";
import fs from "node:fs";

/**
 * Mastra storage roots.
 *
 * `process.cwd()` decides the directory:
 * - Next BFF (`apps/web`) → `apps/web/src/mastra/public` (runtime history)
 * - Mastra Studio (`apps/agent`) → `apps/agent/src/mastra/public` (studio only)
 *
 * Runtime and Studio use separate LibSQL files so the two processes never
 * share one database lock or mix observability with chat threads.
 */
const dataDir =
  process.env.MASTRA_DATA_DIR ??
  path.join(process.cwd(), "src/mastra/public");

fs.mkdirSync(dataDir, { recursive: true });

/** CopilotKit / AG-UI runtime memory + threads. */
export const runtimeDbPath = path.join(dataDir, "mastra-runtime.db");

/** Mastra Studio local storage (starts clean; not shared with runtime). */
export const studioDbPath = path.join(dataDir, "mastra-studio.db");

/** DuckDB observability domain (Studio composite store only). */
export const duckDbPath = path.join(dataDir, "mastra.duckdb");
