# ===============================
#   llama.cpp
# ===============================

export LLAMA_CACHE="$HOME/models"
export PATH="$HOME/llama.cpp/build/bin:$PATH"

# Claude Code with local models
# Start the server first (gemma-moe or qwen-moe), then run the alias
alias claude-qwen='ANTHROPIC_BASE_URL=http://localhost:8080/v1 ANTHROPIC_API_KEY=sk-no-key-required claude --model qwen3.6-35b-a3b'
alias claude-gemma='ANTHROPIC_BASE_URL=http://localhost:8080/v1 ANTHROPIC_API_KEY=sk-no-key-required claude --model gemma-4-26b-a4b'
