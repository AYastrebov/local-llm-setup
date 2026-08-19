# Local LLM Setup — Fedora 44 + AMD Radeon RX 9060 XT

## Hardware

| Component | Spec |
|-----------|------|
| CPU | Intel Core i5-14600K |
| RAM | 32 GB |
| GPU | AMD Radeon RX 9060 XT (16 GB VRAM, RDNA4, gfx1200) |
| OS | Fedora 44, kernel 7.0.12+ |

## ROCm Installation

Fedora 44 ships ROCm 7.1+ natively, which supports RDNA4 (gfx1200).

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
| Gemma 4 26B-A4B (MoE) | UD-Q3_K_XL | 12.9 GB | Yes (~2 GB for KV cache) |
| Qwen3.8-27B (dense, VL) | UD-IQ3_XXS | 11.9 GB | Yes (~2 GB headroom — see below) |

Download models:
```bash
llama-cli -hf unsloth/gemma-4-26B-A4B-it-GGUF:UD-Q3_K_XL -n 0 -p ""
llama-cli -hf unsloth/Qwen3.8-27B-GGUF:UD-IQ3_XXS -n 0 -p ""
```

### Why UD-IQ3_XXS for Qwen3.8-27B

Full quant ladder against the 16 GB budget. The KV cache costs ~2.1 GB at 65536 context with
`q8_0` — only 16 of the 27B model's 64 layers use full attention, the rest are linear (Gated
DeltaNet) with a small fixed state.

| Quant | Size | + KV @ 65536 | Verdict |
|-------|------|--------------|---------|
| UD-Q3_K_XL | 13.4 GB | 15.5 GB | Too tight — will spill to host RAM |
| **UD-IQ3_XXS** | **11.9 GB** | **14.0 GB** | **Recommended — ~2 GB headroom** |
| UD-Q2_K_XL | 10.7 GB | 12.8 GB | More room, but Q2 on a dense model hurts |

`-hf` would also pull `mmproj-F16.gguf` (~0.9 GB), which is what enables image input. That eats the
headroom, so the Fedora branch of the launcher passes `--no-mmproj`. To use vision instead, trade
context for it: `QWEN_CTX=32768 qwen --mmproj-auto`.

> **Tradeoff vs. the Qwen3.6 35B-A3B it replaces.** That was an MoE activating ~3B params per
> token; Qwen3.8-27B is **dense** and activates all 27B. Expect substantially fewer tokens/sec on
> the RX 9060 XT. You also lose MTP speculative decoding (~1.15–1.25x on the MoE) because no
> `-MTP-` GGUF exists for Qwen3.8. What you gain is a much stronger model generation and far
> flatter long-context scaling from the linear-attention layers. If throughput matters more than
> capability here, staying on Qwen3.6 35B-A3B is defensible — it is still in git history.

ROCm/HIP runs the hybrid layers natively: `GGML_OP_GATED_DELTA_NET` is implemented in the CUDA
backend that HIP compiles from, and is only disabled on MUSA.

## Launcher Scripts

Located in `~/.local/bin/`. All default to server mode on port 8080.

### gemma-moe (Gemma 4 26B-A4B)

```bash
gemma-moe              # server on port 8080
gemma-moe server 9090  # server on custom port
gemma-moe chat         # interactive CLI, thinking enabled
```

Configure for Fedora by editing the MODEL line in the script:
```bash
MODEL="unsloth/gemma-4-26B-A4B-it-GGUF:UD-Q3_K_XL"
KV_CACHE="--cache-type-k q8_0 --cache-type-v q8_0"
```

### qwen (Qwen3.8-27B dense)

```bash
qwen              # server on port 8080
qwen server 9090  # server on custom port
qwen chat         # interactive CLI, thinking on  (temp 1.0)
qwen chat-fast    # interactive CLI, thinking off (temp 0.7, instruct params)
```

