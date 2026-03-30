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

### Qwen3-Coder-Next (80B MoE, 3B active)

Specialized coding model. **Does NOT support thinking mode** — non-thinking only.

| Quant | Size | Fits 64GB Mac? | Notes |
|-------|------|----------------|-------|
| UD-Q3_K_XL | 34 GB | Yes (recommended) | Sweet spot for 64GB |
| UD-Q4_K_XL | 46 GB | Tight | May OOM with 65K context |
| UD-IQ3_XXS | 28 GB | Yes | Lower quality, more headroom |

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
| Qwen3-Coder-Next quant | Q3_K_XL (34 GB) | N/A |
| Qwen3.5-35B-A3B quant | Q4_K_XL (~18 GB) | IQ3_XXS (~13 GB) |
| KV cache quantization | q4_0 (saves memory for 65K ctx) | q4_0 |
| Build flags | `-DGGML_METAL=ON -DGGML_NATIVE=ON` | `-DGGML_HIP=ON -DGGML_HIP_ROCWMMA_FATTN=ON` |

The Mac's larger unified memory allows higher quantization levels for better quality output.

## pi.dev integration

Copy `configs/pi-dev/models-mac.json` to `~/.pi/agent/models.json`, then start a server and select the model in pi.dev via `/model`.

## Performance (observed)

**Qwen3-Coder-Next Q3_K_XL on M2 Max:**

| Metric | Value |
|--------|-------|
| Prompt processing (cold) | ~438 t/s |
| Prompt processing (cached) | ~120-220 t/s |
| Generation speed | 32-38 t/s |
| GPU memory used | ~35 GB |
| GPU memory free | ~14 GB |
