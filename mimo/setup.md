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


## pi.dev

pi ships a built-in provider catalog, and `xiaomi` is in it - so there is nothing to add to
`models.json`. Just export the key:

```bash
export XIAOMI_API_KEY=...      # pi reads this directly
```

Then enable it in `~/.pi/agent/settings.json`:

```json
"enabledModels": ["xiaomi/*"]
```

Only custom endpoints (`llama-cpp`, `neuralwatt`, `jbcentral-local`) need an entry in
`models.json`, where the key is stored literally rather than read from the environment.
