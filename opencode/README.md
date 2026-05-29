# opencode

OpenCode user configs (`~/.config/opencode/opencode.jsonc`) for each platform.

## Files

| File | Platform | Copy to |
|------|----------|---------|
| `mac.jsonc` | macOS (M2 Max, 64GB) | `~/.config/opencode/opencode.jsonc` |
| `fedora.jsonc` | Fedora (RX 9060 XT, ROCm) | `~/.config/opencode/opencode.jsonc` |

## Setup

```bash
# macOS
cp opencode/mac.jsonc ~/.config/opencode/opencode.jsonc

# Fedora
cp opencode/fedora.jsonc ~/.config/opencode/opencode.jsonc
```

JetBrains Central wires automatically via `jbcentral add opencode`, which writes
`~/.config/opencode/opencode.json` (managed file, do not edit).

## What differs between mac and fedora

The only difference is the local model in the `local-moe` agent:
- **mac**: `local/qwen3.6-27b` (27B dense, Q6_K_XL, ~26 GB)
- **fedora**: `local/qwen3.6-35b-a3b` (35B MoE, IQ3_XXS, ~14 GB VRAM)

Both use the `qwen-mtp` launcher script — the model file it loads differs per platform.
Cloud provider sections (NeuralWatt, JB Central) and all other agent definitions are identical.

## Agent overview

| Agent | Model | Provider | Notes |
|-------|-------|----------|-------|
| `plan` | DeepSeek V4 Pro | DeepSeek | Read-only analysis, built-in override |
| `build` | DeepSeek V4 Flash | DeepSeek | Default execution, built-in override |
| `kimi-direct` | Kimi K2.6 | Moonshot | General reasoning, 262K ctx |
| `glm` | GLM 5.1 FP8 | NeuralWatt | Architecture, 202K ctx |
| `qwen-fast` | Qwen3.6 35B A3B | NeuralWatt | Fast/cheap tasks |
| `explore` | Qwen3.6 35B Fast | NeuralWatt | Subagent: codebase search |
| `docs` | Qwen3.6 35B Fast | NeuralWatt | Subagent: internal docs |
| `local-gemma` | Gemma 4 26B-A4B | llama.cpp | Offline — start `gemma-moe` first |
| `local-moe` | Qwen3.6 27B/35B | llama.cpp | Offline — start `qwen-mtp` first |

JB Central agents (opus, codex, gemini) are defined in the Kotlin project config
(`~/JB/kotlin/opencode.jsonc`), not here.

## What agents can edit here

- Add or update model definitions under existing providers
- Add new agents to the `agent` section
- Enable/disable MCP servers
- Do **not** add jbcentral provider overrides — those are managed by `opencode.json`
- Do **not** add local models without updating both `mac.jsonc` and `fedora.jsonc` — local model IDs differ per platform
