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

The difference is the set of local agents:
- **mac** — `local-qwen` → `local/qwen3.8-27b` (27B dense VL, UD-Q6_K_XL, 25.9 GB, launcher `qwen`)
  and `local-mellum` → `local/mellum2-12b-a2.5b` (12B MoE / 2.5B active, Q8_0, 12.9 GB, launcher `mellum`)
- **fedora** — `local-gemma` → `local/gemma-4-26b-a4b` (Q3_K_XL, ~13 GB)
  and `local-qwen` → `local/qwen3.8-27b` (27B dense, UD-IQ3_XXS, 11.9 GB, launcher `qwen`)

Both platforms run Qwen3.8-27B — the launcher picks the quant from `uname`. Mellum2 is macOS-only,
Gemma 4 is Fedora-only.
Cloud provider sections (NeuralWatt, JB Central) and all other agent definitions are identical.

## Agent overview

| Agent | Model | Provider | Notes |
|-------|-------|----------|-------|
| `plan` | DeepSeek V4 Pro | DeepSeek | Read-only analysis, built-in override |
| `build` | DeepSeek V4 Flash | DeepSeek | Default execution, built-in override |
| `kimi` | Kimi K2.6 | Moonshot | General reasoning, 262K ctx |
| `glm` | GLM 5.1 FP8 | NeuralWatt | Architecture, 202K ctx |
| `qwen-fast` | Qwen3.6 35B A3B | NeuralWatt | Fast/cheap tasks |
| `explore` | Qwen3.6 35B Fast | NeuralWatt | Subagent: codebase search |
| `docs` | Qwen3.6 35B Fast | NeuralWatt | Subagent: internal docs |
| `local-qwen` | Qwen3.8-27B (both) | llama.cpp | Offline — start `qwen` first |
| `local-mellum` | Mellum2 12B-A2.5B Thinking (mac) | llama.cpp | Offline — start `mellum` first |
| `local-gemma` | Gemma 4 26B-A4B (fedora) | llama.cpp | Offline — start `gemma-moe` first |

JB Central agents (opus, codex, gemini) are defined in the Kotlin project config
(`~/JB/kotlin/opencode.jsonc`), not here.

## What agents can edit here

- Add or update model definitions under existing providers
- Add new agents to the `agent` section
- Enable/disable MCP servers
- Do **not** add jbcentral provider overrides — those are managed by `opencode.json`
- Do **not** add local models without updating both `mac.jsonc` and `fedora.jsonc` — local model IDs differ per platform
