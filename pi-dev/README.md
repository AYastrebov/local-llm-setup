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
1. Replace `sk-your-neuralwatt-key-here` with your NeuralWatt API key

pi.dev does not support env var substitution in JSON, so secrets must be hardcoded in the live file.
The repo templates use placeholders to avoid committing real credentials.

**Never commit `~/.pi/agent/models.json` to this repo** — it contains real secrets. Only edit the template files (`models-mac.json`, `models-fedora.json`), which use `sk-your-neuralwatt-key-here` as a placeholder.

## Providers

| Provider | Models | Notes |
|----------|--------|-------|
| `neuralwatt` | Kimi K2.6, GLM 5.1 FP8, Qwen3.6 35B A3B | Requires NeuralWatt API key |
| `llama-cpp` | mac: Qwen3.8-27B, Mellum2 12B-A2.5B — fedora: Qwen3.8-27B, Gemma 4 26B-A4B | Local llama.cpp at `localhost:8080` — start `qwen`/`mellum` (mac) or `qwen`/`gemma-moe` (fedora) first |

## What differs between mac and fedora

Only the `llama-cpp` models section changes:
- **mac**: Gemma 4 (Q8_K_XL) + Qwen3.6 27B dense (Q6_K_XL)
- **fedora**: Gemma 4 (Q3_K_XL) + Qwen3.6 35B-A3B MoE (IQ3_XXS)

All cloud provider sections are identical.

## Vendor providers

`anthropic`, `openai`, `google`, `deepseek` and friends are in pi's built-in catalog: export the
matching API key and pi picks them up on its own. They do not belong in `models.json` — only custom
endpoints (`llama-cpp`, `neuralwatt`) do.

## LSP (pi-lsp-extension)

`npm:pi-lsp-extension` is installed globally (`pi list`). It gives agents `lsp_diagnostics`, `lsp_hover`, `lsp_definition`, `lsp_references`, and other IDE-grade tools.

Built-in defaults (work automatically, no config needed):

| Language | Server |
|----------|--------|
| TypeScript / JavaScript | `typescript-language-server` |
| Go | `gopls serve` |
| Rust | `rust-analyzer` |
| Python | `pyright-langserver` |
| Java | `jdtls` |

Kotlin has no built-in default. Vue is not in the language map and won't trigger automatically. Configure non-default servers via `.pi-lsp.json` in the project root. A template is at `pi-dev/pi-lsp.json` in this repo.

```json
{
  "servers": {
    "kotlin": { "command": "kotlin-lsp", "args": ["--stdio"] }
  },
  "autoStart": ["kotlin"]
}
```

`autoStart` spins up the server at session start rather than waiting for the first tool call — recommended for Kotlin LSP, which is slow to initialize. See the [pi-lsp-extension README](https://github.com/samfoy/pi-lsp-extension) for full `.pi-lsp.json` options.

## What agents can edit here

- Add or remove models within existing providers
- Add new providers following the same structure
- Update `contextWindow` / `maxTokens` if a model's limits change
- Do **not** use env var substitution — pi.dev reads plain JSON
