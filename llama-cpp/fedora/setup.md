# Local LLM Setup — Fedora 44 + AMD Radeon RX 9060 XT

## Hardware

| Component | Spec |
|-----------|------|
| CPU | Intel Core i5-14600K |
| RAM | 32 GB |
| GPU | AMD Radeon RX 9060 XT (16 GB VRAM, RDNA4, gfx1200) |
| OS | Fedora 44, kernel 7.1.13 |

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
| Qwen3.8-27B (dense, VL) | UD-IQ3_XXS | 10.93 GB | Yes — 14269/16304 MiB used, ~2.0 GiB free at tuned settings |

Download models:
```bash
llama-cli -hf unsloth/gemma-4-26B-A4B-it-GGUF:UD-Q3_K_XL -n 0 -p ""
llama-cli -hf unsloth/Qwen3.8-27B-GGUF:UD-IQ3_XXS -n 0 -p ""
```

> **Run exactly one downloader at a time.** Two `llama-server`/`llama-cli` processes pulling the
> same `-hf` blob concurrently race on the same `.downloadInProgress` file and produce a corrupt,
> oversized GGUF. The header stays valid so the model *loads without any warning* — it just emits
> pure garbage (`??????`, `//////`) on every prompt, on GPU and CPU alike, which looks exactly like
> an unsupported-architecture bug and is very easy to misdiagnose. The only reliable tell is the
> checksum. In the HF cache layout the blob filename **is** the expected sha256:
>
> ```bash
> cd ~/models/models--unsloth--Qwen3.8-27B-GGUF/blobs
> sha256sum *                      # must equal the filename
> curl -sf "https://huggingface.co/api/models/unsloth/Qwen3.8-27B-GGUF/tree/main?recursive=true" \
>   | jq -r '.[] | select(.path|test("UD-IQ3_XXS")) | "\(.lfs.oid)  \(.lfs.size)"'
> ```
>
> If they differ, delete the blob and re-download with a single process.

### Why UD-IQ3_XXS for Qwen3.8-27B

Full quant ladder against the 16 GB budget. Sizes are HF `lfs.size`. Only 16 of the 27B model's 64
layers use full attention, the rest are linear (Gated DeltaNet) with a small fixed state, so the KV
cache is modest — about 1 GB at 65536 context with `q4_0`, roughly double that at `q8_0`.

Budget: 16304 MiB total, minus the ~1919 MiB the desktop holds, minus ~350 MiB for the MTP block.

| Quant | Size (HF `lfs.size`) | Verdict |
|-------|------|---------|
| UD-IQ4_XS | 14.25 GB | No room left for KV + desktop |
| UD-Q3_K_XL | 13.15 GB | Fits only by shrinking context or dropping the desktop margin |
| **UD-IQ3_XXS** | **10.93 GB** | **Recommended — measured 14269/16304 MiB used, ~2034 MiB free** |
| UD-Q2_K_XL | 9.83 GB | More room, but Q2 on a dense model hurts |

`-hf` would also pull `mmproj-F16.gguf` (~0.9 GB), which is what enables image input. That eats the
headroom, so the Fedora branch of the launcher passes `--no-mmproj`. To use vision instead, trade
context for it: `QWEN_CTX=32768 qwen --mmproj-auto`.

> **Tradeoff vs. the Qwen3.6 35B-A3B it replaces.** That was an MoE activating ~3B params per
> token; Qwen3.8-27B is **dense** and activates all 27B, so raw per-token compute is much higher.
> MTP claws most of that back: **34.2 t/s measured with MTP vs 14.8 t/s without** (see below). You
> also gain a much stronger model generation and far flatter long-context scaling from the
> linear-attention layers.
>
> An earlier revision of this doc said Qwen3.8 loses MTP because no `-MTP-` GGUF exists. **That was
> wrong** — the NextN/MTP block ships inside the main GGUF as `blk.64.nextn.*` and llama.cpp builds
> the draft context from the target model itself. No sidecar, no separate repo.

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
`unsloth/Qwen3.8-27B-GGUF:UD-IQ3_XXS`, `--no-mmproj`, `q4_0` KV, `--fit-target 2560` and MTP at
`--spec-draft-n-max 4`; on macOS it selects `UD-Q6_K_XL` with vision and `q8_0` KV. Override with
`QWEN_MODEL=`, `QWEN_CTX=`, `QWEN_REASONING=xhigh|medium|low`, `QWEN_MTP=0`, `QWEN_MTP_NMAX=N`.

This replaces the old `qwen-mtp` launcher. MTP is still on — it just no longer needs a dedicated
`-MTP-` repo, since the draft head is embedded in the main GGUF.

### Measured performance (2026-09-10, llama.cpp `434ddbbc0`)

Prompt: a short Python codegen request, `n_predict 300`, ctx 65536, median of 3-4 runs.

| Config | tok/s | VRAM used / free (MiB, of 16304) |
|---|---|---|
| No MTP, q8_0 KV, default fit margin | 14.8 | 15994 / 310 |
| **MTP n_max=4, q4_0 KV, `--fit-target 2560`** | **34.2** | **14269 / 2034** |

