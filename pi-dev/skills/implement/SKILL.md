---
name: implement
description: Execute a plan from docs/plans/ task by task with fresh pi workers, verify each task, then run one final review. Use when the user runs /skill:implement <plan path>.
disable-model-invocation: true
---

# Implement

You are the coordinator. You do not write the code yourself; workers do. You verify, track progress, and report.

Models (edit here to change):
- Worker: `router/auto` — a cheap qualifier (`nw-flash`) rates each task; hard ones start on `glm-5.3`, everything else runs on `glm-5.3-flash`
- Reviewer: `neuralwatt/glm-5.3:high`

## 0. Start

- Read the plan given as the argument. Stop and ask if it has no `## Tasks` checklist.
- Require a clean git tree (`git status --porcelain` empty) except for the plan file itself; otherwise ask the user first.
- Record the base commit: `git rev-parse HEAD`. You need it for the review.

## 1. For each unchecked task, in order

1. Write the worker prompt to a temp file (`mktemp`):

   ```
   You are implementing one task of a larger plan. Do only this task.

   Plan context (read for decisions, do not edit the plan): <plan path>, section "Decisions".

   Task:
   <the task's full text: title, Files, Change, Verify>

   Rules:
   - Stay within the listed files unless the change truly requires another; say so if it does.
   - Follow the existing code style. No unrelated refactors, no new dependencies unless the task says so.
   - Run the Verify command and fix until it passes.
   - Do not commit. Do not edit the plan.
   - End with: files changed, the Verify command, and its result (pass/fail with the key output lines).
   ```

2. Run it with bash and wait:
   `pi -p --no-skills --model router/auto "$(cat <prompt file>)"`
3. **Run the task's Verify command yourself.** Do not rely on the worker's report.
4. Pass → tick the box in the plan (`- [x]`) and continue.
   Fail → run one more worker with the same prompt plus the failing output appended. If it still fails, stop and report to the user with the output. Do not attempt a third time.

Keep your own messages short between tasks: one line per task (`3/7 ✓ <title>`).

## 2. Final review (once, after all tasks pass)

Run a read-only reviewer:

`pi -p --no-skills --tools read,bash --model neuralwatt/glm-5.3:high "<prompt>"`

with this prompt (fill in base commit and plan path):

```
Review the change `git diff <base>` (run it) against the plan <plan path>.
Report only real problems: bugs, missed requirements from Goal/Done when, decisions that were not followed,
security issues, missing tests for new behaviour. No style nits.
For each: severity (high/medium/low), file:line, what is wrong, suggested fix (1-2 lines).
If nothing is wrong, say "No findings".
```

- High/medium findings → append them to the plan under `## Review fixes` as new tasks (same shape, with `Verify:`), and run them through step 1. Do not review a second time.
- Low findings → list them for the user; do not fix automatically.

## 3. Report

- Tasks done, retries used, review findings and what was fixed.
- Run the plan's `Done when` command(s) and show the result.
- `git diff --stat <base>`. Do not commit — the user decides.
