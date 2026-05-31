# Local LLM Setup

Config files, launcher scripts, and coding agent settings for a self-hosted AI coding setup. Runs llama.cpp on AMD ROCm and Apple Silicon, with NeuralWatt and JetBrains Central as cloud providers. Works with OpenCode, pi.dev, and Claude Code.

## Platform guides

| Platform | Hardware | Guide |
|----------|----------|-------|
| **Fedora** | Intel i5-14600K, RX 9060 XT (16GB), 32GB RAM | [llama-cpp/fedora/setup.md](llama-cpp/fedora/setup.md) |
| **macOS** | Apple M2 Max, 64GB unified memory | [llama-cpp/mac/setup.md](llama-cpp/mac/setup.md) |
| **Docker** | Intel i3-6100T, 24GB RAM, no GPU (home server) | [llama-cpp/docker/setup.md](llama-cpp/docker/setup.md) |

## Local models

| Model | Type | Params | Use case | Platform |
|-------|------|--------|----------|----------|
| [Gemma 4 26B-A4B](https://unsloth.ai/docs/models/gemma-4) | 26B MoE | 3.8B active | General + multimodal | Mac, Fedora |
| [Qwen3.6 27B](https://unsloth.ai/docs/models/qwen3.6) | 27B dense | 27B | General + reasoning | Mac |
| [Qwen3.6 35B-A3B](https://unsloth.ai/docs/models/qwen3.6) | 35B MoE | 3B active | General + reasoning | Fedora |
| [LFM2.5-350M](https://huggingface.co/LiquidAI/LFM2.5-350M-GGUF) | 350M dense | 350M | Lightweight automation | Docker server |

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

## Cloud providers

### NeuralWatt

OpenAI-compatible API with Kimi K2.6, GLM 5.1 FP8, Qwen3.6 35B A3B, and Devstral Small 2. See [neuralwatt/setup.md](neuralwatt/setup.md) for API key setup and the `nw-usage` script.

### JetBrains Central

Local proxy at `127.0.0.1:19516` that routes coding agent requests to the JetBrains AI Platform. Supports Anthropic (Claude Opus 4.7, Sonnet 4.6), OpenAI (GPT-5.5 Pro, Codex), and Google Vertex (Gemini 3.1 Pro). See [jbcentral/setup.md](jbcentral/setup.md) for wire hash setup and dummy API keys.

## Quick start (Fedora)

1. **Install ROCm** (Fedora 43+):
   ```bash
   sudo dnf install rocm-hip-devel hipcc rocminfo rocm-smi rocwmma-devel cmake gcc-c++ openssl-devel
   sudo usermod -aG render,video $USER
   ```

2. **Clone and build llama.cpp**:
   ```bash
   git clone https://github.com/ggml-org/llama.cpp.git ~/llama.cpp
   cp llama-cpp/fedora/build.sh ~/llama.cpp/build.sh
   cd ~/llama.cpp && ./build.sh
   ```

3. **Install launcher scripts**:
   ```bash
   cp llama-cpp/scripts/qwen-mtp llama-cpp/scripts/gemma-moe ~/.local/bin/
   chmod +x ~/.local/bin/qwen-mtp ~/.local/bin/gemma-moe
   # Edit gemma-moe: set MODEL to UD-Q3_K_XL and uncomment KV_CACHE line
   # Edit qwen-mtp: uncomment the 35B-A3B-MTP MODEL line for Fedora
   ```

4. **Add shell config** (append to `~/.zshrc` or `~/.bashrc`):
   ```bash
   cat zshrc-snippet.sh >> ~/.zshrc
   # Edit ~/.zshrc: fill in NEURALWATT_API_KEY and YOUTRACK_TOKEN
   source ~/.zshrc
   ```

5. **Set up JetBrains Central** (for Claude Opus, GPT-5.5, Gemini):
   ```bash
   # Install from https://central-cli.labs.jb.gg
   jbcentral login
   jbcentral add opencode
   ```

6. **Configure coding agents:**
   ```bash
   cp pi-dev/models-fedora.json ~/.pi/agent/models.json
   # Edit: replace YOUR-WIRE-HASH with value from ~/.wire/config.json
   cp opencode/fedora.jsonc ~/.config/opencode/opencode.jsonc
   ```

7. **Run**:
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
   cp llama-cpp/scripts/qwen-mtp llama-cpp/scripts/gemma-moe ~/.local/bin/
   chmod +x ~/.local/bin/qwen-mtp ~/.local/bin/gemma-moe
   # qwen-mtp defaults to 27B dense MTP (macOS)
   ```

3. **Add shell config**:
   ```bash
   cat zshrc-snippet.sh >> ~/.zshrc
   # Edit ~/.zshrc: fill in NEURALWATT_API_KEY and YOUTRACK_TOKEN
   source ~/.zshrc
   ```

4. **Set up JetBrains Central** (for Claude Opus, GPT-5.5, Gemini):
   ```bash
   # Install from https://central-cli.labs.jb.gg
   jbcentral login
   jbcentral add opencode
   ```

5. **Configure coding agents:**
   ```bash
   cp pi-dev/models-mac.json ~/.pi/agent/models.json
   # Edit: replace YOUR-WIRE-HASH with value from ~/.wire/config.json
   cp opencode/mac.jsonc ~/.config/opencode/opencode.jsonc
   ```

6. **Run**:
   ```bash
   gemma-moe            # Gemma 4 26B-A4B server on port 8080
   gemma-moe chat       # Gemma 4 interactive chat with thinking
   qwen-mtp chat        # Qwen3.6 27B interactive chat with MTP
   qwen-mtp chat-think  # Qwen3.6 creative/general chat
   ```

See [llama-cpp/mac/setup.md](llama-cpp/mac/setup.md) for detailed hardware info and model selection.

## Quick start (Docker — home server)

No build needed. See [llama-cpp/docker/setup.md](llama-cpp/docker/setup.md) for full details.

```bash
mkdir -p ~/services/llama/models

# Download LFM2.5-350M (379 MB)
wget -O ~/services/llama/models/LFM2.5-350M-Q8_0.gguf \
  'https://huggingface.co/LiquidAI/LFM2.5-350M-GGUF/resolve/main/LFM2.5-350M-Q8_0.gguf'

# Copy docker-compose.yml from llama-cpp/docker/setup.md, then:
cd ~/services/llama && docker compose up -d
```

Good for lightweight automation: log analysis, Home Assistant NLP, commit messages, text summarization.

## Coding agent integration

### pi.dev

Copy the appropriate config to `~/.pi/agent/models.json`:
- Fedora: `pi-dev/models-fedora.json`
- macOS: `pi-dev/models-mac.json`

Both configs register four providers: NeuralWatt (Kimi K2.6, GLM 5.1 FP8, Qwen3.6 35B), JB Central proxy (Claude Opus 4.7, GPT-5.5 Pro, Gemini 3.1 Pro), and local llama.cpp. Replace `YOUR-WIRE-HASH` with your hash from `~/.wire/config.json` and set your NeuralWatt key.

### opencode

Copy the config for your platform to `~/.config/opencode/opencode.jsonc`:
- Fedora: `opencode/fedora.jsonc`
- macOS: `opencode/mac.jsonc`

Both configs include the same cloud agents. The only difference is the local model (Qwen3.6 27B dense on Mac, Qwen3.6 35B-A3B MoE on Fedora).

| Agent | Mode | Model | Provider |
|-------|------|-------|----------|
| `plan` (built-in) | — | DeepSeek V4 Pro | DeepSeek |
| `build` (built-in) | — | DeepSeek V4 Flash | DeepSeek |
| `kimi` | primary | Kimi K2.6 | Moonshot |
| `explore` | subagent | Qwen3.6 35B Fast | NeuralWatt |
| `docs` | subagent | Qwen3.6 35B Fast | NeuralWatt |
| `local-gemma` | primary | Gemma 4 26B-A4B | Local — start `gemma-moe` |
| `local-moe` | primary | Qwen3.6 27B / 35B-A3B | Local — start `qwen-mtp` |
| `opus` | primary | Claude Opus 4.7 | JB Central |
| `codex` | primary | GPT-5.3 Codex | JB Central |
| `gemini` | primary | Gemini 3.1 Pro | JB Central |

NeuralWatt agents need `NEURALWATT_API_KEY` (see [neuralwatt/setup.md](neuralwatt/setup.md)). JB Central needs `jbcentral login` (see [jbcentral/setup.md](jbcentral/setup.md)). LSP setup for Go, TypeScript, Rust, and Vue is in [docs/lsp.md](docs/lsp.md).

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
cp -r llama-cpp/skills/llama-build ~/llama.cpp/.claude/skills/

# neuralwatt-setup (global or per-project)
mkdir -p ~/.claude/skills/
cp -r neuralwatt/skills/neuralwatt-setup ~/.claude/skills/
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
