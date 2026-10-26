#!/usr/bin/env node
// PreToolUse hook: blocks destructive or hard-to-reverse shell commands (Bash/PowerShell).
// Exit 2 + stderr => Claude Code blocks the tool call and shows the reason to Claude.
const FORBIDDEN = [
  [
    /\brm\s+(-\w*[rf]\w*\s+)+(\/|~|\*|\.)(\s|$)/i,
    "recursive delete of root, home or the whole working directory",
  ],
  [/\bRemove-Item\b(?=.*-Recurse)(?=.*-Force)/i, "Remove-Item -Recurse -Force"],
  [/\b(rd|rmdir)\s+\/s\b/i, "recursive rmdir /s"],
  [/\bdel\s+(\/\w+\s+)*\/[sq]\b/i, "recursive del /s or /q"],
  [
    /\bgit\s+push\b.*(--force\b|--force-with-lease\b|\s-f\b)/i,
    "git force push",
  ],
  [/\bgit\s+push\b.*\b(main|master)\b/i, "git push to main/master"],
  [/\bgit\s+reset\s+--hard\b/i, "git reset --hard"],
  [/\bgit\s+clean\b.*-\w*f/i, "git clean -f"],
  [
    /\bgit\s+(checkout|restore)\s+(--\s+)?\.\s*$/i,
    "discarding all working tree changes",
  ],
  [/\bgit\s+branch\s+-D\b/i, "git branch -D"],
  [/\bgit\b.*--no-verify\b/i, "skipping git hooks (--no-verify)"],
  [/\bdrop\s+(table|database|schema)\b/i, "SQL DROP statement"],
  [/\btruncate\s+table\b/i, "SQL TRUNCATE"],
  [/\bdelete\s+from\s+\w+\s*(;|$)/i, "SQL DELETE without WHERE"],
  [
    /\b(curl|wget|iwr|Invoke-WebRequest)\b.*\|\s*(sh|bash|zsh|iex|Invoke-Expression)\b/i,
    "piping a download into a shell",
  ],
  [/\bnpm\s+publish\b/i, "npm publish"],
  [
    /\b(shutdown|reboot|mkfs|diskpart)\b|\bformat\s+[a-z]:/i,
    "system-level destructive command",
  ],
  [/\bchmod\s+-R\s+0?777\b/i, "chmod -R 777"],
];

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
    const { tool_name: tool, tool_input: ti = {} } = input;
    if (tool !== "Bash" && tool !== "PowerShell") process.exit(0);

    const cmd = ti.command || "";
    const hit = FORBIDDEN.find(([re]) => re.test(cmd));
    if (hit) {
      console.error(
        `Blocked: ${hit[1]}. Ask the user to run it manually or confirm explicitly.`,
      );
      process.exit(2);
    }
    process.exit(0);
  });
