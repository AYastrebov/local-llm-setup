# ===============================
#   API Keys
# ===============================

# NeuralWatt — store once with:
#   printf '%s' 'sk-...' | secret-tool store --label='NeuralWatt API key' service neuralwatt user "$USER"
export NEURALWATT_API_KEY=$(secret-tool lookup service neuralwatt user "$USER")

# GitHub — store once with:
#   printf '%s' 'ghp_...' | secret-tool store --label='GitHub PAT' service github user "$USER"
export GITHUB_TOKEN=$(secret-tool lookup service github user "$USER")
export GITHUB_PERSONAL_ACCESS_TOKEN="$GITHUB_TOKEN"  # github-mcp-server expects this name

# ===============================
#   llama.cpp
# ===============================

export LLAMA_CACHE="$HOME/models"
export PATH="$HOME/llama.cpp/build/bin:$PATH"

# Claude Code with local models
# Start the server first (gemma-moe or qwen-mtp), then run the alias
alias claude-qwen='ANTHROPIC_BASE_URL=http://localhost:8080/v1 ANTHROPIC_API_KEY=sk-no-key-required claude --model qwen3.6-27b'
alias claude-gemma='ANTHROPIC_BASE_URL=http://localhost:8080/v1 ANTHROPIC_API_KEY=sk-no-key-required claude --model gemma-4-26b-a4b'
