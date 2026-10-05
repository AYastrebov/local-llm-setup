# DeepSeek Setup

DeepSeek provides direct API access to V4 Flash and V4 Pro — both support 1M context and reasoning (thinking) mode.

## API key

Get a key at https://platform.deepseek.com/api_keys, then store it once:

```bash
printf '%s' 'sk-...' | secret-tool store --label='DeepSeek API key' service deepseek user "$USER"
```

`zshrc-snippet.sh` picks it up as `DEEPSEEK_API_KEY`.

## Models

| Model ID           | Context | Max Output | Notes                          |
|--------------------|---------|------------|--------------------------------|
| `deepseek-v4-flash`| 1M      | 384K       | Fast, lower cost, thinking on  |
| `deepseek-v4-pro`  | 1M      | 384K       | Full quality, thinking on      |

Both models default to thinking mode. Base URL: `https://api.deepseek.com` (OpenAI-compatible).


## pi.dev

pi ships a built-in provider catalog, and `deepseek` is in it - so there is nothing to add to
`models.json`. Just export the key:

```bash
export DEEPSEEK_API_KEY=...      # pi reads this directly
```

The models already appear in `/model` (press Tab for the full list). To pin one into the short
list, **add** its exact ID to the existing `enabledModels` array in `~/.pi/agent/settings.json`:

```json
"deepseek/deepseek-v4-flash"
```

Prefer exact IDs over `<provider>/*`: model IDs are also matched, so e.g. `moonshotai/*` pulls in
`openrouter/moonshotai/...` too.

Only custom endpoints (`llama-cpp`, `neuralwatt`) need an entry in `models.json`; their keys are
read from the environment too (`"apiKey": "$NAME"`).
