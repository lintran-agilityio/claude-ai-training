#!/usr/bin/env node
// Stop / Notification hook: shows a Windows toast when Claude finishes a turn or needs attention.
// Never blocks (always exit 0).
const { spawn } = require("child_process");

const MESSAGES = {
  Stop: ["Claude finished", "The task is done. Come back to review."],
  Notification: ["Claude needs you", "Waiting for your input or approval."],
};

// Single quotes are doubled so the text is safe inside a PowerShell string.
const escapeForPowerShell = (text) => text.replace(/'/g, "''");

let raw = "";
process.stdin
  .on("data", (c) => (raw += c))
  .on("end", () => {
    let input = {};
    try {
      input = JSON.parse(raw);
    } catch {}

    const [title, fallbackBody] =
      MESSAGES[input.hook_event_name] || MESSAGES.Stop;
    const body =
      input.hook_event_name === "Notification" && input.message
        ? input.message
        : fallbackBody;

    const ps = `Add-Type -AssemblyName System.Windows.Forms,System.Drawing;
$n = New-Object System.Windows.Forms.NotifyIcon;
$n.Icon = [System.Drawing.SystemIcons]::Information; $n.Visible = $true;
$n.ShowBalloonTip(5000, '${escapeForPowerShell(title)}', '${escapeForPowerShell(body.slice(0, 200))}', 'Info');
Start-Sleep -Seconds 6; $n.Dispose()`;

    try {
      spawn(
        "powershell",
        ["-NoProfile", "-WindowStyle", "Hidden", "-Command", ps],
        { detached: true, stdio: "ignore" },
      ).unref();
    } catch {}
    process.exit(0);
  });
