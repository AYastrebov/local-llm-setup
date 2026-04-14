# Local LLM Setup

Configuration files, launcher scripts, and Claude Code skills for running local LLM inference with [llama.cpp](https://github.com/ggml-org/llama.cpp) on Linux (AMD Radeon) and macOS (Apple Silicon).

## Platform guides

| Platform | Hardware | Guide |
|----------|----------|-------|
| **Fedora** | Intel i5-14600K, RX 9060 XT (16GB), 32GB RAM | [docs/fedora-setup.md](docs/fedora-setup.md) |
| **macOS** | Apple M2 Max, 64GB unified memory | [docs/mac-setup.md](docs/mac-setup.md) |

## What's included

```
.
├── scripts/
│   ├── build-llama.sh                     # Build llama.cpp with HIP/ROCm + rocWMMA
│   ├── qwen                               # Launcher: Qwen3.5 9B dense
│   ├── qwen-moe                           # Launcher: Qwen3.5 35B-A3B MoE
│   ├── qwen-coder                         # Launcher: Qwen3-Coder-Next 80B (macOS)
│   └── gemma-moe                          # Launcher: Gemma 4 26B-A4B MoE (macOS)
├── configs/
│   ├── pi-dev/
│   │   ├── models.json                    # pi.dev config (Fedora)
│   │   └── models-mac.json               # pi.dev config (macOS)
│   ├── opencode/
│   │   └── opencode-mac.jsonc            # opencode config (macOS)
│   └── zshrc-snippet.sh                   # Shell environment (PATH, aliases)
├── docs/
│   ├── fedora-setup.md                    # Fedora setup guide (RX 9060 XT)
│   ├── mac-setup.md                       # macOS Apple Silicon setup guide
│   ├── gemma4-model-config.md             # Gemma 4: params, quants, thinking mode
│   ├── qwen3-coder-next-model-config.md   # Qwen3-Coder-Next: params, quants, benchmarks
│   └── qwen3.5-model-config.md            # Qwen3.5 family: params, quants, thinking mode
└── skills/
    └── llama-build/                       # Claude Code skill for building llama.cpp
        ├── SKILL.md                       # Skill definition (multi-platform)
        └── references/
            └── rocm-fedora.md             # Detailed ROCm setup on Fedora
```

## Models

| Model | Type | Active params | Use case | Thinking? | Config reference |
|-------|------|---------------|----------|-----------|-----------------|
| [Gemma 4 26B-A4B](https://unsloth.ai/docs/models/gemma-4) | 26B MoE | 3.8B | General + multimodal | Yes | [docs/gemma4-model-config.md](docs/gemma4-model-config.md) |
| [Qwen3-Coder-Next](https://unsloth.ai/docs/models/qwen3-coder-next) | 80B MoE | 3B | Coding | **No** | [docs/qwen3-coder-next-model-config.md](docs/qwen3-coder-next-model-config.md) |
| [Qwen3.5-35B-A3B](https://unsloth.ai/docs/models/qwen3.5) | 35B MoE | 3B | General + reasoning | Yes | [docs/qwen3.5-model-config.md](docs/qwen3.5-model-config.md) |
| [Qwen3.5-9B](https://unsloth.ai/docs/models/qwen3.5) | 9B dense | 9B | General (fast) | Yes (opt-in) | [docs/qwen3.5-model-config.md](docs/qwen3.5-model-config.md) |

> **Important:** Each model family has different sampling parameters. Do not mix them — see the model config docs for correct settings.

### Quantization per platform

| Model | Mac (64GB) | Fedora (16GB VRAM) |
|-------|------------|-------------------|
| Gemma 4 26B-A4B | Q8_K_XL (28 GB) | — |
| Qwen3-Coder-Next | Q4_K_S (46 GB) | — |
| Qwen3.5-35B-A3B | Q4_K_XL (~18 GB) | IQ3_XXS (~13 GB) |
| Qwen3.5-9B | — | Q8_K_XL (~13 GB) |

### Sampling parameters (quick reference)

| Model | temp | top-p | top-k | min-p |
|-------|------|-------|-------|-------|
| Gemma 4 26B-A4B | 1.0 | 0.95 | 64 | — |
| Qwen3-Coder-Next | 1.0 | 0.95 | 40 | 0.01 |
| Qwen3.5 (coding/thinking) | 0.6 | 0.95 | 20 | 0.0 |
| Qwen3.5 (creative/thinking) | 1.0 | 0.95 | 20 | 0.0 |

## Quick start (Fedora)

1. **Install ROCm** (Fedora 43+):
   ```bash
   sudo dnf install rocm-hip-devel hipcc rocminfo rocm-smi rocwmma-devel cmake gcc-c++ openssl-devel
   sudo usermod -aG render,video $USER
   ```

2. **Clone and build llama.cpp**:
   ```bash
   git clone https://github.com/ggml-org/llama.cpp.git ~/llama.cpp
   cp scripts/build-llama.sh ~/llama.cpp/build.sh
   cd ~/llama.cpp && ./build.sh
   ```

3. **Install launcher scripts**:
   ```bash
   cp scripts/qwen scripts/qwen-moe ~/.local/bin/
   chmod +x ~/.local/bin/qwen ~/.local/bin/qwen-moe
   ```

4. **Add shell config** (append to `~/.zshrc` or `~/.bashrc`):
   ```bash
   cat configs/zshrc-snippet.sh >> ~/.zshrc
   source ~/.zshrc
   ```

5. **Run**:
   ```bash
   qwen chat          # interactive chat with 9B dense
   qwen-moe chat      # interactive chat with 35B MoE
   qwen server         # OpenAI-compatible API + web UI at localhost:8080
   ```

## Quick start (macOS)

1. **Build llama.cpp**:
   ```bash
   git clone https://github.com/ggml-org/llama.cpp.git ~/llama.cpp
   cd ~/llama.cpp
   cmake -B build -DGGML_METAL=ON -DGGML_NATIVE=ON -DCMAKE_BUILD_TYPE=Release
   cmake --build build --config Release -j $(sysctl -n hw.ncpu)
   echo 'export PATH="$HOME/llama.cpp/build/bin:$PATH"' >> ~/.zshrc
   ```

2. **Install launcher scripts**:
   ```bash
   cp scripts/qwen-coder scripts/qwen-moe scripts/gemma-moe ~/.local/bin/
   chmod +x ~/.local/bin/qwen-coder ~/.local/bin/qwen-moe ~/.local/bin/gemma-moe
   ```

3. **Run**:
   ```bash
   gemma-moe            # Gemma 4 26B-A4B server on port 8080
   gemma-moe chat       # Gemma 4 interactive chat with thinking
   qwen-coder           # Qwen3-Coder-Next server on port 8080
   qwen-coder chat      # Qwen3-Coder-Next interactive chat
   qwen-moe chat        # Qwen3.5-35B-A3B interactive chat with thinking
   ```

See [docs/mac-setup.md](docs/mac-setup.md) for detailed hardware info, performance data, and model selection.

## Coding agent integration

### pi.dev

Copy the appropriate config to `~/.pi/agent/models.json`:
- Fedora: `configs/pi-dev/models.json`
- macOS: `configs/pi-dev/models-mac.json`

Start a server (`qwen`, `qwen-moe`, `qwen-coder`, or `gemma-moe`), then select the model in pi.dev via `/model`.

### opencode

Copy the macOS config: `configs/opencode/opencode-mac.jsonc` → `~/.config/opencode/opencode.jsonc`

Agent profiles: `local-coder` (Qwen3-Coder-Next), `local-moe` (Qwen3.5), `local-gemma` (Gemma 4).

### Claude Code

```bash
claude-local        # Claude Code using local Qwen3.5 9B
claude-local-moe    # Claude Code using local Qwen3.5 35B-A3B MoE
```

Note: Claude Code's system prompt requires ~40K+ tokens of context. The current 32K setup is insufficient for full Claude Code use. Regular chat/server modes work fine.

## Claude Code skill

The `skills/llama-build/` directory contains a Claude Code skill that automates the entire setup process. To use it, copy it into your llama.cpp checkout:

```bash
mkdir -p ~/llama.cpp/.claude/skills/
cp -r skills/llama-build ~/llama.cpp/.claude/skills/
```

Then invoke it in Claude Code with `/llama-build`.

## Hardware tested

| | Fedora | macOS |
|---|---|---|
| CPU | Intel Core i5-14600K | Apple M2 Max (12 cores) |
| GPU | AMD Radeon RX 9060 XT (16GB, RDNA4) | Apple M2 Max (30 cores, Metal 3) |
| RAM | 32 GB | 64 GB unified |
| OS | Fedora 43, kernel 6.19+ | macOS Sequoia 15.7 |

The skill itself supports macOS (Apple Silicon / Metal), Linux (AMD / ROCm), and Linux (NVIDIA / CUDA).

## License

MIT
