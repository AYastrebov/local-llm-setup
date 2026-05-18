# Docker Server Setup (CPU-only, Home Server)

Lightweight LLM inference on a headless home server using Docker, no GPU required.

## Hardware

| Component | Spec |
|-----------|------|
| CPU | Intel Core i3-6100T (2 cores, 4 threads, 3.2 GHz) |
| RAM | 24 GB |
| GPU | None (Intel HD 530 — not used for inference) |
| Disk | 107 GB SSD |
| OS | Ubuntu 24.04 LTS |
| Docker | 29.4.1 |

## Model: LiquidAI LFM2.5-350M

A 350M parameter hybrid model from [Liquid AI](https://liquid.ai) designed for on-device deployment. Uses a novel architecture mixing LIV convolution blocks with grouped query attention (16 layers total). Instruction-tuned on 28T tokens. Supports 32K context.

- Architecture: 10 LIV convolution blocks + 6 GQA blocks, 65K vocabulary
- Context window: 32,768 tokens
- Strengths: data extraction, structured outputs, tool/function calling
- Not suited for: knowledge-intensive tasks, programming

See [LiquidAI/LFM2.5-350M](https://huggingface.co/LiquidAI/LFM2.5-350M) and [Liquid AI llama.cpp docs](https://docs.liquid.ai/deployment/on-device/llama-cpp).

| Quant | Size | RAM usage (idle) | Notes |
|-------|------|-----------------|-------|
| Q4_K_M | 229 MB | ~400 MB | Recommended balance (per Liquid AI docs) |
| Q8_0 | 379 MB | ~591 MB | Best quality |
| BF16 | 711 MB | ~800 MB | Full precision |

## Docker Compose

```yaml
# ~/services/llama/docker-compose.yml
services:
  llama:
    image: ghcr.io/ggml-org/llama.cpp:server
    container_name: llama
    ports:
      - 8080:8080
    volumes:
      - ./models:/models
    env_file:
      - .env
    command: >
      --model /models/LFM2.5-350M-Q8_0.gguf
      --host 0.0.0.0
      --port 8080
      --alias lfm2.5-350m
      --jinja
      --ctx-size 4096
      --threads 4
    deploy:
      resources:
        limits:
          memory: 2G
        reservations:
          memory: 512M
    restart: unless-stopped
```

Notes:
- `--ctx-size 4096` — recommended by Liquid AI docs. The model supports up to 32K but 4K is sufficient for most automation tasks and keeps memory low.
- `--threads 4` — match your CPU thread count.
- `--jinja` — enables the model's native chat template.
- Model file is from [LiquidAI/LFM2.5-350M-GGUF](https://huggingface.co/LiquidAI/LFM2.5-350M-GGUF) (this is the instruction-tuned variant, not the base model).

## Setup

```bash
mkdir -p ~/services/llama/models

# Download the model (379 MB for Q8, or 229 MB for Q4_K_M)
wget -O ~/services/llama/models/LFM2.5-350M-Q8_0.gguf \
  'https://huggingface.co/LiquidAI/LFM2.5-350M-GGUF/resolve/main/LFM2.5-350M-Q8_0.gguf'

# Create .env for API key protection
echo "LLAMA_API_KEY=$(openssl rand -hex 32)" > ~/services/llama/.env
chmod 600 ~/services/llama/.env

# Start
cd ~/services/llama && docker compose up -d
```

## API key

The `LLAMA_API_KEY` env var protects inference endpoints (`/v1/chat/completions`, `/v1/completions`). Clients must send `Authorization: Bearer <key>`. The `/v1/models` endpoint remains open (standard OpenAI API behavior).

## Remote access

Exposed via Cloudflare Tunnel at `https://llama.iastrebov.org/` with Cloudflare Access for browser UI protection.

## Larger model alternative

If you have more RAM or want better quality, consider [LFM2.5-1.2B-Instruct](https://huggingface.co/LiquidAI/LFM2.5-1.2B-Instruct-GGUF) (~1.3 GB at Q8). Same architecture, stronger at reasoning tasks. Adjust `--ctx-size` and memory limits accordingly.

## Use cases

### Log summarizer (cron)
```bash
docker logs jellyfin --since 24h 2>&1 | \
  curl -s http://localhost:8080/v1/chat/completions \
    -H "Authorization: Bearer $(grep LLAMA_API_KEY ~/services/llama/.env | cut -d= -f2)" \
    -H "Content-Type: application/json" \
    -d "{\"model\":\"lfm2.5-350m\",\"messages\":[{\"role\":\"user\",\"content\":\"Summarize these logs, highlight errors and warnings:\n$(cat)\"}]}" | \
  jq -r '.choices[0].message.content'
```

### Home Assistant NLP
Parse natural language into structured commands:
```bash
curl http://localhost:8080/v1/chat/completions \
  -H "Authorization: Bearer $LLAMA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"lfm2.5-350m","messages":[
    {"role":"system","content":"Extract a JSON action from the user request: {\"entity\": \"...\", \"action\": \"...\", \"value\": \"...\"}"},
    {"role":"user","content":"turn off the living room lights in 10 minutes"}
  ]}'
```

### Git commit message
```bash
git diff --staged | curl -s http://localhost:8080/v1/chat/completions \
  -H "Authorization: Bearer $LLAMA_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"model\":\"lfm2.5-350m\",\"messages\":[{\"role\":\"user\",\"content\":\"Write a concise git commit message for this diff:\n$(cat)\"}]}" | \
  jq -r '.choices[0].message.content'
```

### Watchtower update digest
```bash
docker logs watchtower --since 24h 2>&1 | \
  curl -s http://localhost:8080/v1/chat/completions \
    -H "Authorization: Bearer $LLAMA_API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"model\":\"lfm2.5-350m\",\"messages\":[{\"role\":\"user\",\"content\":\"Summarize which Docker containers were updated and to what versions:\n$(cat)\"}]}" | \
  jq -r '.choices[0].message.content'
```
