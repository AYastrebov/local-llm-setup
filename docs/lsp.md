# Language Server Setup

LSP (Language Server Protocol) servers give coding agents real code intelligence - go-to-definition,
symbol search, completion context, and live diagnostics. Without them an agent can still read files,
but it loses the structured signal ("this symbol is unused", "the type doesn't match here").

pi gets LSP from `pi-lsp-extension` (our fork, see the status below), listed in both `pi-dev/settings-*.json`. Besides the
`lsp_*` tools it appends compile errors to every `edit`/`write` result once the server for that
language is running (errors only, max 10 lines). For Go, pi additionally uses gopls's official MCP
server (see [mcp.md](mcp.md)) and the `go` skill. Go, Rust,
TypeScript and JavaScript have built-in defaults (TypeScript 7 is detected automatically). Anything
else goes in a
per-project `.pi-lsp.json` - see `pi-dev/pi-lsp.json` for a template, which currently adds Kotlin:

```json
{
  "servers": {
    "kotlin": {
      "command": "kotlin-lsp",
      "args": ["--stdio", "--system-path", "/Users/<you>/.cache/kotlin-lsp"]
    }
  },
  "autoStart": []
}
```

Install only the servers you actually use; a missing binary just means that language has no LSP.

`--system-path` is worth setting for Kotlin. Without it the server puts its caches and indexes in a
`/var/folders/...` temp directory that macOS sweeps, so every start re-indexes the project from
scratch. Point it somewhere stable and the index survives restarts.

> **Read the Kotlin section below before installing it.** These builds expire on a hard date and
> stop working with no warning.


## Verified status (pi 1.0.2 + pi-lsp-extension fork, 2026-10-05)

