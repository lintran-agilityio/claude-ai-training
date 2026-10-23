---
name: push-remote
description: Push the current branch to the right git remote. Use when the user says "push to github" / "push vào github" (remote `github`) or "push to gitlab" / "push vào gitlab" (remote `origin`).
---

# Push to the right remote

| User says | Remote | URL |
|---|---|---|
| push to github / push vào github | `github` | git@github.com:lintran-agilityio/claude-ai-training.git |
| push to gitlab / push vào gitlab | `origin` | git@gitlab.asoft-python.com:lin.tran/claude-ai-training.git |

## Steps
1. `git branch --show-current` to get the branch.
2. `git push -u <remote> <branch>` using the remote from the table.
3. Report the result. On failure (e.g. publickey denied) show the error; do not try the other remote.

## Rules
- Never push to a remote the user did not name. If they only say "push", ask which one.
- No force push unless explicitly asked.
