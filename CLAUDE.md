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
  scripts/          launcher scripts (qwen = both platforms, auto-detected)
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
  mcp.json            MCP servers (github, context7, tavily, playwright, jetbrains); env-var/OAuth auth, no secrets
  extensions/router.ts   router/auto virtual model (NeuralWatt qualifier picks glm-5.3 vs glm-5.3-flash)
  skills/{grill-me,plan,implement}   lean grill -> plan -> implement workflow (explicit /skill: only)
  skills/{go,rust}    language skills: gopls MCP / rust-analyzer workflow + quality gates (auto)
  skills/frontend-checks   Vue/Svelte/Vite gate + browser check; framework skills come from upstream via install-skills.sh
  extensions/neuralwatt/   NeuralWatt provider (live /v1/models catalog), user/flex request fields, hosted tools, footer + /nw
  prompts/{review,simplify}.md   /review (fresh read-only reviewer) and /simplify (apply cleanups) commands
  install-skills.sh   installs those + prompts, + vetted upstream skills (tdd, diagnosing-bugs, writing-for-agents, frontend-design, humanizer)

docs/               misc docs not tied to a specific topic
  lsp.md
  mcp.md            pi-native MCP setup (pi-mcp-adapter is obsolete)

zshrc-snippet.sh    shell environment (API keys, PATH, aliases)
```

## Architecture

**Launcher scripts** (`llama-cpp/scripts/`) — Bash scripts that wrap `llama-cli` and `llama-server` with per-model defaults (quantization, sampling params, KV cache settings). Each script supports `server` (default), `chat`, and optionally `chat-think` modes. They use `-hf` for automatic HuggingFace model download.

**Qwen3.8 thinking controls** — Qwen3.8 uses llama.cpp's `--reasoning-effort` (`xhigh`/`medium`/`low` only; `none` raises a Jinja exception) and `--reasoning off` for genuine non-thinking.

**Both machines run one local model** — Qwen3.8-27B (`qwen`).

**`qwen` is the one cross-platform launcher** — it branches on `uname`: macOS gets `UD-Q6_K_XL` (25.9 GB) with vision, Linux gets `UD-IQ3_XXS` (10.93 GB) plus `--no-mmproj` to stay inside 16 GB VRAM. Override with `QWEN_MODEL` / `QWEN_CTX` rather than editing the script.

**MTP is ON for Qwen3.8 on both platforms** — `--spec-type draft-mtp --spec-draft-n-max 4`, measured 2.3x on Fedora and 1.7x on macOS. No `-MTP-` repo is needed: the NextN block ships *inside* the main GGUF as `blk.64.nextn.*`. An earlier revision of this file said "No MTP anywhere" — that was wrong, and the `unused tensor blk.64.nextn.*` lines in the server log were the idle draft head, not a defect.

**Qwen3.8 is dense** — on Fedora it replaced a 35B-A3B MoE that activated ~3B params per token, so it is markedly slower there. That tradeoff is deliberate and documented in `llama-cpp/fedora/setup.md`; do not "fix" it by silently swapping back.

**pi settings** (`pi-dev/settings-{mac,fedora}.json`) — Sets `defaultProvider`/`defaultModel` (mac: `moonshotai`/`kimi-k3`; fedora: `neuralwatt`/`glm-5.3-flash`). Both set the same `enabledModels` short list. In pi 1.0.2 that is a default *view*, not an allowlist: it scopes startup and `Ctrl+P`, and `/model` opens on it with Tab switching to all models, so env-key providers stay reachable. Use exact IDs for vendors whose names also prefix OpenRouter IDs (`moonshotai/*` matches `openrouter/moonshotai/...`). pi has a built-in provider catalog, so `moonshotai`, `openrouter`, `deepseek` and friends work from an exported API key alone and must NOT be added to `models.json`; only custom endpoints (`llama-cpp`, `neuralwatt`) belong there.

**pi.dev configs** (`pi-dev/`) — `models-*.json` hold only `llama-cpp` (differs per platform). NeuralWatt is registered by the `extensions/neuralwatt/` extension (key from `NEURALWATT_API_KEY`; never commit a literal key); edit `MODEL_IDS` in its `catalog.ts`. Model IDs, prices and supported reasoning efforts come from `GET https://api.neuralwatt.com/v1/models` (no auth); prefer the `nw-flash`/`nw-small`/`nw-large` tracking aliases over pinned IDs.

**Shell snippet** (`zshrc-snippet.sh`) — Sets `LLAMA_CACHE`, PATH and provider API keys. Local models are driven through `pi-qwen`, not Claude Code.

**Claude Code skills** — `llama-cpp/skills/llama-build/` (build llama.cpp).

## Key conventions

- All launcher scripts default to port 8080 and use `exec` to replace the shell process
- KV cache quantization varies by platform and backend: Fedora/ROCm uses `q4_0` for Qwen3.8 (a flash-attention fast path worth ~2x there), macOS/Metal uses `q8_0`. Do not unify these — the difference is measured, see `llama-cpp/fedora/setup.md`
- Context size is 65536 tokens for all models (Qwen3.8 supports 262144 natively; 65536 is the deliberate default)
- Models are sourced from Unsloth's GGUF quantizations on HuggingFace
- `llama-cpp/fedora/build.sh` is Fedora/ROCm-specific (uses `hipconfig`); macOS builds use plain cmake with `-DGGML_METAL=ON`