pi uses **[AYastrebov/pi-lsp-extension](https://github.com/AYastrebov/pi-lsp-extension)**, a fork of
`samfoy/pi-lsp-extension` 1.4.0 (`pi install git:github.com/AYastrebov/pi-lsp-extension`). Upstream
1.4.0 never opened documents before LSP requests and answered `lsp_diagnostics` from an empty cache,
so servers that only analyze opened files (typescript-language-server, kotlin-lsp) always looked
"clean". The fork opens the file first, uses pull diagnostics when offered or waits for the first
push, and runs TypeScript 7's native `tsc --lsp --stdio` automatically. Planted-type-error results:

| Language | Upstream 1.4.0 | Fork | Notes |
|---|---|---|---|
| Go (gopls) | ✅ | ✅ | plus gopls's own MCP server (`docs/mcp.md`) |
| Rust (rust-analyzer) | ✅ | ✅ | indexing takes ~20-30 s on first use |
| TypeScript 6 / JavaScript | ❌ "clean" | ✅ | `typescript-language-server` |
| TypeScript 7 | ❌ "clean" | ✅ | auto-detected: project has no `lib/tsserver.js` → project's `tsc --lsp --stdio` |
| Kotlin | ❌ "clean" | ✅ | `kotlin-lsp` 263.6379.0, Gradle project |
| Vue | ❌ "clean" | ❌ "clean" | `@vue/typescript-plugin` hybrid still does not report; use `vue-tsc` |
| Svelte | not mapped | not mapped | use `svelte-check` |

**Warm-up:** the first `lsp_*` call for a language starts its server; until it is up the tools answer
from tree-sitter and (in the fork) say the server is starting. Call again after a few seconds.

`docs/lsp-probe.cjs` checks a server outside pi: `FILE=<file> LANG_ID=<lang> node docs/lsp-probe.cjs
<server> [args]` prints pushed and pulled diagnostics.

## Install commands

### Fedora

```bash
# Go (only if you don't already have a Go toolchain)
go install golang.org/x/tools/gopls@latest

# Rust — system Rust is installed via dnf, so rust-analyzer goes through dnf too
sudo dnf install rust-analyzer

# TypeScript / JavaScript (TS 6 projects); Vue server is for editors only
npm install -g typescript-language-server typescript @vue/language-server

# Kotlin — standalone archive from https://github.com/Kotlin/kotlin-lsp/releases (see "builds expire")
V=263.6379.0   # latest as of 2026-10-03
U=https://download.jetbrains.com/language-server/kotlin-server/$V
curl -fLO $U/kotlin-server-$V.tar.gz && curl -fLO $U/kotlin-server-$V.tar.gz.sha256
echo "$(cut -d' ' -f1 kotlin-server-$V.tar.gz.sha256)  kotlin-server-$V.tar.gz" | sha256sum -c
mkdir -p ~/VibeProjects/LSP && tar -xzf kotlin-server-$V.tar.gz -C ~/VibeProjects/LSP
ln -sfn ~/VibeProjects/LSP/kotlin-server-$V/bin/intellij-server ~/.local/bin/kotlin-lsp
kotlin-lsp --stdio </dev/null; echo "exit=$?"   # 0 = good, 7 = expired
```

Note `kotlin-lsp.sh` is deprecated as of the 263 builds - it prints a warning and just execs
`bin/intellij-server`. Link the binary directly.

> **Why dnf for Rust:** the official Rust docs suggest `rustup component add rust-analyzer`, but that only works when Rust itself is managed by `rustup`. On Fedora 43+ where Rust is a system package (`rust.x86_64`), use dnf.

### macOS

```bash
# Go
go install golang.org/x/tools/gopls@latest

# Rust
brew install rust-analyzer

# TypeScript / JavaScript (TS 6 projects); Vue server is for editors only
npm install -g typescript-language-server typescript @vue/language-server

# Kotlin — see "Kotlin LSP builds expire" below FIRST; brew may hand you a dead binary
brew install JetBrains/utils/kotlin-lsp
```

## Kotlin LSP builds expire

`kotlin-lsp` is JetBrains' `intellij-server` underneath, and these preview builds carry a hard
expiry date. When it passes, the server stops working with no warning:

```
$ kotlin-lsp --stdio </dev/null
This build of intellij-server has expired.
The IDE will now close.
exit=7
```

pi surfaces this as `[LSP kotlin] Server exited with code 7`. Nothing is misconfigured - the binary
just refuses to run. `--version` and `--help` still work, which makes it look healthy at a glance.

### The trap: brew can be current and still broken

Hit on macOS on 2026-09-09. The installed build `LS-262.9593.0` had expired, and there was no fix
available through the normal channel:

| Source | Build | State |
|--------|-------|-------|
| Newest GitHub release (`v262.9593.0`, 2026-07-27) | `LS-262.9593.0` | expired |
| `brew install JetBrains/utils/kotlin-lsp` | `LS-262.9593.0` | same expired build |
| JetBrains marketplace channel | `ILS-263.4702.0` (2026.3 EAP) | current, works |

The `jetbrains/utils` tap was **not** stale - it sat at origin HEAD with zero commits behind. The
formula upstream still pinned `262.9593.0`, last touched 2026-07-27 (`LSP-1514 Update Kotlin LSP
version to 262.9593.0`), the same day as the last GitHub release. So `brew update && brew upgrade`
changes nothing; JetBrains had simply moved on to a `263.*` line published elsewhere.

Check the two facts before concluding anything:

```bash
kotlin-lsp --version                                    # what you have
cat "$(brew --repository jetbrains/utils)/Formula/kotlin-lsp.rb" | grep -m1 'version "'
```

### Installing a build newer than the formula

Only worth doing when the formula is behind and the current build has expired. Grab the standalone
server, which ships inside the marketplace package - it is a plain zip, and `extension/server/` is
the same CLI server, so this needs no editor:

```bash
curl -sL -o kotlin-server.vsix \
  "https://marketplace.visualstudio.com/_apis/public/gallery/publishers/JetBrains/vsextensions/kotlin-server/<version>/vspackage" \
  -H "Accept-Encoding: gzip"
gunzip -c kotlin-server.vsix > server.zip 2>/dev/null || mv kotlin-server.vsix server.zip
unzip -q server.zip 'extension/server/*'
cat extension/server/build.txt        # confirm it is newer than what you have

VER=$(sed 's/^ILS-//' extension/server/build.txt)
mkdir -p ~/.local/share/kotlin-lsp
cp -R extension/server ~/.local/share/kotlin-lsp/$VER
chmod +x ~/.local/share/kotlin-lsp/$VER/bin/*
brew uninstall kotlin-lsp                               # drop the dead copy
ln -sfn ~/.local/share/kotlin-lsp/$VER/bin/intellij-server ~/.local/bin/kotlin-lsp
kotlin-lsp --stdio </dev/null; echo "exit=$?"           # 0 = good, 7 = still expired
```

Query the current marketplace version with:

```bash
curl -s -X POST "https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery" \
  -H "Content-Type: application/json" -H "Accept: application/json;api-version=7.2-preview.1" \
  -d '{"filters":[{"criteria":[{"filterType":7,"value":"JetBrains.kotlin-server"}]}],"flags":403}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['results'][0]['extensions'][0]['versions'][0]['version'])"
```

Costs and caveats, so this is a deliberate choice rather than a default:

- ~1.1 GB extracted, and **unmanaged by brew** - `brew upgrade` will not maintain it
- still an EAP build, so **it will expire too**, just later
- `~/.local/bin` must precede `/opt/homebrew/bin` on PATH, or the brew copy wins

**Go back to brew** once the formula moves past your manual build:

```bash
rm -rf ~/.local/share/kotlin-lsp ~/.local/bin/kotlin-lsp
brew install JetBrains/utils/kotlin-lsp
```

### If you would rather not chase builds

`fwcd/kotlin-language-server` (`brew install kotlin-language-server`) has no expiry and is in brew
core, but its latest release is from January 2025, so it lags badly on newer Kotlin syntax. It
speaks stdio by default - drop the `--stdio` flag if you switch. Otherwise just remove `kotlin` from
`autoStart` in `.pi-lsp.json` and work without Kotlin LSP until a new build lands.

## Verifying installation

After installing, check each binary resolves:

```bash
for cmd in gopls typescript-language-server rust-analyzer vue-language-server kotlin-lsp; do
  command -v "$cmd" >/dev/null 2>&1 && echo "✓ $cmd" || echo "✗ $cmd"
done
```

When you next launch pi in a project of the matching language, the LSP starts in the background. To confirm it's wired up, open a file and ask the agent to find a symbol or look up a definition — if it returns precise file/line locations, the LSP is working.
