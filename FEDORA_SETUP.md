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
| Qwen3.5 9B | UD-Q8_K_XL | 13 GB | Yes (3 GB left for KV cache) |
| Qwen3.6 35B-A3B (MoE) | UD-IQ3_XXS | 13.2 GB | Yes (3B params active) |

Download models:
```bash
llama-cli -hf unsloth/Qwen3.5-9B-GGUF:UD-Q8_K_XL -n 0 -p ""
llama-cli -hf unsloth/Qwen3.6-35B-A3B-GGUF:UD-IQ3_XXS -n 0 -p ""
```

## Launcher Scripts

Located in `~/.local/bin/`. Both default to server mode on port 8080.

### qwen (dense 9B)

```bash
qwen              # server on port 8080
qwen server 9090  # server on custom port
qwen chat         # interactive CLI, thinking enabled, coding params (temp 0.6)
qwen chat-think   # interactive CLI, thinking enabled, creative params (temp 1.0)
```

### qwen-moe (MoE 35B-A3B)

```bash
qwen-moe              # server on port 8080
qwen-moe server 9090  # server on custom port
qwen-moe chat         # interactive CLI
qwen-moe chat-think   # interactive CLI, creative params
```

### Sampling Parameters

From [Unsloth Qwen3.5 docs](https://unsloth.ai/docs/models/qwen3.5):

| Mode | temp | top-p | top-k | min-p | presence-penalty |
|------|------|-------|-------|-------|-----------------|
| Coding (chat) | 0.6 | 0.95 | 20 | 0.0 | — |
| Creative (chat-think) | 1.0 | 0.95 | 20 | 0.0 | 1.5 |

Context window: 65536 tokens (model supports up to 256K). KV cache is quantized to q4_0 (from default f16) to fit 64K context in 16 GB VRAM (~13 GB model + ~2 GB KV cache, ~1 GB headroom). Negligible quality impact for coding/chat/reasoning.

## pi.dev Configuration

Config file: `~/.pi/agent/models.json`

```json
{
  "providers": {
    "local-fedora": {
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
          "id": "qwen3.5-9b",
          "name": "Qwen3.5 9B (Unsloth Q8_K_XL)",
          "reasoning": true,
          "contextWindow": 65536,
          "maxTokens": 8192
        },
        {
          "id": "qwen3.5-35b-a3b",
          "name": "Qwen3.5 35B-A3B MoE (Unsloth IQ3_XXS)",
          "reasoning": true,
          "contextWindow": 65536,
          "maxTokens": 8192
        }
      ]
    }
  }
}
```

Start a launcher (`qwen` or `qwen-moe`), then select the model in pi.dev via `/model`.

## Web UI

llama-server includes a built-in web UI. After starting a server, open `http://localhost:8080` in a browser.

## Claude Code with Local Models

Claude Code can route to your local llama-server instead of the Anthropic API. One model per session — use aliases to switch:

```bash
claude              # default: Anthropic API (Claude Sonnet/Opus)
claude-local        # local Qwen3.5 9B via llama-server
claude-local-moe    # local Qwen3.5 35B-A3B MoE via llama-server
```

These aliases are defined in `~/.zshrc` and set `ANTHROPIC_BASE_URL` and `ANTHROPIC_MODEL` environment variables.

Start the corresponding llama-server first (`qwen` or `qwen-moe`), then launch Claude Code with the alias.

Note: local models have significantly reduced agentic capabilities (tool use, multi-step reasoning, large context handling) compared to Claude. Best suited for simpler tasks.

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
