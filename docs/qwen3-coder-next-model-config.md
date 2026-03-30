# Qwen3-Coder-Next Model Configuration Reference

Source: [Unsloth Qwen3-Coder-Next docs](https://unsloth.ai/docs/models/qwen3-coder-next)

## Model Architecture

| Property | Value |
|----------|-------|
| Total parameters | 80B (Mixture of Experts) |
| Active parameters | 3B |
| Expert count | 512 (10 active per token) |
| Max context | 262,144 tokens (256K) |
| Architecture | Hybrid: Gated Delta Net + Attention (every 4th layer) |
| Thinking mode | **Not supported** — non-thinking only |
| Tool calling | Supported (use `--jinja` in llama.cpp) |

This model does **not** generate `<think></think>` blocks. It is a pure coding model optimized for speed, not a reasoning model like Qwen3.5.

## Benchmarks

| Benchmark | Score |
|-----------|-------|
| SWE-Bench Verified (w/ SWE-Agent) | 70.6 |
| SWE-Bench Multilingual | 62.8 |
| SWE-Bench Pro | 44.3 |
| Aider Polyglot | 66.2 |
| Terminal-Bench 2.0 | 36.2 |

Context: DeepSeek-V3.2 (671B) scores 70.2 on SWE-Bench Verified — Qwen3-Coder-Next matches it with 10–20x fewer active parameters.

## Sampling Parameters

All modes use the same parameters — there are no separate thinking/instruct profiles:

| Parameter | Value |
|-----------|-------|
| Temperature | 1.0 |
| Top-P | 0.95 |
| Top-K | 40 |
| Min-P | 0.01 |
| Repeat penalty | 1.0 (disabled) |

**Important:** Do not use thinking-mode parameters from Qwen3.5 (temp 0.6, top-k 20). This model requires its own sampling settings.

## VRAM / Memory Requirements

| Quant | Size | Min memory | BPW |
|-------|------|------------|-----|
| UD-Q8_K_XL | 86.3 GB | ~96 GB | 8.0 |
| UD-Q6_K_XL | 73.1 GB | ~80 GB | 6.0 |
| UD-Q5_K_XL | 59.5 GB | ~68 GB | 5.0 |
| UD-Q4_K_XL | 49.6 GB | ~56 GB | 4.0 |
| UD-Q3_K_XL | 36.3 GB | ~44 GB | 3.64 |
| UD-IQ3_XXS | 28.5 GB | ~36 GB | 2.86 |
| UD-Q2_K_XL | 26.8 GB | ~34 GB | 2.5 |
| UD-IQ2_XXS | 23.3 GB | ~30 GB | 2.0 |
| UD-IQ1_M | 21.7 GB | ~28 GB | 1.5 |

Rule of thumb: leave ~8–15 GB free for KV cache, compute buffers, and OS overhead. More for larger context windows.

### Platform recommendations

| Platform | Memory | Recommended quant |
|----------|--------|-------------------|
| Mac M2 Max (64 GB) | 64 GB unified | UD-Q3_K_XL (34 GB) |
| Mac M4 Pro (48 GB) | 48 GB unified | UD-IQ3_XXS (28 GB) |
| Mac M4 Max (128 GB) | 128 GB unified | UD-Q6_K_XL (73 GB) |
| Linux 24 GB VRAM | 24 GB discrete | UD-IQ2_XXS (23 GB) — tight |
| Linux 48 GB VRAM | 48 GB discrete | UD-Q3_K_XL (36 GB) |

## KV Cache Optimization

For large context windows (32K+), quantize the KV cache to reduce memory:

```bash
--cache-type-k q4_0 --cache-type-v q4_0    # ~75% smaller KV cache
```

This allows 65K context with the Q3_K_XL quant on a 64 GB Mac. Negligible quality impact for coding tasks.

## llama.cpp Commands

### Quick start (auto-downloads model)

```bash
# Interactive chat
llama-cli -hf unsloth/Qwen3-Coder-Next-GGUF:UD-Q3_K_XL \
    --ctx-size 16384 \
    --temp 1.0 --top-p 0.95 --min-p 0.01 --top-k 40

# OpenAI-compatible server
llama-server -hf unsloth/Qwen3-Coder-Next-GGUF:UD-Q3_K_XL \
    --jinja --ctx-size 16384 --port 8080 \
    --temp 1.0 --top-p 0.95 --min-p 0.01 --top-k 40
```

### With local model file

```bash
llama-cli \
    --model path/to/Qwen3-Coder-Next-UD-Q3_K_XL.gguf \
    --seed 3407 \
    --temp 1.0 --top-p 0.95 --min-p 0.01 --top-k 40

llama-server \
    --model path/to/Qwen3-Coder-Next-UD-Q3_K_XL.gguf \
    --alias "unsloth/Qwen3-Coder-Next" \
    --seed 3407 --port 8001 \
    --temp 1.0 --top-p 0.95 --min-p 0.01 --top-k 40
```

## Key Differences from Qwen3.5

| | Qwen3-Coder-Next | Qwen3.5-35B-A3B |
|---|---|---|
| Purpose | Coding specialist | General purpose |
| Thinking mode | **No** | Yes (enabled by default) |
| Total params | 80B | 35B |
| Active params | 3B | 3B |
| Experts | 512 (10 active) | MoE |
| Architecture | Hybrid (GDN + Attention) | Transformer |
| Temperature | 1.0 | 0.6 (coding) / 1.0 (creative) |
| Top-K | 40 | 20 |
| Min-P | 0.01 | 0.0 |
| SWE-Bench Verified | 70.6 | — |

## Quantization Quality

Unsloth Dynamic 2.0 ("UD-") quants upcast important layers to 8 or 16-bit for better accuracy at the same average bit width:

- UD-Q4_K_XL outperforms standard Q4_K_M on mixed benchmark suites
- UD-IQ3_XXS "comes close to BF16 performance" — viable minimum for coding
- UD-Q3_K_XL provides better quality and faster inference than UD-IQ3_XXS (standard K-quant vs I-quant)

## Performance Notes

- **Throughput:** 20+ tokens/sec when model fully fits in device memory
- **Inference speed:** MoE with only 3B active params means very fast generation despite 80B total
- **Prompt caching:** llama-server caches prompts automatically — follow-up requests in the same conversation are much faster
- **Tool calling:** Fixed in llama.cpp as of Feb 19 update — use `--jinja` flag

## Troubleshooting

- **OOM on Mac:** Reduce context (`--ctx-size 8192`) or use a smaller quant. The Q4_K_XL (49.6 GB) is too tight for 64 GB Macs with 65K context.
- **Slow first request:** Model warmup is normal. Subsequent requests use cached context.
- **No thinking blocks:** This is expected. The model does not support thinking mode. Use Qwen3.5 if you need reasoning.
