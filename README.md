# Local LLM Setup

Configuration files, launcher scripts, and Claude Code skills for running local LLM inference with [llama.cpp](https://github.com/ggml-org/llama.cpp) on Linux (AMD Radeon), macOS (Apple Silicon), and headless servers (Docker, CPU-only).

## Platform guides

| Platform | Hardware | Guide |
|----------|----------|-------|
| **Fedora** | Intel i5-14600K, RX 9060 XT (16GB), 32GB RAM | [docs/fedora-setup.md](docs/fedora-setup.md) |
| **macOS** | Apple M2 Max, 64GB unified memory | [docs/mac-setup.md](docs/mac-setup.md) |
| **Docker** | Intel i3-6100T, 24GB RAM, no GPU (home server) | [docs/docker-server.md](docs/docker-server.md) |

## Models

| Model | Type | Params | Use case | Platform | Docs |
|-------|------|--------|----------|----------|------|
| [Gemma 4 26B-A4B](https://unsloth.ai/docs/models/gemma-4) | 26B MoE | 3.8B active | General + multimodal | Mac, Fedora | [unsloth.ai](https://unsloth.ai/docs/models/gemma-4) |
| [Qwen3.6 27B](https://unsloth.ai/docs/models/qwen3.6) | 27B dense | 27B | General + reasoning | Mac | [unsloth.ai](https://unsloth.ai/docs/models/qwen3.6) |
| [Qwen3.6 35B-A3B](https://unsloth.ai/docs/models/qwen3.6) | 35B MoE | 3B active | General + reasoning | Fedora | [unsloth.ai](https://unsloth.ai/docs/models/qwen3.6) |
| [LFM2.5-350M](https://huggingface.co/LiquidAI/LFM2.5-350M-GGUF) | 350M dense | 350M | Lightweight automation | Docker server | [huggingface.co](https://huggingface.co/LiquidAI/LFM2.5-350M-GGUF) |

### Quantization per platform

| Model | Mac (64GB) | Fedora (16GB VRAM) | Docker (CPU, 24GB RAM) |
|-------|------------|--------------------|------------------------|
| Gemma 4 26B-A4B | Q8_K_XL (28 GB) | Q3_K_XL (13 GB) | -- |
| Qwen3.6 27B (dense, MTP) | Q6_K_XL (26 GB) | -- | -- |
| Qwen3.6 35B-A3B (MoE, MTP) | -- | IQ3_XXS (14 GB) | -- |
| LFM2.5-350M | -- | -- | Q8_0 (379 MB) |

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
   cp scripts/qwen-mtp scripts/gemma-moe ~/.local/bin/
   chmod +x ~/.local/bin/qwen-mtp ~/.local/bin/gemma-moe
   # Edit gemma-moe: set MODEL to UD-Q3_K_XL and uncomment KV_CACHE line
   # Edit qwen-mtp: uncomment the 35B-A3B-MTP MODEL line for Fedora
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
   qwen-mtp chat      # Qwen3.6 interactive chat with thinking + MTP
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
   cp scripts/qwen-mtp scripts/gemma-moe ~/.local/bin/
   chmod +x ~/.local/bin/qwen-mtp ~/.local/bin/gemma-moe
   # qwen-mtp defaults to 27B dense MTP (macOS)
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
   qwen-mtp chat        # Qwen3.6 27B interactive chat with MTP
   qwen-mtp chat-think  # Qwen3.6 creative/general chat
   ```

See [docs/mac-setup.md](docs/mac-setup.md) for detailed hardware info and model selection.

## Quick start (Docker — home server)

No build needed. See [docs/docker-server.md](docs/docker-server.md) for full details.

```bash
mkdir -p ~/services/llama/models

# Download LFM2.5-350M (379 MB)
wget -O ~/services/llama/models/LFM2.5-350M-Q8_0.gguf \
  'https://huggingface.co/LiquidAI/LFM2.5-350M-GGUF/resolve/main/LFM2.5-350M-Q8_0.gguf'

# Copy docker-compose.yml from docs/docker-server.md, then:
cd ~/services/llama && docker compose up -d
```

Ideal for lightweight automation: log analysis, Home Assistant NLP, git commit messages, text summarization.

## Coding agent integration

### pi.dev

Copy the appropriate config to `~/.pi/agent/models.json`:
- Fedora: `configs/pi-dev/models.json`
- macOS: `configs/pi-dev/models-mac.json`

Both configs register four providers: NeuralWatt (Kimi K2.6, GLM 5.1, Devstral), JBCentral proxy (Anthropic, OpenAI Codex, Gemini 3.5 Flash), and local llama.cpp. Replace `YOUR-WIRE-HASH` with your hash from `~/.config/opencode/opencode.json` and set your NeuralWatt key. Select any model in pi.dev via `/model`.

### opencode

Copy the config for your platform to `~/.config/opencode/opencode.jsonc`:
- Fedora: `configs/opencode/opencode-fedora.jsonc`
- macOS: `configs/opencode/opencode-mac.jsonc`

| Agent | Mode | Model | Provider |
|-------|------|-------|----------|
| `plan` (built-in) | primary | GLM 5.1 FP8 | NeuralWatt |
| `build` (built-in) | primary | Devstral Small 2 24B | NeuralWatt |
| `kimi` | primary | Kimi K2.6 | NeuralWatt |
| `glm` | primary | GLM 5.1 FP8 | NeuralWatt |
| `qwen-fast` | primary | Qwen3.6 35B A3B | NeuralWatt |
| `explore` | subagent | Qwen3.6 35B Fast | NeuralWatt |
| `docs` | subagent | Qwen3.6 35B Fast | NeuralWatt |
| `local-gemma` | primary | Gemma 4 26B-A4B | Local llama.cpp — start `gemma-moe` |
| `local-moe` | primary | Qwen3.6 27B (Mac) / 35B-A3B (Fedora) | Local llama.cpp — start `qwen-mtp` |

NeuralWatt agents require `NEURALWATT_API_KEY` — see [docs/neuralwatt.md](docs/neuralwatt.md). For LSP language-server setup (Go, TypeScript, Rust, Vue), see [docs/lsp.md](docs/lsp.md).

### Claude Code

```bash
# Start server first, then launch Claude Code
gemma-moe && claude-gemma   # Gemma 4 26B-A4B
qwen-mtp  && claude-qwen    # Qwen3.6 27B with MTP
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

## Claude Code skills

| Skill | What it does | Install location |
|-------|-------------|-----------------|
| `llama-build` | Build llama.cpp, download models, set up launcher scripts and coding agent integration | `~/llama.cpp/.claude/skills/` |
| `neuralwatt-setup` | Configure OpenCode with NeuralWatt cloud provider (Kimi, GLM, Qwen), install `nw-usage` | any project's `.claude/skills/` |

Install a skill:

```bash
# llama-build (scoped to the llama.cpp project)
mkdir -p ~/llama.cpp/.claude/skills/
cp -r skills/llama-build ~/llama.cpp/.claude/skills/

# neuralwatt-setup (global or per-project)
mkdir -p ~/.claude/skills/
cp -r skills/neuralwatt-setup ~/.claude/skills/
```

Invoke with `/llama-build` or `/neuralwatt-setup` in Claude Code.

## Hardware tested

| | Fedora | macOS | Docker (home server) |
|---|---|---|---|
| CPU | Intel Core i5-14600K | Apple M2 Max (12 cores) | Intel Core i3-6100T |
| GPU | AMD Radeon RX 9060 XT (16GB, RDNA4) | Apple M2 Max (30 cores, Metal 3) | None (CPU-only) |
| RAM | 32 GB | 64 GB unified | 24 GB |
| OS | Fedora 43, kernel 6.19+ | macOS Sequoia 15.7 | Ubuntu 24.04 (Docker) |

## License

MIT
