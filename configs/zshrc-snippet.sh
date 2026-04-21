# ===============================
#   llama.cpp
# ===============================

export LLAMA_CACHE="$HOME/models"
export PATH="$HOME/llama.cpp/build/bin:$PATH"
alias claude-qwen='ANTHROPIC_BASE_URL=http://localhost:8080 ANTHROPIC_MODEL=qwen3.6-35b-a3b claude'
alias claude-gemma='ANTHROPIC_BASE_URL=http://localhost:8080 ANTHROPIC_MODEL=gemma-4-26b-a4b claude'
