---
name: neuralwatt-setup
description: Configure OpenCode with NeuralWatt as a cloud AI provider. Use this skill when the user wants to set up NeuralWatt, add Kimi/GLM/Qwen/Devstral cloud models to OpenCode, configure the NeuralWatt provider block, install the nw-usage energy script, or connect OpenCode to NeuralWatt's API. Invoke whenever the user mentions NeuralWatt, wants to add cloud models to OpenCode, or asks about configuring Kimi K2.6, GLM 5.1, Qwen, or Devstral via NeuralWatt — even if they don't use the word "NeuralWatt" explicitly.
---

# NeuralWatt + OpenCode Setup

This skill configures OpenCode to use NeuralWatt as a cloud AI provider. The full setup involves four things: API key, `nw-usage` script, opencode provider block, and agent profiles.

Read `neuralwatt/setup.md` for full background. The reference config is at `opencode/fedora.jsonc`.

## Step 1: Check API key

```bash
echo "${NEURALWATT_API_KEY:-not set}"
grep "NEURALWATT_API_KEY" ~/.zshrc 2>/dev/null || echo "not in zshrc"
secret-tool lookup service neuralwatt user "$USER" >/dev/null 2>&1 && echo "in keyring" || echo "not in keyring"
```

If the key isn't anywhere, ask the user for their key (from https://portal.neuralwatt.com). Prefer storing it in the system keyring instead of plaintext in `~/.zshrc` — same pattern as the user's existing `GITHUB_TOKEN`:

```bash
# Store once (key only enters memory via stdin — never in shell history)
printf '%s' 'sk-...' | secret-tool store \
  --label='NeuralWatt API key' service neuralwatt user "$USER"
```

Then add to `~/.zshrc`:

```bash
export NEURALWATT_API_KEY=$(secret-tool lookup service neuralwatt user "$USER")
```

Remind them to `source ~/.zshrc` afterward. If `secret-tool` isn't installed (no libsecret), fall back to a plain `export NEURALWATT_API_KEY=sk-...` line — and warn that the key is then in plaintext.

## Step 2: Install nw-usage

The script is at `neuralwatt/nw-usage` in this repo:

```bash
cp neuralwatt/nw-usage ~/.local/bin/
chmod +x ~/.local/bin/nw-usage
```

The script looks up the API key from (in order): `NEURALWATT_API_KEY` env var → `secret-tool` keyring (service `neuralwatt`, user `$USER`) → `~/.config/neuralwatt/api_key` plaintext fallback. If you stored the key via `secret-tool` in Step 1, you don't need the plaintext file at all — statusline callers like tmux will hit the keyring directly.

Only create the file if `secret-tool` isn't available:

```bash
mkdir -p ~/.config/neuralwatt
printf '%s' "$NEURALWATT_API_KEY" > ~/.config/neuralwatt/api_key
chmod 600 ~/.config/neuralwatt/api_key
```

Verify:
```bash
nw-usage
```

If `nw-usage` reports zero requests/energy that's expected on a fresh account — it means the API is reachable and the key is valid.

## Step 3: Update opencode config

Read `~/.config/opencode/opencode.jsonc` and check what's already there before making changes — the user may have a partial setup.

### Global setting

Point `small_model` at the cheap non-reasoning Qwen alias so background auxiliary calls (titles, summaries) stay fast and cheap:

```jsonc
"small_model": "neuralwatt/qwen3.6-35b-fast"
```

### Provider block

Add to `"provider"` if `"neuralwatt"` is not present. Note the per-model `options` tuning — `repetitionPenalty: 1.05` on Kimi reduces looping, and Devstral gets a lower temperature and a `maxTokens` cap to keep coding responses focused:

```jsonc
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
    "qwen3.6-35b-fast": {
      "name": "Qwen3.6 35B Fast (no reasoning)",
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
```

### Agent profiles

opencode has built-in `plan` and `build` modes — overriding them here makes the entire `/plan` → exit-plan → build flow automatically use NeuralWatt models. Add the full block to `"agent"` if the keys are not present:

```jsonc
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
"explore": {
  "description": "Fast codebase search subagent — Qwen3.6 35B Fast (no reasoning overhead). For grep, file finding, symbol lookup, and shallow code exploration",
  "mode": "subagent",
  "model": "neuralwatt/qwen3.6-35b-fast",
  "steps": 20
},
"docs": {
  "description": "Internal docs subagent — Qwen3.6 35B Fast. For reading project READMEs, code comments, and docstrings. Use Context7 MCP for library/framework documentation instead",
  "mode": "subagent",
  "model": "neuralwatt/qwen3.6-35b-fast",
  "steps": 20
}
```

### /nw-usage command

Create a `"command"` section if it doesn't exist, then add:

```jsonc
"nw-usage": {
  "description": "Show Neuralwatt energy usage",
  "template": "Here is my Neuralwatt API usage:\n\n!`nw-usage`\n\nReport this to the user."
}
```

## Step 4: Confirm

Report what was done (installed vs. already present). Tell the user:
- Built-in modes: `/plan` (GLM 5.1) → exit plan → build (Devstral) — runs automatically
- Custom agents: `/agent kimi`, `/agent glm`, `/agent qwen-fast` for explicit overrides
- Subagents (delegatable): `explore`, `docs`
- Command: `/nw-usage` inside an OpenCode session
