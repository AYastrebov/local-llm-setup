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
| Qwen3.8-27B (dense, VL) | UD-IQ3_XXS | 10.93 GB | Yes — 14269/16304 MiB used, ~2.0 GiB free at tuned settings |

Download models:
```bash
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
> MTP claws most of that back: **41.1 t/s measured with MTP vs 20.6 t/s without** (see below). You
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

### qwen (Qwen3.8-27B dense)

```bash
qwen              # server on port 8080
qwen server 9090  # server on custom port
qwen chat         # interactive CLI, thinking on  (temp 1.0)
qwen chat-fast    # interactive CLI, thinking off (temp 0.7, instruct params)
```

The script auto-detects the platform — no MODEL line to edit. On Linux it selects
`unsloth/Qwen3.8-27B-GGUF:UD-IQ3_XXS`, `--no-mmproj`, `q4_0` KV, `--fit-target 2560` and MTP at
`--spec-draft-n-max 3 --spec-draft-sampling probabilistic`; on macOS it selects `UD-Q6_K_XL` with
vision, `q8_0` KV and MTP at depth 4 with greedy drafting. The MTP defaults are **deliberately
per-platform** — each was measured on its own box and on a different llama.cpp build. Override with
`QWEN_MODEL=`, `QWEN_CTX=`, `QWEN_REASONING=xhigh|medium|low`, `QWEN_MTP=0`, `QWEN_MTP_NMAX=N`,
`QWEN_MTP_SAMPLING=greedy|probabilistic`.

This replaces the old `qwen-mtp` launcher. MTP is still on — it just no longer needs a dedicated
`-MTP-` repo, since the draft head is embedded in the main GGUF.

### Measured performance (2026-10-08, llama.cpp `de7fa0a3c` build 11514)

Prompt: a short Python codegen request to `/completion`, `n_predict 300`, ctx 65536. Medians of
6-10 runs; the n=10 cells reproduced to <0.2 t/s across full server restarts.

| Config | tok/s | VRAM used / free (MiB, of 16304) |
|---|---|---|
| No MTP, q8_0 KV, default fit margin | 20.6 | 12897 / 3407 |
| **MTP n=3 probabilistic, q4_0 KV, `--fit-target 2560`** | **41.1** | **14049 / 2255** |

> **The baseline moved under us.** On build 10884 (2026-09-10) the same two rows were 14.8 and
> 34.2 t/s. The no-MTP path gained ~39% from upstream HIP/CUDA work while the MTP path stayed flat,
> so MTP's multiple fell from 2.3x to 2.0x even though absolute throughput rose 20%. The practical
> lesson: **re-run the depth sweep after any large llama.cpp jump** instead of trusting a number
> written down here — the optimum genuinely moved from 4 to 3.

Three levers get you there, and the second one also stops the machine falling over:

**KV cache `q4_0`, not `q8_0`.** The ROCm/RDNA4 flash-attention kernel has a fast path for `q4_0`,
and `q8_0` additionally pushes `--fit` into spilling layers to host RAM once you ask for a safe
margin. At fixed `--fit-target 2560`, ctx 65536, MTP on:

| `-ctk` / `-ctv` | build 10884 | build 11514 |
|---|---|---|
| **q4_0 / q4_0** | **34.2** | **41.1** |
| q5_1 / q4_0 | 18.7 | — |
| q8_0 / q4_0 | 16.7 | — |
| q8_0 / q8_0 | 13.4 | 14.4 |

Re-verified on build 11514 after the flash-attention kernels changed upstream: still a ~2.9x gap,
so it is a property of the backend rather than of one llama.cpp version.

**`--fit-target 2560`, not the default 1024.** The desktop alone holds ~1919 MiB (1.9 GiB) of VRAM. At the
default margin `--fit on` fills the card to 98%, leaving ~310 MiB, and the compositor then dies with:

```
amdgpu: [drm] *ERROR* Not enough memory for command submission!
```

which takes the terminal emulator with it — any agent session running in that terminal is killed
and you land back at a login screen. 2560 MiB costs nothing in throughput and leaves ~2.0 GiB free.

**MTP draft depth — now 3, was 4.** Deeper drafts still lose badly; depth 6 is now worse than no
MTP at all.

| `--spec-draft-n-max` | build 10884 | build 11514 (probabilistic) |
|---|---|---|
| off | 14.8 | 20.6 |
| 2 | 29.2 | 35.8 |
| **3** | 33.1 | **40.9** |
| 4 | **34.5** | 36.7 |
| 6 | 21.5 | 15.0 |
| 8 | 15.8 | — |

**`--spec-draft-sampling probabilistic`** (new in llama.cpp #27694; the upstream default is
`greedy`). The drafter samples and the target verifies by rejection sampling, which is also the
distribution-preserving variant for temp > 0. n=10 per cell:

| | greedy | probabilistic |
|---|---|---|
| n=4 | 35.9 (acc 66%) | 37.2 (acc 72%) |
| **n=3** | 36.6 (acc 76%) | **41.1 (acc 89%)** |

Depth and sampling compound: +14% together against +2% and +3.6% alone.

> **Caveat on these numbers.** The benchmark prompt is ~300 tokens. pi's real prompt is ~7,880
> tokens with tool definitions, and behaves differently — on one real pi turn, acceptance went from
> 34% (n=4 greedy) to 80% (n=3 probabilistic) and generation from 21.7 to 35.3 t/s, same direction
> but a single short sample. More importantly, pi spends ~14 s on prompt eval for that 7,880-token
> prompt, which dwarfs the generation gain on a short tool-call turn. This tuning pays off on long
> generations; for pi responsiveness, prompt processing is the thing to attack.


### pi-qwen (run pi against a local model)

```bash
pi-qwen             # start Qwen3.8-27B if needed, then run pi on it
pi-qwen stop        # stop the background server (frees ~14 GB)
pi-qwen status      # show what is on the port
pi-qwen logs        # follow the server log

