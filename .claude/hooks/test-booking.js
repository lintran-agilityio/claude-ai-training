#!/usr/bin/env node
// PostToolUse hook: after editing a file under **/booking/**, runs the Booking feature tests
// (overlapping bookings, same-day check-in/out, per-night pricing) with jest in apps/api.
// On failure it reports to the user (systemMessage + toast) and feeds the error back to Claude.
const { spawnSync, spawn } = require("child_process");
const path = require("path");

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
    if (!file) process.exit(0);

    const p = file.replace(/\\/g, "/");
    if (!/\/booking\//.test(p) || /\/(dist|node_modules)\//.test(p))
      process.exit(0);

    const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
    const apiDir = path.join(
      root,
      "exercises/manage-homestay/homestay-assistant/apps/api",
    );

    const r = spawnSync(
      "pnpm",
      ["exec", "jest", "modules/booking", "--silent", "--passWithNoTests"],
      {
        cwd: apiDir,
        encoding: "utf8",
        shell: true,
        timeout: 110000,
      },
    );
    if (r.status === 0) process.exit(0);

    const out = `${r.stdout || ""}\n${r.stderr || ""}`
      .trim()
      .split("\n")
      .slice(-40)
      .join("\n");
    const title = "❌ Test Booking FAIL";
    const reason = `Booking tests (overlap / same-day check-in-out / per-night pricing) FAILED after editing "${file}":\n${out}`;

    // Windows toast for the user (non-blocking, errors ignored)
    try {
      const ps = `Add-Type -AssemblyName System.Windows.Forms,System.Drawing;
$n = New-Object System.Windows.Forms.NotifyIcon;
$n.Icon = [System.Drawing.SystemIcons]::Error; $n.Visible = $true;
$n.ShowBalloonTip(5000, '${title}', 'See details in Claude Code', 'Error');
Start-Sleep -Seconds 6; $n.Dispose()`;
      spawn(
        "powershell",
        ["-NoProfile", "-WindowStyle", "Hidden", "-Command", ps],
        {
          detached: true,
          stdio: "ignore",
        },
      ).unref();
    } catch {}

    // exit 0 + JSON: systemMessage is shown to the user, decision/reason feeds the error to Claude
    // (JSON is only processed on exit 0, so exit 2 is not used here)
    console.log(
      JSON.stringify({
        systemMessage: `${title}: ${file.replace(/\\/g, "/").split("/").pop()}`,
        decision: "block",
        reason,
      }),
    );
    process.exit(0);
  });
