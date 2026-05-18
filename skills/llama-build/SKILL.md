---
name: llama-build
description: "Build llama.cpp from source, run local LLM inference with GPU acceleration, and configure coding agents to use local models. Use this skill whenever the user wants to: compile llama.cpp, set up local AI inference, run GGUF models locally, configure llama-server or llama-cli, create model launcher scripts, work with Unsloth quantized models, or connect coding tools (Claude Code, opencode, pi.dev, Continue, Cursor) to a local llama.cpp server. Triggers on mentions of llama.cpp, GGUF, local LLM serving, Metal/ROCm/HIP/CUDA GPU backends, model quantization (Q4, Q3, IQ3, Q8, etc), MTP/Multi-Token Prediction, or running models from Hugging Face locally. Also triggers when the user asks about using local models with Claude Code, opencode, pi.dev, or any OpenAI-compatible API client."
---

# llama-build

Build llama.cpp for local GPU-accelerated inference, set up model serving, and connect coding agents.

## Quick reference

| Platform | GPU backend | Build flag | Auto-detected? |
|----------|------------|------------|----------------|
| macOS (Apple Silicon) | Metal | `-DGGML_METAL=ON` | Yes (default) |
| Linux (AMD Radeon) | HIP/ROCm | `-DGGML_HIP=ON` | No |
| Linux (NVIDIA) | CUDA | `-DGGML_CUDA=ON` | No |
| CPU-only (Docker) | None | N/A | N/A |

## Step 1: Detect hardware and environment

Before building, detect the user's platform, GPU, and OS version to pick the right backend.

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
```

### ROCm install path decision (Linux/AMD)

| GPU family | Min ROCm | Fedora native works? | Recommendation |
|------------|----------|---------------------|----------------|
| RDNA2 (gfx1030) | 5.0+ | F42+ (6.3) — yes | Fedora native packages |
| RDNA3 (gfx1100) | 5.5+ | F42+ (6.3) — yes | Fedora native packages |
| RDNA4 RX 9070 (gfx1200) | 6.4.1+ | F42 — **no**; F43+ — yes | F43+: native. F42: AMD repo |
| RDNA4 RX 9060 XT (gfx1201) | 7.0.2+ | F42/F43 — **no**; F44+ — yes | F44+: native. Older: AMD repo |

Key rule: if the user's Fedora version ships a ROCm version >= what their GPU needs, use native packages. Otherwise, fall back to AMD's repo. See `references/rocm-fedora.md` for full details.

## Step 2: Build llama.cpp

### macOS (Apple Silicon)

```bash
cd /path/to/llama.cpp
cmake -B build -DGGML_METAL=ON -DGGML_NATIVE=ON -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release -j $(sysctl -n hw.ncpu)
```

Metal is on by default. `-DGGML_NATIVE=ON` enables NEON/dotprod/i8mm optimizations.

### Linux with AMD Radeon (HIP/ROCm)

Install ROCm first (see Step 1 matrix), then:

```bash
HIPCXX="$(hipconfig -l)/clang" HIP_PATH="$(hipconfig -R)" \
    cmake -S . -B build -DGGML_HIP=ON -DGGML_HIP_ROCWMMA_FATTN=ON -DCMAKE_BUILD_TYPE=Release \
    && cmake --build build --config Release -j $(nproc)
```

`-DGGML_HIP_ROCWMMA_FATTN=ON` enables rocWMMA flash attention (RDNA3+). See `references/rocm-fedora.md` for troubleshooting.

### Linux with NVIDIA (CUDA)

```bash
cmake -B build -DGGML_CUDA=ON -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release -j $(nproc)
```

Useful env vars: `GGML_CUDA_ENABLE_UNIFIED_MEMORY=1` (swap to RAM), `GGML_CUDA_P2P=1` (multi-GPU).

### Docker (CPU-only, no build needed)

For headless servers without a GPU:

```yaml
# docker-compose.yml
services:
  llama:
    image: ghcr.io/ggml-org/llama.cpp:server
    container_name: llama
    ports:
      - 8080:8080
    volumes:
      - ./models:/models
    env_file:
      - .env    # LLAMA_API_KEY for auth
    command: >
      --model /models/<model-file>.gguf
      --host 0.0.0.0 --port 8080
      --alias <model-alias>
      --jinja --reasoning off
      --ctx-size 16384
      --fit on
    deploy:
      resources:
        limits:
          memory: 12G
    restart: unless-stopped
