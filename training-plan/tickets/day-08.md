# Day 8: MCP & connectors

**Labels:** `training` `day-08` `phase::dev-track` · **Source:** https://dojo.agilityio.dev/schedule/day-08.html

## Goal
Let Claude read real PR and ticket state, and drive the running app.

## Tasks
- [ ] Finish the course *Introduction to model context protocol*.
- [ ] Add the GitHub connector: `claude mcp add --transport http github https://api.githubcopilot.com/mcp/`, restart, sign in.
- [ ] Install Node.js, then add Playwright MCP: `claude mcp add playwright -- npx -y @playwright/mcp@latest`, restart.
- [ ] Exercise: use one MCP tool end-to-end in a session (e.g. query PRs and comment on one).

## Deliverables
- Both MCP servers working.
- Note of the end-to-end MCP exercise.

## Definition of Done
- [ ] Claude read real PR state instead of guessing.
- [ ] Notes in `exercises/day-08-exercises.md`; 3 takeaways written.

> Note: this repo is hosted on GitLab. If the GitHub connector cannot be used here, use a sandbox GitHub repo with sample data only.
