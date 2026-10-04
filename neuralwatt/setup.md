# NeuralWatt

[NeuralWatt](https://portal.neuralwatt.com) is an energy-aware OpenAI-compatible API. This doc covers adding it as a pi provider, plus the `nw-usage` energy reporting script.

## Models

Snapshot of `GET https://api.neuralwatt.com/v1/models`, 2026-10-04 (same data as
[portal.neuralwatt.com/models](https://portal.neuralwatt.com/models)). Prices per million tokens.
These are the models in `pi-dev/models-*.json`:

| Model ID | Currently runs | Context | $ in | $ out | Images | Notes |
|----------|----------------|---------|------|-------|--------|-------|
| `nw-flash` | DeepSeek V4.1 Flash | 1M | $0.15 | $0.60 | ✅ | Cheap and fast |
| `nw-small` | Qwen3.8 27B | 262K | $0.45 | $3.20 | ✅ | |
| `nw-large` | Kimi K3 | 1M | $3.00 | $15.00 | ✅ | Hardest tasks |
| `glm-5.3` | GLM 5.3 | 1M | $1.45 | $4.50 | ❌ | Always reasons — no "off" |
| `glm-5.3-flash` | GLM 5.3 Flash | 1M | $0.15 | $0.50 | ✅ | **pi default (Fedora)** — best quality per dollar, lowest energy; always reasons |
| `mimo-v2.6-pro` | MiMo V2.6 Pro | 1M | $0.87 | $1.74 | ✅ | Thinking on/off only; ~2x OpenRouter's price for the same model |

**`nw-flash` / `nw-small` / `nw-large` are tracking aliases.** NeuralWatt re-points them at newer
models as the catalog changes (with notice), at the target's price. Use them when you want "the cheap
one" or "the big one" without editing config every time a model is retired. The pinned IDs behind them
(`deepseek-v4.1-flash`, `qwen-3.8-27b`, `kimi-k3`) are also served but not listed in the templates.

**Variants not in the templates:** `-flex` (~35% cheaper, lower scheduling priority), `-fast`
(skips the thinking phase), `-speed`. `GET /v1/models` lists them all with prices, limits and
supported reasoning efforts — it needs no API key.

**ID scheme changed in 2026.** The old Hugging Face-style IDs (`zai-org/GLM-5.1-FP8`,
`Qwen/Qwen3.6-35B-A3B`) are unlisted; Devstral is gone. `zai-org/GLM-5.1-FP8` still answered on
2026-10-04 but should be treated as retired.

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
providers in pi's built-in catalog, which only need an env var). Both `pi-dev/models-*.json`
templates contain the same block:

```json
"neuralwatt": {
  "api": "openai-completions",
  "apiKey": "$NEURALWATT_API_KEY",
  "baseUrl": "https://api.neuralwatt.com/v1",
  "compat": {
    "supportsDeveloperRole": false,
    "supportsReasoningEffort": true,
    "supportsUsageInStreaming": true
  },
  "models": [
    {
      "id": "nw-flash",
      "reasoning": true,
      "contextWindow": 1048560,
      "maxTokens": 65536,
      "cost": { "input": 0.15, "output": 0.6, "cacheRead": 0.015, "cacheWrite": 0 },
      "thinkingLevelMap": { "off": "none", "minimal": "low", "medium": "high" }
    },
    "..."
  ]
}
```

- **`apiKey: "$NEURALWATT_API_KEY"`** — pi interpolates `$NAME` / `${NAME}` in `models.json`, so the
  key comes from the environment (see [API key](#api-key)) and the file holds no secret.
- **`compat`** — verified against the live API: `developer` role is rejected on every model;
  `reasoning_effort` is honoured; streamed responses include a final usage chunk, so pi's cost
  footer works (each model carries its `cost`).
- **`thinkingLevelMap`** — translates pi's levels to the efforts each model supports (from
  `reasoning.supported_efforts` in `/v1/models`). `null` marks a level as unsupported, e.g. `off`
  for GLM 5.3, which always reasons.

On Fedora, `pi-dev/settings-fedora.json` makes `neuralwatt` / `glm-5.3-flash` the default and scopes
the model picker with `enabledModels` (`neuralwatt/*` is included, so new entries here show up
automatically).

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