```

Pre-download the model (the `-hf` flag is unreliable inside Docker):
```bash
wget -O models/<model-file>.gguf \
  'https://huggingface.co/<org>/<repo>/resolve/main/<filename>.gguf'
```

For CPU inference, use small dense models (Gemma 4 E4B Q8 at 8.7 GB is a good choice). MoE models are slow on CPU because all expert weights must be loaded per token even though only a few are active.

## Step 3: Add to PATH

```bash
# macOS
echo 'export PATH="/path/to/llama.cpp/build/bin:$PATH"' >> ~/.zshrc && source ~/.zshrc

# Linux
echo 'export PATH="/path/to/llama.cpp/build/bin:$PATH"' >> ~/.bashrc && source ~/.bashrc
```

Verify: `which llama-cli && llama-cli --version`

## Step 4: Run models

### Direct run (auto-downloads from HuggingFace)

```bash
# Interactive chat
llama-cli -hf unsloth/gemma-4-26B-A4B-it-GGUF:UD-Q8_K_XL \
    --jinja --chat-template-kwargs '{"enable_thinking":true}' \
    --flash-attn on --ctx-size 32768

# OpenAI-compatible server with web UI
llama-server -hf unsloth/gemma-4-26B-A4B-it-GGUF:UD-Q8_K_XL \
    --jinja --chat-template-kwargs '{"enable_thinking":true}' \
    --flash-attn on --fit on --ctx-size 32768 --port 8080
```

### Key server flags

| Flag | Purpose |
|------|---------|
| `--flash-attn on` | Flash attention — faster inference, lower memory |
| `--fit on` | Auto-offload layers to CPU if VRAM is full |
| `--jinja` | Use model's native chat template (required for thinking mode) |
| `--alias <name>` | Model name exposed via the OpenAI-compatible API |

### MTP (Multi-Token Prediction)

MTP enables speculative decoding for ~1.4–2.2x faster generation. Requires special `-MTP-` GGUF files from Unsloth (regular GGUFs don't have the prediction heads).

```bash
--spec-type draft-mtp --spec-draft-n-max 6
```

Dense models benefit significantly more from MTP than MoE models (1.4–2.2x vs 1.15–1.25x). When a dense MTP variant is available (e.g., Qwen3.6-27B-MTP), prefer it over MoE for quality and MTP speedup.

### Quantization guide

Pick the largest quant that leaves ~2–4 GB free for KV cache and OS overhead.

| Quant | Quality | Notes |
|-------|---------|-------|
| UD-Q8_K_XL | Near-lossless | Use when you have the headroom |
| UD-Q6_K_XL | Excellent | Good balance for large unified memory |
| UD-Q4_K_XL | Good | Standard choice for most setups |
| UD-Q3_K_XL | Decent | MoE models degrade less at lower bits |
| UD-IQ3_XXS | Acceptable | Best for 16GB VRAM |

For MoE models (only 3–4B active params), lower quants degrade less than for dense models.

### KV cache quantization

Use `q8_0` for best quality/size balance:
```bash
--cache-type-k q8_0 --cache-type-v q8_0
```
Use `q4_0` only when VRAM is very tight (e.g. 16GB with a large model).

### Thinking mode

Models that support thinking (Gemma 4, Qwen3.x) require `--jinja` and:
```bash
--chat-template-kwargs '{"enable_thinking":true}'   # enable
--chat-template-kwargs '{"enable_thinking":false}'  # disable
```

Disable thinking for CPU inference — it generates many extra tokens which is painfully slow without a GPU.

## Step 5: Create a launcher script

Create a convenience launcher in `~/.local/bin/`. Include `--flash-attn on`, `--fit on`, MTP flags if applicable, and model-specific sampling parameters from the model's Unsloth docs page.

**Template:**

```bash
#!/bin/bash
MODEL="unsloth/<model-repo>:<QUANT>"
CTX_SIZE=65536
KV_CACHE="--cache-type-k q8_0 --cache-type-v q8_0"
MTP="--spec-type draft-mtp --spec-draft-n-max 6"   # only for -MTP- GGUFs
SAMPLING="--temp 1.0 --top-p 0.95 --top-k 64"      # adjust per model docs

MODE="${1:-server}"
shift 2>/dev/null

