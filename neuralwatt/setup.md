# NeuralWatt

[NeuralWatt](https://portal.neuralwatt.com) is an energy-aware OpenAI-compatible API. This doc covers adding it as a pi provider with Kimi, GLM, Qwen, and Devstral models, plus the `nw-usage` energy reporting script.

## Model comparison

Live snapshot from [portal.neuralwatt.com/models](https://portal.neuralwatt.com/models), May 2026. Prices per million tokens. Energy/req is the maximum a single request can be billed under the server's attribution cap — actual usage under concurrent load is lower.

| Model | Reasoning | Context | $ in | $ out | Energy/req | Agent | Best for |
|-------|-----------|---------|------|-------|------------|-------|----------|
| `moonshotai/Kimi-K2.6` | ✅ | 262K | $0.69 | $3.22 | 1.46 Wh | `kimi` | Coding, agentic — Sonnet/Codex-tier |
| `zai-org/GLM-5.1-FP8` | ✅ | 200K | $1.10 | $3.60 | 923 mWh | `glm` | Complex reasoning |
| `mistralai/Devstral-Small-2-24B` | ❌ | 262K | $0.12 | $0.35 | 332 mWh | `code` | Coding implementation — purpose-built |
| `Qwen/Qwen3.6-35B-A3B` | ✅ | 131K | $0.29 | $1.15 | 192 mWh | `qwen-fast` + `small_model` | Cheap utility tasks |
| `moonshotai/Kimi-K2.5` | ✅ | 262K | $0.52 | $2.59 | 1.23 Wh | — | Coding, previous gen |
| `Qwen/Qwen3.5-397B-A17B-FP8` | ✅ | 262K | $0.69 | $4.14 | 234 mWh | — | Large reasoning, long context |
| `MiniMaxAI/MiniMax-M2.5` | ✅ | 196K | $0.35 | $1.38 | 296 mWh | — | General tasks, good value |
| `kimi-k2.6-fast` | ❌ | 262K | $0.69 | $3.22 | 1.42 Wh | — | Kimi without thinking |
| `kimi-k2.5-fast` | ❌ | 262K | $0.52 | $2.59 | 1.68 Wh | — | K2.5 without thinking |
| `qwen3.6-35b-fast` | ❌ | 131K | $0.29 | $1.15 | 196 mWh | — | Qwen 35B without thinking |
| `qwen3.5-397b-fast` | ❌ | 262K | $0.69 | $4.14 | 215 mWh | — | Qwen 397B without thinking |
| `glm-5.1-fast` | ❌ | 200K | $1.10 | $3.60 | 712 mWh | — | GLM without thinking |
| `glm-5-fast` | ❌ | 200K | $1.10 | $3.60 | 923 mWh | — | GLM-5 previous gen |
| `openai/gpt-oss-20b` | ✅ | 16K | $0.03 | $0.16 | 53 mWh | — | Dirt-cheap, tiny context |

**Configured agents** use the full-precision reasoning variants. The `-fast` aliases run the same weights but skip the thinking phase — lower latency, same cost.

### Coming soon (portal roadmap)

Devstral 2 123B ($0.24/$0.48, 131K), Devstral Small ($0.15/$0.19, 131K), Gemma 4 31B (Google, 256K), GPT-OSS 120B, NVIDIA Nemotron 3 Super 120B / Ultra (1M context), Qwen3.5 122B, Qwen3.5 27B FP8.

## Plan → implement workflow


- **`/plan`** → GLM 5.1 FP8 ($1.10/M in) — read-only mode for architecture decisions and step-by-step plans
- **exit plan + execute** → Devstral Small 2 24B ($0.12/M in) — coding-specialized, cheap, fast

Devstral is purpose-built for code generation and instruction following. It won't reason through ambiguous requirements as well as GLM, but with a detailed plan in hand it's faster and ~10× cheaper for the mechanical implementation work.

The standalone `/agent kimi`, `/agent glm`, and `/agent qwen-fast` agents are still available when you want to override the default flow for a specific request.

## API key

Get a key from the [portal](https://portal.neuralwatt.com). Store it in the system keyring instead of hardcoding it in your shell rc (no plaintext in dotfiles, no exposure in shell history):

```bash
printf '%s' 'sk-your-key-here' | secret-tool store \
  --label='NeuralWatt API key' service neuralwatt user "$USER"
```

Then export it from `~/.zshrc` via a lookup:

```bash
export NEURALWATT_API_KEY=$(secret-tool lookup service neuralwatt user "$USER")
```

Verify:

```bash
echo "${NEURALWATT_API_KEY:0:6}…  (len=${#NEURALWATT_API_KEY})"
```

If you don't have `secret-tool` (libsecret), install it (`sudo dnf install libsecret` on Fedora, `sudo apt install libsecret-tools` on Debian/Ubuntu). On macOS you can use `security add-generic-password` instead.

## Wiring it into pi

NeuralWatt is a custom endpoint, so it needs an entry in `~/.pi/agent/models.json` (unlike the
providers in pi's built-in catalog, which only need an env var). The macOS template
`pi-dev/models-mac.json` already contains it:

```json
"neuralwatt": {
  "api": "openai-completions",
  "apiKey": "sk-your-neuralwatt-key-here",
  "baseUrl": "https://api.neuralwatt.com/v1",
  "models": [ { "id": "kimi-k3", "name": "Kimi K3", "reasoning": true }, "..." ]
}
```

Then enable it in `~/.pi/agent/settings.json`:

```json
"enabledModels": ["neuralwatt/*"]
```

Note pi stores the key literally in `models.json` for custom providers - it does not read
`NEURALWATT_API_KEY` for them. Keep the real key out of git; the committed file is a placeholder.

Select a model at runtime with `pi --provider neuralwatt --model <id>`, or `/model` in a session.


## GitHub MCP

The official GitHub MCP server provides agents with direct access to repos, issues, PRs, Actions, and code search. Uses the remote HTTP server hosted by GitHub (the npm package `@modelcontextprotocol/server-github` was deprecated April 2025).

### Install

MCP servers are configured through pi's `pi-mcp-adapter` package (see `pi list`):

```jsonc
"github": {
  "type": "remote",
  "url": "https://api.githubcopilot.com/mcp/",
  "headers": {
    "Authorization": "Bearer {env:GITHUB_PERSONAL_ACCESS_TOKEN}"
  },
  "enabled": true
}
```

Add the token to `~/.zshrc`:

```bash
export GITHUB_PERSONAL_ACCESS_TOKEN=ghp_...
```

The PAT needs at least `repo` scope.

## Playwright CLI

[Playwright CLI](https://github.com/microsoft/playwright-cli) provides browser automation as a skill rather than an MCP server. For coding agents, CLI + SKILLS is more token-efficient than MCP — it avoids loading large tool schemas and accessibility trees into context.

### Install

```bash
npm install -g @playwright/cli@latest
playwright-cli install --skills
```

`install --skills` installs the skill files into `.claude/skills/playwright-cli/` in the current project. For global availability across all projects, run it from `~/.claude/skills/`.

### Usage

Agents pick up the skill automatically. For explicit invocation:

```
Test the login flow on https://example.com using playwright-cli.
```

To monitor running browser sessions:

```bash
playwright-cli show
```

## Context7 MCP

[Context7](https://context7.com) is an MCP server that injects up-to-date library documentation directly into agent context. When an agent needs to know an API, it resolves the latest docs rather than relying on training data.

### Install

MCP servers are configured through pi's `pi-mcp-adapter` package (see `pi list`):

```jsonc
"context7": {
  "type": "local",
  "command": ["npx", "-y", "@upstash/context7-mcp"],
  "enabled": true
}
```

No API key required. The server starts on demand via `npx` and communicates over stdio.

### Usage

Once enabled, agents can call Context7 tools automatically. You can also prompt explicitly:

```
use context7 — how do I configure retry logic in Ktor?
```

Context7 resolves the library, fetches current docs, and injects them into the response.

## nw-usage script

Queries the NeuralWatt energy API and prints request count and Wh consumption.

### Install

```bash
cp neuralwatt/nw-usage ~/.local/bin/
chmod +x ~/.local/bin/nw-usage
```

The script looks for the API key in three places, in order:

1. `NEURALWATT_API_KEY` environment variable
2. `secret-tool lookup service neuralwatt user "$USER"` (libsecret keyring — recommended; see [API key](#api-key) above)
3. `~/.config/neuralwatt/api_key` file (legacy plaintext fallback — only use if libsecret isn't available)

Statusline-style callers (tmux, conky) often run outside an interactive shell where `~/.zshrc` hasn't been sourced — the keyring lookup keeps working in those contexts, so you don't need the plaintext file.

### Usage

```bash
nw-usage            # human-readable: date, requests, Wh
nw-usage --tmux     # compact for statusline (cached 5 min): ↗42 ⚡17Wh
nw-usage --json     # raw JSON from API
```

