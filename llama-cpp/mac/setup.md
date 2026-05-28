# macOS Setup (Apple Silicon)

Setup guide for running local LLM inference on Apple Silicon Macs with Metal GPU acceleration.

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

## Models

### Gemma 4 26B-A4B (26B MoE, 3.8B active)

Google’s multimodal model with thinking/reasoning support.

| Quant | Size | Fits 64GB Mac? | Notes |
|-------|------|----------------|-------|
| UD-Q8_K_XL | 28 GB | Yes (recommended) | Near-lossless quality, 21 GB headroom |
| UD-Q6_K_XL | 23 GB | Yes | Great quality |
| UD-Q4_K_XL | 17 GB | Yes | Good quality, max context headroom |

**Sampling parameters** (per [Unsloth docs](https://unsloth.ai/docs/models/gemma-4)):

| Parameter | Value |
|-----------|-------|
| Temperature | 1.0 |
| Top-P | 0.95 |
| Top-K | 64 |

**Launch:**
```bash
gemma-moe              # server on port 8080
gemma-moe chat         # interactive CLI (thinking enabled)
```

### Qwen3.6-27B (27B dense, MTP)

General-purpose model with thinking/reasoning and MTP speculative decoding (~1.4–2.2× speedup).

| Quant | Size | Fits 64GB Mac? | Notes |
|-------|------|----------------|-------|
| UD-Q6_K_XL | ~26 GB | Yes (recommended) | High quality, ~38 GB headroom |
| UD-Q4_K_XL | ~18 GB | Yes | Good quality, ~46 GB headroom |

**Sampling parameters** (per [Unsloth docs](https://unsloth.ai/docs/models/qwen3.6)):

| Mode | Temperature | Top-P | Top-K | Min-P |
|------|-------------|-------|-------|-------|
| Coding (thinking) | 0.6 | 0.95 | 20 | 0.0 |
| General/creative (thinking) | 1.0 | 0.95 | 20 | 0.0 |

**Launch:**
```bash
qwen-mtp                # server on port 8080
qwen-mtp chat           # interactive CLI (coding params)
qwen-mtp chat-think     # interactive CLI (creative params)
```

## Key differences from Fedora setup

| | Mac (M2 Max, 64GB) | Fedora (RX 9060 XT, 16GB VRAM) |
|---|---|---|
| GPU backend | Metal | HIP/ROCm |
| Gemma 4 26B-A4B quant | Q8_K_XL (28 GB) | Q3_K_XL (13 GB) |
| Qwen3.6 model | 27B dense MTP, Q6_K_XL (~26 GB) | 35B-A3B MoE, IQ3_XXS (~13 GB) |
| KV cache quantization | q8_0 | q8_0 |
| Build flags | `-DGGML_METAL=ON -DGGML_NATIVE=ON` | `-DGGML_HIP=ON -DGGML_HIP_ROCWMMA_FATTN=ON` |

The Mac’s larger unified memory allows higher quantization levels for better quality output.

## Coding agent integration

Copy configs to their respective locations:
- pi.dev: `pi-dev/models-mac.json` → `~/.pi/agent/models.json`
- opencode: `opencode/mac.jsonc` → `~/.config/opencode/opencode.jsonc`

Start a server and select the model in the agent UI.

## LSP

`opencode-mac.jsonc` declares language servers for Go, TypeScript/JavaScript, Rust, and Vue. See [docs/lsp.md](../docs/lsp.md) for macOS install commands (`brew install rust-analyzer`, npm for the JS-based servers).

## Performance (observed)

Generation speed is ~32–38 t/s for MoE models (3–4B active params) on M2 Max.
