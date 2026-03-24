#!/bin/bash
set -e

REPO="https://github.com/dragolea/claude-prompt-enhancer.git"

# Parse flags
PROJECT_INSTALL=false
EXPLICIT_LEVEL=false
for arg in "$@"; do
  case "$arg" in
    --project) PROJECT_INSTALL=true; EXPLICIT_LEVEL=true ;;
    --user) PROJECT_INSTALL=false; EXPLICIT_LEVEL=true ;;
  esac
done

# If no explicit level flag, ask the user interactively
if [ "$EXPLICIT_LEVEL" = false ]; then
  echo ""
  echo "Where would you like to install?"
  echo "  1) User-level (~/.claude/skills/) — available in all your projects"
  echo "  2) Project-level (./.claude/skills/) — scoped to current project, shareable via git"
  echo ""
  choice=""
  if [ -e /dev/tty ]; then
    printf "Choose [1/2] (default: 1): "
    read -r choice < /dev/tty 2>/dev/null || true
  fi
  case "$choice" in
    2) PROJECT_INSTALL=true ;;
    *) PROJECT_INSTALL=false ;;
  esac
fi

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

# Create install directories
mkdir -p "$INSTALL_DIR/scripts"

# Derive audit install dir from enhance install dir
if [ "$PROJECT_INSTALL" = true ]; then
  AUDIT_INSTALL_DIR="$PWD/.claude/skills/audit"
else
  AUDIT_INSTALL_DIR="$HOME/.claude/skills/audit"
fi
mkdir -p "$AUDIT_INSTALL_DIR/scripts"

# Copy skill definition (distributed version)
cp "$SRC_DIR/skill/SKILL.md" "$INSTALL_DIR/SKILL.md"

# Copy audit skill definition
cp "$SRC_DIR/skill/AUDIT-SKILL.md" "$AUDIT_INSTALL_DIR/SKILL.md"

# For project installs, rewrite paths in SKILL.md to use relative paths
if [ "$PROJECT_INSTALL" = true ]; then
  sed -i.bak 's|~/.claude/skills/enhance/scripts/cli.ts|.claude/skills/enhance/scripts/cli.ts|g' "$INSTALL_DIR/SKILL.md"
  rm -f "$INSTALL_DIR/SKILL.md.bak"
  sed -i.bak 's|~/.claude/skills/audit/scripts/cli.ts|.claude/skills/audit/scripts/cli.ts|g' "$AUDIT_INSTALL_DIR/SKILL.md"
  rm -f "$AUDIT_INSTALL_DIR/SKILL.md.bak"
fi

# Copy discovery scripts
cp "$SRC_DIR/src/discovery/"*.ts "$INSTALL_DIR/scripts/"

# Copy shared modules
cp "$SRC_DIR/src/shared/"*.ts "$INSTALL_DIR/scripts/"

# Copy injection scripts
cp "$SRC_DIR/src/injection/"*.ts "$INSTALL_DIR/scripts/"

# Copy audit scripts (source files + rules)
cp "$SRC_DIR/src/audit/"*.ts "$AUDIT_INSTALL_DIR/scripts/"
mkdir -p "$AUDIT_INSTALL_DIR/scripts/rules"
cp "$SRC_DIR/src/audit/rules/"*.ts "$AUDIT_INSTALL_DIR/scripts/rules/"

# Fix audit import paths for flat installed layout
# Audit scripts reference ../discovery/* which needs to point to the enhance scripts dir
if [ "$PROJECT_INSTALL" = true ]; then
  ENHANCE_SCRIPTS=".claude/skills/enhance/scripts"
else
  ENHANCE_SCRIPTS="~/.claude/skills/enhance/scripts"
fi
for f in "$AUDIT_INSTALL_DIR/scripts/"*.ts; do
  sed -i.bak "s|from \"../discovery/|from \"$ENHANCE_SCRIPTS/|" "$f"
  rm -f "$f.bak"
done
# Fix the types import in rules/ (they reference ../types which is now in parent scripts dir)
for f in "$AUDIT_INSTALL_DIR/scripts/rules/"*.ts; do
  sed -i.bak 's|from "../types"|from "../types"|' "$f"
  rm -f "$f.bak"
done
# Fix audit rules that import from shared (overlapping-descriptions.ts)
for f in "$AUDIT_INSTALL_DIR/scripts/rules/"*.ts; do
  sed -i.bak "s|from \"../../shared/|from \"$ENHANCE_SCRIPTS/|" "$f"
  rm -f "$f.bak"
done

# Copy format-context.ts and fix import path for flat directory structure
cp "$SRC_DIR/src/format-context.ts" "$INSTALL_DIR/scripts/"
sed -i.bak 's|from "./discovery/types"|from "./types"|' "$INSTALL_DIR/scripts/format-context.ts"
rm -f "$INSTALL_DIR/scripts/format-context.ts.bak"

# Rewrite shared module imports for flat layout
sed -i.bak 's|from "../discovery/types"|from "./types"|' "$INSTALL_DIR/scripts/relevance.ts"
rm -f "$INSTALL_DIR/scripts/relevance.ts.bak"

# Rewrite injection script imports for flat layout
for f in "$INSTALL_DIR/scripts/user-prompt-hook.ts" \
         "$INSTALL_DIR/scripts/agent-tool-hook.ts"; do
  sed -i.bak 's|from "../discovery/|from "./|g' "$f"
  sed -i.bak 's|from "../shared/|from "./|g' "$f"
  rm -f "$f.bak"
done
for f in "$INSTALL_DIR/scripts/format-context-injection.ts" \
         "$INSTALL_DIR/scripts/format-stderr.ts"; do
  sed -i.bak 's|from "../discovery/|from "./|g' "$f"
  rm -f "$f.bak"
done
sed -i.bak 's|from "../shared/|from "./|g' "$INSTALL_DIR/scripts/skill-adds-value.ts"
rm -f "$INSTALL_DIR/scripts/skill-adds-value.ts.bak"

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

# Add runtime artifacts to .gitignore for project-level installs
if [ "$PROJECT_INSTALL" = true ]; then
  GITIGNORE="$PWD/.gitignore"
  ENTRIES=(".claude/session.json" ".claude/.cache/")
  for entry in "${ENTRIES[@]}"; do
    if [ ! -f "$GITIGNORE" ] || ! grep -qxF "$entry" "$GITIGNORE"; then
      echo "$entry" >> "$GITIGNORE"
    fi
  done
fi

# Cleanup temp dir if we cloned
[ -n "$CLEANUP" ] && rm -rf "$CLEANUP"

if [ "$PROJECT_INSTALL" = true ]; then
  echo "Installed claude-prompt-enhancer to $INSTALL_DIR (project-level)"
else
  echo "Installed claude-prompt-enhancer to $INSTALL_DIR (user-level)"
fi
echo "Runtime: $RUNTIME"
echo "Auto context injection is now active via hooks."
echo "Use /enhance for explicit prompt enhancement."
echo "Use /audit to check for skill and agent conflicts."
