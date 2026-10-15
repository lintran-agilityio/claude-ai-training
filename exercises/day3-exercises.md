# Day 3 – Reproduce a seeded bug, failing test, Git rebase

Role: **Developer**

## Exercise brief

- Workshop: each pair takes one seeded bug ticket. Get the app running locally from scratch, reproduce the bug, write exact repro steps into the ticket.
- Claude habit: paste the stack trace / relevant code into chat, ask for hypotheses, verify each by running, not by trusting.
- Exercise: express the bug as a failing test if possible (devs write it; BA/QA describe the assertion and pair with a dev).
- Git block: `pull --rebase`, reading `git log` / `git diff`, merge conflict #1 (lead seeds a conflict deliberately).

## Prerequisites

- The repo in `exercises/manage-homestay/` only has tickets and docs, no app source code.
- Ask the lead for: (1) the workshop app repo, (2) the seeded bug ticket assigned to our pair.

## Checklist (Dev)

### 1. Run the app locally from scratch
- [ ] Clone the repo, read the README
- [ ] Install dependencies
- [ ] Create `.env`
- [ ] Start the app
- [ ] Note every setup problem hit (missing env var, wrong version, ...)

### 2. Reproduce the bug and write repro steps into the ticket

```
Environment: OS, Node/Python version, branch/commit
Steps 1..n:  action + concrete input data
Expected:    ...
Actual:      ... (with stack trace / log)
Frequency:   always / intermittent
```

### 3. Work with Claude
- Paste the stack trace and relevant code into chat.
- Prompt: *"Give 3 hypotheses for the cause, ranked by likelihood. For each, give a concrete command or test to verify it."*
- Run every verification. Record rejected hypotheses too.

| # | Hypothesis | How verified | Result |
|---|---|---|---|
| 1 | | | |
| 2 | | | |
| 3 | | | |

### 4. Write the bug as a failing test
- [ ] Test fails only because of this bug (not config or import errors)
- [ ] Name describes behaviour, e.g. `rejects_overlapping_booking`
- [ ] Ran it and confirmed it fails with the expected message
- [ ] No fix yet, unless the workshop asks for it
- [ ] If paired with BA/QA, they confirm the assertion matches the expected behaviour

### 5. Git block

```bash
git checkout -b fix/<ticket-id>
git pull --rebase origin main     # lead seeds a conflict here
git log --oneline -10             # read history
git diff origin/main              # read changes
# on conflict:
git status                        # find conflicted files
# edit the <<<<<<< ======= >>>>>>> blocks, then:
git add <file>
git rebase --continue
```

- Read both sides of a conflict to understand the intent; do not blindly pick "ours" or "theirs".
- Claude can explain a conflict, but verify the result and re-run the tests after merging.

## Deliverables

- [ ] Ticket updated with exact repro steps
- [x] Failing test committed on its own branch (commit `9667a73`, then fixed in `57e91a2`)
- [ ] Notes on hypotheses tried (confirmed / rejected)
- [ ] Merge conflict #1 resolved

## Notes / results

### What I did

| Step | Result |
|---|---|
| Seed a bug | Branch `feat/seed-bug`: in `booking.repository.ts:109`, `checkOutDate > :checkInDate` changed to `>=` (Claude seeded it for practice). Ticket: [BUG-HS-001](manage-homestay/tickets/bug-hs-001.md). |
| Blind practice branch | `practice/blind-bug`: bug and ticket squashed into one commit, answer key kept out of git. |
| Fix branch | `fix/hs-001-checkout-day-overlap`, pushed to GitLab. |
| Failing test | `9667a73` + `66d8f73`: integration test against real PostgreSQL. Result: 1 failed, 8 passed. |
| Fix | `57e91a2`: `>=` back to `>`. Result: 9 passed. |
| Bug report | Written in [day-02-exercises.md](day-02-exercises.md), Part 3. |
| PR description | Drafted with Claude in [mr-description-hs-001.md](manage-homestay/analysis/mr-description-hs-001.md) (what / why / how tested / screenshots), then edited by hand. Branch pushed; I added the screenshots and opened the MR on GitLab against `practice/blind-bug`. |

### The bug (real example)

- **Symptom:** room booked 10-12 refuses a new booking 12-14 (`409 ... not available for the selected dates`). Gap day 13-15 works.
- **Cause:** stay is `[check_in, check_out)` (rule A1), but the query treated check-out day as occupied.
- **Evidence:** only the case "new check-in == old check-out" failed; the other 8 cases (touching before, gap day, 4 real overlaps, cancelled, `excludeBookingId`) passed.
- **Why a unit test with a mocked repository would not catch it:** the rule lives in the SQL string, so the test needs a real database.

