# Local LLM Setup

Configuration files, launcher scripts, and Claude Code skills for running local LLM inference with [llama.cpp](https://github.com/ggml-org/llama.cpp) on Linux (AMD Radeon) and macOS (Apple Silicon).

Developed and tested on Fedora 43 with an AMD Radeon RX 9060 XT (16 GB VRAM, RDNA4).

## What's included

```
.
├── FEDORA_SETUP.md                        # Complete setup guide (hardware-specific)
├── scripts/
│   ├── build-llama.sh                     # Build llama.cpp with HIP/ROCm + rocWMMA
│   ├── qwen                               # Launcher: Qwen3.5 9B dense
│   └── qwen-moe                           # Launcher: Qwen3.5 35B-A3B MoE
├── configs/
│   ├── pi-dev/models.json                 # pi.dev coding agent model config
│   └── zshrc-snippet.sh                   # Shell environment (PATH, aliases)
├── docs/
│   └── qwen3.5-model-config.md           # Qwen3.5 sampling params, VRAM, quants
└── skills/
    └── llama-build/                       # Claude Code skill for building llama.cpp
        ├── SKILL.md                       # Skill definition (multi-platform)
        └── references/
            └── rocm-fedora.md             # Detailed ROCm setup on Fedora
```

## Quick start

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

5. **Download models and run**:
   ```bash
   # Download (one-time)
   llama-cli -hf unsloth/Qwen3.5-9B-GGUF:UD-Q8_K_XL -n 0 -p ""
   llama-cli -hf unsloth/Qwen3.5-35B-A3B-GGUF:UD-IQ3_XXS -n 0 -p ""

   # Run
   qwen chat          # interactive chat with 9B dense
   qwen-moe chat      # interactive chat with 35B MoE
   qwen server         # OpenAI-compatible API + web UI at localhost:8080
   ```

## Coding agent integration

### pi.dev

Copy `configs/pi-dev/models.json` to `~/.pi/agent/models.json`, start a server (`qwen` or `qwen-moe`), then select the model in pi.dev via `/model`.

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

| Component | Spec |
|-----------|------|
| CPU | Intel Core i5-14600K |
| RAM | 32 GB |
| GPU | AMD Radeon RX 9060 XT (16 GB VRAM, RDNA4, gfx1200) |
| OS | Fedora 43, kernel 6.19+ |

The skill itself supports macOS (Apple Silicon / Metal), Linux (AMD / ROCm), and Linux (NVIDIA / CUDA).

## License

MIT
