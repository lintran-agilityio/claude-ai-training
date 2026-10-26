#!/usr/bin/env node
// PreToolUse hook: prevents leaking Homestay customer data (national ID/passport, phone, card) and secrets.
// Exit 2 + stderr => Claude Code blocks the tool call and shows the reason to Claude.
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
    const block = (msg) => {
      console.error(`🛡️ Blocked: ${msg}`);
      process.exit(2);
    };

    // ---- 1. Sensitive files (by path) ----
    const SENSITIVE_PATH = [
      /(^|[\/])\.env(\.(?!example$|sample$|template$)[^\/]*)?$/i,
      /\.(pem|key|p12|pfx|jks|keystore)$/i,
      /(^|[\/])id_(rsa|ed25519|ecdsa)(\.pub)?$/i,
      /service[-_]?account.*\.json$/i,
      /(^|[\/])(auth|credentials?|secrets?)\.(json|ya?ml|txt)$/i,
      /(^|[\/])\.(npmrc|netrc|pgpass)$/i,
      /(guest|customer|khach|booking|payment)[-_a-z0-9]*\.(csv|xlsx?|sql|dump|bak)$/i,
      /(^|[\/])(data|exports?|backups?|dumps?)[\/].*\.(csv|xlsx?|sql|dump|bak|json)$/i,
    ];
    const isSensitivePath = (p) => p && SENSITIVE_PATH.some((r) => r.test(p));

    const paths = [ti.file_path, ti.path, ti.notebook_path].filter(Boolean);
    for (const p of paths) {
      if (isSensitivePath(p))
        block(
          `"${p}" contains secrets or customer data. Use fake data or .env.example instead.`,
        );
    }

    // ---- 2. Bash/PowerShell: reading/pushing sensitive files, dumping env vars ----
    if (tool === "Bash" || tool === "PowerShell") {
      const cmd = ti.command || "";
      const tokens = cmd.split(/[\s"'=|;&<>()]+/).filter(Boolean);
      const hit = tokens.find(isSensitivePath);
      if (hit) block(`command touches sensitive file "${hit}".`);
      if (
        /(^|[;&|]\s*)(printenv|env|set)\s*($|[|;&])|Get-ChildItem\s+env:|\$env:\w*(KEY|SECRET|TOKEN|PASSWORD)|\becho\s+\$\{?\w*(KEY|SECRET|TOKEN|PASSWORD)/i.test(
          cmd,
        )
      )
        block("do not print environment variables / secrets to output.");
      if (
        /git\s+add\s+(-A|--all|\.)\s*$/.test(cmd.trim()) === false &&
        /git\s+add\b.*\.env\b/.test(cmd)
      )
        block("do not git add .env files.");
    }

    // ---- 3. Scan content about to be written (Write/Edit/MultiEdit) ----
    const text = [
      ti.content,
      ti.new_string,
      ...(ti.edits || []).map((e) => e.new_string),
    ]
      .filter(Boolean)
      .join("\n");
    if (!text) process.exit(0);

    const luhn = (s) => {
      const d = s.replace(/\D/g, "");
      if (d.length < 13 || d.length > 19) return false;
      let sum = 0;
      for (let i = 0; i < d.length; i++) {
        let n = +d[d.length - 1 - i];
        if (i % 2) {
          n *= 2;
          if (n > 9) n -= 9;
        }
        sum += n;
      }
      return sum % 10 === 0;
    };

    const findings = [];
    const SECRETS = [
      ["private key", /-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
      ["OpenAI/Anthropic key", /\bsk-(ant-|proj-)?[A-Za-z0-9_-]{20,}/],
      ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/],
      ["GitHub token", /\bgh[pousr]_[A-Za-z0-9]{30,}/],
      ["Google API key", /\bAIza[0-9A-Za-z_-]{35}\b/],
      ["Slack token", /\bxox[baprs]-[A-Za-z0-9-]{10,}/],
      [
        "JWT",
        /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
      ],
      [
        "hard-coded credential",
        /\b(password|passwd|secret|api[_-]?key|token)\s*[:=]\s*["'][^"'\s${}]{8,}["']/i,
      ],
      [
        "connection string with password",
        /\b\w+:\/\/[^\s:@/]+:[^\s:@/]{3,}@[^\s/]+/,
      ],
    ];
    for (const [name, re] of SECRETS)
      if (re.test(text)) findings.push(`secret (${name})`);

    const cccd = /(?<!\d)(?:\d{12}|0\d{11})(?!\d)/;
    if (
      cccd.test(text) &&
      /cccd|cmnd|căn cước|can cuoc|citizen|national[_ ]?id|id[_ ]?number/i.test(
        text,
      )
    )
      findings.push("national ID number (12 digits)");
    const passport = /(passport|hộ chiếu|ho chieu)\W{0,20}[A-Z]\d{7,8}\b/i;
    if (passport.test(text)) findings.push("passport number");
    if (/(?<!\d)(?:\+?84|0)(?:3|5|7|8|9)\d{8}(?!\d)/.test(text))
      findings.push("VN phone number");
    for (const m of text.match(/(?<!\d)(?:\d[ -]?){13,19}(?!\d)/g) || [])
      if (luhn(m)) {
        findings.push("payment card number (Luhn)");
        break;
      }

    if (findings.length)
      block(
        `content written to "${ti.file_path || "file"}" contains: ${[...new Set(findings)].join(", ")}. ` +
          "Use obviously fake placeholders and read secrets from environment variables.",
      );
    process.exit(0);
  });
