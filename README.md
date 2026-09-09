# Local LLM Setup

Config files, launcher scripts, and coding agent settings for a self-hosted AI coding setup. Runs llama.cpp on AMD ROCm and Apple Silicon, with NeuralWatt and JetBrains Central as cloud providers. Driven through pi.dev, plus Claude Code.

## Status (2026-09-09)

Everything below was verified on the macOS box on this date. **The Fedora and Docker sections are
documented but unverified** - there is no access to those machines from here, so treat their numbers
as intent, not measurement.

| | macOS (M2 Max, 64 GB) | Fedora | Docker |
|---|---|---|---|
| llama.cpp | `22397c31a`, build 10881, ggml 0.23.0 | not checked | not checked |
| Qwen3.8-27B | downloaded, served, 11.6 t/s gen | documented only | - |
| Mellum2 12B-A2.5B | downloaded, served, 79-80 t/s gen | - | - |
| Agent | pi (`pi-qwen` shorthand) | pi | - |

opencode was removed from this repo in September 2026 - macOS no longer has it installed, and its
configs, provider blocks and the `neuralwatt-setup` skill are gone. Local models are driven through
pi.

## Platform guides

| Platform | Hardware | Guide |
|----------|----------|-------|
| **Fedora** | Intel i5-14600K, RX 9060 XT (16GB), 32GB RAM | [llama-cpp/fedora/setup.md](llama-cpp/fedora/setup.md) |
| **macOS** | Apple M2 Max, 64GB unified memory | [llama-cpp/mac/setup.md](llama-cpp/mac/setup.md) |
| **Docker** | Intel i3-6100T, 24GB RAM, no GPU (home server) | [llama-cpp/docker/setup.md](llama-cpp/docker/setup.md) |

## Local models

