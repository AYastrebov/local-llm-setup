# Local LLM Setup — Fedora 43 + AMD Radeon RX 9060 XT

## Hardware

| Component | Spec |
|-----------|------|
| CPU | Intel Core i5-14600K |
| RAM | 32 GB |
| GPU | AMD Radeon RX 9060 XT (16 GB VRAM, RDNA4, gfx1200) |
| OS | Fedora 43, kernel 6.19+ |

## ROCm Installation

Fedora 43 ships ROCm 6.4+ natively, which supports RDNA4 (gfx1200).

```bash
sudo dnf install rocm-hip-devel hipcc rocminfo rocm-smi cmake gcc-c++ openssl-devel
sudo dnf install rocwmma-devel   # flash attention acceleration for RDNA3+
sudo usermod -aG render,video $USER
# Log out and back in for group changes
```

Verify:
```bash
rocminfo | grep gfx     # should show gfx1200
rocm-smi                # should show the RX 9060 XT
```

## Building llama.cpp

Clone and build from `~/llama.cpp`:

```bash
cd ~/llama.cpp
./build.sh        # builds with HIP + rocWMMA, 4 parallel jobs
./build.sh 8      # or with more parallelism (needs ~32 GB RAM)
```

The build script (`~/llama.cpp/build.sh`) runs:
```bash
HIPCXX="$(hipconfig -l)/clang" HIP_PATH="$(hipconfig -R)" \
    cmake -S . -B build \
    -DGGML_HIP=ON \
    -DGGML_HIP_ROCWMMA_FATTN=ON \
    -DCMAKE_BUILD_TYPE=Release

cmake --build build --config Release -j "$JOBS"
```

Key flags:
- `-DGGML_HIP=ON` — AMD GPU backend
- `-DGGML_HIP_ROCWMMA_FATTN=ON` — rocWMMA flash attention (RDNA3+)

## Shell Configuration (~/.zshrc)

```bash
export LLAMA_CACHE="$HOME/models"
export PATH="/home/ayastrebov/llama.cpp/build/bin:$PATH"
```

- `LLAMA_CACHE` — all model downloads (`-hf` flag) go to `~/models/`
- Build binaries (`llama-cli`, `llama-server`) added to PATH

## Models

Models are stored as plain GGUF files in `~/models/`.

| Model | Quant | Size | VRAM fit? |
|-------|-------|------|-----------|
| Gemma 4 26B-A4B (MoE) | UD-Q3_K_XL | 12.9 GB | Yes (~2 GB for KV cache) |
| Qwen3.6 35B-A3B (MoE) | UD-IQ3_XXS | 13.2 GB | Yes (3B params active) |

Download models:
```bash
llama-cli -hf unsloth/gemma-4-26B-A4B-it-GGUF:UD-Q3_K_XL -n 0 -p ""
llama-cli -hf unsloth/Qwen3.6-35B-A3B-GGUF:UD-IQ3_XXS -n 0 -p ""
```

## Launcher Scripts

Located in `~/.local/bin/`. All default to server mode on port 8080.

### gemma-moe (Gemma 4 26B-A4B)

```bash
gemma-moe              # server on port 8080
gemma-moe server 9090  # server on custom port
gemma-moe chat         # interactive CLI, thinking enabled
```

Configure for Fedora by editing the MODEL line in the script:
```bash
MODEL="unsloth/gemma-4-26B-A4B-it-GGUF:UD-Q3_K_XL"
KV_CACHE="--cache-type-k q4_0 --cache-type-v q4_0"
```

### qwen-moe (Qwen3.6 35B-A3B)

```bash
qwen-moe              # server on port 8080
qwen-moe server 9090  # server on custom port
qwen-moe chat         # interactive CLI, thinking enabled (coding params)
qwen-moe chat-think   # interactive CLI, creative params
```

### Sampling Parameters

| Model | Mode | temp | top-p | top-k | min-p |
|-------|------|------|-------|-------|-------|
| Gemma 4 26B-A4B | all | 1.0 | 0.95 | 64 | — |
| Qwen3.6 35B-A3B | Coding (chat) | 0.6 | 0.95 | 20 | 0.0 |
| Qwen3.6 35B-A3B | Creative (chat-think) | 1.0 | 0.95 | 20 | 0.0 |

Context window: 65536 tokens. KV cache is quantized to `q4_0` to fit 64K context in 16 GB VRAM (~13 GB model + ~2 GB KV cache, ~1 GB headroom).

## pi.dev Configuration

Config file: `~/.pi/agent/models.json` (copy from `configs/pi-dev/models.json`)

Start a launcher (`gemma-moe` or `qwen-moe`), then select the model in pi.dev via `/model`.

## opencode Configuration

Config file: `~/.config/opencode/opencode.jsonc` (copy from `configs/opencode/opencode-fedora.jsonc`)

```bash
cp configs/opencode/opencode-fedora.jsonc ~/.config/opencode/opencode.jsonc
```

Agent profiles:
- `local-gemma` — Gemma 4 26B-A4B (thinking, temp 1.0). Start server: `gemma-moe`
- `local-moe` — Qwen3.6 35B-A3B (thinking, temp 0.6). Start server: `qwen-moe`

## Web UI

llama-server includes a built-in web UI. After starting a server, open `http://localhost:8080` in a browser.

## Claude Code with Local Models

```bash
claude-gemma       # Gemma 4 26B-A4B
claude-qwen        # Qwen3.6 35B-A3B
```

Aliases defined in `configs/zshrc-snippet.sh`. Start the corresponding server first.

## Troubleshooting

**"Cannot find ROCm device library":**
```bash
find $HIP_PATH -name "oclc_abi_version_400.bc" 2>/dev/null
# Re-run cmake with HIP_DEVICE_LIB_PATH set to that directory
```

**Compiler segfault during build:**
Too many parallel HIP kernel compilations exhausting RAM. Reduce jobs: `./build.sh 2`

**GPU not detected:**
```bash
# Check groups
groups | grep -E 'render|video'
# Check ROCm sees the GPU
rocminfo | grep gfx
```
