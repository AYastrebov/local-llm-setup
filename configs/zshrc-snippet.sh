# ===============================
#   llama.cpp
# ===============================

export LLAMA_CACHE="$HOME/models"
export PATH="$HOME/llama.cpp/build/bin:$PATH"
alias claude-local='ANTHROPIC_BASE_URL=http://localhost:8080 ANTHROPIC_MODEL=qwen3.5-9b claude'
alias claude-local-moe='ANTHROPIC_BASE_URL=http://localhost:8080 ANTHROPIC_MODEL=qwen3.5-35b-a3b claude'