### Hypotheses

| # | Hypothesis | How verified | Result |
|---|---|---|---|
| 1 | Off-by-one in the overlap condition in `hasOverlappingBooking` | Integration test with boundary cases | Confirmed: only 12-14 failed |
| 2-3 | Not tried | | The cause was found by reading the code first, so no other hypotheses were tested. |

### Writing the PR description

- Checked the description against the real diff (`git diff practice/blind-bug...HEAD`). The first draft missed the `day-02-exercises.md` change, so I added it to "What".
- A relative link to the ticket breaks on GitLab, so I used a plain path.
- "How tested" has the exact commands and the before/after commits (`66d8f73` fails, `57e91a2` passes), so a reviewer can reproduce it from the description alone.
- "Notes for the reviewer" states what is **not** tested (HTTP endpoint, AI assistant), so nobody assumes more coverage than there is.

### Example: Create PR description (comparing my two prompts)

**Prompt A** (short):

```
Write a PR description for my changes
```

**Prompt B** (structured, translated to English):

```
I fixed the bug: wrong to compare date time to find whether a room fits the booked periods.
Create a PR description.
Use ONLY facts from the diff and the commit message.
Do not invent test results. Keep it under 150 words.
Do not run git push, git commit or any gh command.
## What (1-2 sentences)
## Why (link "Closes #7", one sentence on user impact)
## How tested (use the commands in [source left blank]; leave "[screenshot of test output]" as a placeholder)
## Notes for reviewer (files changed, what I did NOT change)
```

| Criterion | A | B |
|---|---|---|
| Target (which diff) | Not stated. `git status` showed only untracked files, so "my changes" was ambiguous. | "Diff and commit message" is named, but not the base branch. |
| Format | None. Claude chose the sections. | Four fixed sections with a size for each. |
| Length | None. | Under 150 words. |
| Evidence | None. | "Do not invent test results", screenshot left as a placeholder. |
| Facts | Claude used memory of the session. | "Use ONLY facts from the diff", so the output stayed in the diff. |
| Safety | Not stated. | No `git push`, `git commit` or `gh`. |
| Reviewer help | Added "Notes" on its own. | Asks for files changed and what was NOT changed. |
| Accuracy of my input | Nothing to get wrong. | My cause ("compare date time") did not match the diff (`>=` to `>` on a `date` column). Claude followed the diff and flagged it. |
| Gaps | Everything above. | `Closes #7` was not verifiable (no issue #7 in the repo); "the commands in ;" was blank; base branch missing. |

**Which is better: B.**

- Its output was about 120 words, matched the diff and listed what was not tested. A's output was long and contained a claim nobody had checked ("Room search is not affected").
- B's constraints are the reason: format, size, source of facts, allowed actions.
- B still has gaps. A forced `Closes #7` and a wrong cause statement are inputs I must check myself. "Use ONLY the diff" also hides context Claude may need, such as the ticket and rule A1.

**Best version** (B plus what it missed):

```
Write the MR description for branch fix/hs-001-checkout-day-overlap, target practice/blind-bug.
Read: git diff practice/blind-bug...HEAD and the commit messages. Use ONLY facts from them.
Do not invent test results. Under 150 words. Do not run git push, git commit or any gh command.
## What (1-2 sentences)
## Why (ticket BUG-HS-001; one sentence on user impact)
## How tested (cd apps/api; docker compose up -d; pnpm exec jest booking.repository; keep "[screenshot of test output]")
## Notes for reviewer (files changed, what I did NOT change)
Mark anything you could not verify from the diff, including my own description of the cause.
```

### Lessons

- Run the test before the fix and keep the output; "fails for the right reason" is the evidence.
- A test that only fails with config errors proves nothing: check the failure message.
- Before I ran it, the report said "not reproduced". Update the status once you have real evidence.
- Not done yet: merge conflict #1 (`pull --rebase`), peer swap, review of the partner's MR (at least 3 actionable comments).

## Lesson learned

- A good prompt names the target (base branch, diff, issue) and includes real evidence like test results. Claude cannot guess these.
- "Use ONLY the facts" stops Claude from inventing things, but it can also hide context Claude needs. Let it read more, and ask it to label what it could not verify.
- When comparing a raw and an improved prompt, start each one from a clean state. Before trusting a review, check that Claude is looking at the right diff.
- Claude is a second reader, not the decider. I have the real context, so I judge each comment myself.
