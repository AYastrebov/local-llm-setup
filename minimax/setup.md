# MiniMax Setup

Direct API access to MiniMax M3 — frontier coding and agentic model with 1M context and multimodal support.

## API key

Get a Token Plan key at https://www.minimax.io, then store it once:

```bash
printf '%s' 'sk-cp-...' | secret-tool store --label='MiniMax API key' service minimax user "$USER"
```

`zshrc-snippet.sh` picks it up as `MINIMAX_API_KEY`.

## Models

| Model ID      | Context | Notes                                                 |
|---------------|---------|-------------------------------------------------------|
| `MiniMax-M3`  | 1M      | Frontier coding + agentic, multimodal, deep thinking  |

Base URL: `https://api.minimax.io/v1` (OpenAI-compatible).

Other available models (not configured): `MiniMax-M2.7`, `MiniMax-M2.7-highspeed`, `MiniMax-M2.5`.

## OpenCode

Provider name: `minimax`. Env var: `MINIMAX_API_KEY`.

Available agent:
- `minimax` — M3, 100 steps

## pi.dev

Provider name: `minimax` in `models-fedora.json` / `models-mac.json`.  
API key set directly in the config file.
