# Language Server Setup

LSP (Language Server Protocol) servers give coding agents real code intelligence - go-to-definition,
symbol search, completion context, and live diagnostics. Without them an agent can still read files,
but it loses the structured signal ("this symbol is unused", "the type doesn't match here").

pi gets LSP from the `pi-lsp-extension` package listed in `pi-dev/settings-mac.json`. Go, Rust,
TypeScript and JavaScript have built-in defaults and need no configuration. Anything else goes in a
per-project `.pi-lsp.json` - see `pi-dev/pi-lsp.json` for a template, which currently adds Kotlin:

```json
{
  "servers": {
    "kotlin": { "command": "kotlin-lsp", "args": ["--stdio"] }
  },
  "autoStart": []
}
```

Install only the servers you actually use; a missing binary just means that language has no LSP.


## Install commands

### Fedora

```bash
# Go (only if you don't already have a Go toolchain)
go install golang.org/x/tools/gopls@latest

# Rust — system Rust is installed via dnf, so rust-analyzer goes through dnf too
sudo dnf install rust-analyzer

# TypeScript / JavaScript / Vue
npm install -g typescript-language-server typescript @vue/language-server

# Kotlin (alpha — https://github.com/Kotlin/kotlin-lsp)
# No Homebrew on Fedora — install manually from releases:
# https://github.com/Kotlin/kotlin-lsp/releases
KOTLIN_LSP_DIR=~/tools/kotlin-lsp   # or wherever you extract it
chmod +x $KOTLIN_LSP_DIR/kotlin-lsp.sh
ln -s $KOTLIN_LSP_DIR/kotlin-lsp.sh ~/.local/bin/kotlin-lsp
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

# Kotlin (alpha — https://github.com/Kotlin/kotlin-lsp)
brew install JetBrains/utils/kotlin-lsp
```

## Verifying installation

After installing, check each binary resolves:

```bash
for cmd in gopls typescript-language-server rust-analyzer vue-language-server kotlin-lsp; do
  command -v "$cmd" >/dev/null 2>&1 && echo "✓ $cmd" || echo "✗ $cmd"
done
```

When you next launch pi in a project of the matching language, the LSP starts in the background. To confirm it's wired up, open a file and ask the agent to find a symbol or look up a definition — if it returns precise file/line locations, the LSP is working.
