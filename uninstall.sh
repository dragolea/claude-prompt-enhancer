#!/bin/bash
set -e

# Parse flags
PROJECT_INSTALL=false
for arg in "$@"; do
  case "$arg" in
    --project) PROJECT_INSTALL=true ;;
  esac
done

if [ "$PROJECT_INSTALL" = true ]; then
  INSTALL_DIR="$PWD/.claude/skills/enhance"
  SETTINGS_PATH="$PWD/.claude/settings.json"
else
  INSTALL_DIR="$HOME/.claude/skills/enhance"
  SETTINGS_PATH="$HOME/.claude/settings.json"
fi

if [ ! -d "$INSTALL_DIR" ]; then
  echo "claude-prompt-enhancer is not installed." >&2
  exit 0
fi

# Remove SessionStart hook from settings.json
SETUP_HOOK="$INSTALL_DIR/scripts/setup-hook.ts"
HOOK_ARGS="--settings-path $SETTINGS_PATH --install-dir $INSTALL_DIR"
if [ -f "$SETUP_HOOK" ]; then
  if command -v bun &>/dev/null; then
    bun "$SETUP_HOOK" --remove $HOOK_ARGS 2>/dev/null || true
  elif command -v node &>/dev/null; then
    node --experimental-strip-types "$SETUP_HOOK" --remove $HOOK_ARGS 2>/dev/null || true
  fi
fi

rm -rf "$INSTALL_DIR"
echo "Uninstalled claude-prompt-enhancer from $INSTALL_DIR"
