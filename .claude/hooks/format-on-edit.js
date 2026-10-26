#!/usr/bin/env node
// PostToolUse hook: formats a file with the project's prettier right after Claude edits it.
// Only touches supported files inside homestay-assistant. Never blocks (always exit 0).
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const EXTENSIONS = /\.(ts|tsx|js|jsx|mjs|cjs|json|css|md)$/i;
const IGNORED = /\/(node_modules|dist|build|\.next|coverage)\//;

let raw = "";
process.stdin
  .on("data", (c) => (raw += c))
  .on("end", () => {
    let input;
    try {
      input = JSON.parse(raw);
    } catch {
      process.exit(0);
    }
    const file = (input.tool_input || {}).file_path;
    if (!file || !fs.existsSync(file)) process.exit(0);

    const normalized = path.resolve(file).replace(/\\/g, "/");
    const root = (process.env.CLAUDE_PROJECT_DIR || process.cwd()).replace(
      /\\/g,
      "/",
    );
    const projectDir = `${root}/exercises/manage-homestay/homestay-assistant`;

    if (
      !normalized.startsWith(`${projectDir}/`) ||
      !EXTENSIONS.test(normalized) ||
      IGNORED.test(normalized)
    )
      process.exit(0);

    const r = spawnSync(
      "pnpm",
      ["exec", "prettier", "--write", `"${normalized}"`],
      {
        cwd: projectDir,
        encoding: "utf8",
        shell: true,
        timeout: 30000,
      },
    );

    if (r.status !== 0) {
      const message = `${r.stdout || ""}\n${r.stderr || ""}`.trim();
      console.log(
        JSON.stringify({
          systemMessage: `Prettier failed on ${path.basename(file)}: ${message.slice(-300)}`,
        }),
      );
    }
    process.exit(0);
  });
