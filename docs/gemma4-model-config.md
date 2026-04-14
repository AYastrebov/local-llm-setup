# Gemma 4 Model Configuration Reference

Source: [Unsloth Gemma 4 docs](https://unsloth.ai/docs/models/gemma-4)

## Model Architecture

| Property | Value |
|----------|-------|
| Total parameters | 26B (Mixture of Experts) |
| Active parameters | 3.8B (A4B) |
| Max context | 256,000 tokens (256K) |
| Thinking mode | **Supported** (enable with `enable_thinking: true`) |
| Tool calling | Supported (use `--jinja` in llama.cpp) |
| Multimodal | Text, image, audio |

## Model Variants

| Model | Type | Active params | Context | Use case |
|-------|------|---------------|---------|----------|
| Gemma 4 31B | Dense | 31B | 256K | Maximum quality |
| Gemma 4 26B-A4B | MoE | 3.8B | 256K | Best speed/quality balance |
| Gemma 4 E4B | Small | ~4B effective | 128K | Laptop/edge |
| Gemma 4 E2B | Small | ~2B effective | 128K | Phone/edge |

## Sampling Parameters

| Parameter | Value |
|-----------|-------|
| Temperature | 1.0 |
| Top-P | 0.95 |
| Top-K | 64 |
| Repeat penalty | 1.0 (disabled) |

## Thinking Mode

Gemma 4 supports a thinking/reasoning mode:

- **Enable:** `--chat-template-kwargs '{"enable_thinking":true}'`
- **Disable:** `--chat-template-kwargs '{"enable_thinking":false}'`

Output format when thinking is enabled:
```
<|channel>thought
[internal reasoning]
<channel|>
[final answer]
```

**Multi-turn rule:** Do not feed prior thought blocks back into conversation history. Only keep the final visible answer.

## VRAM / Memory Requirements

### Gemma 4 26B-A4B (MoE)

| Quant | Size | Min memory |
|-------|------|------------|
| BF16 | 50.5 GB | ~52 GB |
| UD-Q8_K_XL | 27.9 GB | ~30 GB |
| UD-Q6_K_XL | 23.3 GB | ~26 GB |
| UD-Q5_K_XL | 21.2 GB | ~24 GB |
| UD-Q4_K_XL | 17.1 GB | ~20 GB |
| UD-Q3_K_XL | 12.9 GB | ~16 GB |
| UD-IQ3_XXS | 11.2 GB | ~14 GB |

### Gemma 4 31B (Dense)

| Quant | Size | Min memory |
|-------|------|------------|
| BF16 | 61.4 GB | ~64 GB |
| UD-Q8_K_XL | 35 GB | ~38 GB |
| UD-Q6_K_XL | 27.5 GB | ~30 GB |
| UD-Q4_K_XL | 18.8 GB | ~22 GB |
| UD-Q3_K_XL | 15.3 GB | ~18 GB |

### Platform recommendations

| Platform | Memory | Recommended model & quant |
|----------|--------|---------------------------|
| Mac M2 Max (64 GB) | 64 GB unified | 26B-A4B UD-Q8_K_XL (28 GB) — near-lossless |
| Mac M4 Pro (48 GB) | 48 GB unified | 26B-A4B UD-Q6_K_XL (23 GB) |
| Mac M4 Max (128 GB) | 128 GB unified | 31B UD-Q8_K_XL (35 GB) |
| Linux 16 GB VRAM | 16 GB discrete | 26B-A4B UD-Q3_K_XL (13 GB) |
| Linux 24 GB VRAM | 24 GB discrete | 26B-A4B UD-Q6_K_XL (23 GB) |

## llama.cpp Commands

### Quick start (auto-downloads model)

```bash
# Interactive chat with thinking
llama-cli -hf unsloth/gemma-4-26B-A4B-it-GGUF:UD-Q8_K_XL \
    --ctx-size 65536 \
    --chat-template-kwargs '{"enable_thinking":true}' \
    --temp 1.0 --top-p 0.95 --top-k 64

# OpenAI-compatible server
llama-server -hf unsloth/gemma-4-26B-A4B-it-GGUF:UD-Q8_K_XL \
    --jinja --ctx-size 65536 --port 8080 \
    --chat-template-kwargs '{"enable_thinking":true}' \
    --temp 1.0 --top-p 0.95 --top-k 64
```

## Key Differences from Qwen Models

| | Gemma 4 26B-A4B | Qwen3-Coder-Next | Qwen3.5-35B-A3B |
|---|---|---|---|
| Vendor | Google | Alibaba | Alibaba |
| Purpose | General + multimodal | Coding specialist | General + reasoning |
| Thinking mode | Yes | **No** | Yes |
| Total params | 26B | 80B | 35B |
| Active params | 3.8B | 3B | 3B |
| Max context | 256K | 256K | 131K |
| Temperature | 1.0 | 1.0 | 0.6 (coding) / 1.0 |
| Top-K | 64 | 40 | 20 |
| Multimodal | Yes (image, audio) | No | No |
| Q8 on 64GB Mac? | Yes (28 GB) | No (86 GB) | Yes (28 GB) |

## Special Considerations

- **Requires llama.cpp build from April 2026+** for full Gemma 4 support (template, tokenizer, softcapping)
- **Use `--jinja` flag** for proper chat template handling
- **No KV cache quantization needed** on 64 GB Mac at Q8 — 27.9 GB model leaves ~21 GB headroom
- **End-of-sequence token:** `<turn|>`
- **Multimodal:** Image and audio inputs supported via mmproj (separate projection model)
