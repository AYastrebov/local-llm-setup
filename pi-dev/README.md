# pi-dev

pi.dev model configs (`~/.pi/agent/models.json`) for each platform.

## Files

| File | Platform | Copy to |
|------|----------|---------|
| `models-mac.json` | macOS (M2 Max, 64GB) | `~/.pi/agent/models.json` |
| `models-fedora.json` | Fedora (RX 9060 XT, ROCm) | `~/.pi/agent/models.json` |

## Setup

```bash
# macOS
cp pi-dev/models-mac.json ~/.pi/agent/models.json

# Fedora
cp pi-dev/models-fedora.json ~/.pi/agent/models.json
```

Then edit `~/.pi/agent/models.json`:
1. Replace `YOUR-WIRE-HASH` with your secret from `~/.wire/config.json` (`proxy_secret` field)
2. Replace `sk-your-neuralwatt-key-here` with your NeuralWatt API key

pi.dev does not support env var substitution in JSON, so secrets must be hardcoded in the live file.
The repo templates use placeholders to avoid committing real credentials.

**Never commit `~/.pi/agent/models.json` to this repo** — it contains real secrets. Only edit the template files (`models-mac.json`, `models-fedora.json`) which use `YOUR-WIRE-HASH` and `sk-your-neuralwatt-key-here` as placeholders.

## Providers

| Provider | Models | Notes |
|----------|--------|-------|
| `neuralwatt` | Kimi K2.6, GLM 5.1 FP8, Qwen3.6 35B A3B | Requires NeuralWatt API key |
| `anthropic` | Claude Opus 4.7 | Via JB Central proxy (`claude-code` wire path) |
| `openai` | GPT-5.5 Pro | Via JB Central proxy (`codex` wire path), `openai-codex-responses` API |
| `google` | Gemini 3.1 Pro | Via JB Central proxy (`gemini-cli/vertex` wire path) |
| `llama-cpp` | Gemma 4 26B-A4B, Qwen3.6 27B/35B | Local llama.cpp at `localhost:8080` — start `gemma-moe` or `qwen-mtp` first |

## What differs between mac and fedora

Only the `llama-cpp` models section changes:
- **mac**: Gemma 4 (Q8_K_XL) + Qwen3.6 27B dense (Q6_K_XL)
- **fedora**: Gemma 4 (Q3_K_XL) + Qwen3.6 35B-A3B MoE (IQ3_XXS)

All cloud provider sections are identical.

## JB Central wire paths

pi.dev uses agent-specific wire paths for quota tracking:

```
anthropic: http://127.0.0.1:19516/wire/{secret}/claude-code/anthropic/
openai:    http://127.0.0.1:19516/wire/{secret}/codex/openai/
google:    http://127.0.0.1:19516/wire/{secret}/gemini-cli/vertex
```

These differ from the OpenCode paths. See `jbcentral/setup.md` for the full wire path table.

## LSP (pi-lsp-extension)

`npm:pi-lsp-extension` is installed globally (`pi list`). It gives agents `lsp_diagnostics`, `lsp_hover`, `lsp_definition`, `lsp_references`, and other IDE-grade tools.

Kotlin LSP has no built-in default in the extension — configure it per project with `.pi-lsp.json` in the project root:

```json
{
  "servers": {
    "kotlin": { "command": "kotlin-lsp", "args": ["--stdio"] }
  },
  "autoStart": ["kotlin"]
}
```

`autoStart` tells the extension to spin up `kotlin-lsp` eagerly on session start (recommended — it's slow to initialize). See the [pi-lsp-extension README](https://github.com/samfoy/pi-lsp-extension) for full `.pi-lsp.json` options.

## What agents can edit here

- Add or remove models within existing providers
- Add new providers following the same structure
- Update `contextWindow` / `maxTokens` if a model's limits change
- Do **not** use env var substitution — pi.dev reads plain JSON
