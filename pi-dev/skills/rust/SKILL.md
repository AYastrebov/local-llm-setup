---
name: rust
description: Rust development workflow with rust-analyzer (via pi-lsp-extension) and cargo quality gates. Use when working in a Cargo project (Cargo.toml present) — reading, editing, testing or reviewing Rust code.
---

# Rust in pi

Code intelligence comes from rust-analyzer through `pi-lsp-extension`: `lsp_symbols`, `lsp_hover`,
`lsp_definition`, `lsp_references`, `lsp_diagnostics`, `lsp_code_actions`, `lsp_rename`.
After every `edit`/`write`, compile errors for that file are appended to the result once the server
is running — read them before moving on.

**Warm-up:** the first `lsp_*` call starts the server and may answer from the tree-sitter fallback
(`syntax only, no type checking`). That is not a clean result: wait ~20 s and call again.

## Read workflow

1. `cargo metadata --no-deps --format-version 1` (or read `Cargo.toml`) to learn crates, features
   and workspace members.
2. Locate symbols with `lsp_symbols` (workspace query) instead of grepping for `fn`/`struct`.
3. Use `lsp_hover` for types and trait bounds instead of guessing; it resolves generics and macros.

## Edit workflow

1. Before changing a public item, `lsp_references` on it and read every call site.
2. Prefer `lsp_rename` / `lsp_code_actions` for renames, imports and trait stubs over manual edits.
3. After edits: `cargo check --all-targets` (fast), fix errors, then `lsp_diagnostics` on touched files
   for anything `cargo check` misses (e.g. unused items in tests).
4. Design rules: no `unwrap()`/`expect()` in library code paths that can fail at runtime (return
   `Result`); no `clone()` added just to silence the borrow checker without saying why; no new
   `unsafe` unless the task requires it, with a `// SAFETY:` comment.

## Quality gate (run before declaring a change done)

```bash
cargo fmt --all --check
cargo clippy --all-targets --all-features -- -D warnings
cargo nextest run          # falls back to: cargo test (nextest does not run doctests:
cargo test --doc           #   run them separately when the crate has any)
cargo deny check           # only when Cargo.toml / Cargo.lock changed and deny.toml exists
```

Fix every failure in code you touched. Do not add `#[allow(...)]` to silence clippy unless the ticket
says so; if a lint is genuinely wrong for this code, explain why in a comment next to the allow.
