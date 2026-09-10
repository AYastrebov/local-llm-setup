# Local LLM Setup

Config files, launcher scripts, and coding agent settings for a self-hosted AI coding setup. Runs llama.cpp on AMD ROCm and Apple Silicon, with NeuralWatt as the cloud provider. Driven through pi.dev, plus Claude Code.

## Status (2026-09-10)

Both **macOS and Fedora were verified 2026-09-10** — the numbers below are measured on those boxes,
not intent.

| | macOS (M2 Max, 64 GB) | Fedora (RX 9060 XT, 16 GB) |
|---|---|---|
| llama.cpp | `41fc7584f`, build 10895, ggml 0.23.0 | `434ddbbc0`, build 10884 (HIP + rocWMMA) |
| Qwen3.8-27B | **served, 19.3 t/s gen with MTP** (11.3 without) | **served, 34.2 t/s gen with MTP** (14.8 without) |
| Mellum2 12B-A2.5B | **removed 2026-09-10** | launcher installed, **not yet benchmarked** |
| Gemma 4 26B-A4B | - | launcher installed, not re-benchmarked |
| Agent | pi (`pi-qwen` shorthand) | pi (`pi-qwen` shorthand) |

Fedora VRAM at the tuned settings: **14269 / 16304 MiB used (13.9 / 15.9 GiB), ~2.0 GiB free.** See
[Fedora tuning](#fedora-tuning-rx-9060-xt-16-gb) — the defaults put it at 98% and crash the desktop.

macOS now runs **Qwen3.8-27B only**. Mellum2 was removed from the Mac on 2026-09-10 — weights
deleted, launcher uninstalled, pi model entry dropped. It remains a Fedora model. Its last measured
macOS figure was 79-80 t/s on 2026-09-09, kept here only as history.

opencode was removed from this repo in September 2026 - macOS no longer has it installed, and its
configs, provider blocks and the `neuralwatt-setup` skill are gone. Local models are driven through
pi.

## Platform guides

| Platform | Hardware | Guide |
|----------|----------|-------|
| **Fedora** | Intel i5-14600K, RX 9060 XT (16GB), 32GB RAM | [llama-cpp/fedora/setup.md](llama-cpp/fedora/setup.md) |
| **macOS** | Apple M2 Max, 64GB unified memory | [llama-cpp/mac/setup.md](llama-cpp/mac/setup.md) |

## Local models

| Model | Type | Params | Use case | Platform |
|-------|------|--------|----------|----------|
| [Qwen3.8-27B](https://huggingface.co/collections/unsloth/qwen38) | 27B dense | 27B | General + reasoning + vision | Mac, Fedora |
| [Mellum2 12B-A2.5B](https://huggingface.co/collections/JetBrains/mellum-2) | 12B MoE | 2.5B active | Coding | Fedora* |
| [Gemma 4 26B-A4B](https://unsloth.ai/docs/models/gemma-4) | 26B MoE | 3.8B active | General + multimodal | Fedora |

macOS runs **only Qwen3.8-27B**; Mellum2 and Gemma 4 are Fedora-only. Qwen3.6 has been retired from
both machines — the `unsloth/qwen38` collection ships only the 27B dense model and a 2.4T-A95B MoE
far too large for either box, so both platforms run the 27B at different quants.

\* Mellum2 is *installed* on Fedora (the `mellum` launcher is Fedora-only since the Mac dropped it), but it
has **not been benchmarked or run there yet**. Its Q8_0 weights are 12.9 GB, so it should fit the
16 GB card, and the `q4_0` KV finding below may or may not transfer — it is a different
architecture and deserves its own sweep before anyone trusts a number.

### Quantization per platform

| Model | Mac (64GB) | Fedora (16GB VRAM) |
|-------|------------|--------------------|
| Qwen3.8-27B (dense, VL) | UD-Q6_K_XL (25.9 GB) | UD-IQ3_XXS (10.93 GB) |
| Mellum2 12B-A2.5B Thinking | -- | Q8_0 (12.9 GB) |
| Gemma 4 26B-A4B | -- | Q3_K_XL (13 GB) |

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

5. **Configure coding agents:**
   ```bash
   cp pi-dev/models-fedora.json ~/.pi/agent/models.json
   # Edit: fill in the placeholder API keys
   ```

6. **Run** (one at a time — all default to port 8080):
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
   cp llama-cpp/scripts/qwen ~/.local/bin/
   chmod +x ~/.local/bin/qwen
   ```
   `qwen` runs Qwen3.8-27B (UD-Q6_K_XL) and is the only local model on macOS.
   `mellum` and `gemma-moe` are Fedora-only — do not install them on macOS. `qwen` is shared: it
   picks the right quant and flags from `uname`.

3. **Add shell config**:
   ```bash
   cat zshrc-snippet.sh >> ~/.zshrc
   # Edit ~/.zshrc: fill in NEURALWATT_API_KEY and YOUTRACK_TOKEN
   source ~/.zshrc
   ```

4. **Configure coding agents:**
   ```bash
   cp pi-dev/models-mac.json   ~/.pi/agent/models.json     # fill in the placeholder keys
   cp pi-dev/settings-mac.json ~/.pi/agent/settings.json
   cp llama-cpp/scripts/pi-qwen ~/.local/bin/ && chmod +x ~/.local/bin/pi-qwen
   ```

6. **Run**:
   ```bash
   qwen                 # Qwen3.8-27B server on port 8080
   qwen chat            # interactive chat, thinking on
   qwen chat-fast       # interactive chat, thinking off (instruct params)
   ```

See [llama-cpp/mac/setup.md](llama-cpp/mac/setup.md) for detailed hardware info and model selection.

## Coding agent integration

### pi.dev

Copy the appropriate config to `~/.pi/agent/models.json`:
- Fedora: `pi-dev/models-fedora.json`
- macOS: `pi-dev/models-mac.json`

Both configs register NeuralWatt (Kimi K2.6, GLM 5.1 FP8, Qwen3.6 35B) and local llama.cpp
(Qwen3.8-27B on Mac; Qwen3.8-27B + Mellum2 + Gemma 4 on Fedora); `models-fedora.json` adds a few
direct vendor endpoints. Set your NeuralWatt key.

> The local provider **must be named `llama-cpp`** in `models.json` — `pi-qwen` hardcodes
> `PROVIDER="llama-cpp"`. `models-fedora.json` used to call it `local-fedora`, which meant
> `pi-qwen` failed on Fedora with an unknown-provider error while working fine on Mac. Fixed
> 2026-09-10; if you have an older `~/.pi/agent/models.json`, rename that key.

macOS also copies `pi-dev/settings-mac.json` to `~/.pi/agent/settings.json`:

| Setting | Value |
|---------|-------|
| `defaultProvider` / `defaultModel` | `moonshotai` / `kimi-k3` (needs `MOONSHOT_API_KEY`) |
| `defaultThinkingLevel` | `high` |
| `enabledModels` | **not set** — see below |

### Provider discovery

pi ships a built-in provider catalog and activates each entry when its API key is present in the
environment: `MOONSHOT_API_KEY` -> `moonshotai`, `OPENROUTER_API_KEY` -> `openrouter`,
`DEEPSEEK_API_KEY` -> `deepseek`, and so on (`pi --help` lists them all). Those providers are **not**
listed in `models.json`. Only custom endpoints go there: `llama-cpp` and `neuralwatt`.

`enabledModels` is an **allowlist**, so setting it defeats that discovery — a provider whose key you
later export stays invisible until you also add it to the list. It was dropped on 2026-09-10 for
exactly that reason. Verified: with no allowlist, exporting `DEEPSEEK_API_KEY` makes `deepseek`
appear in `pi --list-models` with no config change at all.

The cost is a long Ctrl+P list (~485 models here, most of them OpenRouter's). If that gets
unwieldy, re-add `enabledModels` with narrow patterns — but then remember to extend it whenever you
add a provider key.

NeuralWatt needs `NEURALWATT_API_KEY` (see [neuralwatt/setup.md](neuralwatt/setup.md)). LSP setup for Go, TypeScript, Rust, Vue, and Kotlin is in [docs/lsp.md](docs/lsp.md).

### Local models through pi

```bash
pi-qwen            # start Qwen3.8-27B if needed, then run pi on it
pi-qwen stop       # stop the background server (frees ~26 GB mac, ~14 GB Fedora)
pi-qwen status     # show what is on the port
```

`pi-qwen` is the only local shorthand on macOS. Fedora additionally has the `pi-mellum` alias in
[zshrc-snippet.sh](zshrc-snippet.sh).

See [llama-cpp/mac/setup.md](llama-cpp/mac/setup.md) for how `pi-qwen` reuses an already-loaded
model and what it refuses to do.

### Claude Code

**Local models are driven through pi, not Claude Code.** Pointing Claude Code at a local
llama-server via `ANTHROPIC_BASE_URL` used to be documented here and was removed in September 2026:
Claude Code is built around Anthropic models, and driving a non-Anthropic model through it gave
consistently poor results in practice. Use `pi-qwen` for local models; keep Claude Code on
Anthropic models.

Claude Code is still used in this setup — see the skill below.

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

| | Fedora | macOS |
|---|---|---|
| CPU | Intel Core i5-14600K | Apple M2 Max (12 cores) |
| GPU | AMD Radeon RX 9060 XT (16GB, RDNA4) | Apple M2 Max (30 cores, Metal 3) |
| RAM | 32 GB | 64 GB unified |
| OS | Fedora 44, kernel 7.0.12+ | macOS Sequoia 15.7 |

## License

MIT
