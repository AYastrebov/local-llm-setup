# macOS Setup (Apple Silicon)

Setup guide for running local LLM inference on Apple Silicon Macs with Metal GPU acceleration.

This Mac runs exactly one local model: **Qwen3.8-27B** (general + reasoning + vision). Mellum2,
Gemma 4 and the Qwen3.6 MTP builds are Fedora-only — see [../fedora/setup.md](../fedora/setup.md).

> Mellum2 12B-A2.5B was removed from this Mac on 2026-09-10 — weights deleted, `mellum` launcher
> uninstalled, pi model entry dropped. It was faster (79 t/s vs Qwen3.8's 19.9) but the setup is
> deliberately single-model now. The `mellum` launcher lives on for Fedora.

## Hardware tested

| Component | Spec |
|-----------|------|
| Machine | MacBook Pro 16-inch, 2023 |
| CPU | Apple M2 Max (12 cores @ 3.50 GHz) |
| GPU | Apple M2 Max (30 cores, Metal 3) |
| Memory | 64 GB unified |
| OS | macOS Sequoia 15.7 |

## Build llama.cpp

Metal GPU acceleration is enabled by default on macOS. No third-party drivers needed.

**Prerequisites:** Xcode Command Line Tools (`xcode-select --install`).

```bash
git clone https://github.com/ggml-org/llama.cpp.git ~/llama.cpp
cd ~/llama.cpp
cmake -B build -DGGML_METAL=ON -DGGML_NATIVE=ON -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release -j $(sysctl -n hw.ncpu)
```

Add to PATH (`~/.zshrc`):
```bash
export PATH="$HOME/llama.cpp/build/bin:$PATH"
```

> **Upgrading an existing checkout:** llama.cpp vendored cpp-httplib in mid-2026. Reconfiguring a
> `build/` directory created before that fails with
> `Target "cpp-httplib" links to OpenSSL::SSL but the target was not found`.
> Fix: `rm -rf build` and configure from scratch. Clean builds are unaffected.

The architecture used here must be present in your build — verify with:
```bash
grep '"qwen35"' ~/llama.cpp/src/llama-arch.cpp
```

**Last verified build** (2026-09-09): llama.cpp `22397c31a`, build 10881, version 0.4.0-dev,
ggml 0.23.0, AppleClang 21.0.0 (Xcode 26.6), macOS Tahoe 26.6.2. Configure line used:

```bash
cmake -B build -DCMAKE_BUILD_TYPE=Release -DGGML_METAL=ON -DGGML_BLAS=ON -DLLAMA_OPENSSL=ON
```

The CPU backend variant selected for this machine was `-mcpu=native+dotprod+i8mm+nosve+nosme`.

## Models

### Qwen3.8-27B (27B dense, vision-language)

Qwen's most capable compact dense model: hybrid Gated DeltaNet + Gated Attention, native image and
video understanding, 262K native context, thinking on by default with per-request control
(`enable_thinking`, `reasoning_effort`, `preserve_thinking`).

| Quant | Size | Fits 64 GB Mac? | Notes |
|-------|------|-----------------|-------|
| UD-Q8_K_XL | 31.5 GB | Yes | Near-lossless, tighter headroom |
| **UD-Q6_K_XL** | **25.9 GB** | **Yes (recommended)** | High quality, ~35 GB headroom |
| UD-Q5_K_XL | 20.2 GB | Yes | Good quality, more room for context |
| UD-Q4_K_XL | 17.9 GB | Yes | Max headroom |

**Measured footprint** at UD-Q6_K_XL, 65536 context, `--flash-attn on` with q8_0 KV:

| Component | Size |
|-----------|------|
| Weights (Metal) | 23,782 MiB |
| Weights (CPU-mapped) | 995 MiB |
| KV cache — 16 of 64 layers x 65536 cells, K 1088 + V 1088 | 2,176 MiB |
| Compute buffers (Metal + CPU) | 429 + 84 MiB |
| **Total** | **~27.5 GB** |

Only 16 of the 64 layers use full attention; the rest are linear (Gated DeltaNet) carrying a small
fixed-size state, which is why 64K of context costs just over 2 GB. Metal reported a 53,084 MiB
working set at measurement time — not the full 64 GB, and it varies with memory pressure — so that
is the real ceiling to budget against.

Confirmed on this build: **q8_0 KV cache works with flash attention on the hybrid `qwen35` arch.**

`-hf` also pulls an mmproj automatically, which is what enables image input; the server reports
`modalities: {vision: true, video: true, audio: false}`. Note it selects **`mmproj-BF16.gguf`**
(896 MB), not the F16 file — do not fetch F16 by hand, it will sit unused. Pass `--no-mmproj` to
skip vision entirely.

> **MTP is on by default.** An earlier version of this doc claimed no MTP GGUF exists for
> Qwen3.8-27B — that was wrong. `unsloth/Qwen3.8-27B-GGUF` ships the NextN block inside the main
> GGUF (`blk.64.nextn.*`, present in UD-Q6_K_XL), and llama.cpp builds the draft context from the
> target model itself. The launcher passes `--spec-type draft-mtp --spec-draft-n-max 4`, worth a
> measured **1.7x** here. Disable with `QWEN_MTP=0`, retune with `QWEN_MTP_NMAX=N`.

**Sampling parameters** (per the [Qwen3.8 model card](https://huggingface.co/unsloth/Qwen3.8-27B-GGUF)):

| Mode | Temperature | Top-P | Top-K | Min-P | Presence penalty |
|------|-------------|-------|-------|-------|------------------|
| Thinking | 1.0 | 0.95 | 20 | 0.0 | 0.0 |
| Instruct (non-thinking) | 0.7 | 0.80 | 20 | 0.0 | 1.5 |

**Launch:**
```bash
qwen              # server on port 8080
qwen chat         # interactive CLI, thinking on
qwen chat-fast    # interactive CLI, thinking off (instruct params)
```

## Memory ceiling

Metal reports a **49,152 MiB working set** on this machine, not the full 64 GB. That is the real
number to budget against. Qwen3.8-27B at UD-Q6_K_XL leaves plenty of room even at full context:

| Context | KV cache (q8_0) | Total RSS |
|---------|-----------------|-----------|
| 65536 (launcher default) | 2.35 GB | ~27.6 GB |
| 131072 | 4.7 GB | ~30 GB |
| 262144 (native max) | 9.4 GB | **34.8 GB, measured** |

The cache stays small because only **17 of 65 layers are attention** (4 KV heads x 256); the other
48 are Gated DeltaNet SSM with constant-size state.

## Key differences from Fedora setup

| | Mac (M2 Max, 64 GB) | Fedora (RX 9060 XT, 16 GB VRAM) |
|---|---|---|
| GPU backend | Metal | HIP/ROCm |
| General model | Qwen3.8-27B dense, UD-Q6_K_XL (25.9 GB) | Qwen3.6 35B-A3B MoE MTP, IQ3_XXS (~14 GB) |
| Coding model | — (Qwen3.8 does both) | Mellum2 12B-A2.5B Thinking, Q8_0 (12.9 GB) |
| Multimodal | Gemma 4 26B-A4B (Fedora only) | Gemma 4 26B-A4B, Q3_K_XL (13 GB) |
| Speculative decoding | `--spec-type draft-mtp --spec-draft-n-max 4` | `--spec-type draft-mtp --spec-draft-n-max 4` |
| KV cache quantization | q8_0 | q8_0 |
| Build flags | `-DGGML_METAL=ON -DGGML_NATIVE=ON` | `-DGGML_HIP=ON -DGGML_HIP_ROCWMMA_FATTN=ON` |

## Coding agent integration

macOS drives local models through **pi** only. opencode is no longer installed here.

```bash
cp pi-dev/models-mac.json    ~/.pi/agent/models.json     # then fill in the placeholder keys
cp pi-dev/settings-mac.json  ~/.pi/agent/settings.json
cp llama-cpp/scripts/pi-qwen ~/.local/bin/ && chmod +x ~/.local/bin/pi-qwen
```

### pi-qwen (the shorthand)

`pi-qwen` starts llama-server with Qwen3.8-27B if it is not already up, then execs pi against it:

```bash
pi-qwen [pi args...]   # ensure server, then run pi on it
pi-qwen stop           # stop the background server (frees ~25 GB)
pi-qwen status         # show what is on the port
pi-qwen logs           # follow the server log
```

The server is left running after pi exits, so a second launch reuses the loaded model instead of
paying the load cost again. State lives in `~/.local/state/pi-local/`.

It resolves `~/.local/bin`, `~/llama.cpp/build/bin` and the fnm node dir internally, so it works
from a non-login shell (cron, Raycast, scripts). It refuses to run if the port is serving a
different model, rather than silently talking to the wrong one.

`pi-qwen` is the only local shorthand on macOS. Its vars are env-overridable
(`PI_LOCAL_LAUNCHER`, `PI_LOCAL_MODEL`, `PI_LOCAL_PORT`), which is how Fedora builds its
`pi-mellum` alias — see [zshrc-snippet.sh](../../zshrc-snippet.sh).

### pi provider settings

`pi-dev/models-mac.json` registers three providers: `llama-cpp` (local, Qwen3.8 only), `neuralwatt`, and
`jbcentral-local`. pi also ships a built-in catalog (`moonshotai`, `openrouter`, `deepseek`,
`minimax`, `xiaomi`, ...) that needs only the matching API key in the environment - those do not
appear in `models.json` at all.

The `llama-cpp` `compat` block is set from what this llama.cpp build actually accepts:

| Flag | Value | Why |
|------|-------|-----|
| `supportsReasoningEffort` | `true` | server accepts `reasoning_effort` in the request body (HTTP 200) |
| `supportsUsageInStreaming` | `true` | `stream_options.include_usage` returns a usage chunk |
| `supportsDeveloperRole` | `false` | unverified, and it is model-dependent - the flag is provider-wide |

## LSP

LSP is provided by the `pi-lsp-extension` package listed in `pi-dev/settings-mac.json`. See
[docs/lsp.md](../../docs/lsp.md) for macOS install commands (`brew install rust-analyzer`, npm for
the JS-based servers) and `pi-dev/pi-lsp.json` for the server map.

## Performance (observed)

**Qwen3.8-27B, UD-Q6_K_XL** — measured on the same machine and build:

| Metric | Value |
|--------|-------|
| Model load | 6 s (warm page cache) |
| Prompt eval | 46.6 t/s |
| Generation, no MTP | 11.6 t/s |
| **Generation, MTP `-n-max 4`** | **19.1 t/s** |

The MTP row was measured 2026-09-10 at ctx 8192 with q8_0 KV over a 160-token generation:
11.3 t/s off, 19.0 at depth 3, **19.1 at depth 4**, 17.2 at depth 6 — the same optimum Fedora found,
though the Metal curve is flatter than ROCm's.

This is a dense 27B, so every token activates all 27B params — the retired Mellum2 managed 79 t/s
on the same box off 2.5B active. That speed is the cost of running one model that also reasons,
handles 262K context, and sees images.

**KV cache type does not matter on Metal.** Fedora's dramatic `q4_0` result is a ROCm/RDNA4
flash-attention quirk. Measured here at ctx 8192, MTP `-n-max 4`, medians of 3: f16/f16 20.0,
q8_0/q8_0 19.9, q4_0/q4_0 19.8, q8_0/q4_0 19.5 — a 2.5% spread. `q8_0` is kept for quality.
