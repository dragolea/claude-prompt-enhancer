#!/bin/bash
set -e

REPO="https://github.com/dragolea/claude-prompt-enhancer.git"
INSTALL_DIR="$HOME/.claude/skills/enhance"

echo "Installing claude-prompt-enhancer..."

# Check for bun or node
if command -v bun &>/dev/null; then
  RUNTIME="bun"
elif command -v node &>/dev/null; then
  RUNTIME="node"
else
  echo "Error: bun or node is required but neither is installed." >&2
  echo "Install bun: curl -fsSL https://bun.sh/install | bash" >&2
  exit 1
fi

# Use LOCAL_REPO if set (for testing), otherwise clone from GitHub
if [ -n "$LOCAL_REPO" ]; then
  SRC_DIR="$LOCAL_REPO"
  CLEANUP=""
else
  if ! command -v git &>/dev/null; then
    echo "Error: git is required but not installed." >&2
    exit 1
  fi
  TMP=$(mktemp -d)
  CLEANUP="$TMP"
  git clone --depth 1 --quiet "$REPO" "$TMP/claude-prompt-enhancer"
  SRC_DIR="$TMP/claude-prompt-enhancer"
fi

# Create install directory
mkdir -p "$INSTALL_DIR/scripts"

# Copy skill definition (distributed version)
cp "$SRC_DIR/skill/SKILL.md" "$INSTALL_DIR/SKILL.md"

# Copy discovery scripts
cp "$SRC_DIR/src/discovery/"*.ts "$INSTALL_DIR/scripts/"

# Copy format-context.ts and fix import path for flat directory structure
cp "$SRC_DIR/src/format-context.ts" "$INSTALL_DIR/scripts/"
sed -i.bak 's|from "./discovery/types"|from "./types"|' "$INSTALL_DIR/scripts/format-context.ts"
rm -f "$INSTALL_DIR/scripts/format-context.ts.bak"

# Copy and run hook setup
cp "$SRC_DIR/src/setup-hook.ts" "$INSTALL_DIR/scripts/"
if [ "$RUNTIME" = "bun" ]; then
  bun "$INSTALL_DIR/scripts/setup-hook.ts"
else
  node --experimental-strip-types "$INSTALL_DIR/scripts/setup-hook.ts"
fi

# Cleanup temp dir if we cloned
[ -n "$CLEANUP" ] && rm -rf "$CLEANUP"

echo "Installed claude-prompt-enhancer to $INSTALL_DIR"
echo "Runtime: $RUNTIME"
echo "Use /enhance in Claude Code to enhance your prompts."
