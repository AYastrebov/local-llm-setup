---
name: llama-build
description: "Build llama.cpp from source and run local LLM inference with GPU acceleration. Use this skill whenever the user wants to: compile llama.cpp, set up local AI inference, run GGUF models locally, configure llama-server or llama-cli, create model launcher scripts, or work with Unsloth quantized models. Triggers on mentions of llama.cpp, GGUF, local LLM serving, Metal/ROCm/HIP GPU backends, or model quantization (Q4, Q3, IQ3, etc). Also use when the user asks about running models from Hugging Face locally on their own hardware."
---

# llama-build

Build llama.cpp for local GPU-accelerated inference and set up model serving.

## Quick reference

| Platform | GPU backend | Build flag | Auto-detected? |
|----------|------------|------------|----------------|
| macOS (Apple Silicon) | Metal | `-DGGML_METAL=ON` | Yes (default) |
| Linux (AMD Radeon) | HIP/ROCm | `-DGGML_HIP=ON` | No |
| Linux (NVIDIA) | CUDA | `-DGGML_CUDA=ON` | No |

## Step 1: Detect hardware and environment

Before building, detect the user's platform, GPU, and OS version to pick the right backend and install method.

```bash
# Platform
uname -s  # Darwin = macOS, Linux = Linux

# macOS: check Apple Silicon
sysctl -n machdep.cpu.brand_string
system_profiler SPDisplaysDataType 2>/dev/null | head -20

# Linux: check GPU
lspci | grep -iE 'vga|3d|display'
rocminfo 2>/dev/null | grep -E 'gfx|Name' | head -5  # AMD with ROCm

# Linux: check distro, version, and kernel (needed for ROCm compatibility)
cat /etc/fedora-release 2>/dev/null || cat /etc/os-release | head -5
uname -r                                    # RDNA4 needs kernel 6.12+
rpm -q rocm-hip-devel 2>/dev/null           # existing ROCm version if any
rpm -q --queryformat '%{VERSION}' fedora-release 2>/dev/null  # Fedora version number
```

### ROCm install path decision (Linux/AMD)

After detecting GPU and distro, use this matrix to decide how to install ROCm:

| GPU family | Min ROCm | Fedora native works? | Recommendation |
|------------|----------|---------------------|----------------|
| RDNA2 (gfx1030) | 5.0+ | F42+ (6.3) — yes | Fedora native packages |
| RDNA3 (gfx1100) | 5.5+ | F42+ (6.3) — yes | Fedora native packages |
| RDNA4 RX 9070 (gfx1200) | 6.4.1+ | F42 (6.3) — **no**; F43+ (6.4) — yes | F43+: native. F42: AMD repo or upgrade Fedora |
| RDNA4 RX 9060 XT (gfx1201) | 7.0.2+ | F42/F43 — **no**; F44+ (7.1) — yes | F44+: native. Older: AMD repo |
| Any GPU | — | RHEL / CentOS / Rocky | AMD `amdgpu-install` repo (see `references/rocm-fedora.md`) |
| Any GPU | — | Fedora Atomic (Silverblue/Kinoite) | Toolbox container (see `references/rocm-fedora.md`) |

Key rule: if the user's Fedora version ships a ROCm version >= what their GPU needs, use native packages. Otherwise, fall back to AMD's repo.

## Step 2: Build llama.cpp

### macOS (Apple Silicon)

Metal GPU acceleration is enabled by default. The Accelerate framework provides BLAS automatically.

**Prerequisites:** Xcode Command Line Tools (ships with cmake).

```bash
cd /path/to/llama.cpp
cmake -B build -DGGML_METAL=ON -DGGML_NATIVE=ON -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release -j $(sysctl -n hw.ncpu)
```

Key points:
- Metal is on by default, `-DGGML_METAL=ON` is explicit but optional
- `-DGGML_NATIVE=ON` enables CPU-specific SIMD optimizations (NEON, dotprod, i8mm)
- OpenMP is typically not available on macOS — this is fine, pthreads works and Metal does the heavy lifting
- Install `ccache` (`brew install ccache`) for faster rebuilds

