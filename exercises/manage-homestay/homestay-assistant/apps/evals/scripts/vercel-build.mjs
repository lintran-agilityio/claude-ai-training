import { mkdir } from "node:fs/promises";
import { exportStaticUI } from "evalite/export-static";
import { createInMemoryStorage } from "evalite/in-memory-storage";
import { runEvalite } from "evalite/runner";

const storage = createInMemoryStorage();

await runEvalite({
  cwd: process.cwd(),
  mode: "run-once-and-exit",
  path: "deterministic",
  storage,
});

await mkdir("evalite-export", { recursive: true });
await exportStaticUI({
  storage,
  outputPath: "evalite-export",
});