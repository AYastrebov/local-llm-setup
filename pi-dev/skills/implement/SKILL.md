---
name: implement
description: Implement the tickets in a .scratch/<feature>/ plan one at a time with fresh pi workers, verify and commit each, then run one final review. Use when the user runs /skill:implement <feature dir>.
disable-model-invocation: true
---

# Implement

You coordinate; workers write the code. You pick tickets, verify, commit, and report.

Models (edit here to change):
- Worker: `router/auto` — a cheap qualifier (`nw-flash`) rates each ticket; hard ones start on `glm-5.3`, everything else runs on `glm-5.3-flash`
- Reviewer: `neuralwatt/glm-5.3:high`

## 0. Start

- Argument: the feature directory (`.scratch/<feature-slug>`). Read `plan.md` and every file in `issues/`.
- The working tree must be clean apart from `.scratch/` (`git status --porcelain -- . ':!.scratch'` empty);
  otherwise ask the user first.
- Record the base commit: `git rev-parse HEAD`.

## 1. Work the frontier

Repeat until no ticket has `Status: ready`:

1. Pick the **lowest-numbered** ticket with `Status: ready` whose `Blocked by` tickets are all `Status: done`.
   If ready tickets remain but none is unblocked, stop and report the cycle.
2. Run a fresh worker with bash and wait (point to files, don't paste them):

   ```
   pi -p --no-skills --model router/auto "Implement ticket <ticket path> of the plan <plan path>.
   Read both first; follow the plan's Decisions and test at its Test seams.
   Work test-first: read and follow ~/.pi/agent/skills/tdd/SKILL.md.
   Stay within the ticket's scope; no unrelated refactors or new dependencies unless the ticket says so.
   Run single test files and any typecheck as you go, and the ticket's Verify command before finishing.
   Do not commit and do not edit anything under .scratch/.
   End with: files changed, the Verify command, and its result."
   ```

3. **Run the ticket's Verify command yourself**; do not rely on the worker's report.
4. Pass →
   - Tick the ticket's Acceptance boxes, set `Status: done`.
   - Commit the code (never `.scratch/`): `git add -A -- . ':!.scratch'` then
     `git commit -m "<NN>: <ticket title>"`. If the commit fails (e.g. a signing prompt), retry once,
     then stop and report.
5. Fail → run one more worker with the same prompt plus the failing output appended. If it still
   fails, set `Status: blocked`, stop, and report the output. Never a third attempt.

One line per ticket in your messages (`02/05 ✓ <title> (abc1234)`).

## 2. Final review (once)

After the last ticket, run the full test suite / checks from `Done when`, then a read-only reviewer:

```
pi -p --no-skills --tools read,bash --model neuralwatt/glm-5.3:high "Review `git diff <base>..HEAD`
(run it) against <plan path> and the tickets in <issues dir>. Two axes: (1) spec fidelity: missed
acceptance criteria or Done-when items, Decisions not followed, tests not at the agreed seams;
(2) correctness: bugs, security issues, missing tests for new behaviour. No style nits. For each:
severity (high/medium/low), file:line, what is wrong, suggested fix (1-2 lines). If nothing is wrong,
say 'No findings'."
```

- High/medium findings → write them as new tickets (next free numbers, `Blocked by: None`,
  `Status: ready`) and work them through step 1. Do not review a second time.
- Low findings → list them for the user only.

## 3. Report

Tickets done/blocked, retries used, commits (`git log --oneline <base>..HEAD`), review findings and
what was fixed, and the result of the `Done when` checks. Do not push.
