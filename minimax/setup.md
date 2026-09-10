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


## pi.dev

pi ships a built-in provider catalog, and `minimax` is in it - so there is nothing to add to
`models.json`. Just export the key:

```bash
export MINIMAX_API_KEY=...      # pi reads this directly
```

Then enable it in `~/.pi/agent/settings.json`:

```json
"enabledModels": ["minimax/*"]
```

Only custom endpoints (`llama-cpp`, `neuralwatt`) need an entry in
`models.json`, where the key is stored literally rather than read from the environment.
