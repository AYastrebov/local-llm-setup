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

Then enable it in `~/.pi/agent/settings.json`:

```json
"enabledModels": ["deepseek/*"]
```

Only custom endpoints (`llama-cpp`, `neuralwatt`) need an entry in
`models.json`, where the key is stored literally rather than read from the environment.
