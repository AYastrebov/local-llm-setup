# Xiaomi MiMo Setup

Direct API access to MiMo V2.5 (Omni) and V2.5 Pro from Xiaomi. Both have a 1M context window and support deep thinking.

## API key

Get a key at https://platform.xiaomimimo.com, then store it once:

```bash
printf '%s' 'sk-...' | secret-tool store --label='Xiaomi MiMo API key' service mimo user "$USER"
```

`zshrc-snippet.sh` picks it up as `MIMO_API_KEY`.

## Models

| Model ID         | Context | Max Output | Notes                                          |
|------------------|---------|------------|------------------------------------------------|
| `mimo-v2.5`      | 1M      | 128K       | Omni — multimodal, thinking, function calls    |
| `mimo-v2.5-pro`  | 1M      | 128K       | Pro tier — same context, higher capability     |

Base URL: `https://api.xiaomimimo.com/v1` (OpenAI-compatible).  
Anthropic-format endpoint also available: `https://api.xiaomimimo.com/anthropic`.

## OpenCode

Provider name: `mimo`. Env var: `MIMO_API_KEY`.

Available agents:
- `mimo` — V2.5 Omni, 50 steps
- `mimo-pro` — V2.5 Pro, 100 steps

## pi.dev

Provider name: `mimo` in `models-fedora.json` / `models-mac.json`.  
API key set directly in the config file.
