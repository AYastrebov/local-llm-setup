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

Base URL: `https://api.moonshot.cn/v1` (OpenAI-compatible).

## OpenCode

Provider name: `moonshot`. Env var: `MOONSHOT_API_KEY`.

Available agent:
- `kimi` — 100 steps

## pi.dev

Provider name: `moonshot` in `models-fedora.json` / `models-mac.json`.  
API key set directly in the config file.
