# ===============================
#   API Keys
# ===============================
#
# NOTE: the secret-tool lookups below are Fedora-only (libsecret is Linux).
# On macOS use the Keychain instead, e.g.:
#   security add-generic-password -a "$USER" -s neuralwatt -w 'sk-...'
#   export NEURALWATT_API_KEY=$(security find-generic-password -a "$USER" -s neuralwatt -w)

# NeuralWatt — store once with:
#   printf '%s' 'sk-...' | secret-tool store --label='NeuralWatt API key' service neuralwatt user "$USER"
export NEURALWATT_API_KEY=$(secret-tool lookup service neuralwatt user "$USER")

# GitHub — store once with:
#   printf '%s' 'ghp_...' | secret-tool store --label='GitHub PAT' service github user "$USER"
export GITHUB_TOKEN=$(secret-tool lookup service github user "$USER")
export GITHUB_PERSONAL_ACCESS_TOKEN="$GITHUB_TOKEN"  # github-mcp-server expects this name

# DeepSeek — store once with:
#   printf '%s' 'sk-...' | secret-tool store --label='DeepSeek API key' service deepseek user "$USER"
export DEEPSEEK_API_KEY=$(secret-tool lookup service deepseek user "$USER")

# Moonshot (Kimi) — store once with:
#   printf '%s' 'sk-...' | secret-tool store --label='Moonshot API key' service moonshot user "$USER"
export MOONSHOT_API_KEY=$(secret-tool lookup service moonshot user "$USER")

# Xiaomi MiMo — store once with:
#   printf '%s' 'sk-...' | secret-tool store --label='Xiaomi MiMo API key' service mimo user "$USER"
export MIMO_API_KEY=$(secret-tool lookup service mimo user "$USER")

# MiniMax — store once with:
#   printf '%s' 'sk-cp-...' | secret-tool store --label='MiniMax API key' service minimax user "$USER"
export MINIMAX_API_KEY=$(secret-tool lookup service minimax user "$USER")

# Context7 MCP — store once with:
#   printf '%s' 'ctx7sk-...' | secret-tool store --label='Context7 API key' service context7 user "$USER"
export CONTEXT7_API_KEY=$(secret-tool lookup service context7 user "$USER")

# Anthropic / OpenAI / Google: export the real API keys here if you use them.
# pi discovers a provider from its key alone -- do NOT set placeholder values,
# or pi will offer models that fail on every call.

# ===============================
#   llama.cpp
# ===============================

# Recent llama.cpp stores -hf downloads in the standard HuggingFace hub cache
# (~/.cache/huggingface/hub), which is where the macOS box keeps them. Set
# LLAMA_CACHE only if you want them somewhere else, e.g. an external volume:
# export LLAMA_CACHE="$HOME/models"
export PATH="$HOME/llama.cpp/build/bin:$PATH"
export PATH="$HOME/.local/bin:$PATH"   # qwen, pi-qwen launchers (+ mellum on Fedora)

# Local models are driven through pi, not Claude Code aliases.
#   pi-qwen            start llama-server with Qwen3.8-27B if needed, then run pi on it
#   pi-qwen stop       stop the background server (frees ~25 GB)
#   pi-qwen status     show what is on the port
#
# Mellum2 twin - Fedora only, different port so both can run side by side.
# macOS dropped Mellum2 on 2026-09-10 and runs Qwen3.8-27B alone.
alias pi-mellum='PI_LOCAL_LAUNCHER=mellum PI_LOCAL_MODEL=mellum2-12b-a2.5b PI_LOCAL_PORT=8081 pi-qwen'
#
# Fedora also has gemma-moe; to point Claude Code at any local server:
# alias claude-local='ANTHROPIC_BASE_URL=http://localhost:8080/v1 ANTHROPIC_API_KEY=sk-no-key-required claude --model qwen3.8-27b'
