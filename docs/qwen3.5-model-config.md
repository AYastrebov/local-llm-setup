# Qwen3.5 Model Configuration Reference

Source: [Unsloth Qwen3.5 docs](https://unsloth.ai/docs/models/qwen3.5)

## Model Family

| Model | Type | Active Params | Max Context | Thinking Default |
|-------|------|---------------|-------------|-----------------|
| Qwen3.5-0.8B | Dense | 0.8B | 256K | Disabled |
| Qwen3.5-2B | Dense | 2B | 256K | Disabled |
| Qwen3.5-4B | Dense | 4B | 256K | Disabled |
| Qwen3.5-9B | Dense | 9B | 256K | Disabled |
| Qwen3.5-27B | Dense | 27B | 256K | Enabled |
| Qwen3.5-35B-A3B | MoE | 3B (of 35B) | 256K | Enabled |
| Qwen3.5-122B-A10B | MoE | 10B (of 122B) | 256K | Enabled |
| Qwen3.5-397B-A17B | MoE | 17B (of 397B) | 256K | Enabled |

Context is extendable to 1M tokens via YaRN scaling.

## VRAM Requirements

| Model | 3-bit | 4-bit | 6-bit | 8-bit | BF16 |
|-------|-------|-------|-------|-------|------|
| 0.8B + 2B | 3 GB | 3.5 GB | 5 GB | 7.5 GB | 9 GB |
| 4B | 4.5 GB | 5.5 GB | 7 GB | 10 GB | 14 GB |
| 9B | 5.5 GB | 6.5 GB | 9 GB | 13 GB | 19 GB |
| 27B | 14 GB | 17 GB | 24 GB | 30 GB | 54 GB |
| 35B-A3B | 17 GB | 22 GB | 30 GB | 38 GB | 70 GB |
| 122B-A10B | 60 GB | 70 GB | 106 GB | 132 GB | 245 GB |
| 397B-A17B | 180 GB | 214 GB | 340 GB | 512 GB | 810 GB |

## Sampling Parameters

### Thinking Mode

| Task | temp | top-p | top-k | min-p | presence-penalty |
|------|------|-------|-------|-------|-----------------|
| General tasks | 1.0 | 0.95 | 20 | 0.0 | 1.5 |
| Precise coding (WebDev) | 0.6 | 0.95 | 20 | 0.0 | 0.0 |

### Non-Thinking (Instruct) Mode

| Task | temp | top-p | top-k | min-p | presence-penalty |
|------|------|-------|-------|-------|-----------------|
| General tasks | 0.7 | 0.8 | 20 | 0.0 | 1.5 |
| Reasoning tasks | 1.0 | 0.95 | 20 | 0.0 | 1.5 |

**Repetition penalty:** 1.0 (disabled) for all modes.

**Presence penalty notes:** Range 0.0–2.0. Reduces repetitions but may decrease performance. Use 1.5 for general/reasoning tasks, 0.0 for precise coding.

**Output length:** 32,768 tokens for most queries.

## Thinking Mode Toggle

For small models (0.8B, 2B, 4B, 9B), thinking is **disabled by default**. Enable with:

```bash
--chat-template-kwargs '{"enable_thinking":true}'
```

For larger models (27B, 35B-A3B, 122B-A10B, 397B-A17B), thinking is **enabled by default**. Disable with:

```bash
--chat-template-kwargs '{"enable_thinking":false}'
```

Windows PowerShell requires escaped quotes:
```powershell
--chat-template-kwargs "{\"enable_thinking\":true}"
```

## Quantization Guide

- Use at least `UD-Q2_K_XL` for balanced size/accuracy
- `UD-Q4_K_XL` provides state-of-the-art quality
- All Unsloth Dynamic 2.0 GGUFs upcast important layers to 8 or 16-bit

### Benchmark: 397B-A17B Quantization Accuracy

| Quant | Accuracy | vs Original |
|-------|----------|-------------|
| Original (BF16) | 81.3% | baseline |
| UD-Q4_K_XL | 80.5% | -0.8 points |
| UD-Q3_K_XL | 80.7% | -0.6 points |

## Model Selection Tips

- **35B-A3B vs 27B:** Use 35B-A3B for much faster inference (only 3B active). Use 27B for slightly more accuracy if your device can fit it.
- **Small series (0.8B–9B):** Fit on 12 GB devices in near full precision.
- **Multimodal:** All models support vision via separate `mmproj-F16` files.

## Troubleshooting

- **Gibberish output:** Context length may be too low, or try `--cache-type-k bf16 --cache-type-v bf16`
- **Ollama incompatibility:** Qwen3.5 GGUFs currently don't work in Ollama due to separate mmproj vision files. Use llama.cpp directly.
- **Slow inference:** Ensure `LLAMA_CACHE` is set so models aren't re-downloaded. SSD/HDD offloading is possible but slower.
