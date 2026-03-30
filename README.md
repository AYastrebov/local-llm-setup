# Local LLM Setup

Configuration files, launcher scripts, and Claude Code skills for running local LLM inference with [llama.cpp](https://github.com/ggml-org/llama.cpp) on Linux (AMD Radeon) and macOS (Apple Silicon).

## Platform guides

| Platform | Hardware | Guide |
|----------|----------|-------|
| **Fedora** | Intel i5-14600K, RX 9060 XT (16GB), 32GB RAM | [FEDORA_SETUP.md](FEDORA_SETUP.md) |
| **macOS** | Apple M2 Max, 64GB unified memory | [docs/mac-setup.md](docs/mac-setup.md) |

## What's included

```
.
├── FEDORA_SETUP.md                        # Fedora setup guide (RX 9060 XT)
├── scripts/
│   ├── build-llama.sh                     # Build llama.cpp with HIP/ROCm + rocWMMA
│   ├── qwen                               # Launcher: Qwen3.5 9B dense
│   ├── qwen-moe                           # Launcher: Qwen3.5 35B-A3B MoE
│   └── qwen-coder                         # Launcher: Qwen3-Coder-Next 80B (macOS)
├── configs/
│   ├── pi-dev/
│   │   ├── models.json                    # pi.dev config (Fedora)
│   │   └── models-mac.json               # pi.dev config (macOS)
│   └── zshrc-snippet.sh                   # Shell environment (PATH, aliases)
├── docs/
│   ├── mac-setup.md                       # macOS Apple Silicon setup guide
│   └── qwen3.5-model-config.md           # Qwen3.5 sampling params, VRAM, quants
└── skills/
    └── llama-build/                       # Claude Code skill for building llama.cpp
        ├── SKILL.md                       # Skill definition (multi-platform)
        └── references/
            └── rocm-fedora.md             # Detailed ROCm setup on Fedora
```

## Models

| Model | Type | Active params | Use case | Thinking? |
|-------|------|---------------|----------|-----------|
| [Qwen3-Coder-Next](https://unsloth.ai/docs/models/qwen3-coder-next) | 80B MoE | 3B | Coding | No |
| [Qwen3.5-35B-A3B](https://unsloth.ai/docs/models/qwen3.5) | 35B MoE | 3B | General + reasoning | Yes |
| [Qwen3.5-9B](https://unsloth.ai/docs/models/qwen3.5) | 9B dense | 9B | General (fast) | Yes (opt-in) |

### Quantization per platform

| Model | Mac (64GB) | Fedora (16GB VRAM) |
|-------|------------|-------------------|
| Qwen3-Coder-Next | Q3_K_XL (34 GB) | — |
| Qwen3.5-35B-A3B | Q4_K_XL (~18 GB) | IQ3_XXS (~13 GB) |
| Qwen3.5-9B | — | Q8_K_XL (~13 GB) |

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
   cp scripts/qwen-coder scripts/qwen-moe ~/.local/bin/
   chmod +x ~/.local/bin/qwen-coder ~/.local/bin/qwen-moe
   ```

3. **Run**:
   ```bash
   qwen-coder          # Qwen3-Coder-Next server on port 8080
   qwen-moe chat       # Qwen3.5-35B-A3B interactive chat
   ```

See [docs/mac-setup.md](docs/mac-setup.md) for detailed hardware info, performance data, and model selection.

## Coding agent integration

### pi.dev

Copy the appropriate config to `~/.pi/agent/models.json`:
- Fedora: `configs/pi-dev/models.json`
- macOS: `configs/pi-dev/models-mac.json`

Start a server (`qwen`, `qwen-moe`, or `qwen-coder`), then select the model in pi.dev via `/model`.

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