Two independent levers get you there, and the second one also stops the machine falling over:

**KV cache `q4_0`, not `q8_0`.** The ROCm/RDNA4 flash-attention kernel has a fast path for `q4_0`,
and `q8_0` additionally pushes `--fit` into spilling layers to host RAM once you ask for a safe
margin. At fixed `--fit-target 2560`, ctx 65536, MTP on:

| `-ctk` / `-ctv` | tok/s |
|---|---|
| **q4_0 / q4_0** | **34.2** |
| q5_1 / q4_0 | 18.7 |
| q8_0 / q4_0 | 16.7 |
| q8_0 / q8_0 | 13.4 |

**`--fit-target 2560`, not the default 1024.** The desktop alone holds ~1919 MiB (1.9 GiB) of VRAM. At the
default margin `--fit on` fills the card to 98%, leaving ~310 MiB, and the compositor then dies with:

```
amdgpu: [drm] *ERROR* Not enough memory for command submission!
```

which takes the terminal emulator with it — any agent session running in that terminal is killed
and you land back at a login screen. 2560 MiB costs nothing in throughput and leaves ~2.0 GiB free.

**MTP draft depth.** Acceptance falls off past 4, so deeper drafts lose:

| `--spec-draft-n-max` | tok/s | acceptance |
|---|---|---|
| off | 14.8 | — |
| 2 | 29.2 | 82% |
| 3 | 33.1 | 76% |
| **4** | **34.5** | **70%** |
| 6 | 21.5 | 55% |
| 8 | 15.8 | 43% |

### mellum (Mellum2 12B-A2.5B)

```bash
mellum              # server on port 8080
mellum server 8081  # second port, alongside qwen
mellum chat         # interactive coding chat
```

Installed on Fedora as of 2026-09-10 so the box matches the macOS setup, but **not yet run or
benchmarked here** — Q8_0 is 12.9 GB and should fit the 16 GB card, but that is an expectation, not
a measurement. It also still uses `q8_0` KV; whether the `q4_0` fast path above transfers to this
architecture has not been tested.

### pi-qwen (run pi against a local model)

```bash
pi-qwen             # start Qwen3.8-27B if needed, then run pi on it
pi-qwen stop        # stop the background server (frees ~14 GB)
pi-qwen status      # show what is on the port
pi-qwen logs        # follow the server log
pi-mellum           # same for Mellum2 on port 8081 (alias in zshrc-snippet.sh)
```

The server is left running after pi exits, so the next launch is instant. Measured on Fedora: **~14 s
cold** (weights already cached) and **~2 s warm**.

`pi-qwen` requires the local provider in `~/.pi/agent/models.json` to be named **`llama-cpp`** — it
passes `--provider llama-cpp` to pi.

### Sampling Parameters

| Model | Mode | temp | top-p | top-k | min-p | presence |
|-------|------|------|-------|-------|-------|----------|
| Gemma 4 26B-A4B | all | 1.0 | 0.95 | 64 | — | — |
| Qwen3.8-27B | Thinking (chat) | 1.0 | 0.95 | 20 | 0.0 | 0.0 |
| Qwen3.8-27B | Instruct (chat-fast) | 0.7 | 0.80 | 20 | 0.0 | 1.5 |

`repetition_penalty` is 1.0 for Qwen3.8 in both modes, which is llama.cpp's default, so it is not
passed explicitly.

Context window: 65536 tokens. Qwen3.8 uses `q4_0` KV (see the performance section above); Gemma 4
still uses `q8_0` and has not been re-benchmarked against `q4_0`.

### Reasoning effort

`qwen` uses llama.cpp's `--reasoning-effort`, not the deprecated
`--chat-template-kwargs '{"enable_thinking":...}'`. The Qwen3.8 chat template accepts only
`xhigh` (its default), `medium` and `low`. Unsloth's guide also lists `none`, but passing it raises:

```
Unexpected reasoning effort none. Supported types are xhigh (default), medium, and low.
```

True non-thinking comes from `--reasoning off`, which `qwen chat-fast` uses — verified to return
`144` for `12*12` with an empty reasoning field in 4 completion tokens.

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
| `llama-cpp` | Qwen3.8-27B, Mellum2 12B-A2.5B, Gemma 4 26B-A4B | llama.cpp at port 8080 — start a launcher first. Name must be `llama-cpp`: `pi-qwen` hardcodes it |

`anthropic`, `openai` and `google` are not listed: pi's built-in catalog activates them from an
exported API key alone.

## LSP Configuration

LSP comes from pi's `pi-lsp-extension`. Go, Rust, TypeScript and JavaScript work out of the box;
anything else goes in a per-project `.pi-lsp.json` (see `pi-dev/pi-lsp.json`). A missing binary just
means that language has no LSP, so install only the servers you use.

See [docs/lsp.md](../../docs/lsp.md) for the per-language install commands (Fedora uses `dnf` for
`rust-analyzer`, not `rustup`).

## Web UI

llama-server includes a built-in web UI. After starting a server, open `http://localhost:8080` in a browser.

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
