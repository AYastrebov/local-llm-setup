---
name: plan
description: Turn an agreed feature into a short plan plus vertical-slice tickets under .scratch/<feature>/, before any code is written. Use when the user runs /skill:plan.
disable-model-invocation: true
---

# Plan

Writes `.scratch/<feature-slug>/plan.md` and one ticket file per slice under
`.scratch/<feature-slug>/issues/`. No code changes in this step.
Adapted from mattpocock/skills (to-spec + to-tickets), trimmed for a single local tracker.

## 1. Gather

- Work from the conversation first. If the user already ran `/skill:grill-me`, the decisions are made:
  **synthesize, don't re-interview**.
- Read the code the request touches. Prefer looking over asking.
- Without prior grilling, ask only what blocks the plan: **at most 3 questions in one message**, each with
  your recommended answer. Otherwise pick a sensible default and record it as a decision.

## 2. Choose test seams

Decide where the feature is tested: the **highest seam possible**, preferring existing ones (CLI entry,
public function, HTTP handler, module API). Fewer seams is better; one is ideal. Tests at a seam check
external behaviour, not implementation details.

## 3. Slice into tickets

Tracer-bullet **vertical slices**:
- Each cuts a narrow but complete path through every layer it touches and is verifiable on its own.
- Each fits one fresh context window (typically one to three files).
- Prefactor first: "make the change easy, then make the easy change".
- Give each ticket its **Blocked by** edges; a ticket with none can start immediately.
- A wide mechanical refactor (rename/retype across the codebase) is the exception: sequence it
  expand → migrate → contract instead of forcing it into a slice.

Show the breakdown as a numbered list (title · blocked by · what it delivers) and ask whether the
granularity and edges are right. Iterate until approved. If the user is not available to answer
(non-interactive run), write the files and say the breakdown is unreviewed.

## 4. Write the files

`plan.md` — a reader should finish it in two minutes:

```markdown
# <Title>

## Problem
What is wrong or missing, from the user's perspective. 1–3 sentences.

## Solution
What changes for the user. 2–4 sentences.

## Decisions
Only choices a reader could otherwise get wrong, one bullet each with its reason: interfaces,
data shapes, where code lives, libraries, error handling, trade-offs.
- **Test seams:** <seam(s)> and what a good test there checks.

## Out of scope
- ...

## Done when
Observable acceptance criteria, plus the full-suite / check command(s).
```

`issues/NN-<slug>.md`, numbered from `01` in dependency order, one file per ticket:

```markdown
# NN: <Ticket title>

Blocked by: None | 01, 02
Status: ready

## What to build
The end-to-end behaviour this ticket makes work, from the user's perspective.

## Acceptance
- [ ] criterion
- [ ] criterion

Verify: `<command that proves this ticket works>`
Files (hint): `path/a`, `path/b`
```

No full code in either file. File paths are hints only; the Decisions carry the design.

## 5. Hand off

List the ticket files and suggest: `/skill:implement .scratch/<feature-slug>`.