The script auto-detects the platform — no MODEL line to edit. On Linux it selects
`unsloth/Qwen3.8-27B-GGUF:UD-IQ3_XXS` and adds `--no-mmproj`; on macOS it selects `UD-Q6_K_XL`
with vision enabled. Override either with `QWEN_MODEL=` / `QWEN_CTX=`.

This replaces the old `qwen-mtp` launcher, which is gone — Qwen3.8 has no MTP GGUF, so there is
nothing for `--spec-type draft-mtp` to load.

### Sampling Parameters

| Model | Mode | temp | top-p | top-k | min-p | presence |
|-------|------|------|-------|-------|-------|----------|
| Gemma 4 26B-A4B | all | 1.0 | 0.95 | 64 | — | — |
| Qwen3.8-27B | Thinking (chat) | 1.0 | 0.95 | 20 | 0.0 | 0.0 |
| Qwen3.8-27B | Instruct (chat-fast) | 0.7 | 0.80 | 20 | 0.0 | 1.5 |

Context window: 65536 tokens. KV cache is quantized to `q8_0` — Gemma 4 sits at ~12.9 GB model +
~2 GB KV, Qwen3.8-27B at ~11.9 GB model + ~2.1 GB KV, both inside 16 GB VRAM.

## pi.dev Configuration

Config file: `~/.pi/agent/models.json` (copy from `pi-dev/models-fedora.json`)

```bash
cp pi-dev/models-fedora.json ~/.pi/agent/models.json
```

The config registers four providers. Select any model via `/model` inside pi.dev:

| Provider | Models | Notes |
|---|---|---|
| `minimax` | MiniMax M3 | Requires `MINIMAX_API_KEY` — replace placeholder key in file |
| `mimo` | MiMo V2.5, V2.5 Pro | Requires `MIMO_API_KEY` — replace placeholder key in file |
| `moonshot` | Kimi K2.6 | Requires `MOONSHOT_API_KEY` — replace placeholder key in file |
| `deepseek` | V4 Flash, V4 Pro | Requires `DEEPSEEK_API_KEY` — replace placeholder key in file |
| `neuralwatt` | Kimi K2.6, GLM 5.1, Devstral Small 2 | Requires `NEURALWATT_API_KEY` — replace placeholder key in file |
| `anthropic` | Claude models (dynamic) | JBCentral proxy — replace `YOUR-WIRE-HASH` |
| `openai` | Codex models (dynamic) | JBCentral proxy — replace `YOUR-WIRE-HASH` |
| `google` | Gemini 3.5 Flash | JBCentral proxy — replace `YOUR-WIRE-HASH` |
| `local-fedora` | Gemma 4 26B-A4B, Qwen3.8-27B | llama.cpp at port 8080 — start a launcher first |

The wire hash is in `~/.config/opencode/opencode.json` (set up by JBCentral).

## opencode Configuration

Config file: `~/.config/opencode/opencode.jsonc` (copy from `opencode/fedora.jsonc`)

```bash
cp opencode/fedora.jsonc ~/.config/opencode/opencode.jsonc
```

Agent profiles — see [neuralwatt/setup.md](../../neuralwatt/setup.md) for full details.

## LSP Configuration

`opencode-fedora.jsonc` declares language servers for Go, TypeScript/JavaScript, Rust, Vue, and Kotlin. opencode silently skips any binary that's not on PATH, so install only the ones you actually use.

See [docs/lsp.md](../docs/lsp.md) for the per-language install commands (Fedora uses `dnf` for `rust-analyzer`, not `rustup`).

## Web UI

llama-server includes a built-in web UI. After starting a server, open `http://localhost:8080` in a browser.

## Claude Code with Local Models

```bash
claude-gemma       # Gemma 4 26B-A4B
claude-qwen        # Qwen3.8-27B
```

Aliases defined in `zshrc-snippet.sh`. Start the corresponding server first.

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
