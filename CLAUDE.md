# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

An automatic context injection system for Claude Code that bridges the gap between your natural language prompts and Claude Code's multi-agent orchestration capabilities. It silently injects relevant agents and skills as `additionalContext` on every prompt via hooks, so Claude always knows what tools are available — without you having to remember.

Also includes `/enhance` as an explicit prompt enhancement skill, and `/audit` — a skill conflict detection engine that scans installed agents and skills for duplicates, missing frontmatter, contradictory instructions, and other issues.

## Commands

- `bun install` — install dependencies
- `bun test` — run all tests
- `bun test tests/discovery/cache.test.ts` — run a single test file
- `bun test --watch` — run tests in watch mode
- `bun run audit` — run the audit CLI (JSON output)
- `bun run audit -- --human` — run the audit CLI (human-readable output)

## Architecture

### Four subsystems

1. **Discovery** (`src/discovery/`) — Scans `.claude/agents/`, `.claude/skills/`, and `package.json`. Outputs a `DiscoveredContext` JSON blob. Entry point: `cli.ts` → `discover.ts`. Has a stat-fingerprint cache (`cache.ts`) that is **Bun-only**.

2. **Injection hooks** (`src/injection/`) — The core of the project. Two Claude Code hooks that silently inject context:
   - `user-prompt-hook.ts` — `UserPromptSubmit` hook. Runs discovery → intent detection → relevance matching → outputs `additionalContext`.
   - `agent-tool-hook.ts` — `PreToolUse` hook (matches `Agent` tool). Intercepts subagent spawning, applies a 3-check filter (agent already has skill? → skill relevant to prompt? → skill adds value beyond agent's knowledge?), injects relevant skills.

3. **Audit** (`src/audit/`) — Imports from discovery (reuses parsers, types) and adds analysis. Each rule in `rules/` is a pure function: `(AuditInventory) => AuditFinding[]`. Entry point: `cli.ts` → `analyze.ts`.

4. **Shared** (`src/shared/`) — Modules used by both injection and audit: Jaccard similarity, intent detection, stack detection, relevance matching.

### Hook I/O protocol

Both hooks follow the same pattern — this is critical to understand when working on injection:

- **Input**: JSON on stdin from Claude Code. Structure differs per hook type:
  - `UserPromptSubmit`: `{ input: { prompt }, cwd }`
  - `PreToolUse` (Agent): `{ tool_input: { subagent_type, prompt }, cwd }`
- **Output**: Plain text on stdout becomes `additionalContext` (injected into Claude's context). Stderr is CLI feedback shown to the user.
- **Failure mode**: Silent. Hooks must never block the user's prompt — all errors go to stderr.

### Dual SKILL.md copies

There are two copies of each SKILL.md that must stay in sync:
- `skill/SKILL.md` + `skill/AUDIT-SKILL.md` — **distributable** versions (installed to `~/.claude/skills/`)
- `.claude/skills/enhance/SKILL.md` + `.claude/skills/audit/SKILL.md` — **local dev** versions

### Install path rewriting

The install script (`install.sh`) copies `src/` files to a flat `scripts/` directory. It rewrites import paths (e.g., `./discovery/types` → `./types`) for the installed layout. This means source imports use the nested structure but installed files are flat.

## Key Conventions

- **Dual runtime**: Discovery scripts must work with both `bun` and `node --experimental-strip-types` since users may have either. `cache.ts` is the exception — it's Bun-only (`Bun.Glob`, `Bun.hash`). Other discovery files use `node:fs`.
- **Zero dependencies**: No `node_modules` at runtime. `devDependencies` are only `@types/bun` and `bun-types`.
- **Bun APIs preferred**: Use `Bun.file`, `Bun.write`, `Bun.hash`, `Bun.Glob` over Node.js equivalents where possible (except in files that must also run under Node).
- **SKILL.md sync**: When changing SKILL.md prompt logic, update both distributed (`skill/`) and local dev (`.claude/skills/`) versions.
- **Audit rules are pure**: Each takes `AuditInventory` and returns `AuditFinding[]`. No side effects.
- **Tests**: All tests use `bun:test`. Test files mirror source structure under `tests/`.
