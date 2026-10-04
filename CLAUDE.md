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
  scripts/          launcher scripts (qwen = both platforms, auto-detected; gemma-moe = Fedora)
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

pi-dev/             pi.dev model + settings configs per platform
  models-mac.json
  models-fedora.json
  settings-mac.json
  settings-fedora.json

docs/               misc docs not tied to a specific topic
  lsp.md

zshrc-snippet.sh    shell environment (API keys, PATH, aliases)
```

## Architecture

**Launcher scripts** (`llama-cpp/scripts/`) — Bash scripts that wrap `llama-cli` and `llama-server` with per-model defaults (quantization, sampling params, KV cache settings). Each script supports `server` (default), `chat`, and optionally `chat-think` modes. They use `-hf` for automatic HuggingFace model download.

**Model families are distinct** — Qwen3.8 and Gemma 4 have different sampling parameters and completely different thinking-mode controls. Never mix them. Qwen3.8 uses llama.cpp's `--reasoning-effort` (`xhigh`/`medium`/`low` only; `none` raises a Jinja exception) and `--reasoning off` for genuine non-thinking. Gemma 4 disables thinking with `--chat-template-kwargs '{"enable_thinking":false}'` and enables it with a `<|think|>` token at the start of the system prompt.

**macOS runs one model** — Qwen3.8-27B (`qwen`). Gemma 4 is Fedora-only; do not reintroduce it into `pi-dev/models-mac.json` or `llama-cpp/mac/setup.md`.

**`qwen` is the one cross-platform launcher** — it branches on `uname`: macOS gets `UD-Q6_K_XL` (25.9 GB) with vision, Linux gets `UD-IQ3_XXS` (10.93 GB) plus `--no-mmproj` to stay inside 16 GB VRAM. Override with `QWEN_MODEL` / `QWEN_CTX` rather than editing the script.

**MTP is ON for Qwen3.8 on both platforms** — `--spec-type draft-mtp --spec-draft-n-max 4`, measured 2.3x on Fedora and 1.7x on macOS. No `-MTP-` repo is needed: the NextN block ships *inside* the main GGUF as `blk.64.nextn.*`. An earlier revision of this file said "No MTP anywhere" — that was wrong, and the `unused tensor blk.64.nextn.*` lines in the server log were the idle draft head, not a defect. Gemma 4 has MTP too, but as a separate sidecar (`MTP/mtp-gemma-4-26B-A4B-it.gguf`) that llama.cpp fetches automatically; `gemma-moe` does not yet enable it.

**Qwen3.8 is dense** — on Fedora it replaced a 35B-A3B MoE that activated ~3B params per token, so it is markedly slower there. That tradeoff is deliberate and documented in `llama-cpp/fedora/setup.md`; do not "fix" it by silently swapping back.

**pi settings** (`pi-dev/settings-{mac,fedora}.json`) — Sets `defaultProvider`/`defaultModel` (mac: `moonshotai`/`kimi-k3`; fedora: `neuralwatt`/`nw-flash`). Neither sets **`enabledModels`**: that key is an allowlist and would defeat pi's env-key provider discovery. pi has a built-in provider catalog, so `moonshotai`, `openrouter`, `deepseek` and friends work from an exported API key alone and must NOT be added to `models.json`; only custom endpoints (`llama-cpp`, `neuralwatt`) belong there.

**pi.dev configs** (`pi-dev/`) — The `neuralwatt` block is identical in both `models-*.json` files; only `llama-cpp` differs per platform. NeuralWatt uses `"apiKey": "$NEURALWATT_API_KEY"` (pi interpolates env vars in `models.json`) — never commit a literal key. Model IDs, prices and supported reasoning efforts come from `GET https://api.neuralwatt.com/v1/models` (no auth); prefer the `nw-flash`/`nw-small`/`nw-large` tracking aliases over pinned IDs.

**Shell snippet** (`zshrc-snippet.sh`) — Sets `LLAMA_CACHE`, PATH and provider API keys. Local models are driven through `pi-qwen`, not Claude Code.

**Claude Code skills** — `llama-cpp/skills/llama-build/` (build llama.cpp).

## Key conventions

- All launcher scripts default to port 8080 and use `exec` to replace the shell process
- KV cache quantization varies by platform and backend: Fedora/ROCm uses `q4_0` for Qwen3.8 (a flash-attention fast path worth ~2x there), macOS/Metal and `gemma-moe` use `q8_0`. Do not unify these — the difference is measured, see `llama-cpp/fedora/setup.md`
- Context size is 65536 tokens for all models (Qwen3.8 supports 262144 natively; 65536 is the deliberate default)
- Models are sourced from Unsloth's GGUF quantizations on HuggingFace
- `llama-cpp/fedora/build.sh` is Fedora/ROCm-specific (uses `hipconfig`); macOS builds use plain cmake with `-DGGML_METAL=ON`
