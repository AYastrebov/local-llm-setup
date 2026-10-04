#!/usr/bin/env bash
# Install pi skills: this repo's own (plan, implement, grill-me) plus vetted
# third-party skills fetched from upstream (not vendored here).
set -euo pipefail
DEST="${PI_SKILLS_DIR:-$HOME/.pi/agent/skills}"
HERE="$(cd "$(dirname "$0")" && pwd)"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
mkdir -p "$DEST"

cp -r "$HERE/skills/plan" "$HERE/skills/implement" "$HERE/skills/grill-me" "$HERE/skills/rust" "$HERE/skills/go" "$HERE/skills/frontend-checks" "$DEST/"

# go: keep the hand-written header, refresh the body from the installed gopls.
if command -v gopls >/dev/null 2>&1; then
  sed -n '1,/^# The gopls MCP server$/p' "$HERE/skills/go/SKILL.md" | sed '$d' > "$DEST/go/SKILL.md"
  gopls mcp -instructions >> "$DEST/go/SKILL.md"
fi

clone() { git clone -q --depth 1 "https://github.com/$1.git" "$TMP/$2"; }
clone anthropics/skills anthropic
clone mattpocock/skills matt
clone blader/humanizer humanizer
clone sveltejs/ai-tools svelte
clone vuejs-ai/skills vue

install_skill() { rm -rf "$DEST/$(basename "$1")"; cp -r "$1" "$DEST/"; }
install_skill "$TMP/anthropic/skills/frontend-design"
install_skill "$TMP/matt/skills/engineering/tdd"
install_skill "$TMP/matt/skills/engineering/diagnosing-bugs"
install_skill "$TMP/matt/skills/productivity/writing-for-agents"
for s in svelte-code-writer svelte-core-bestpractices; do install_skill "$TMP/svelte/tools/skills/$s"; done
for s in vue-best-practices vue-pinia-best-practices vue-router-best-practices vue-testing-best-practices; do install_skill "$TMP/vue/skills/$s"; done
rm -rf "$DEST/writing-for-agents/agents"
rm -rf "$DEST/humanizer" && mkdir -p "$DEST/humanizer" && cp "$TMP/humanizer/SKILL.md" "$TMP/humanizer/LICENSE" "$DEST/humanizer/"

ls "$DEST"
