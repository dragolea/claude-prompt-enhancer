#!/bin/bash
set -e

INSTALL_DIR="$HOME/.claude/skills/enhance"

if [ ! -d "$INSTALL_DIR" ]; then
  echo "claude-prompt-enhancer is not installed." >&2
  exit 0
fi

rm -rf "$INSTALL_DIR"
echo "Uninstalled claude-prompt-enhancer from $INSTALL_DIR"
