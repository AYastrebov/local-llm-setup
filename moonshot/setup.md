# Moonshot (Kimi) Setup

Direct API access to Kimi (K3, K2.7 Code) from Moonshot AI. Cheaper than NeuralWatt for this model at the cost of one more key to manage.

## API key

Get a key at https://platform.kimi.com, then store it once:

```bash
printf '%s' 'sk-...' | secret-tool store --label='Moonshot API key' service moonshot user "$USER"
```

`zshrc-snippet.sh` picks it up as `MOONSHOT_API_KEY`.

## Models

| Model ID | Context | Notes |
|---|---|---|
| `kimi-k3` | 1M | Current flagship; macOS default (`settings-mac.json`) |
| `kimi-k2.7-code` | 262K | Coding-tuned |
| `kimi-k2.7-code-highspeed` | 262K | Faster variant |
| `kimi-k2.6` | 262K | Previous generation |

From pi's built-in catalog (`pi --list-models moonshotai`), 2026-10-04.

Base URL: `https://api.moonshot.ai/v1` (OpenAI-compatible).


## pi.dev

pi ships a built-in provider catalog, and `moonshotai` is in it - so there is nothing to add to
`models.json`. Just export the key:

```bash
export MOONSHOT_API_KEY=...      # pi reads this directly
```

The models already appear in `/model` (press Tab for the full list). To pin one into the short
list, **add** its exact ID to the existing `enabledModels` array in `~/.pi/agent/settings.json`:

```json
"moonshotai/kimi-k3"
```

Prefer exact IDs over `<provider>/*`: model IDs are also matched, so e.g. `moonshotai/*` pulls in
`openrouter/moonshotai/...` too.

Only custom endpoints (`llama-cpp`, `neuralwatt`) need an entry in `models.json`; their keys are
read from the environment too (`"apiKey": "$NAME"`).
