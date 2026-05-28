# NeuralWatt + opencode

[NeuralWatt](https://portal.neuralwatt.com) is an energy-aware OpenAI-compatible API. This doc covers adding it as an opencode provider with Kimi, GLM, Qwen, and Devstral models, plus the `nw-usage` energy reporting script.

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

opencode has two built-in modes — `plan` (read-only analysis) and `build` (executes edits and commands). We override both to use NeuralWatt models so the entire workflow happens automatically without manual `/agent` switching:

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

## opencode provider config

Add the `neuralwatt` block to `~/.config/opencode/opencode.jsonc` (already included in `opencode/fedora.jsonc`):

```jsonc
"small_model": "neuralwatt/qwen3.6-35b-fast",
"provider": {
  "neuralwatt": {
    "name": "Neuralwatt",
    "npm": "@ai-sdk/openai-compatible",
    "options": {
      "baseURL": "https://api.neuralwatt.com/v1",
      "apiKey": "{env:NEURALWATT_API_KEY}"
    },
    "models": {
      "moonshotai/Kimi-K2.6": {
        "name": "Kimi K2.6",
        "limit": { "context": 262128, "output": 262128 },
        "options": {
          "repetitionPenalty": 1.05
        }
      },
      "zai-org/GLM-5.1-FP8": {
        "name": "GLM 5.1 FP8",
        "limit": { "context": 202736, "output": 202736 }
      },
      "Qwen/Qwen3.6-35B-A3B": {
        "name": "Qwen3.6 35B A3B",
        "limit": { "context": 131056, "output": 131056 }
      },
      "mistralai/Devstral-Small-2-24B-Instruct-2512": {
        "name": "Devstral Small 2 24B",
        "limit": { "context": 262128, "output": 262128 },
        "options": {
          "temperature": 0.3,
          "maxTokens": 4096
        }
      }
    }
  }
}
```

`small_model` is the model opencode uses for short auxiliary calls (titles, summaries, etc.). Pointing it at the cheap MoE keeps background traffic effectively free.

### Per-model tuning

The `options` block lets you set provider-specific knobs. Useful tweaks:

- **`repetitionPenalty: 1.05`** on Kimi K2 family — reduces the looping behaviour Kimi sometimes exhibits without affecting creativity (per [NeuralWatt docs](https://portal.neuralwatt.com/docs/integrations/opencode)).
- **`maxTokens: 4096`** — caps responses at a sensible length for typical coding work even when the model's hard output limit is much higher. Useful on Devstral to avoid runaway generations.
- **`temperature: 0.3`** on Devstral — lower temperature for more deterministic code generation.

## Agent profiles

The `plan` and `build` keys override opencode's built-in default agents. Everything else is a custom agent you invoke explicitly with `/agent <name>`.

```jsonc
"agent": {
  "plan": {
    "description": "Planning mode — uses GLM 5.1 FP8 for read-only analysis, architecture decisions, and step-by-step plans before execution",
    "model": "neuralwatt/zai-org/GLM-5.1-FP8",
    "steps": 30
  },
  "build": {
    "description": "Default execution mode — uses Devstral Small 2 for cheap, coding-specialized implementation. Pair with /plan first for best results",
    "model": "neuralwatt/mistralai/Devstral-Small-2-24B-Instruct-2512",
    "steps": 100
  },
  "kimi": {
    "description": "Kimi K2.6 via NeuralWatt — reasoning + tool use, 262K context",
    "mode": "primary",
    "model": "neuralwatt/moonshotai/Kimi-K2.6",
    "steps": 100
  },
  "glm": {
    "description": "GLM 5.1 FP8 via NeuralWatt — reasoning + tool use, 202K context",
    "mode": "primary",
    "model": "neuralwatt/zai-org/GLM-5.1-FP8",
    "steps": 50
  },
  "qwen-fast": {
    "description": "Qwen3.6 35B A3B MoE via NeuralWatt — cheap fast tasks, $0.29/M in. Use for summaries, simple edits, quick Q&A",
    "mode": "primary",
    "model": "neuralwatt/Qwen/Qwen3.6-35B-A3B",
    "steps": 15
  },
  "code": {
    "description": "Devstral Small 2 via NeuralWatt — coding-specialized, $0.12/M in. Step 2 of plan→implement workflow: use /agent kimi to plan, then switch here to implement",
    "mode": "primary",
    "model": "neuralwatt/mistralai/Devstral-Small-2-24B-Instruct-2512",
    "steps": 100
  }
}
```

### Step limits

`steps` caps the number of tool-call iterations (file read, edit, bash, etc.) an agent runs before stopping. If a task needs more, opencode aborts with "out of steps." Workhorse agents (`build`, `code`, `kimi`) get 100 for serious refactors; planning/reasoning get 30–50; `qwen-fast` stays at 15 since it's the cheap quick agent.

| Agent | Mode | Model | Best for |
|-------|------|-------|----------|
| `plan` (built-in) | primary | GLM 5.1 FP8 | Read-only planning — invoked via `/plan` |
| `build` (built-in) | primary | Devstral Small 2 24B | Default execution after plan exits — runs automatically |
| `kimi` | primary | Kimi K2.6 | Strong coding when you want better than Devstral |
| `glm` | primary | GLM 5.1 FP8 | Reasoning outside plan mode — architecture chats, design discussions, trade-off analysis |
| `qwen-fast` | primary | Qwen3.6 35B A3B | Quick reasoning tasks, summaries — $0.29/M |
| `explore` | subagent | Qwen3.6 35B Fast | Grep, file/symbol lookup, shallow code exploration (no reasoning overhead) |
| `docs` | subagent | Qwen3.6 35B Fast | README/comment/docstring lookup, "where is X documented" |

Use built-in modes with `/plan` and the normal build flow; switch to a specific custom agent with `/agent <name>`. Subagents are delegated to by other agents (or invoked directly).

## Recommended workflow

For most coding tasks, the default flow is enough:

1. **Press Tab** to enter `/plan` mode — GLM 5.1 analyses, proposes a plan
2. **Exit plan mode** — automatically hands off to `build` (Devstral) for implementation
3. **Hit "out of steps"?** — switch to `/agent kimi` and continue (Kimi has 100 steps + stronger reasoning)

For design decisions before coding:
- **Architecture consultation** → `/agent glm` (reasoning through design decisions and trade-offs)

For other tasks:
- **"Where is X in the codebase?"** → `/agent explore` (or it gets invoked automatically as subagent)
- **Doc/comment lookup** → `/agent docs`
- **Long-form writing, summaries** → `/agent qwen-fast`
- **Hard coding problems** → `/agent kimi`

## GitHub MCP

The official GitHub MCP server provides agents with direct access to repos, issues, PRs, Actions, and code search. Uses the remote HTTP server hosted by GitHub (the npm package `@modelcontextprotocol/server-github` was deprecated April 2025).

### Install

Add to the `"mcp"` section of `~/.config/opencode/opencode.jsonc`:

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

`install --skills` installs the skill files into `.claude/skills/playwright-cli/` in the current project. For global availability across all projects, run it from `~/.claude/skills/` or verify the skill lands in `~/.config/opencode/skills/` which OpenCode also scans.

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

Add to the `"mcp"` section of `~/.config/opencode/opencode.jsonc`:

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

Queries the NeuralWatt energy API and prints request count and Wh consumption. Used by the `/nw-usage` opencode command.

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

### opencode command

Add to `opencode.jsonc` to query usage from within a session:

```jsonc
"command": {
  "nw-usage": {
    "description": "Show Neuralwatt energy usage",
    "template": "Here is my Neuralwatt API usage:\n\n!`nw-usage`\n\nReport this to the user."
  }
}
```

Then run `/nw-usage` inside opencode.
