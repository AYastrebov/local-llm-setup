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

Google's multimodal model with thinking/reasoning support.

| Quant | Size | Fits 64GB Mac? | Notes |
|-------|------|----------------|-------|
| UD-Q8_K_XL | 28 GB | Yes (recommended) | Near-lossless quality, 21 GB headroom |
| UD-Q6_K_XL | 23 GB | Yes | Great quality, even more headroom |
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

### Qwen3-Coder-Next (80B MoE, 3B active)

Specialized coding model. **Does NOT support thinking mode** — non-thinking only.

| Quant | Size | Fits 64GB Mac? | Notes |
|-------|------|----------------|-------|
| UD-Q4_K_S | 46 GB | Yes (recommended) | Best quality that fits with KV cache quant |
| UD-Q3_K_XL | 34 GB | Yes | More headroom, slightly lower quality |
| UD-Q4_K_XL | 49.6 GB | No | OOMs with 65K context |
| UD-IQ3_XXS | 28 GB | Yes | Lower quality, most headroom |

> **Note:** Q4_K_S requires KV cache quantization (`q4_0`) and single parallel slot (`-np 1`) to fit. ~1.8 GB free after model + KV cache.

**Sampling parameters** (per [Unsloth docs](https://unsloth.ai/docs/models/qwen3-coder-next)):

| Parameter | Value |
|-----------|-------|
| Temperature | 1.0 |
| Top-P | 0.95 |
| Top-K | 40 |
| Min-P | 0.01 |

**Launch:**
```bash
qwen-coder              # server on port 8080
qwen-coder chat         # interactive CLI
```

### Qwen3.5-35B-A3B (35B MoE, 3B active)

General-purpose model with thinking/reasoning support.

| Quant | Size | Fits 64GB Mac? | Notes |
|-------|------|----------------|-------|
| UD-Q4_K_XL | ~18 GB | Yes (recommended) | Higher quality than Fedora's IQ3_XXS |
| UD-IQ3_XXS | ~13 GB | Yes | Use on memory-constrained systems |

**Sampling parameters** (per [Unsloth docs](https://unsloth.ai/docs/models/qwen3.5)):

| Mode | Temperature | Top-P | Top-K | Min-P |
|------|-------------|-------|-------|-------|
| Coding (thinking) | 0.6 | 0.95 | 20 | 0.0 |
| Creative (thinking) | 1.0 | 0.95 | 20 | 0.0 |

**Launch:**
```bash
qwen-moe                # server on port 8080
qwen-moe chat           # interactive CLI (coding params)
qwen-moe chat-think     # interactive CLI (creative params)
```

## Key differences from Fedora setup

| | Mac (M2 Max, 64GB) | Fedora (RX 9060 XT, 16GB VRAM) |
|---|---|---|
| GPU backend | Metal | HIP/ROCm |
| Gemma 4 26B-A4B quant | Q8_K_XL (28 GB) | N/A |
| Qwen3-Coder-Next quant | Q4_K_S (46 GB) | N/A |
| Qwen3.5-35B-A3B quant | Q4_K_XL (~18 GB) | IQ3_XXS (~13 GB) |
| KV cache quantization | q4_0 (for Qwen3-Coder-Next) | q4_0 |
| Build flags | `-DGGML_METAL=ON -DGGML_NATIVE=ON` | `-DGGML_HIP=ON -DGGML_HIP_ROCWMMA_FATTN=ON` |

The Mac's larger unified memory allows higher quantization levels for better quality output.

## Coding agent integration

Copy configs to their respective locations:
- pi.dev: `configs/pi-dev/models-mac.json` → `~/.pi/agent/models.json`
- opencode: `configs/opencode/opencode-mac.jsonc` → `~/.config/opencode/opencode.jsonc`

Start a server and select the model in the agent UI.

## Performance (observed)

**Qwen3-Coder-Next Q4_K_S on M2 Max:**

| Metric | Value |
|--------|-------|
| GPU memory used | ~47 GB |
| GPU memory free | ~2 GB |

> Generation speed is ~32-38 t/s for MoE models (3-4B active params) on M2 Max.
