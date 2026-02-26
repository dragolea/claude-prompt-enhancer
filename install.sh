#!/bin/bash
set -e

REPO="https://github.com/dragolea/claude-prompt-enhancer.git"

# Parse flags
PROJECT_INSTALL=false
for arg in "$@"; do
  case "$arg" in
    --project) PROJECT_INSTALL=true ;;
  esac
done

if [ "$PROJECT_INSTALL" = true ]; then
  INSTALL_DIR="$PWD/.claude/skills/enhance"
else
  INSTALL_DIR="$HOME/.claude/skills/enhance"
fi

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

# For project installs, rewrite paths in SKILL.md to use relative paths
if [ "$PROJECT_INSTALL" = true ]; then
  sed -i.bak 's|~/.claude/skills/enhance/scripts/cli.ts|.claude/skills/enhance/scripts/cli.ts|g' "$INSTALL_DIR/SKILL.md"
  rm -f "$INSTALL_DIR/SKILL.md.bak"
fi

# Copy discovery scripts
cp "$SRC_DIR/src/discovery/"*.ts "$INSTALL_DIR/scripts/"

# Copy format-context.ts and fix import path for flat directory structure
cp "$SRC_DIR/src/format-context.ts" "$INSTALL_DIR/scripts/"
sed -i.bak 's|from "./discovery/types"|from "./types"|' "$INSTALL_DIR/scripts/format-context.ts"
rm -f "$INSTALL_DIR/scripts/format-context.ts.bak"

# Copy and run hook setup
cp "$SRC_DIR/src/setup-hook.ts" "$INSTALL_DIR/scripts/"
if [ "$PROJECT_INSTALL" = true ]; then
  SETTINGS_PATH="$PWD/.claude/settings.json"
else
  SETTINGS_PATH="$HOME/.claude/settings.json"
fi
HOOK_ARGS="--settings-path $SETTINGS_PATH --install-dir $INSTALL_DIR"
if [ "$RUNTIME" = "bun" ]; then
  bun "$INSTALL_DIR/scripts/setup-hook.ts" $HOOK_ARGS
else
  node --experimental-strip-types "$INSTALL_DIR/scripts/setup-hook.ts" $HOOK_ARGS
fi

# Cleanup temp dir if we cloned
[ -n "$CLEANUP" ] && rm -rf "$CLEANUP"

if [ "$PROJECT_INSTALL" = true ]; then
  echo "Installed claude-prompt-enhancer to $INSTALL_DIR (project-level)"
else
  echo "Installed claude-prompt-enhancer to $INSTALL_DIR (user-level)"
fi
echo "Runtime: $RUNTIME"
echo "Use /enhance in Claude Code to enhance your prompts."
