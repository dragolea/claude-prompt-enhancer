---
name: audit
description: "Audit your installed agents and skills for conflicts, missing frontmatter, duplicate names, and other issues. Usage: /audit [project-path]"
---

# Audit Installed Agents & Skills

Detect conflicts, duplicates, and issues across your installed Claude Code agents and skills.

## Step 1: Run Discovery Audit

```bash
bun ~/.claude/skills/audit/scripts/cli.ts --human
```

If `bun` is not available, fall back to:
```bash
node --experimental-strip-types ~/.claude/skills/audit/scripts/cli.ts --human
```

## Step 2: Present Results

Read the audit output carefully. Present the findings to the user organized by severity:

1. **Errors** (must fix): Duplicate names, broken references
2. **Warnings** (should fix): Missing frontmatter, excluded agent references, cross-category collisions
3. **Info** (consider): Overlapping descriptions, potentially contradictory instructions

For each finding:
- Explain **why** it's a problem
- Show the **files** involved
- Suggest a **concrete fix**

## Step 3: Offer to Fix

For actionable findings (duplicate names, missing frontmatter), offer to apply fixes directly:

- Rename duplicates by adding a category prefix (e.g., `debugger` → `perf-debugger`)
- Add missing frontmatter blocks with sensible defaults derived from filename and directory

Ask the user before making any changes.
