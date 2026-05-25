---
name: neuralwatt-setup
description: Configure OpenCode with NeuralWatt as a cloud AI provider. Use this skill when the user wants to set up NeuralWatt, add Kimi/GLM/Qwen cloud models to OpenCode, configure the NeuralWatt provider block, install the nw-usage energy script, or connect OpenCode to NeuralWatt's API. Invoke whenever the user mentions NeuralWatt, wants to add cloud models to OpenCode, or asks about configuring Kimi K2.6, GLM 5.1, or Qwen via NeuralWatt — even if they don't use the word "NeuralWatt" explicitly.
---

# NeuralWatt + OpenCode Setup

This skill configures OpenCode to use NeuralWatt as a cloud AI provider. The full setup involves four things: API key, `nw-usage` script, opencode provider block, and agent profiles.

Read `docs/neuralwatt.md` for full background. The reference config is at `configs/opencode/opencode-fedora.jsonc`.

## Step 1: Check API key

```bash
echo "${NEURALWATT_API_KEY:-not set}"
grep "NEURALWATT_API_KEY" ~/.zshrc 2>/dev/null || echo "not in zshrc"
```

If not set, ask the user for their key (from https://portal.neuralwatt.com) and add to `~/.zshrc`:

```bash
export NEURALWATT_API_KEY=sk-...
```

Remind them to `source ~/.zshrc` afterward.

## Step 2: Install nw-usage

The script is at `scripts/nw-usage` in this repo. Install it and write the key file (the script checks the env var first, then falls back to this file):

```bash
cp scripts/nw-usage ~/.local/bin/
chmod +x ~/.local/bin/nw-usage

mkdir -p ~/.config/neuralwatt
echo "$NEURALWATT_API_KEY" > ~/.config/neuralwatt/api_key
chmod 600 ~/.config/neuralwatt/api_key
```

Verify:
```bash
nw-usage
```

If `nw-usage` reports zero requests/energy that's expected on a fresh account — it means the API is reachable and the key is valid.

## Step 3: Update opencode config

Read `~/.config/opencode/opencode.jsonc` and check what's already there before making changes — the user may have a partial setup.

### Provider block

Add to `"provider"` if `"neuralwatt"` is not present:

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
      "limit": { "context": 262128, "output": 262128 }
    },
    "zai-org/GLM-5.1-FP8": {
      "name": "GLM 5.1 FP8",
      "limit": { "context": 202736, "output": 202736 }
    },
    "Qwen/Qwen3.5-397B-A17B-FP8": {
      "name": "Qwen3.5 397B A17B FP8",
      "limit": { "context": 262128, "output": 262128 }
    },
    "Qwen/Qwen3.6-35B-A3B": {
      "name": "Qwen3.6 35B A3B",
      "limit": { "context": 131056, "output": 131056 }
    },
    "mistralai/Devstral-Small-2-24B-Instruct-2512": {
      "name": "Devstral Small 2 24B",
      "limit": { "context": 262128, "output": 262128 }
    }
  }
}
```

### Agent profiles

Add to `"agent"` if the keys are not present:

```jsonc
"kimi": {
  "description": "Kimi K2.6 via NeuralWatt — reasoning + tool use, 262K context",
  "mode": "primary",
  "model": "neuralwatt/moonshotai/Kimi-K2.6",
  "steps": 20
},
"glm": {
  "description": "GLM 5.1 FP8 via NeuralWatt — reasoning + tool use, 202K context",
  "mode": "primary",
  "model": "neuralwatt/zai-org/GLM-5.1-FP8",
  "steps": 20
},
"qwen": {
  "description": "Qwen3.5 397B via NeuralWatt — reasoning + tool use, 262K context. Sonnet-tier for complex reasoning",
  "mode": "primary",
  "model": "neuralwatt/Qwen/Qwen3.5-397B-A17B-FP8",
  "steps": 20
},
"qwen-fast": {
  "description": "Qwen3.6 35B A3B MoE via NeuralWatt — cheap fast tasks, $0.05/M in. Use for summaries, simple edits, quick Q&A",
  "mode": "primary",
  "model": "neuralwatt/Qwen/Qwen3.6-35B-A3B",
  "steps": 10
},
"code": {
  "description": "Devstral Small 2 via NeuralWatt — coding-specialized, $0.12/M in. Step 2 of plan→implement workflow: use /agent kimi to plan, then switch here to implement",
  "mode": "primary",
  "model": "neuralwatt/mistralai/Devstral-Small-2-24B-Instruct-2512",
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
- Agents: `/agent kimi`, `/agent code`, `/agent glm`, `/agent qwen`, `/agent qwen-fast` in OpenCode
- Plan→implement workflow: `/agent kimi` to plan → `/agent code` to implement
- Command: `/nw-usage` inside an OpenCode session
