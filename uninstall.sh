#!/bin/bash
set -e

INSTALL_DIR="$HOME/.claude/skills/enhance"

if [ ! -d "$INSTALL_DIR" ]; then
  echo "claude-prompt-enhancer is not installed." >&2
  exit 0
fi

# Remove SessionStart hook from settings.json
SETUP_HOOK="$INSTALL_DIR/scripts/setup-hook.ts"
if [ -f "$SETUP_HOOK" ]; then
  if command -v bun &>/dev/null; then
    bun "$SETUP_HOOK" --remove 2>/dev/null || true
  elif command -v node &>/dev/null; then
    node --experimental-strip-types "$SETUP_HOOK" --remove 2>/dev/null || true
  fi
fi

rm -rf "$INSTALL_DIR"
echo "Uninstalled claude-prompt-enhancer from $INSTALL_DIR"
