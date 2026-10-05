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

The models already appear in `/model` (press Tab for the full list). To pin one into the short
list, **add** its exact ID to the existing `enabledModels` array in `~/.pi/agent/settings.json`:

```json
"minimax/MiniMax-M3"
```

Prefer exact IDs over `<provider>/*`: model IDs are also matched, so e.g. `moonshotai/*` pulls in
`openrouter/moonshotai/...` too.

Only custom endpoints (`llama-cpp`, `neuralwatt`) need an entry in `models.json`; their keys are
read from the environment too (`"apiKey": "$NAME"`).
