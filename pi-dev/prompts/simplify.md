---
description: Simplify the changed code (reuse, clarity, efficiency) and apply the fixes, behaviour unchanged (like Claude Code's /simplify)
argument-hint: "[base ref, default: HEAD (uncommitted changes)]"
---
Clean up the code in the current change set. Quality only: do not hunt for bugs (that is `/review`)
and do not change behaviour.

1. Diff: base `${1:-HEAD}` (`HEAD` = uncommitted work incl. untracked files, else
   `git diff ${1:-HEAD}...HEAD`). Read every changed file in full, plus the code it calls.
2. Look only at changed or added code, and only for:
   - **Reuse**: logic that duplicates an existing helper or another hunk → call/extract the shared one.
   - **Needless complexity**: speculative parameters/hooks/abstractions the change does not use,
     pass-through wrappers (middle man), deep nesting that an early return removes, dead code.
   - **Clarity**: names that do not say what a thing is or does; comments that restate the code.
   - **Efficiency**: repeated work in loops, N+1 calls, quadratic scans with an obvious linear form,
     needless copies/allocations — only where the fix is simple and local.
   Follow the repo's existing style; the repo's conventions win over these heuristics.
3. Apply the worthwhile fixes with `edit`. Skip anything that needs a design decision; list it instead.
4. Prove behaviour is unchanged: run the language skill's gate if one applies (`go`, `rust`,
   `frontend-checks`), otherwise the project's tests and linters.
5. Report: one line per change (file — what and why), anything skipped and why, and the gate result.
