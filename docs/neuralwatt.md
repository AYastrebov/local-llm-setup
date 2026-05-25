# NeuralWatt + opencode

[NeuralWatt](https://portal.neuralwatt.com) is an energy-aware OpenAI-compatible API. This doc covers adding it as an opencode provider with Kimi, GLM, and Qwen models, plus the `nw-usage` energy reporting script.

## Model comparison

All models available on NeuralWatt as of May 2026. Prices per million tokens.

| Model | Reasoning | Context | Price in | Price out | Best for | Agent |
|-------|-----------|---------|----------|-----------|----------|-------|
| `moonshotai/Kimi-K2.6` | ✅ | 262K | $0.69 | $3.22 | Coding, agentic tasks — Sonnet/Codex-tier | `kimi` |
| `moonshotai/Kimi-K2.5` | ✅ | 262K | $0.52 | $2.59 | Coding, previous gen | — |
| `Qwen/Qwen3.5-397B-A17B-FP8` | ✅ | 262K | $0.69 | $4.14 | General reasoning, long context — Sonnet-tier | `qwen` |
| `zai-org/GLM-5.1-FP8` | ✅ | 202K | $1.10 | $3.60 | Complex reasoning | `glm` |
| `MiniMaxAI/MiniMax-M2.5` | ✅ | 196K | $0.35 | $1.38 | General tasks, good value | — |
| `mistralai/Devstral-Small-2-24B` | ❌ | 262K | $0.12 | $0.35 | Coding, fast — coding-specialized | — |
| `Qwen/Qwen3.6-35B-A3B` | ✅ | 131K | $0.05 | $0.10 | Quick tasks, same as local MoE | `qwen-fast` |
| `kimi-k2.6-fast` | ❌ | 262K | $0.69 | $3.22 | Kimi without thinking overhead | — |
| `qwen3.5-397b-fast` | ❌ | 262K | $0.69 | $4.14 | Qwen 397B without thinking overhead | — |
| `glm-5.1-fast` | ❌ | 202K | $1.10 | $3.60 | GLM without thinking overhead | — |
| `openai/gpt-oss-20b` | ✅ | 16K | $0.03 | $0.16 | Dirt-cheap, tiny context | — |

**Configured agents** use the full-precision reasoning variants. The `-fast` aliases run the same weights but skip the thinking phase — lower latency, same cost.

## API key

Get a key from the [portal](https://portal.neuralwatt.com) and add it to `~/.zshrc`:

```bash
export NEURALWATT_API_KEY=your-api-key-here
```

## opencode provider config

Add the `neuralwatt` block to `~/.config/opencode/opencode.jsonc` (already included in `configs/opencode/opencode-fedora.jsonc`):

```jsonc
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
        "limit": { "context": 262128, "output": 262128 }
      },
      "zai-org/GLM-5.1-FP8": {
        "name": "GLM 5.1 FP8",
        "limit": { "context": 202736, "output": 202736 }
      },
      "Qwen/Qwen3.6-35B-A3B": {
        "name": "Qwen3.6 35B A3B",
        "limit": { "context": 131056, "output": 131056 }
      }
    }
  }
}
```

## Agent profiles

```jsonc
"agent": {
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
  }
}
```

| Agent | Model | Best for |
|-------|-------|----------|
| `kimi` | Kimi K2.6 | Coding, agentic tasks — Sonnet/Codex-tier |
| `glm` | GLM 5.1 FP8 | Complex reasoning |
| `qwen` | Qwen3.5 397B | General reasoning, long context — Sonnet-tier |
| `qwen-fast` | Qwen3.6 35B A3B | Quick tasks, summaries — $0.05/M |

Use agents with `/agent kimi`, `/agent glm`, `/agent qwen`, or `/agent qwen-fast` in opencode.

## nw-usage script

Queries the NeuralWatt energy API and prints request count and Wh consumption. Used by the `/nw-usage` opencode command.

### Install

```bash
cp scripts/nw-usage ~/.local/bin/
chmod +x ~/.local/bin/nw-usage

mkdir -p ~/.config/neuralwatt
echo "your-api-key" > ~/.config/neuralwatt/api_key
chmod 600 ~/.config/neuralwatt/api_key
```

The script reads the key from `NEURALWATT_API_KEY` env var or `~/.config/neuralwatt/api_key` (checked in that order).

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
