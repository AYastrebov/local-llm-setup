# NeuralWatt + opencode

[NeuralWatt](https://portal.neuralwatt.com) is an energy-aware OpenAI-compatible API. This doc covers adding it as an opencode provider with Kimi, GLM, and Qwen models, plus the `nw-usage` energy reporting script.

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
    "description": "Qwen3.6 35B A3B via NeuralWatt — reasoning + tool use, 131K context",
    "mode": "primary",
    "model": "neuralwatt/Qwen/Qwen3.6-35B-A3B",
    "steps": 20
  }
}
```

Use agents with `/agent kimi`, `/agent glm`, or `/agent qwen` in opencode.

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
