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

The standalone `/agent kimi`, `/agent code`, `/agent glm`, and `/agent qwen-fast` agents are still available when you want to override the default flow for a specific request.

## API key

Get a key from the [portal](https://portal.neuralwatt.com) and add it to `~/.zshrc`:

```bash
export NEURALWATT_API_KEY=your-api-key-here
```

## opencode provider config

Add the `neuralwatt` block to `~/.config/opencode/opencode.jsonc` (already included in `configs/opencode/opencode-fedora.jsonc`):

```jsonc
"small_model": "neuralwatt/Qwen/Qwen3.6-35B-A3B",
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
    "model": "neuralwatt/zai-org/GLM-5.1-FP8"
  },
  "build": {
    "description": "Default execution mode — uses Devstral Small 2 for cheap, coding-specialized implementation. Pair with /plan first for best results",
    "model": "neuralwatt/mistralai/Devstral-Small-2-24B-Instruct-2512"
  },
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
}
```

| Agent | Model | Best for |
|-------|-------|----------|
| `plan` (built-in) | GLM 5.1 FP8 | Read-only planning — invoked via `/plan` |
| `build` (built-in) | Devstral Small 2 24B | Default execution after plan exits — runs automatically |
| `kimi` | Kimi K2.6 | Strong coding when you want better than Devstral |
| `code` | Devstral Small 2 24B | Same model as `build`, for explicit invocation |
| `glm` | GLM 5.1 FP8 | Standalone reasoning outside of plan mode |
| `qwen-fast` | Qwen3.6 35B A3B | Quick tasks, summaries — $0.29/M |

Use built-in modes with `/plan` and the normal build flow; switch to a specific custom agent with `/agent <name>`.

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
