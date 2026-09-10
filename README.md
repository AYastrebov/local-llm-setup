# Local LLM Setup

Config files, launcher scripts, and coding agent settings for a self-hosted AI coding setup. Runs llama.cpp on AMD ROCm and Apple Silicon, with NeuralWatt and JetBrains Central as cloud providers. Driven through pi.dev, plus Claude Code.

## Status (2026-09-10)

Both **macOS and Fedora were verified 2026-09-10** — the numbers below are measured on those boxes,
not intent. **Docker remains documented but unverified.**

| | macOS (M2 Max, 64 GB) | Fedora (RX 9060 XT, 16 GB) | Docker |
|---|---|---|---|
| llama.cpp | `22397c31a`, build 10881, ggml 0.23.0 | `434ddbbc0`, build 10884 (HIP + rocWMMA) | not checked |
| Qwen3.8-27B | **served, 19.1 t/s gen with MTP** (11.3 without) | **served, 34.2 t/s gen with MTP** (14.8 without) | - |
| Mellum2 12B-A2.5B | downloaded, served, 79-80 t/s gen | launcher installed, **not yet benchmarked** | - |
| Gemma 4 26B-A4B | - | launcher installed, not re-benchmarked | - |
| Agent | pi (`pi-qwen` shorthand) | pi (`pi-qwen` shorthand) | - |

