# Moonshot (Kimi) Setup

Direct API access to Kimi K2.6 from Moonshot AI. Cheaper than NeuralWatt for this model at the cost of one more key to manage.

## API key

Get a key at https://platform.kimi.com, then store it once:

```bash
printf '%s' 'sk-...' | secret-tool store --label='Moonshot API key' service moonshot user "$USER"
```

`zshrc-snippet.sh` picks it up as `MOONSHOT_API_KEY`.

## Models

| Model ID   | Context | Max Output | Notes         |
|------------|---------|------------|---------------|
| `kimi-k2.6`| 262K    | 32768      | Thinking on by default |

Base URL: `https://api.moonshot.ai/v1` (OpenAI-compatible).


## pi.dev

pi ships a built-in provider catalog, and `moonshotai` is in it - so there is nothing to add to
`models.json`. Just export the key:

```bash
export MOONSHOT_API_KEY=...      # pi reads this directly
```

Then enable it in `~/.pi/agent/settings.json`:

```json
"enabledModels": ["moonshotai/*"]
```

Only custom endpoints (`llama-cpp`, `neuralwatt`, `jbcentral-local`) need an entry in
`models.json`, where the key is stored literally rather than read from the environment.