# Launcher, model alias and port are env-overridable:
#   PI_LOCAL_LAUNCHER, PI_LOCAL_MODEL, PI_LOCAL_PORT
```

The server is left running after pi exits, so the next launch is instant. Measured on Fedora: **~14 s
cold** (weights already cached) and **~2 s warm**.

`pi-qwen` requires the local provider in `~/.pi/agent/models.json` to be named **`llama-cpp`** — it
passes `--provider llama-cpp` to pi.

### Sampling Parameters

| Model | Mode | temp | top-p | top-k | min-p | presence |
|-------|------|------|-------|-------|-------|----------|
| Qwen3.8-27B | Thinking (chat) | 1.0 | 0.95 | 20 | 0.0 | 0.0 |
| Qwen3.8-27B | Instruct (chat-fast) | 0.7 | 0.80 | 20 | 0.0 | 1.5 |

`repetition_penalty` is 1.0 for Qwen3.8 in both modes, which is llama.cpp's default, so it is not
passed explicitly.

Context window: 65536 tokens. Qwen3.8 uses `q4_0` KV (see the performance section above).

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

Config files: `~/.pi/agent/models.json` and `~/.pi/agent/settings.json`

```bash
cp pi-dev/models-fedora.json   ~/.pi/agent/models.json
cp pi-dev/settings-fedora.json ~/.pi/agent/settings.json
```

`models.json` registers the two custom endpoints. Select any model via `/model` inside pi.dev:

| Provider | Models | Notes |
|---|---|---|
| `neuralwatt` | GLM 5.3 Flash (default), GLM 5.3, MiMo V2.6 Pro, `nw-flash`, `nw-small`, `nw-large` | Reads `NEURALWATT_API_KEY` from the environment — see [neuralwatt/setup.md](../../neuralwatt/setup.md) |
| `llama-cpp` | Qwen3.8-27B | llama.cpp at port 8080 — start a launcher first. Name must be `llama-cpp`: `pi-qwen` hardcodes it |

DeepSeek, Moonshot, MiniMax, MiMo, `anthropic`, `openai`, `google` and the rest are not listed:
pi's built-in catalog activates them from an exported API key alone. (`models-fedora.json` used to
carry hand-written blocks for the first four; they were dropped on 2026-10-04.)

## LSP Configuration

LSP comes from our fork of `pi-lsp-extension` (see docs/lsp.md). Go, Rust, TypeScript/JavaScript (incl. TS 7) and Kotlin work;
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