Fedora VRAM at the tuned settings: **14269 / 16304 MiB used (13.9 / 15.9 GiB), ~2.0 GiB free.** See
[Fedora tuning](#fedora-tuning-rx-9060-xt-16-gb) — the defaults put it at 98% and crash the desktop.

The macOS Mellum2 figure (79-80 t/s) still dates from 2026-09-09 and has not been re-measured since.

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
| [Mellum2 12B-A2.5B](https://huggingface.co/collections/JetBrains/mellum-2) | 12B MoE | 2.5B active | Coding | Mac, Fedora* |
| [Gemma 4 26B-A4B](https://unsloth.ai/docs/models/gemma-4) | 26B MoE | 3.8B active | General + multimodal | Fedora |
| [LFM2.5-350M](https://huggingface.co/LiquidAI/LFM2.5-350M-GGUF) | 350M dense | 350M | Lightweight automation | Docker server |

macOS runs **only Qwen3.8-27B and Mellum2**; Gemma 4 is Fedora-only. Qwen3.6 has been retired from
both machines — the `unsloth/qwen38` collection ships only the 27B dense model and a 2.4T-A95B MoE
far too large for either box, so both platforms run the 27B at different quants.

\* Mellum2 is now *installed* on Fedora too (the `mellum` launcher is no longer mac-only), but it
has **not been benchmarked or run there yet**. Its Q8_0 weights are 12.9 GB, so it should fit the
16 GB card, and the `q4_0` KV finding below may or may not transfer — it is a different
architecture and deserves its own sweep before anyone trusts a number.

### Quantization per platform

| Model | Mac (64GB) | Fedora (16GB VRAM) | Docker (CPU, 24GB RAM) |
|-------|------------|--------------------|------------------------|
| Qwen3.8-27B (dense, VL) | UD-Q6_K_XL (25.9 GB) | UD-IQ3_XXS (10.93 GB) | -- |
| Mellum2 12B-A2.5B Thinking | Q8_0 (12.9 GB) | -- | -- |
| Gemma 4 26B-A4B | -- | Q3_K_XL (13 GB) | -- |
| LFM2.5-350M | -- | -- | Q8_0 (379 MB) |

### MTP (Multi-Token Prediction)

MTP enables speculative decoding, and is enabled by default in the `qwen` launcher on **both**
platforms — a measured **2.3x on Fedora** and **1.7x on macOS**:

```bash
--spec-type draft-mtp --spec-draft-n-max 4
```

**A separate `-MTP-` repo is not required.** This doc previously claimed no MTP GGUF exists for
Qwen3.8-27B — that was wrong. `unsloth/Qwen3.8-27B-GGUF` ships the NextN/MTP block *inside the main
GGUF* as `blk.64.nextn.*`, and llama.cpp builds the draft context from the target model itself. If
you run without `--spec-type`, those tensors show up in the log as
`model has unused tensor blk.64.nextn.* -- ignoring` — that is the MTP head sitting idle.
(The repo also has a standalone `MTP/mtp-Qwen3.8-27B-Q4_0.gguf` sidecar, which is not needed for
this setup.)

Draft depth matters a lot. Measured on the RX 9060 XT, ctx 65536, q4_0 KV, median of 3-4 runs:

| `--spec-draft-n-max` | tok/s | draft acceptance |
|---|---|---|
| off (no MTP) | 14.8 | — |
| 2 | 29.2 | 82% |
| 3 | 33.1 | 76% |
| **4** | **34.5** | **70%** |
| 6 | 21.5 | 55% |
| 8 | 15.8 | 43% |

Acceptance collapses past 4, so deeper drafts cost more than they win — the old `-n-max 6` was
leaving ~40% on the table. Disable MTP entirely with `QWEN_MTP=0`, or retune with `QWEN_MTP_NMAX=N`.

**`n-max 4` is now measured on macOS too, not inherited from Fedora.** M2 Max, UD-Q6_K_XL, ctx 8192,
q8_0 KV, 160-token generation:

| `--spec-draft-n-max` | tok/s |
|---|---|
| off (no MTP) | 11.3 |
| 3 | 19.0 |
| **4** | **19.1** |
| 6 | 17.2 |

The Metal speedup is smaller than ROCm's (1.7x vs 2.3x) and the curve is flatter, but the optimum
sits at the same depth. The Mac's UD-Q6_K_XL GGUF carries the same `blk.64.nextn.*` block as the
Fedora IQ3_XXS, so no extra download is involved.

### Sampling parameters (quick reference)

| Model | temp | top-p | top-k | min-p | presence |
|-------|------|-------|-------|-------|----------|
| Qwen3.8-27B (thinking) | 1.0 | 0.95 | 20 | 0.0 | 0.0 |
| Qwen3.8-27B (instruct) | 0.7 | 0.80 | 20 | 0.0 | 1.5 |
| Mellum2 12B-A2.5B | 0.6 | 0.95 | 20 | -- | -- |
| Gemma 4 26B-A4B | 1.0 | 0.95 | 64 | -- | -- |

`repetition_penalty` is 1.0 for Qwen3.8 in both modes, which is already llama.cpp's default
(`--repeat-penalty` default: 1.00), so no launcher passes it.

### Reasoning effort (Qwen3.8)

Use llama.cpp's first-class `--reasoning-effort`, not `--chat-template-kwargs
'{"enable_thinking":...}'` — the latter is deprecated and llama.cpp warns about it on startup.

The Qwen3.8 chat template accepts **only `xhigh` (its own default), `medium` and `low`**. Unsloth's
guide also lists `none`, but that raises a Jinja exception:

```
Unexpected reasoning effort none. Supported types are xhigh (default), medium, and low.
```

For genuine non-thinking output use llama.cpp's `--reasoning off` instead, which bypasses the
template's thinking block. Verified: `12*12` returns `144` with an empty reasoning field in 4
completion tokens. That is what `qwen chat-fast` uses.

Cost of each level on a trivial prompt (`"reply with only the word: pong"`): `xhigh` 40 tokens,
`medium` 30, `low` 21, `--reasoning off` 4.

### Fedora tuning (RX 9060 XT, 16 GB)

Two settings matter more than anything else on this box, and neither is in Unsloth's guide.

**1. KV cache must be `q4_0`.** This is not only about VRAM — the ROCm/RDNA4 flash-attention kernel
has a fast path for `q4_0`. Measured at a fixed 2560 MiB fit margin, ctx 65536, MTP on:

| `--cache-type-k` / `-v` | tok/s |
|---|---|
| **q4_0 / q4_0** | **34.2** |
| q5_1 / q4_0 | 18.7 |
| q8_0 / q4_0 | 16.7 |
| q8_0 / q8_0 | 13.4 |

`q8_0` also forces `--fit` to spill layers to host RAM at a safe margin, which is most of that
collapse. Output quality at `q4_0` was spot-checked and is fine.

**KV cache type does not matter on Metal.** The `q4_0` result above is a ROCm/RDNA4
flash-attention quirk and does not transfer. Measured on the M2 Max, UD-Q6_K_XL, ctx 8192, MTP
`-n-max 4`, medians of 3:

| `--cache-type-k` / `-v` | tok/s |
|---|---|
| f16 / f16 | 20.0 |
| **q8_0 / q8_0** | **19.9** |
| q4_0 / q4_0 | 19.8 |
| q8_0 / q4_0 | 19.5 |

A 2.5% spread, i.e. noise-adjacent. macOS keeps `q8_0` for quality, not speed.

**2. `--fit-target 2560`, not the default 1024.** The desktop (gnome-shell, Xwayland, terminal)
holds ~1919 MiB (1.9 GiB) of VRAM on its own. At the default margin `--fit on` fills to 98%, and the compositor
then fails to allocate:

```
amdgpu: [drm] *ERROR* Not enough memory for command submission!
```

That kills the terminal emulator out from under whatever is running — an agent session in that
terminal just dies and you land back at a login screen. A 2560 MiB target leaves ~2.0 GiB free and
costs nothing in throughput.

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
   cp llama-cpp/scripts/{qwen,gemma-moe,mellum,pi-qwen} ~/.local/bin/
   chmod +x ~/.local/bin/{qwen,gemma-moe,mellum,pi-qwen}
   # Edit gemma-moe: set MODEL to UD-Q3_K_XL and uncomment KV_CACHE line
   # qwen auto-detects the platform — on Linux it picks Qwen3.8-27B UD-IQ3_XXS,
   # --no-mmproj, q4_0 KV, --fit-target 2560 and MTP at --spec-draft-n-max 4
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

7. **Run** (one at a time — all default to port 8080):
   ```bash
   qwen               # Qwen3.8-27B server + web UI at localhost:8080
   qwen chat          # interactive chat, thinking on
   qwen chat-fast     # interactive chat, thinking off (--reasoning off)
   gemma-moe          # Gemma 4 server
   gemma-moe chat     # Gemma 4 interactive chat with thinking
   pi-qwen            # start Qwen3.8-27B if needed, then run pi against it
   ```

   Cold start on Fedora is ~14 s once the GGUF is cached; a warm `pi-qwen` reuses the
   running server in ~2 s.

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

Both configs register four providers: NeuralWatt (Kimi K2.6, GLM 5.1 FP8, Qwen3.6 35B), JB Central proxy (Claude Opus 4.7, GPT-5.5 Pro, Gemini 3.1 Pro), and local llama.cpp (Qwen3.8-27B + Mellum2 on Mac; Qwen3.8-27B + Mellum2 + Gemma 4 on Fedora). Replace `YOUR-WIRE-HASH` with your hash from `~/.wire/config.json` and set your NeuralWatt key.

> The local provider **must be named `llama-cpp`** in `models.json` — `pi-qwen` hardcodes
> `PROVIDER="llama-cpp"`. `models-fedora.json` used to call it `local-fedora`, which meant
> `pi-qwen` failed on Fedora with an unknown-provider error while working fine on Mac. Fixed
> 2026-09-10; if you have an older `~/.pi/agent/models.json`, rename that key.

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
pi-qwen stop       # stop the background server (frees ~26 GB mac, ~14 GB Fedora)
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