### Linux with AMD Radeon (Fedora + ROCm)

**Prerequisites — install ROCm:**

Use the decision matrix from Step 1 to pick the right install path. Check the user's Fedora version and GPU first.

**Option A: Fedora native packages** (when compatible — see matrix above):

```bash
# Install ROCm HIP and build tools from Fedora repos
sudo dnf install rocm-hip-devel hipcc rocminfo rocm-smi cmake gcc-c++ openssl-devel

# For RDNA3+ flash attention performance
sudo dnf install rocwmma-devel

# Add user to GPU groups
sudo usermod -aG render,video $USER
# Log out and back in (or reboot) for group changes to take effect
```

**Option B: AMD repo** (when native packages don't have the ROCm version needed):

```bash
# Install amdgpu-install meta-installer (check https://repo.radeon.com/amdgpu-install/ for latest)
sudo dnf install https://repo.radeon.com/amdgpu-install/7.2.1/rhel/9.7/amdgpu-install-7.2.1.70201-1.el9.noarch.rpm
sudo dnf clean all
sudo dnf install "kernel-headers-$(uname -r)" "kernel-devel-$(uname -r)"
sudo dnf install amdgpu-dkms rocm cmake gcc-c++ openssl-devel
sudo usermod -aG render,video $USER
# Reboot required
```

For detailed setup (Atomic desktops, rocWMMA from source, troubleshooting), read `references/rocm-fedora.md`.

**Identify your GPU architecture:**

```bash
rocminfo | grep gfx | head -1 | awk '{print $2}'
# Common targets: gfx1030 (RDNA2), gfx1100 (RDNA3), gfx1200 (RDNA4 — RX 9070), gfx1201 (RDNA4 — RX 9060 XT)
```

**Build:**

```bash
cd /path/to/llama.cpp

# GPU_TARGETS is optional — omit it to auto-detect
HIPCXX="$(hipconfig -l)/clang" HIP_PATH="$(hipconfig -R)" \
    cmake -S . -B build -DGGML_HIP=ON -DCMAKE_BUILD_TYPE=Release \
    && cmake --build build --config Release -j $(nproc)
```

For RDNA3+ GPUs, enable rocWMMA for better flash attention performance:

```bash
HIPCXX="$(hipconfig -l)/clang" HIP_PATH="$(hipconfig -R)" \
    cmake -S . -B build -DGGML_HIP=ON -DGGML_HIP_ROCWMMA_FATTN=ON -DCMAKE_BUILD_TYPE=Release \
    && cmake --build build --config Release -j $(nproc)
```

**Troubleshooting — "cannot find ROCm device library":**

```bash
# Find the device library path
find $HIP_PATH -name "oclc_abi_version_400.bc" 2>/dev/null

# Re-run cmake with HIP_DEVICE_LIB_PATH set to that directory
HIP_DEVICE_LIB_PATH=/path/to/found/dir HIPCXX="$(hipconfig -l)/clang" HIP_PATH="$(hipconfig -R)" \
    cmake -S . -B build -DGGML_HIP=ON -DCMAKE_BUILD_TYPE=Release
```

**Troubleshooting — GPU not officially supported:**

Set `HSA_OVERRIDE_GFX_VERSION` to a compatible target:
- RDNA2 (gfx1030/1031/1035): `HSA_OVERRIDE_GFX_VERSION=10.3.0`
- RDNA3 (gfx1100/1101/1102): `HSA_OVERRIDE_GFX_VERSION=11.0.0`

## Step 3: Add to PATH

After building, offer to add `build/bin` to the user's shell PATH.

**macOS (zsh):**
```bash
echo 'export PATH="/path/to/llama.cpp/build/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

**Linux (bash):**
```bash
echo 'export PATH="/path/to/llama.cpp/build/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

Verify with: `which llama-cli && llama-cli --version`

## Step 4: Run models

### Direct run (auto-downloads from HuggingFace)

llama.cpp can download GGUF models directly with the `-hf` flag:

```bash
# Interactive chat
llama-cli -hf unsloth/Qwen3-Coder-Next-GGUF:UD-Q3_K_XL --ctx-size 16384

# OpenAI-compatible server with web UI
llama-server -hf unsloth/Qwen3-Coder-Next-GGUF:UD-Q3_K_XL --jinja --ctx-size 16384 --port 8080
```

### Quantization guide

Pick quantization based on available unified memory (macOS) or VRAM (Linux):

| Quant | Approx size | Min memory | Quality | Notes |
|-------|-------------|------------|---------|-------|
| UD-Q6_K_XL | ~55 GB | 64 GB | Best | Needs lots of headroom |
| UD-Q4_K_XL | ~46 GB | 56 GB | Excellent | Tight on 64GB unified |
| UD-Q3_K_XL | ~36 GB | 48 GB | Very good | Sweet spot for 64GB Macs |
| UD-IQ3_XXS | ~28 GB | 36 GB | Good | Best for memory-constrained |
| UD-IQ2_XXS | ~20 GB | 28 GB | Acceptable | Minimum viable for coding |

Rule of thumb: pick the largest quant that leaves ~10-15 GB free for KV cache, OS, and other apps.

### Recommended sampling parameters

These are the officially recommended values for Qwen3-Coder-Next:

| Parameter | Value |
|-----------|-------|
| `--temp` | 1.0 |
| `--top-p` | 0.95 |
| `--min-p` | 0.01 |
| `--top-k` | 40 |
| Repeat penalty | 1.0 (disabled) |

## Step 5: Create a launcher script

Offer to create a convenience launcher in `~/.local/bin/` (or wherever the user prefers). The script should:
- Default to server mode on port 8080
- Support `chat` mode for interactive CLI
- Use the `-hf` flag for automatic model download
- Include `--jinja` for proper chat template support
- Apply recommended sampling parameters

**Template:**

```bash
#!/bin/bash
# Launch <model-name> via llama.cpp

MODEL="unsloth/Qwen3-Coder-Next-GGUF:<QUANT>"
CTX_SIZE=16384
SAMPLING="--temp 1.0 --top-p 0.95 --min-p 0.01 --top-k 40"

MODE="${1:-server}"
shift 2>/dev/null

case "$MODE" in
  chat)
    exec llama-cli \
      -hf "$MODEL" \
      --ctx-size "$CTX_SIZE" \
      --conversation \
      $SAMPLING \
      "$@"
    ;;
  server)
    PORT="${1:-8080}"
    shift 2>/dev/null
    echo "Starting server on http://localhost:$PORT"
    exec llama-server \
      -hf "$MODEL" \
      --ctx-size "$CTX_SIZE" \
      --jinja \
      --alias "<model-alias>" \
      --port "$PORT" \
      $SAMPLING \
      "$@"
    ;;
  *)
    echo "Usage: $(basename $0) [chat|server] [port] [extra flags...]"
    exit 1
    ;;
esac
```

Replace `<QUANT>` with the chosen quantization and `<model-alias>` with a friendly name. Make executable with `chmod +x`.

## Step 6: Configure API clients (optional)

If the user wants to connect a coding agent (pi.dev, Continue, etc.) to the local server:

**pi.dev** (`~/.pi/agent/models.json`):
```json
{
  "providers": {
    "llama-cpp": {
      "baseUrl": "http://localhost:8080/v1",
      "api": "openai-completions",
      "apiKey": "none",
      "models": [
        {
          "id": "Qwen3-Coder-Next-GGUF"
        }
      ]
    }
  }
}
```

The server exposes an OpenAI-compatible API at `/v1/chat/completions`.

## Reference documentation

For deeper details, read these reference files:
- `references/rocm-fedora.md` — detailed ROCm setup on Fedora including RDNA4 (RX 9060 XT/9070), kernel driver, rocWMMA, troubleshooting

External references:
- llama.cpp build guide: https://github.com/ggml-org/llama.cpp/blob/master/docs/build.md
- ROCm quick start: https://rocm.docs.amd.com/projects/install-on-linux/en/latest/install/quick-start.html
- rocWMMA (flash attention acceleration): https://github.com/ROCm/rocWMMA
- Unsloth Qwen3-Coder-Next: https://unsloth.ai/docs/models/qwen3-coder-next
