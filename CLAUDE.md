# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This repo covers a full AI coding assistant setup across two machines:
- **Fedora Linux** — Intel i5-14600K + AMD RX 9060 XT (16GB VRAM, ROCm/HIP)
- **macOS** — Apple M2 Max (64GB unified memory, Metal)

It combines local LLM inference (llama.cpp) with cloud providers (NeuralWatt, Moonshot) and configs for two coding agents: pi.dev and Claude Code. opencode was removed in September 2026 - do not reintroduce it. JetBrains Central was removed in September 2026 as an internal-only tool - do not reintroduce it.

There is no build system, test suite, or linter — this is a collection of shell scripts, JSON configs, and documentation.

## Repository structure (organized by topic)

```
llama-cpp/          local inference — scripts, build instructions, skill
  mac/setup.md      macOS build guide
  fedora/setup.md   Fedora/ROCm build guide
  fedora/build.sh   ROCm build script (uses hipconfig)
  scripts/          launcher scripts (qwen = both platforms, auto-detected; mellum = macOS; gemma-moe = Fedora)
  skills/llama-build/  Claude Code skill for building llama.cpp


neuralwatt/         NeuralWatt cloud provider setup
  setup.md          API key, nw-usage install, agent config
  nw-usage          usage reporting script

deepseek/           DeepSeek cloud provider setup
  setup.md          API key, model IDs, agent config

moonshot/           Moonshot (Kimi) cloud provider setup
  setup.md          API key, model IDs, agent config

mimo/               Xiaomi MiMo cloud provider setup
  setup.md          API key, model IDs, agent config

minimax/            MiniMax cloud provider setup
  setup.md          API key, model IDs, agent config

pi-dev/             pi.dev model configs per platform
  models-mac.json
  models-fedora.json

docs/               misc docs not tied to a specific topic
  lsp.md

zshrc-snippet.sh    shell environment (API keys, PATH, aliases)
```

## Architecture

**Launcher scripts** (`llama-cpp/scripts/`) — Bash scripts that wrap `llama-cli` and `llama-server` with per-model defaults (quantization, sampling params, KV cache settings). Each script supports `server` (default), `chat`, and optionally `chat-think` modes. They use `-hf` for automatic HuggingFace model download.

**Model families are distinct** — Qwen3.8, Qwen3.6, Gemma 4, and Mellum2 each have their own sampling parameters and thinking-mode controls. Never mix them. Qwen3.8 accepts `enable_thinking`, `reasoning_effort`, and `preserve_thinking` via `--chat-template-kwargs`; Qwen3.6 accepts `enable_thinking`; Mellum2 emits `<think>` blocks unconditionally in its Thinking variant and never in Instruct.

**macOS runs only two models** — Qwen3.8-27B (`qwen`) and Mellum2 12B-A2.5B (`mellum`). Gemma 4 is Fedora-only; do not reintroduce it into `pi-dev/models-mac.json` or `llama-cpp/mac/setup.md`.

**`qwen` is the one cross-platform launcher** — it branches on `uname`: macOS gets `UD-Q6_K_XL` (25.9 GB) with vision, Linux gets `UD-IQ3_XXS` (11.9 GB) plus `--no-mmproj` to stay inside 16 GB VRAM. Override with `QWEN_MODEL` / `QWEN_CTX` rather than editing the script.

**No MTP anywhere** — neither Qwen3.8-27B nor Mellum2 has a published `-MTP-` GGUF, and Qwen3.6-35B-A3B-MTP has been retired, so no launcher passes `--spec-type`. The `qwen-mtp` script was deleted; it is in git history if Fedora ever reverts.

**Qwen3.8 is dense** — on Fedora it replaced a 35B-A3B MoE that activated ~3B params per token, so it is markedly slower there. That tradeoff is deliberate and documented in `llama-cpp/fedora/setup.md`; do not "fix" it by silently swapping back.

**pi settings** (`pi-dev/settings-mac.json`) — Sets `defaultProvider`/`defaultModel` (`moonshotai`/`kimi-k3`). It deliberately sets **no `enabledModels`**: that key is an allowlist and would defeat pi's env-key provider discovery. pi has a built-in provider catalog, so `moonshotai`, `openrouter`, `deepseek` and friends work from an exported API key alone and must NOT be added to `models.json`; only custom endpoints (`llama-cpp`, `neuralwatt`) belong there.

**pi.dev configs** (`pi-dev/`) — Same pattern: cloud sections are identical, local model section differs per platform.

**Shell snippet** (`zshrc-snippet.sh`) — Sets `LLAMA_CACHE`, PATH, provider API keys, and aliases for running Claude Code against local models.

**Claude Code skills** — `llama-cpp/skills/llama-build/` (build llama.cpp).

## Key conventions

- All launcher scripts default to port 8080 and use `exec` to replace the shell process
- KV cache quantization (`--cache-type-k q8_0 --cache-type-v q8_0`) is standard across all launchers
- Context size is 65536 tokens for all models (Qwen3.8 supports 262144 and Mellum2 131072 natively; 65536 is the deliberate default)
- Models are sourced from Unsloth's GGUF quantizations on HuggingFace, except Mellum2, which uses JetBrains' own GGUF repos (`JetBrains/Mellum2-12B-A2.5B-{Thinking,Instruct}-GGUF-Q8_0`)
- `llama-cpp/fedora/build.sh` is Fedora/ROCm-specific (uses `hipconfig`); macOS builds use plain cmake with `-DGGML_METAL=ON`
