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
if command -v bun &>/dev/null; then bun ~/.claude/skills/enhance/scripts/cli.ts; elif command -v node &>/dev/null; then node --experimental-strip-types ~/.claude/skills/enhance/scripts/cli.ts; else echo '{"error":"No runtime found. Install bun or node."}'; fi
```

This outputs JSON with all available agents (from `.claude/agents/`), skills (from `.claude/skills/`), and project context (from `package.json`, etc.).

## Step 2: Enhance the Prompt

Using the discovered context and the user's raw prompt, create an enhanced version that:

### Skill Routing
Match the task type to workflow skill(s) **first** — skills define the execution structure, agents fill roles within it.

| Task Type | Primary Skill(s) | Typical Agents |
|-----------|------------------|----------------|
| New feature | `/brainstorming` → `/writing-plans` → `/subagent-driven-development` | @fullstack-developer, @frontend-developer |
| Bug fix | `/systematic-debugging` → `/test-driven-development` | @debugger |
| Refactor | `/test-driven-development` | @code-reviewer, @typescript-pro |
| Multi-step work | `/dispatching-parallel-agents` or `/executing-plans` | varies |
| UI/design work | `/frontend-design` or `/web-design-guidelines` | @frontend-developer |
| Completion/merge | `/verification-before-completion` → `/finishing-a-development-branch` | @code-reviewer |

Rules:
- Always identify the matching workflow skill(s) FIRST
- Chain skills when the task spans multiple phases (e.g., brainstorming → writing-plans)
- `/verification-before-completion` should be appended to ANY task that produces code changes
- `/test-driven-development` should be included for ANY implementation work

### Agent Assignment
- Assign agents to roles defined by the chosen skill workflow — agents work within the skill's structure, not independently
- Reference them with `@AgentName:` prefix followed by their specific task
- Only assign agents whose capabilities match the prompt — don't force-fit agents

### Context Enrichment
- Search the codebase for files matching prompt keywords (use Glob/Grep)
- Add specific file paths to the enhanced prompt
- Reference relevant test files
- Include project conventions from the discovery output

### Orchestration
- Skills already define the primary execution sequence — use sequencing words ("First... Then... After... Finally...") only to clarify transitions between chained skills or agent handoffs
- For multi-skill chains, make the phase boundaries explicit

### Guards
- Add verification steps using discovered test/lint commands
- Add "If any step fails, stop and report" guards
- Add timeout guards for potentially long operations

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
Use /systematic-debugging to investigate the login flow in src/components/Login.tsx
and src/services/auth.ts. @debugger: Identify root cause using the 4-phase
debugging workflow. Once root cause is found, use /test-driven-development —
write a failing test first, then fix. Run `bun test` after changes.
Use /verification-before-completion before claiming done.
```

### Input
```
refactor the services folder
```

### Enhanced Output
```
Use /test-driven-development for the refactor of src/services/.
@typescript-pro: Move inline types to src/types/api.d.ts — write tests for
each extraction before moving. @code-reviewer: Review each refactored file.
Run `eslint . --fix` after each file. Use /verification-before-completion
before claiming done.
```

### Input
```
build a user dashboard
```

### Enhanced Output
```
Use /brainstorming to explore requirements for the user dashboard feature.
Once design is agreed, use /writing-plans to break into tasks.
Execute with /subagent-driven-development — @frontend-developer for UI
components, @fullstack-developer for API endpoints.
Use /verification-before-completion before claiming done.
```
