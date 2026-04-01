# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This repo contains configuration files, launcher scripts, and a Claude Code skill for running local LLM inference with llama.cpp on two platforms:
- **Fedora Linux** — Intel i5-14600K + AMD RX 9060 XT (16GB VRAM, ROCm/HIP)
- **macOS** — Apple M2 Max (64GB unified memory, Metal)

There is no build system, test suite, or linter for this repo itself — it is a collection of shell scripts, JSON configs, and documentation.

## Architecture

**Launcher scripts** (`scripts/`) — Bash scripts that wrap `llama-cli` and `llama-server` with per-model defaults (quantization, sampling params, KV cache settings). Each script supports `server` (default), `chat`, and optionally `chat-think` modes. They use `-hf` for automatic HuggingFace model download.

**Model families are distinct** — Qwen3-Coder-Next and Qwen3.5 have different sampling parameters and thinking mode support. Qwen3-Coder-Next does NOT support thinking mode. Qwen3.5 models use `--chat-template-kwargs '{"enable_thinking":true}'`. Never mix their parameters.

**pi.dev configs** (`configs/pi-dev/`) — JSON files for `~/.pi/agent/models.json` that point pi.dev at the local llama-server's OpenAI-compatible API (`localhost:8080/v1`). Fedora and macOS have separate configs with different model lists.

**Shell snippet** (`configs/zshrc-snippet.sh`) — Sets `LLAMA_CACHE`, PATH, and aliases (`claude-local`, `claude-local-moe`) for running Claude Code against local models.

**Claude Code skill** (`skills/llama-build/`) — Multi-platform skill that automates building llama.cpp from source with GPU acceleration. Includes a ROCm compatibility matrix for Fedora/AMD and reference docs in `references/`.

## Key conventions

- All launcher scripts default to port 8080 and use `exec` to replace the shell process
- KV cache quantization (`--cache-type-k q4_0 --cache-type-v q4_0`) is standard across all launchers
- Context size is 65536 tokens for all models
- Models are sourced from Unsloth's GGUF quantizations on HuggingFace
- The `build-llama.sh` script is Fedora/ROCm-specific (uses `hipconfig`); macOS builds use plain cmake with `-DGGML_METAL=ON`
