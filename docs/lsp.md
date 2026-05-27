# Language Server Setup for opencode

opencode uses LSP (Language Server Protocol) servers to give the AI agents real code intelligence — go-to-definition, symbol search, completion context, and live diagnostics. Without LSPs, agents can still read files, but they lose the structured signal that LSP provides (e.g., "this symbol is unused", "the type doesn't match here", "this import is wrong").

The opencode configs in this repo declare four language servers:

| Language | Server | Triggered by |
|---|---|---|
| Go | `gopls` | `.go` files |
| TypeScript / JavaScript | `typescript-language-server` | `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, etc. |
| Rust | `rust-analyzer` | `.rs` files |
| Vue | `vue-language-server` | `.vue` files |

opencode silently skips any server whose binary isn't on `PATH` — you only need to install the ones you actually use.

## Install commands

### Fedora

```bash
# Go (only if you don't already have a Go toolchain)
go install golang.org/x/tools/gopls@latest

# Rust — system Rust is installed via dnf, so rust-analyzer goes through dnf too
sudo dnf install rust-analyzer

# TypeScript / JavaScript / Vue
npm install -g typescript-language-server typescript @vue/language-server
```

> **Why dnf for Rust:** the official Rust docs suggest `rustup component add rust-analyzer`, but that only works when Rust itself is managed by `rustup`. On Fedora 43+ where Rust is a system package (`rust.x86_64`), use dnf.

### macOS

```bash
# Go
go install golang.org/x/tools/gopls@latest

# Rust
brew install rust-analyzer

# TypeScript / JavaScript / Vue
npm install -g typescript-language-server typescript @vue/language-server
```

## Verifying installation

After installing, check each binary resolves:

```bash
for cmd in gopls typescript-language-server rust-analyzer vue-language-server; do
  command -v "$cmd" >/dev/null 2>&1 && echo "✓ $cmd" || echo "✗ $cmd"
done
```

When you next launch opencode in a project of the matching language, the LSP starts in the background. To confirm it's wired up, open a file and ask the agent to find a symbol or look up a definition — if it returns precise file/line locations, the LSP is working.

## Adding a new language

The config block lives at the top of each `opencode-*.jsonc` template:

```jsonc
"lsp": {
  "gopls":      { "command": ["gopls"] },
  "typescript": { "command": ["typescript-language-server", "--stdio"] },
  "rust":       { "command": ["rust-analyzer"] },
  "vue":        { "command": ["vue-language-server", "--stdio"] }
}
```

To add another language, append an entry with `command` set to the server binary and (optionally) its flags. opencode auto-detects file extensions for the languages it has built-in support for; for anything exotic, you may also need an `extensions` array.

See the [opencode LSP docs](https://opencode.ai/docs/lsp/) for the full schema (env vars, custom extensions, disabling auto-download).

## Disabling LSP auto-download

opencode tries to fetch some language servers on first use. To turn that off and only rely on what's installed manually:

```bash
export OPENCODE_DISABLE_LSP_DOWNLOAD=1
```

Add it to `~/.zshrc` if you want this permanent.
