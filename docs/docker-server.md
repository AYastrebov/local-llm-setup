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

A tiny 350M parameter model from [Liquid AI](https://liquid.ai) designed for edge/on-device deployment. Extremely fast on CPU, uses under 600 MB of RAM.

| Quant | Size | RAM usage (idle) |
|-------|------|-----------------|
| Q8_0 | 379 MB | ~591 MB |
| Q4_K_M | 229 MB | ~400 MB |
| BF16 | 711 MB | ~800 MB |

Good for: log analysis, simple Q&A, Home Assistant NLP, git commit messages, text summarization, structured data extraction.

Not suitable for: complex reasoning, multi-step coding, large context tasks, agentic workflows.

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
      --ctx-size 16384
      --threads 4
    deploy:
      resources:
        limits:
          memory: 2G
        reservations:
          memory: 512M
    restart: unless-stopped
```

## Setup

```bash
mkdir -p ~/services/llama/models

# Download the model (379 MB)
wget -O ~/services/llama/models/LFM2.5-350M-Q8_0.gguf \
  'https://huggingface.co/LiquidAI/LFM2.5-350M-GGUF/resolve/main/LFM2.5-350M-Q8_0.gguf'

# Create .env for API key protection
echo "LLAMA_API_KEY=$(openssl rand -hex 32)" > ~/services/llama/.env
chmod 600 ~/services/llama/.env

# Start
cd ~/services/llama && docker compose up -d
```

## API key

The `LLAMA_API_KEY` env var protects inference endpoints. Clients must send `Authorization: Bearer <key>`. The `/v1/models` endpoint remains open (standard OpenAI API behavior).

## Remote access

Exposed via Cloudflare Tunnel at `https://llama.iastrebov.org/` with Cloudflare Access for browser protection.

## Use cases

### Log summarizer (cron)
```bash
docker logs jellyfin --since 24h 2>&1 | \
  curl -s http://localhost:8080/v1/chat/completions \
    -H "Authorization: Bearer $(cat ~/services/llama/.env | grep LLAMA_API_KEY | cut -d= -f2)" \
    -H "Content-Type: application/json" \
    -d "{\"model\":\"lfm2.5-350m\",\"messages\":[{\"role\":\"user\",\"content\":\"Summarize these logs, highlight errors and warnings:\n$(cat)\"}]}" | \
  jq -r '.choices[0].message.content'
```

### Home Assistant NLP
Parse natural language into structured commands:
```bash
curl http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"lfm2.5-350m","messages":[{"role":"system","content":"Parse the user request into a JSON action: {\"entity\": \"...\", \"action\": \"...\", \"value\": \"...\"}"},{"role":"user","content":"turn off the living room lights in 10 minutes"}]}'
```

### Git commit message
```bash
git diff --staged | curl -s http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d "{\"model\":\"lfm2.5-350m\",\"messages\":[{\"role\":\"user\",\"content\":\"Write a concise git commit message for this diff:\n$(cat)\"}]}" | \
  jq -r '.choices[0].message.content'
```
