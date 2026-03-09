---
name: enhance
description: "Enhance your prompts with agent orchestration, file paths, sequencing, and guards. Usage: /enhance <your raw prompt>"
---

# Prompt Enhancer

## Overview

Enhance raw prompts by injecting explicit skill references, agent assignments, file paths, and guards — ensuring Claude actually picks up and uses available skills and agents that it might otherwise overlook.

## Activation

When this skill is invoked with `/enhance <raw prompt>`, follow this exact workflow:

## Step 1: Discover Context

Run the discovery script to gather available agents, skills, and project info:

```bash
if command -v bun &>/dev/null; then bun ~/.claude/skills/enhance/scripts/cli.ts; elif command -v node &>/dev/null; then node --experimental-strip-types ~/.claude/skills/enhance/scripts/cli.ts; else echo '{"error":"No runtime found. Install bun or node."}'; fi
```

This outputs JSON with all available agents (from `.claude/agents/`), skills (from `.claude/skills/`), and project context (from `package.json`, etc.).

## Step 2: Assess Complexity

Classify the task before deciding how much to enhance:

| Size | Signals | Examples |
|------|---------|----------|
| **Small** | 1-2 files, < ~50 lines, single concern | Add a flag, fix a typo, tweak config, small UI change |
| **Medium** | 3-5 files, cross-cutting concern | Bug fix requiring investigation, focused refactor |
| **Large** | 5+ files, architectural impact | New feature, multi-component work, system redesign |

## Step 3: Enhance the Prompt

Using the discovered context, enrich the user's raw prompt with explicit references that improve skill/agent pickup reliability.

### What to Add

1. **Skill references** — Explicitly name the skill(s) that match the task. This is the core value — Claude's auto-trigger often misses skills, but explicit `/skill-name` mentions ensure they fire.
2. **Agent assignments** — Reference agents with `@AgentName:` prefix when their capabilities match. Only assign agents that genuinely fit.
3. **File paths** — Search the codebase (Glob/Grep) for files matching prompt keywords. Add specific paths to ground the prompt in real code.
4. **Guards** — Add verification steps using discovered test/lint commands. For small tasks, embed inline (e.g., "Run `bun test` after changes"). For medium/large, reference `/verification-before-completion`.

### Skill Routing Table

Match the task type to workflow skill(s) — skills define the execution structure, agents fill roles within it.

| Task Type | Primary Skill(s) | Typical Agents |
|-----------|------------------|----------------|
| New feature | `/brainstorming` → `/writing-plans` → `/subagent-driven-development` | @fullstack-developer, @frontend-developer |
| Bug fix | `/systematic-debugging` → `/test-driven-development` | @debugger |
| Refactor | `/test-driven-development` | @code-reviewer, @typescript-pro |
| Multi-step work | `/dispatching-parallel-agents` or `/executing-plans` | varies |
| UI/design work | `/frontend-design` or `/web-design-guidelines` | @frontend-developer |
| Completion/merge | `/verification-before-completion` → `/finishing-a-development-branch` | @code-reviewer |

### Prompt Quality Principles

1. **Lead with action verbs** — analyze, implement, fix, refactor, build, debug, create, extract
2. **Be specific and measurable** — Replace vague qualifiers with concrete criteria
3. **Include context and motivation** — Add WHY behind constraints
4. **Add grounding** — Reference specific files, functions, and test cases
5. **One cognitive action per step** — For complex tasks, decompose via skill chaining
6. **Request reasoning for non-trivial decisions** — "Investigate root cause before proposing fixes"

### Rules

- **Additive only** — never remove or alter the user's original intent
- **Be specific** — use real file paths, real agent names, real commands
- **Be concise** — aim for 3-8 lines max. Enhance, don't bloat
- **Positive framing** — tell what TO do, not what to avoid
- **Respect aliases** — if config has aliases, use the user's preferred names
- **Small tasks: no heavy skills** — embed inline guards instead of referencing `/verification-before-completion` or `/test-driven-development`
- **Medium/Large tasks** — chain skills when spanning multiple phases, append `/verification-before-completion` for any code changes

## Step 4: Present Enhancements

Show ONLY what was added — the user already knows what they typed. Use `+` prefix for additions:

```
  [user's original prompt, unchanged]
  + [skill reference added]
  + [agent assignment added]
  + [file paths added]
  + [guard added]
```

### By complexity tier:

**Small tasks** — Skip confirmation. Show the additions briefly and execute immediately.

**Medium tasks** — Show additions with default-yes confirmation:
```
  Execute? [Y/n]
```

**Large tasks** — Show additions with default-yes confirmation:
```
  Execute? [Y/n]
```

If the user confirms (or hits Enter), execute the full enhanced prompt as if the user had typed it directly. If the user says no, discard and do nothing.

## Examples

### Small task — auto-execute, no confirmation

**Input:** `add a --verbose flag to the CLI`

**Output:**
```
  add a --verbose flag to the CLI
  + Target: src/cli.ts (arg parser + logger integration)
  + Guard: Run `bun test` after changes

Executing...
```

### Medium task — show additions, confirm

**Input:** `fix the login bug`

**Output:**
```
  fix the login bug
  + Use /systematic-debugging for root cause analysis
  + @debugger: investigate login flow
  + Files: src/components/Login.tsx, src/services/auth.ts
  + Then /test-driven-development — write failing test, then fix
  + Guard: Run `bun test`, use /verification-before-completion

  Execute? [Y/n]
```

### Medium task — refactor

**Input:** `refactor the services folder`

**Output:**
```
  refactor the services folder
  + Use /test-driven-development for each extraction
  + @typescript-pro: move inline types to src/types/api.d.ts
  + @code-reviewer: review each refactored file
  + Guard: Run `eslint . --fix` after each file, use /verification-before-completion

  Execute? [Y/n]
```

### Large task — multi-skill chain

**Input:** `build a user dashboard`

**Output:**
```
  build a user dashboard
  + Use /brainstorming to explore requirements first
  + Then /writing-plans to break into tasks
  + Execute with /subagent-driven-development
  + @frontend-developer: UI components, @fullstack-developer: API endpoints
  + Guard: use /verification-before-completion

  Execute? [Y/n]
```