case "$MODE" in
  chat)
    exec llama-cli -hf "$MODEL" --ctx-size "$CTX_SIZE" --conversation \
      --chat-template-kwargs '{"enable_thinking":true}' \
      --flash-attn on ${KV_CACHE} ${MTP} $SAMPLING "$@" ;;
  server)
    PORT="${1:-8080}"; shift 2>/dev/null
    exec llama-server -hf "$MODEL" --ctx-size "$CTX_SIZE" --jinja \
      --chat-template-kwargs '{"enable_thinking":true}' \
      --alias "<model-alias>" --port "$PORT" \
      --flash-attn on --fit on ${KV_CACHE} ${MTP} $SAMPLING "$@" ;;
  *) echo "Usage: $(basename $0) [chat|server] [port] [extra flags...]"; exit 1 ;;
esac
```

Make executable with `chmod +x`.

## Step 6: Configure coding agents

The llama-server exposes an OpenAI-compatible API at `http://localhost:8080/v1`. The `--alias` flag sets the model name that clients see. Start the server first, then configure the client.

### pi.dev (`~/.pi/agent/models.json`)

```json
{
  "providers": {
    "llama-cpp": {
      "baseUrl": "http://localhost:8080/v1",
      "api": "openai-completions",
      "apiKey": "none",
      "compat": {
        "supportsDeveloperRole": false,
        "supportsReasoningEffort": false,
        "supportsUsageInStreaming": false
      },
      "models": [
        {
          "id": "<model-alias>",
          "name": "<display name>",
          "reasoning": true,
          "contextWindow": 65536,
          "maxTokens": 8192
        }
      ]
    }
  }
}
```

Select the model in pi.dev via `/model`.

### opencode (`~/.config/opencode/opencode.jsonc`)

```jsonc
{
  "provider": {
    "local": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Local llama.cpp",
      "options": { "baseURL": "http://127.0.0.1:8080/v1" },
      "models": {
        "<model-alias>": {
          "name": "<display name>",
          "limit": { "context": 65536, "output": 8192 }
        }
      }
    }
  },
  "agent": {
    "local-model": {
      "description": "Local <model-name>. Start server first: <launcher-name>",
      "mode": "primary",
      "model": "local/<model-alias>",
      "temperature": 0.6,
      "steps": 15,
      "permission": {
        "edit": "allow",
        "write": "allow",
        "webfetch": "deny",
        "websearch": "deny"
      }
    }
  }
}
```

Disable webfetch/websearch for local agents since the model runs offline.

### Claude Code

#### Shell aliases (`~/.zshrc`)

```bash
alias claude-local='ANTHROPIC_BASE_URL=http://localhost:8080/v1 ANTHROPIC_API_KEY=sk-no-key-required claude --model <model-alias>'
```

For fully autonomous mode (use with care):
```bash
alias claude-local-auto='ANTHROPIC_BASE_URL=http://localhost:8080/v1 ANTHROPIC_API_KEY=sk-no-key-required claude --model <model-alias> --dangerously-skip-permissions'
```

#### settings.json (`~/.claude/settings.json`) — CRITICAL

Claude Code sends attribution headers that **invalidate the KV cache** on every request, causing ~90% slower inference. This must be disabled in `settings.json` — setting it via environment variable does NOT work.

```json
{
  "env": {
    "CLAUDE_CODE_ATTRIBUTION_HEADER": "0",
    "CLAUDE_CODE_ENABLE_TELEMETRY": "0",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1"
  }
}
```

#### First-run onboarding (if Claude Code prompts for sign-in)

Add to `~/.claude.json`:
```json
{
  "hasCompletedOnboarding": true,
  "primaryApiKey": "sk-dummy-key"
}
```

### API key protection (for remote/public servers)

If the llama-server is exposed over the network (e.g., via Cloudflare Tunnel), set `LLAMA_API_KEY` as an environment variable in the container or `.env` file. The server enforces `Authorization: Bearer <key>` on inference endpoints. The `/v1/models` endpoint stays open by design (standard OpenAI API behavior).

## Reference documentation

- `references/rocm-fedora.md` — detailed ROCm setup on Fedora including RDNA4, kernel driver, rocWMMA, troubleshooting

External references:
- llama.cpp build guide: https://github.com/ggml-org/llama.cpp/blob/master/docs/build.md
- llama.cpp Docker guide: https://github.com/ggml-org/llama.cpp/blob/master/docs/docker.md
- ROCm quick start: https://rocm.docs.amd.com/projects/install-on-linux/en/latest/install/quick-start.html
- Unsloth Claude Code guide: https://unsloth.ai/docs/basics/claude-code
- Unsloth Gemma 4: https://unsloth.ai/docs/models/gemma-4
- Unsloth Qwen3.6: https://unsloth.ai/docs/models/qwen3.6
