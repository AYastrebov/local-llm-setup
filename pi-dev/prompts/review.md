---
description: Review the current changes for bugs in a fresh, read-only pi (like Claude Code's /code-review)
argument-hint: "[base ref, default: HEAD (uncommitted changes)] [focus...]"
---
Review a change set without editing anything.

1. Resolve the diff. Base = `${1:-HEAD}`. If the base is `HEAD`, the change is the uncommitted work
   (`git diff HEAD` plus untracked files from `git status --porcelain`); otherwise it is
   `git diff ${1:-HEAD}...HEAD`. Stop and say so if the diff is empty or the ref does not resolve.
2. Find context: a plan or spec for this change (`.scratch/*/plan.md` and tickets, an issue/PR the
   commits reference, a spec the user names), and the repo's standards (`AGENTS.md`, `CONTRIBUTING.md`).
3. Run the review in a fresh read-only pi so it is not biased by this session, and wait for it:

   ```
   PI_NW_FLEX=1 pi -p --no-skills --tools read,bash --model neuralwatt/glm-5.3:high "<prompt>" < /dev/null
   ```

   with this prompt (fill in the diff command, spec path or "none", standards files, focus):

   > Review the change produced by `<diff command>` (run it; read the surrounding code, not just the
   > hunks). Spec: <path or none>. Standards: <files or none>. Extra focus: ${@:2}.
   > Report only real problems, most severe first:
   > (1) correctness: bugs, broken edge cases, races, resource leaks, error handling, security;
   > (2) spec fidelity: missed requirements, behaviour the spec did not ask for;
   > (3) missing tests for new behaviour.
   > For each: severity (high/medium/low), file:line, what is wrong, a concrete failure scenario
   > (input/state → wrong result), and a 1-2 line fix. Before reporting a finding, re-read the code
   > to confirm it; drop anything you cannot back with a scenario. No style nits, no praise.
   > If nothing survives, say "No findings".

4. Present the findings as returned, grouped by severity. Do not fix anything unless I ask; then
   suggest `/simplify` for cleanups or fix the listed bugs one by one.
