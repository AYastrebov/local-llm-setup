---
name: plan
description: Turn a feature request into one short plan document (goal, key decisions, task checklist) before any code is written. Use when the user runs /skill:plan.
disable-model-invocation: true
---

# Plan

Produce **one** document: `docs/plans/<topic>.md` (kebab-case topic). No code changes in this step.

## 1. Understand

- Read the code the request touches. Prefer looking over asking.
- If something important is still ambiguous, ask **at most 3 questions in a single message**, each with your recommended answer. Skip questions you can answer with a sensible default; state the default in the plan instead.

## 2. Write the plan

Keep it short — a reader should finish it in two minutes. Use this shape:

```markdown
# <Title>

## Goal
What changes for the user, in 2–4 sentences. Non-goals as a short list if they prevent scope creep.

## Decisions
Only choices that matter and that a reader could otherwise get wrong:
data shapes, interfaces, where code lives, libraries, error handling, trade-offs taken.
One bullet each, with the reason. Skip anything obvious from the code.

## Tasks
- [ ] 1. <imperative title>
  Files: `path/a`, `path/b`
  Change: what to do, 1–3 lines. Name functions/types; no full code.
  Verify: `<command that proves it works>`
- [ ] 2. ...

## Done when
Observable acceptance criteria, plus the command(s) that check them.
```

Task rules:
- Each task is self-contained: a worker that sees **only this task and the Decisions section** can do it.
- Order tasks so each one leaves the build/tests green.
- Small: one focused change, typically one to three files.
- Every task has a concrete `Verify:` command (test, build, script run). "Manually check" only when nothing else is possible.

## 3. Hand off

Show the plan path and the task list, and ask the user to review it. Implementation starts with `/skill:implement docs/plans/<topic>.md`.
