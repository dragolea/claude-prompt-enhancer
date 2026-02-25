# Claude Prompt Enhancer — Design Document

**Date:** 2026-02-25
**Status:** Approved

## Problem

Writing effective prompts for Claude Code that leverage available skills and subagents requires knowing what's available and how to orchestrate them. Users write simple prompts like "fix the login bug" when they could get much better results with structured prompts that reference specific agents, include file paths, define execution order, and add verification guards.

## Solution

A Claude Code **skill** (`/enhance`) that transforms raw user prompts into structured, agent-orchestrated prompts using dynamic discovery of available skills and agents.

## References

- [Augment Code Prompt Enhancer](https://docs.augmentcode.com/cli/interactive/prompt-enhancer) — Ctrl+P trigger, codebase-aware enhancement, review-before-send UX
- [severity1/claude-code-prompt-improver](https://github.com/severity1/claude-code-prompt-improver) — UserPromptSubmit hook, skill-based clarity evaluation

## User Flow

```
User types:  /enhance fix the login component
                        |
Skill activates, reads "fix the login component"
                        |
Auto-discovers: agents from .claude/agents/
                skills from .claude/skills/
                project conventions from config files
                        |
Enhances prompt using Claude's context:
  - Identifies relevant agents (@Debugger, @ReactSpecialist)
  - Adds file paths (src/components/Login.tsx)
  - Adds sequencing & guards
  - Pulls in project conventions
                        |
Shows diff view:
  Original: fix the login component
  Enhanced: @Debugger: Investigate the login component at
            src/components/Login.tsx. Check for state management
            issues. @ReactSpecialist: Fix the identified issue,
            ensure existing Vitest tests pass. Run npm test after.
                        |
  [Accept] [Edit] [Reject]
                        |
Accept -> submits enhanced prompt to Claude
Edit -> user modifies, then submits
Reject -> discards, returns to normal input
```

## Architecture

### Trigger

`/enhance <raw prompt>` — a Claude Code slash command skill.

### Language

TypeScript/Bun

### Skill Structure

```
.claude/skills/prompt-enhancer/
  SKILL.md          # Skill definition + enhancement instructions + prompt template
  discovery.ts      # Auto-discovers skills, agents, conventions
  enhancer-config.json (optional, user-created)
```

### Components

#### SKILL.md — Skill Definition

Contains:
- Skill metadata (name, trigger, description)
- Enhancement instructions for Claude
- Prompt template with placeholders for discovered context
- Diff output format specification
- Accept/Edit/Reject flow instructions

#### discovery.ts — Context Discovery

Scans at runtime:
- `.claude/skills/*/SKILL.md` — extracts skill names, descriptions, trigger conditions
- `.claude/agents/*.md` — extracts agent names and capabilities
- `CLAUDE.md` / `.claude/CLAUDE.md` — extracts any agent/skill references
- `package.json` — test scripts, frameworks, dependencies
- `tsconfig.json`, `.eslintrc`, etc. — project conventions

Outputs a structured context object:
```typescript
interface DiscoveredContext {
  agents: { name: string; description: string; capabilities: string[] }[]
  skills: { name: string; description: string; triggers: string[] }[]
  project: {
    testCommand: string
    lintCommand: string
    framework: string
    language: string
    conventions: string[]
  }
  config: EnhancerConfig | null  // from optional enhancer-config.json
}
```

#### enhancer-config.json — Optional Overrides

```json
{
  "aliases": { "@FE": "@react-specialist", "@BE": "@fullstack-developer" },
  "defaultGuards": ["Run tests after each change", "Lint after file modifications"],
  "conventions": ["Always use Vitest, not Jest", "Prefer functional components"],
  "excludeAgents": ["mobile-developer"]
}
```

## Enhancement Strategy

The enhancer applies these transformations (all dynamic, no hardcoded mappings):

### 1. Agent Assignment
Matches prompt intent keywords against discovered agent descriptions and capabilities. No static lookup table — entirely driven by what's in `.claude/agents/` and `.claude/skills/`.

### 2. Context Enrichment
Adds from codebase:
- File paths matching prompt keywords
- Test file locations
- Config file references when relevant

### 3. Orchestration
Adds sequencing based on detected workflow:
- TDD order: tests first -> types -> implementation
- Review order: implement -> test -> review
- Refactor order: review -> refactor -> verify

### 4. Guards
Adds verification steps:
- "Run `[test command from package.json]` after changes"
- "If any step fails, stop and report before continuing"
- Timeout guards for long-running operations

### 5. Skill Invocation
References available skills when relevant to the prompt intent.

All enhancement is **additive** — never removes user intent, only enriches it.

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Skill-only (no hooks, no external API) | Simplest approach, fully within Claude ecosystem, no API keys needed |
| Dynamic discovery from .claude/ dirs | Adapts to any project's agent/skill setup without hardcoding |
| Diff review before send | Transparent — user sees exactly what changed (like Augment's "what you see is what gets sent") |
| TypeScript/Bun | Fast startup, runs TS directly, good JSON handling |
| Optional config with auto-discovery | Works out of the box, customizable when needed |
| Additive enhancement | Respects user intent, only adds structure and context |

## Out of Scope (for v1)

- Automatic enhancement of every prompt (hook-based)
- Multi-turn enhancement (enhance -> re-enhance)
- Enhancement history/analytics
- Custom prompt templates per project
