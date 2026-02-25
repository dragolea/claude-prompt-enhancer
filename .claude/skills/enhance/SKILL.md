---
name: enhance
description: "Enhance your prompts with agent orchestration, file paths, sequencing, and guards. Usage: /enhance <your raw prompt>"
---

# Prompt Enhancer

## Overview

Transform raw prompts into structured, agent-orchestrated prompts that leverage your available skills and subagents.

## Activation

When this skill is invoked with `/enhance <raw prompt>`, follow this exact workflow:

## Step 1: Discover Context

Run the discovery script to gather available agents, skills, and project info:

```bash
$HOME/.bun/bin/bun run src/discovery/cli.ts
```

This outputs JSON with all available agents (from `.claude/agents/`), skills (from `.claude/skills/`), and project context (from `package.json`, etc.).

## Step 2: Enhance the Prompt

Using the discovered context and the user's raw prompt, create an enhanced version that:

### Agent Assignment
- Match the prompt's intent to the most relevant discovered agents
- Reference them with `@AgentName:` prefix followed by their specific task
- Only assign agents whose capabilities match the prompt — don't force-fit agents

### Context Enrichment
- Search the codebase for files matching prompt keywords (use Glob/Grep)
- Add specific file paths to the enhanced prompt
- Reference relevant test files
- Include project conventions from the discovery output

### Orchestration
- Define clear execution order when multiple agents are involved
- Use sequencing words: "First... Then... After... Finally..."
- For TDD workflows: tests first → types → implementation
- For bug fixes: investigate → reproduce → fix → verify

### Guards
- Add verification steps using discovered test/lint commands
- Add "If any step fails, stop and report" guards
- Add timeout guards for potentially long operations

### Skill Invocation
- Reference discovered skills when they match the prompt intent
- Use `/skill-name` syntax

### Rules
- **Additive only** — never remove or alter the user's original intent
- **Be specific** — use real file paths, real agent names, real commands
- **Be concise** — enhance, don't bloat. Aim for 3-8 lines max
- **Respect aliases** — if config has aliases, use the user's preferred names

## Step 3: Show Diff

Present the enhancement as a clear before/after comparison:

```
┌─ Original ────────────────────────────────────┐
│ [user's raw prompt]                           │
└───────────────────────────────────────────────┘

┌─ Enhanced ────────────────────────────────────┐
│ [enhanced prompt with agents, paths, guards]  │
└───────────────────────────────────────────────┘
```

## Step 4: Ask for Confirmation

Ask the user to choose one of:

1. **Accept** — Execute the enhanced prompt immediately
2. **Edit** — Let the user modify the enhanced prompt, then execute
3. **Reject** — Discard the enhancement, do nothing

If the user accepts, proceed to execute the enhanced prompt as if the user had typed it directly.

## Examples

### Input
```
fix the login bug
```

### Enhanced Output
```
@debugger: Investigate the login flow in src/components/Login.tsx and
src/services/auth.ts. Identify the root cause of the bug.
@react-specialist: Fix the identified issue. Ensure existing tests at
tests/components/Login.test.tsx pass. Run `bun test` after changes.
If any step fails, stop and report before continuing.
```

### Input
```
refactor the services folder
```

### Enhanced Output
```
@typescript-pro: Move all inline types from src/services/ to a central
src/types/api.d.ts. @code-reviewer: Review each refactored file for
correctness. @debugger: Remove all console.logs and unused imports from
src/services/. Run `eslint . --fix` after each file is touched.
Use /verification-before-completion before claiming done.
```