| Model | Type | Params | Use case | Platform |
|-------|------|--------|----------|----------|
| [Qwen3.8-27B](https://huggingface.co/collections/unsloth/qwen38) | 27B dense | 27B | General + reasoning + vision | Mac, Fedora |
| [Mellum2 12B-A2.5B](https://huggingface.co/collections/JetBrains/mellum-2) | 12B MoE | 2.5B active | Coding | Mac |
| [Gemma 4 26B-A4B](https://unsloth.ai/docs/models/gemma-4) | 26B MoE | 3.8B active | General + multimodal | Fedora |
| [LFM2.5-350M](https://huggingface.co/LiquidAI/LFM2.5-350M-GGUF) | 350M dense | 350M | Lightweight automation | Docker server |

macOS runs **only Qwen3.8-27B and Mellum2**; Gemma 4 is Fedora-only. Qwen3.6 has been retired from
both machines — the `unsloth/qwen38` collection ships only the 27B dense model and a 2.4T-A95B MoE
far too large for either box, so both platforms run the 27B at different quants.

### Quantization per platform

| Model | Mac (64GB) | Fedora (16GB VRAM) | Docker (CPU, 24GB RAM) |
|-------|------------|--------------------|------------------------|
| Qwen3.8-27B (dense, VL) | UD-Q6_K_XL (25.9 GB) | UD-IQ3_XXS (11.9 GB) | -- |
| Mellum2 12B-A2.5B Thinking | Q8_0 (12.9 GB) | -- | -- |
| Gemma 4 26B-A4B | -- | Q3_K_XL (13 GB) | -- |
| LFM2.5-350M | -- | -- | Q8_0 (379 MB) |

### MTP (Multi-Token Prediction)

MTP enables speculative decoding for ~1.4-2.2x faster generation. Requires special `-MTP-` GGUF files.

```bash
--spec-type draft-mtp --spec-draft-n-max 6
```

Dense models benefit significantly more from MTP than MoE models.

**No longer used on either machine.** No `-MTP-` GGUF is published for Qwen3.8-27B or Mellum2, and
Qwen3.6-35B-A3B-MTP has been retired, so no launcher currently passes `--spec-type`. Re-add the
flags if unsloth publishes a Qwen3.8 `-MTP-` repo.

### Sampling parameters (quick reference)

| Model | temp | top-p | top-k | min-p | presence |
|-------|------|-------|-------|-------|----------|
| Qwen3.8-27B (thinking) | 1.0 | 0.95 | 20 | 0.0 | 0.0 |
| Qwen3.8-27B (instruct) | 0.7 | 0.80 | 20 | 0.0 | 1.5 |
| Mellum2 12B-A2.5B | 0.6 | 0.95 | 20 | -- | -- |
| Gemma 4 26B-A4B | 1.0 | 0.95 | 64 | -- | -- |

## Cloud providers

### NeuralWatt

OpenAI-compatible API with Kimi K2.6, GLM 5.1 FP8, Qwen3.6 35B A3B, and Devstral Small 2. See [neuralwatt/setup.md](neuralwatt/setup.md) for API key setup and the `nw-usage` script.

### JetBrains Central

Local proxy at `127.0.0.1:19516` that routes coding agent requests to the JetBrains AI Platform. Supports Anthropic (Claude Opus 4.7, Sonnet 4.6), OpenAI (GPT-5.5 Pro, Codex), and Google Vertex (Gemini 3.1 Pro). See [jbcentral/setup.md](jbcentral/setup.md) for wire hash setup and dummy API keys.

## Quick start (Fedora)

1. **Install ROCm** (Fedora 44+):
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
   cp llama-cpp/scripts/qwen llama-cpp/scripts/gemma-moe ~/.local/bin/
   chmod +x ~/.local/bin/qwen ~/.local/bin/gemma-moe
   # Edit gemma-moe: set MODEL to UD-Q3_K_XL and uncomment KV_CACHE line
   # qwen auto-detects the platform — on Linux it picks Qwen3.8-27B UD-IQ3_XXS + --no-mmproj
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
   ```

6. **Configure coding agents:**
   ```bash
   cp pi-dev/models-fedora.json ~/.pi/agent/models.json
   # Edit: replace YOUR-WIRE-HASH with value from ~/.wire/config.json
   ```

7. **Run**:
   ```bash
   gemma-moe chat     # Gemma 4 interactive chat with thinking
   qwen chat          # Qwen3.8-27B interactive chat with thinking
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
   cp llama-cpp/scripts/qwen llama-cpp/scripts/mellum ~/.local/bin/
   chmod +x ~/.local/bin/qwen ~/.local/bin/mellum
   ```
   `qwen` runs Qwen3.8-27B (UD-Q6_K_XL); `mellum` runs Mellum2 12B-A2.5B Thinking (Q8_0).
   `gemma-moe` is Fedora-only — do not install it on macOS. `qwen` is shared: it picks the right
   quant and flags from `uname`.

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
   ```

5. **Configure coding agents:**
   ```bash
   cp pi-dev/models-mac.json   ~/.pi/agent/models.json     # fill in the placeholder keys
   cp pi-dev/settings-mac.json ~/.pi/agent/settings.json
   cp llama-cpp/scripts/pi-qwen ~/.local/bin/ && chmod +x ~/.local/bin/pi-qwen
   ```

6. **Run** (one at a time — both default to port 8080):
   ```bash
   qwen                 # Qwen3.8-27B server on port 8080
   qwen chat            # interactive chat, thinking on
   qwen chat-fast       # interactive chat, thinking off (instruct params)
   mellum               # Mellum2 12B-A2.5B Thinking server on port 8080
   mellum chat          # interactive coding chat
   mellum server 8081   # run alongside qwen on a second port
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

Both configs register four providers: NeuralWatt (Kimi K2.6, GLM 5.1 FP8, Qwen3.6 35B), JB Central proxy (Claude Opus 4.7, GPT-5.5 Pro, Gemini 3.1 Pro), and local llama.cpp (Qwen3.8-27B + Mellum2 on Mac; Qwen3.8-27B + Gemma 4 on Fedora). Replace `YOUR-WIRE-HASH` with your hash from `~/.wire/config.json` and set your NeuralWatt key.

macOS also copies `pi-dev/settings-mac.json` to `~/.pi/agent/settings.json`, which sets the
defaults and the enabled-model patterns:

| Setting | Value |
|---------|-------|
| `defaultProvider` / `defaultModel` | `moonshotai` / `kimi-k3` (needs `MOONSHOT_API_KEY`) |
| `defaultThinkingLevel` | `high` |
| `enabledModels` | `neuralwatt/*`, `llama-cpp/*`, `jbcentral-local/**`, `moonshotai/*`, `openrouter/*` |

pi ships a built-in provider catalog (`moonshotai`, `openrouter`, `deepseek`, `minimax`, `xiaomi`,
`anthropic`, `google`, `openai`, ...). Those need only the matching API key exported - they are not
listed in `models.json`. Only custom endpoints go in `models.json`: `llama-cpp`, `neuralwatt`, and
`jbcentral-local`.

NeuralWatt needs `NEURALWATT_API_KEY` (see [neuralwatt/setup.md](neuralwatt/setup.md)). JB Central needs `jbcentral login` (see [jbcentral/setup.md](jbcentral/setup.md)). LSP setup for Go, TypeScript, Rust, Vue, and Kotlin is in [docs/lsp.md](docs/lsp.md).

### Local models through pi

```bash
pi-qwen            # start Qwen3.8-27B if needed, then run pi on it
pi-qwen stop       # stop the background server (frees ~25 GB)
pi-qwen status     # show what is on the port
pi-mellum          # same, for Mellum2 on port 8081 (alias in zshrc-snippet.sh)
```

See [llama-cpp/mac/setup.md](llama-cpp/mac/setup.md) for how `pi-qwen` reuses an already-loaded
model and what it refuses to do.

### Claude Code

The dedicated `claude-qwen` / `claude-mellum` aliases were removed in September 2026 - local models
are driven through `pi-qwen` now. To point Claude Code at a running local server anyway, start one
and set the base URL:

```bash
qwen                                        # or: mellum / gemma-moe (Fedora)
ANTHROPIC_BASE_URL=http://localhost:8080/v1 \
ANTHROPIC_API_KEY=sk-no-key-required \
  claude --model qwen3.8-27b
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

Install a skill:

```bash
# llama-build (scoped to the llama.cpp project)
mkdir -p ~/llama.cpp/.claude/skills/
cp -r llama-cpp/skills/llama-build ~/llama.cpp/.claude/skills/

```

Invoke with `/llama-build` in Claude Code.

## Hardware tested

| | Fedora | macOS | Docker (home server) |
|---|---|---|---|
| CPU | Intel Core i5-14600K | Apple M2 Max (12 cores) | Intel Core i3-6100T |
| GPU | AMD Radeon RX 9060 XT (16GB, RDNA4) | Apple M2 Max (30 cores, Metal 3) | None (CPU-only) |
| RAM | 32 GB | 64 GB unified | 24 GB |
| OS | Fedora 44, kernel 7.0.12+ | macOS Sequoia 15.7 | Ubuntu 24.04 (Docker) |

## License

MIT
