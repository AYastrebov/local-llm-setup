# Local LLM Setup

Configuration files, launcher scripts, and Claude Code skills for running local LLM inference with [llama.cpp](https://github.com/ggml-org/llama.cpp) on Linux (AMD Radeon) and macOS (Apple Silicon).

## Platform guides

| Platform | Hardware | Guide |
|----------|----------|-------|
| **Fedora** | Intel i5-14600K, RX 9060 XT (16GB), 32GB RAM | [docs/fedora-setup.md](docs/fedora-setup.md) |
| **macOS** | Apple M2 Max, 64GB unified memory | [docs/mac-setup.md](docs/mac-setup.md) |

## Models

| Model | Type | Active params | Use case | Thinking? | Docs |
|-------|------|---------------|----------|-----------|------|
| [Gemma 4 26B-A4B](https://unsloth.ai/docs/models/gemma-4) | 26B MoE | 3.8B | General + multimodal | Yes | [unsloth.ai](https://unsloth.ai/docs/models/gemma-4) |
| [Qwen3.6 27B](https://unsloth.ai/docs/models/qwen3.6) | 27B dense | 27B | General + reasoning | Yes | [unsloth.ai](https://unsloth.ai/docs/models/qwen3.6) |
| [Qwen3.6 35B-A3B](https://unsloth.ai/docs/models/qwen3.6) | 35B MoE | 3B | General + reasoning | Yes | [unsloth.ai](https://unsloth.ai/docs/models/qwen3.6) |

### Quantization per platform

| Model | Mac (64GB) | Fedora (16GB VRAM) |
|-------|------------|--------------------|
| Gemma 4 26B-A4B | Q8_K_XL (28 GB) | Q3_K_XL (13 GB) |
| Qwen3.6 27B (dense, MTP) | Q6_K_XL (26 GB) | -- |
| Qwen3.6 35B-A3B (MoE, MTP) | -- | IQ3_XXS (14 GB) |

### MTP (Multi-Token Prediction)

MTP enables speculative decoding for ~1.4-2.2x faster generation. Requires special `-MTP-` GGUF files.

```bash
--spec-type draft-mtp --spec-draft-n-max 6
```

Dense models benefit significantly more from MTP than MoE models.

### Sampling parameters (quick reference)

| Model | temp | top-p | top-k | min-p |
|-------|------|-------|-------|-------|
| Gemma 4 26B-A4B | 1.0 | 0.95 | 64 | -- |
| Qwen3.6 (coding/thinking) | 0.6 | 0.95 | 20 | 0.0 |
| Qwen3.6 (creative/thinking) | 1.0 | 0.95 | 20 | 0.0 |

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
   cp scripts/qwen-moe scripts/gemma-moe ~/.local/bin/
   chmod +x ~/.local/bin/qwen-moe ~/.local/bin/gemma-moe
   # Edit gemma-moe: set MODEL to UD-Q3_K_XL and uncomment KV_CACHE line
   # Edit qwen-moe: uncomment the 35B-A3B-MTP MODEL line for Fedora
   ```

4. **Add shell config** (append to `~/.zshrc` or `~/.bashrc`):
   ```bash
   cat configs/zshrc-snippet.sh >> ~/.zshrc
   source ~/.zshrc
   ```

5. **Configure coding agents:**
   ```bash
   cp configs/pi-dev/models.json ~/.pi/agent/models.json
   cp configs/opencode/opencode-fedora.jsonc ~/.config/opencode/opencode.jsonc
   ```

6. **Run**:
   ```bash
   gemma-moe chat     # Gemma 4 interactive chat with thinking
   qwen-moe chat      # Qwen3.6 interactive chat with thinking + MTP
   gemma-moe          # OpenAI-compatible API + web UI at localhost:8080
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
   cp scripts/qwen-moe scripts/gemma-moe ~/.local/bin/
   chmod +x ~/.local/bin/qwen-moe ~/.local/bin/gemma-moe
   # qwen-moe defaults to 27B dense MTP (macOS)
   ```

3. **Configure coding agents:**
   ```bash
   cp configs/pi-dev/models-mac.json ~/.pi/agent/models.json
   cp configs/opencode/opencode-mac.jsonc ~/.config/opencode/opencode.jsonc
   ```

4. **Run**:
   ```bash
   gemma-moe            # Gemma 4 26B-A4B server on port 8080
   gemma-moe chat       # Gemma 4 interactive chat with thinking
   qwen-moe chat        # Qwen3.6 27B interactive chat with MTP
   qwen-moe chat-think  # Qwen3.6 creative/general chat
   ```

See [docs/mac-setup.md](docs/mac-setup.md) for detailed hardware info and model selection.

## Coding agent integration

### pi.dev

Copy the appropriate config to `~/.pi/agent/models.json`:
- Fedora: `configs/pi-dev/models.json`
- macOS: `configs/pi-dev/models-mac.json`

Start a server (`qwen-moe` or `gemma-moe`), then select the model in pi.dev via `/model`.

### opencode

Copy the config for your platform to `~/.config/opencode/opencode.jsonc`:
- Fedora: `configs/opencode/opencode-fedora.jsonc`
- macOS: `configs/opencode/opencode-mac.jsonc`

| Agent | Model | Platform | Start server |
|-------|-------|----------|--------------|
| `local-gemma` | Gemma 4 26B-A4B | both | `gemma-moe` |
| `local-moe` | Qwen3.6 27B (Mac) / 35B-A3B (Fedora) | both | `qwen-moe` |

### Claude Code

```bash
# Start server first, then launch Claude Code
gemma-moe && claude-gemma   # Gemma 4 26B-A4B
qwen-moe  && claude-qwen    # Qwen3.6 27B with MTP
```

Set in `~/.claude/settings.json` to prevent KV cache invalidation:
```json
{
  "env": {
    "CLAUDE_CODE_ATTRIBUTION_HEADER": "0",
    "CLAUDE_CODE_ENABLE_TELEMETRY": "0",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1"
  }
}
```

## Claude Code skill

The `skills/llama-build/` directory contains a Claude Code skill that automates the entire setup process:

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

## License

MIT
