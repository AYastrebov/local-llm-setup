---
name: frontend-checks
description: Quality gate and browser verification for JS/TS frontend projects (Vue, Svelte/SvelteKit, Vite). Use when editing, testing or reviewing a project with a package.json that depends on vue, svelte or vite.
---

# Frontend checks

Framework rules live in their own skills: `vue-best-practices` (+ pinia/router/testing) for Vue,
`svelte-core-bestpractices` and `svelte-code-writer` for Svelte. This skill is the gate that proves a
change is done.

## 0. Detect the project

- Package manager from the lockfile: `pnpm-lock.yaml` → pnpm, `bun.lock` → bun, `yarn.lock` → yarn,
  otherwise npm. Use it for every command below (`<pm> run …`, `<pm> exec …`).
- Framework from `package.json` dependencies: `vue`, `svelte` / `@sveltejs/kit`, plus `vitest`,
  `eslint`, `oxlint`, `prettier`, `@biomejs/biome`.
- **Project scripts win.** If `package.json` has `lint`, `typecheck`/`check`, `test`, `format:check`,
  run those instead of the fallbacks below.

## 1. Gate (run before declaring a change done)

`lsp_diagnostics` is **not** reliable for `.vue` / `.svelte` files (it can report "clean" with type
errors present); the type-check step below is the source of truth.

| Step | Vue | Svelte / SvelteKit |
|---|---|---|
| Types | `<pm> exec vue-tsc --noEmit` (or `-b` with project references) | `<pm> run check` (svelte-kit sync + svelte-check) or `<pm> exec svelte-check` |
| Framework | — | `npx @sveltejs/mcp svelte-autofixer <file>` on every changed `.svelte` file; fix all issues |
| Lint | project ESLint; without one: `npx -y oxlint@latest` | same |
| Format | project Prettier/Biome check, if configured | same |
| Tests | `<pm> exec vitest run` (only changed specs while iterating) | same |
| Build | `<pm> run build` at the end of a plan, or when config/routing changed | same |

Fix every error in code you touched. Do not add `// @ts-ignore`, `eslint-disable` or `any` to get
green unless the ticket says so; explain any exception in a comment.

## 2. Browser check (UI changes only)

1. Start the dev server in the background on a free port and remember to stop it:
   `<pm> run dev -- --port 5199 > /tmp/dev-5199.log 2>&1 & echo $!`
2. With the `chrome-devtools` MCP tools: open `http://localhost:5199/<route>`, take a snapshot or
   screenshot of the changed UI, and read the console messages: **no errors or Vue/Svelte warnings**.
3. For layout or performance work, run `lighthouse_audit` and report accessibility and performance
   scores; fix new accessibility violations.
4. Kill the dev server (`kill <pid>`).

Prefer `playwright` MCP tools for scripted multi-step flows (forms, navigation); use
`chrome-devtools` for console, network and performance evidence.
