# macOS Setup (Apple Silicon)

Setup guide for running local LLM inference on Apple Silicon Macs with Metal GPU acceleration.

This Mac runs exactly two local models: **Qwen3.8-27B** (general + reasoning + vision) and
**Mellum2 12B-A2.5B** (coding). Gemma 4 and the Qwen3.6 MTP builds are Fedora-only — see
[../fedora/setup.md](../fedora/setup.md).

## Hardware tested

| Component | Spec |
|-----------|------|
| Machine | MacBook Pro 16-inch, 2023 |
| CPU | Apple M2 Max (12 cores @ 3.50 GHz) |
| GPU | Apple M2 Max (30 cores, Metal 3) |
| Memory | 64 GB unified |
| OS | macOS Sequoia 15.7 |

## Build llama.cpp

Metal GPU acceleration is enabled by default on macOS. No third-party drivers needed.

**Prerequisites:** Xcode Command Line Tools (`xcode-select --install`).

```bash
git clone https://github.com/ggml-org/llama.cpp.git ~/llama.cpp
cd ~/llama.cpp
cmake -B build -DGGML_METAL=ON -DGGML_NATIVE=ON -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release -j $(sysctl -n hw.ncpu)
```

Add to PATH (`~/.zshrc`):
```bash
export PATH="$HOME/llama.cpp/build/bin:$PATH"
```

> **Upgrading an existing checkout:** llama.cpp vendored cpp-httplib in mid-2026. Reconfiguring a
> `build/` directory created before that fails with
> `Target "cpp-httplib" links to OpenSSL::SSL but the target was not found`.
> Fix: `rm -rf build` and configure from scratch. Clean builds are unaffected.

Both architectures used here must be present in your build — verify with:
```bash
grep -E '"(qwen35|mellum)"' ~/llama.cpp/src/llama-arch.cpp
```

## Models

### Qwen3.8-27B (27B dense, vision-language)

Qwen's most capable compact dense model: hybrid Gated DeltaNet + Gated Attention, native image and
video understanding, 262K native context, thinking on by default with per-request control
(`enable_thinking`, `reasoning_effort`, `preserve_thinking`).

| Quant | Size | Fits 64 GB Mac? | Notes |
|-------|------|-----------------|-------|
| UD-Q8_K_XL | 31.5 GB | Yes | Near-lossless, tighter headroom |
| **UD-Q6_K_XL** | **25.9 GB** | **Yes (recommended)** | High quality, ~35 GB headroom |
| UD-Q5_K_XL | 20.2 GB | Yes | Good quality, more room for context |
| UD-Q4_K_XL | 17.9 GB | Yes | Max headroom |

At 65536 context with q8_0 KV cache the attention cache adds roughly 2 GB — only 16 of 64 layers
use full attention, the rest are linear (DeltaNet) and carry a small fixed-size state.

`-hf` also pulls `mmproj-F16.gguf` (~0.9 GB) automatically, which is what enables image input.
Pass `--no-mmproj` to skip it.

> There is **no MTP GGUF** for Qwen3.8-27B (unlike Qwen3.6-27B-MTP), so the launcher carries no
> `--spec-type draft-mtp` flags. Speculative decoding returns if unsloth publishes an `-MTP-` repo.

**Sampling parameters** (per the [Qwen3.8 model card](https://huggingface.co/unsloth/Qwen3.8-27B-GGUF)):

| Mode | Temperature | Top-P | Top-K | Min-P | Presence penalty |
|------|-------------|-------|-------|-------|------------------|
| Thinking | 1.0 | 0.95 | 20 | 0.0 | 0.0 |
| Instruct (non-thinking) | 0.7 | 0.80 | 20 | 0.0 | 1.5 |

**Launch:**
```bash
qwen              # server on port 8080
qwen chat         # interactive CLI, thinking on
qwen chat-fast    # interactive CLI, thinking off (instruct params)
```

### Mellum2 12B-A2.5B (12B MoE, 2.5B active)

JetBrains' coding model. 64 experts, 8 active per token; sliding-window + full attention;
131K context; Apache 2.0. Two post-trained variants ship at the same size:

| Variant | LiveCodeBench v6 | BFCL v3 | AIME | Use when |
|---------|-----------------|---------|------|----------|
| **Thinking** (default) | **69.9** | **69.4** | **58.4** | Agentic coding, debugging, multi-step planning |
| Instruct | 37.2 | 66.3 | 41.7 | Direct low-latency answers, no reasoning trace |

Benchmarks are JetBrains self-reported. Thinking wins decisively on code at identical cost, so it
is the default here; switch with `MELLUM_VARIANT=Instruct`.

| Quant | Size | Fits 64 GB Mac? | Notes |
|-------|------|-----------------|-------|
| BF16 | ~24 GB | Yes | Reference precision |
| **Q8_0** | **12.9 GB** | **Yes (recommended)** | Near-lossless for a 2.5B-active MoE |
| Q6_K | 10.9 GB | Yes | Slightly smaller |
| Q4_K_M | 8.1 GB | Yes | Smallest sensible |

**Sampling parameters** (per the [Mellum2 model card](https://huggingface.co/JetBrains/Mellum2-12B-A2.5B-Thinking)):

| Parameter | Value |
|-----------|-------|
| Temperature | 0.6 |
| Top-P | 0.95 |
| Top-K | 20 |

**Launch:**
```bash
mellum                            # Thinking variant, server on port 8080
mellum chat                       # interactive CLI
MELLUM_VARIANT=Instruct mellum    # low-latency variant
```

## Running both

Both launchers bind port 8080, so run one at a time. To keep both up, give one a different port:

```bash
qwen server 8080     # general / reasoning / vision
mellum server 8081   # coding
```

## Key differences from Fedora setup

| | Mac (M2 Max, 64 GB) | Fedora (RX 9060 XT, 16 GB VRAM) |
|---|---|---|
| GPU backend | Metal | HIP/ROCm |
| General model | Qwen3.8-27B dense, UD-Q6_K_XL (25.9 GB) | Qwen3.6 35B-A3B MoE MTP, IQ3_XXS (~14 GB) |
| Coding model | Mellum2 12B-A2.5B Thinking, Q8_0 (12.9 GB) | — |
| Multimodal | Gemma 4 26B-A4B (Fedora only) | Gemma 4 26B-A4B, Q3_K_XL (13 GB) |
| Speculative decoding | none (no Qwen3.8 MTP GGUF) | `--spec-type draft-mtp` |
| KV cache quantization | q8_0 | q8_0 |
| Build flags | `-DGGML_METAL=ON -DGGML_NATIVE=ON` | `-DGGML_HIP=ON -DGGML_HIP_ROCWMMA_FATTN=ON` |

## Coding agent integration

Copy configs to their respective locations:
- pi.dev: `pi-dev/models-mac.json` → `~/.pi/agent/models.json`
- opencode: `opencode/mac.jsonc` → `~/.config/opencode/opencode.jsonc`

Start a server and select the model in the agent UI.

## LSP

`opencode/mac.jsonc` declares language servers for Go, TypeScript/JavaScript, Rust, Vue, and Kotlin.
See [docs/lsp.md](../../docs/lsp.md) for macOS install commands (`brew install rust-analyzer`, npm
for the JS-based servers).

## Performance (observed)

Previously measured: ~32–38 t/s for MoE models with 3–4B active params on this M2 Max. Mellum2
activates 2.5B params per token, so expect the same ballpark. Qwen3.8-27B is dense (all 27B active)
and will be substantially slower per token — not yet benchmarked here; update this line once measured.
