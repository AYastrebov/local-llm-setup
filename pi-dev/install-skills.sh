#!/usr/bin/env bash
# Install pi skills: this repo's own (plan, implement, grill-me) plus vetted
# third-party skills fetched from upstream (not vendored here).
set -euo pipefail
DEST="${PI_SKILLS_DIR:-$HOME/.pi/agent/skills}"
HERE="$(cd "$(dirname "$0")" && pwd)"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
mkdir -p "$DEST"

cp -r "$HERE/skills/plan" "$HERE/skills/implement" "$HERE/skills/grill-me" "$DEST/"

clone() { git clone -q --depth 1 "https://github.com/$1.git" "$TMP/$2"; }
clone anthropics/skills anthropic
clone mattpocock/skills matt
clone blader/humanizer humanizer

install_skill() { rm -rf "$DEST/$(basename "$1")"; cp -r "$1" "$DEST/"; }
install_skill "$TMP/anthropic/skills/frontend-design"
install_skill "$TMP/matt/skills/engineering/tdd"
install_skill "$TMP/matt/skills/engineering/diagnosing-bugs"
install_skill "$TMP/matt/skills/productivity/writing-for-agents"
rm -rf "$DEST/writing-for-agents/agents"
rm -rf "$DEST/humanizer" && mkdir -p "$DEST/humanizer" && cp "$TMP/humanizer/SKILL.md" "$TMP/humanizer/LICENSE" "$DEST/humanizer/"

ls "$DEST"
