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

## OpenCode

Provider name: `deepseek`. Env var: `DEEPSEEK_API_KEY`.

Available agents:
- `deepseek-flash` — fast tasks, 50 steps
- `deepseek-pro` — full reasoning, 100 steps

## pi.dev

Provider name: `deepseek` in `models-fedora.json` / `models-mac.json`.  
API key set directly in the config file (not via env var — pi doesn't support env var substitution).
