# Day 2: Ticket analysis, reproduce & understand

**Labels:** `training` `day-02` `phase::fundamentals` · **Source:** https://dojo.agilityio.dev/schedule/day-02.html

## Goal
Analyse tickets, reproduce a bug from the report alone, and turn it into a failing test.

## Tasks
**Morning: ticket analysis**
- [ ] Take 5 tickets from the training backlog. For each, write a 3-sentence analysis: what it asks, what is ambiguous, first step. Use Claude to find gaps.
- [ ] Write the questions you would ask the reporter; role-play reporter/dev in pairs.

**Afternoon: reproduce and understand**
- [ ] Take the seeded bug ticket. Run the app locally from scratch, reproduce the bug, and write exact repro steps into the ticket.
- [ ] Paste the stack trace or code into Claude, ask for hypotheses, and verify each by running (not by trusting).
- [ ] Express the bug as a failing test, if possible.
- [ ] Git block: `pull --rebase`, read `git log` / `git diff`, resolve merge conflict #1 (seeded by the lead).
- [x] Finish the **Claude 101** course.

## Deliverables
- 5 ticket analyses and clarifying questions.
- Repro steps (steps, expected vs actual, environment) in the bug ticket.
- A failing test for the bug.
- Merge conflict #1 resolved.

## Definition of Done
- [ ] Someone else could reproduce the bug from your report alone.
- [ ] Evidence saved in `exercises/day-02-exercises.md`; 3 takeaways written.
