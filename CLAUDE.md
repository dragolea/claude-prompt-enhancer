# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A Claude Code skill (`/enhance`) that transforms raw prompts into structured, agent-orchestrated prompts. It discovers available agents, skills, and project context, then enhances prompts with agent assignments, file paths, sequencing, and guards proportional to task complexity.

Also includes `/audit` — a skill conflict detection engine that scans installed agents and skills for duplicates, missing frontmatter, contradictory instructions, and other issues. Exposed as both a CLI (`bun src/audit/cli.ts`) and an `/audit` skill.

## Commands

- `bun install` — install dependencies
- `bun test` — run all tests
- `bun test tests/discovery/cache.test.ts` — run a single test file
- `bun test --watch` — run tests in watch mode
- `bun run audit` — run the audit CLI (JSON output)
- `bun run audit -- --human` — run the audit CLI (human-readable output)

## Architecture

There are two copies of each SKILL.md:
- `skill/SKILL.md` + `skill/AUDIT-SKILL.md` — the **distributable** versions (installed to `~/.claude/skills/enhance/` and `~/.claude/skills/audit/`).
- `.claude/skills/enhance/SKILL.md` + `.claude/skills/audit/SKILL.md` — the **local dev** versions. Each pair must stay in sync content-wise.

### Discovery Pipeline (`src/discovery/`)

The core runtime invoked by the SKILL.md bash command. Scans the user's `.claude/` directory and `package.json`, outputs JSON:

1. **`cli.ts`** — Entry point. Checks cache, runs discovery if stale, writes cache, prints JSON.
2. **`discover.ts`** — Orchestrator. Walks `.claude/agents/` and `.claude/skills/`, calls parsers, applies `excludeAgents` filter from config.
3. **`parse-agent.ts`** — Parses agent `.md` frontmatter (name, description, category from parent dir).
4. **`parse-skill.ts`** — Parses `SKILL.md` frontmatter (name, description).
5. **`parse-project.ts`** — Extracts test/lint commands, framework, and language from `package.json`.
6. **`load-config.ts`** — Reads optional `.claude/enhancer-config.json` (aliases, guards, conventions, excludeAgents).
7. **`cache.ts`** — Stat-fingerprint cache using `Bun.Glob` + `Bun.hash`. Invalidates when any `.md` file or `package.json` changes. Stored at `.claude/.cache/discovery-cache.json`.
8. **`types.ts`** — Shared interfaces: `AgentInfo`, `SkillInfo`, `ProjectInfo`, `EnhancerConfig`, `DiscoveredContext`.

### Audit Engine (`src/audit/`)

Skill conflict detection that **imports from** discovery (reuses parsers, types) and adds analysis on top. Never modifies discovery files.

1. **`cli.ts`** — Entry point for `claude-discover` / `bun run audit`. Args: `[project-path]`, `--human`. JSON by default. Exit code 1 on errors.
2. **`discover-for-audit.ts`** — Parallel to `discover.ts` but returns `AuditInventory` without `excludeAgents` filtering.
3. **`parse-for-audit.ts`** — Wrappers around `parseAgentFile`/`parseSkillFile` that preserve `filePath`, `body`, `hasFrontmatter`.
4. **`analyze.ts`** — Orchestrator: runs all rules, sorts findings by severity, returns `AuditReport`.
5. **`format-report.ts`** — Human-readable output formatter (INVENTORY + FINDINGS sections).
6. **`types.ts`** — `AuditFinding`, `AuditReport`, `Severity`, `RuleId`, `AuditInventory`.
7. **`rules/`** — Each rule is a pure function `(inventory: AuditInventory) => AuditFinding[]`:
   - `duplicate-names.ts` — Same name across agents or skills (error)
   - `missing-frontmatter.ts` — `.md` files without valid frontmatter (warn)
   - `excluded-agent-refs.ts` — Skill references agent that config excludes (warn)
   - `overlapping-descriptions.ts` — Skills with similar descriptions via Jaccard similarity (info)
   - `cross-category-collisions.ts` — Same agent name in different category dirs (warn)
   - `missing-skill-deps.ts` — Skill body references `/skill` that isn't installed (warn)
   - `contradictory-instructions.ts` — "always X" vs "never X" across skills (info)

### Other Source Files

- **`src/format-context.ts`** — Formats `DiscoveredContext` into human-readable text (grouped agents, skills, project info). Note: the install script rewrites its import path from `./discovery/types` to `./types` for the flat installed layout.
- **`src/setup-hook.ts`** — Adds/removes `SessionStart` hook in `settings.json` for cache pre-warming. Supports both user-level and project-level installs.

### Install/Uninstall

- **`install.sh`** — Clones repo (or uses `LOCAL_REPO` for testing), copies `skill/SKILL.md` + `skill/AUDIT-SKILL.md` + `src/` scripts to install dirs, rewrites paths for project-level installs, runs `setup-hook.ts`. Supports `--project` and `--user` flags.
- **`uninstall.sh`** — Removes installed files (both enhance and audit) and cleans up the SessionStart hook.

### Tests (`tests/`)

All tests use `bun:test`. Test files mirror source structure:
- `tests/discovery/` — unit tests for each parser and the full discovery pipeline
- `tests/audit/` — unit tests for audit rules, analyzer, CLI, and formatter
- `tests/format-context.test.ts` — formatting output tests
- `tests/install.test.ts` — end-to-end install script test (uses `LOCAL_REPO` env var)

## Key Conventions

- Runtime is **Bun** — use Bun APIs (`Bun.file`, `Bun.write`, `Bun.hash`, `Bun.Glob`) not Node.js equivalents where possible. `cache.ts` is Bun-only; other discovery files use `node:fs` for Node.js compat.
- The discovery scripts must work with both `bun` and `node --experimental-strip-types` since users may have either runtime.
- Zero dependencies — no `node_modules` at runtime. `devDependencies` are only `@types/bun` and `bun-types`.
- When changing SKILL.md prompt logic, update both distributed (`skill/`) and local dev (`.claude/skills/`) versions.
- Audit rules are pure functions — each takes `AuditInventory` and returns `AuditFinding[]`. No side effects.
