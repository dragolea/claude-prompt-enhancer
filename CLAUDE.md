# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A Claude Code skill (`/enhance`) that transforms raw prompts into structured, agent-orchestrated prompts. It discovers available agents, skills, and project context, then enhances prompts with agent assignments, file paths, sequencing, and guards proportional to task complexity.

## Commands

- `bun install` — install dependencies
- `bun test` — run all tests
- `bun test tests/discovery/cache.test.ts` — run a single test file
- `bun test --watch` — run tests in watch mode

## Architecture

There are two copies of SKILL.md:
- `skill/SKILL.md` — the **distributable** version (installed to `~/.claude/skills/enhance/`). References `~/.claude/skills/enhance/scripts/cli.ts`.
- `.claude/skills/enhance/SKILL.md` — the **local dev** version. Both must stay in sync content-wise.

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

### Other Source Files

- **`src/format-context.ts`** — Formats `DiscoveredContext` into human-readable text (grouped agents, skills, project info). Note: the install script rewrites its import path from `./discovery/types` to `./types` for the flat installed layout.
- **`src/setup-hook.ts`** — Adds/removes `SessionStart` hook in `settings.json` for cache pre-warming. Supports both user-level and project-level installs.

### Install/Uninstall

- **`install.sh`** — Clones repo (or uses `LOCAL_REPO` for testing), copies `skill/SKILL.md` + `src/` scripts to install dir, rewrites paths for project-level installs, runs `setup-hook.ts`. Supports `--project` and `--user` flags.
- **`uninstall.sh`** — Removes installed files and cleans up the SessionStart hook.

### Tests (`tests/`)

All tests use `bun:test`. Test files mirror source structure:
- `tests/discovery/` — unit tests for each parser and the full discovery pipeline
- `tests/format-context.test.ts` — formatting output tests
- `tests/install.test.ts` — end-to-end install script test (uses `LOCAL_REPO` env var)

## Key Conventions

- Runtime is **Bun** — use Bun APIs (`Bun.file`, `Bun.write`, `Bun.hash`, `Bun.Glob`) not Node.js equivalents where possible. `cache.ts` is Bun-only; other discovery files use `node:fs` for Node.js compat.
- The discovery scripts must work with both `bun` and `node --experimental-strip-types` since users may have either runtime.
- Zero dependencies — no `node_modules` at runtime. `devDependencies` are only `@types/bun` and `bun-types`.
- When changing the SKILL.md prompt logic, update both `skill/SKILL.md` (distributed) and `.claude/skills/enhance/SKILL.md` (local).
