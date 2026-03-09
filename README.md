# Claude Prompt Enhancer

A Claude Code skill that transforms raw prompts into structured, agent-orchestrated prompts. It discovers your available agents, skills, and project context, then enhances your prompts with agent assignments, file paths, sequencing, and guards. It assesses task complexity so small changes get lightweight inline guards while larger work gets full skill workflows.

Also includes **`/audit`** — a skill conflict detection engine that scans your installed agents and skills for duplicate names, missing frontmatter, contradictory instructions, and other issues. Use it to keep your setup clean as you install skill packs from different sources.

## Installation

```bash
curl -fsSL https://raw.githubusercontent.com/dragolea/claude-prompt-enhancer/main/install.sh | bash
```

Requires `git` and either `bun` or `node` (v22.6+).

### Project-level install

To install scoped to a specific project (useful for teams sharing config via git):

```bash
curl -fsSL https://raw.githubusercontent.com/dragolea/claude-prompt-enhancer/main/install.sh | bash -s -- --project
```

This installs to `.claude/skills/enhance/` in your current directory and adds the SessionStart hook to the project's `.claude/settings.json` instead of your user-level settings.

### What gets installed

The install script places the skills at `~/.claude/skills/`:

```
~/.claude/skills/
├── enhance/
│   ├── SKILL.md              # Skill definition (Claude reads this on /enhance)
│   └── scripts/
│       ├── cli.ts            # Discovery entry point
│       ├── discover.ts       # Walks .claude/agents/ and .claude/skills/
│       ├── cache.ts          # Stat-fingerprint cache for fast re-runs
│       ├── types.ts          # TypeScript interfaces
│       ├── parse-agent.ts    # Parses agent .md frontmatter
│       ├── parse-skill.ts    # Parses SKILL.md frontmatter
│       ├── parse-project.ts  # Parses package.json
│       ├── load-config.ts    # Parses enhancer-config.json
│       ├── format-context.ts # Formats discovery output
│       └── setup-hook.ts     # Manages SessionStart hook
└── audit/
    ├── SKILL.md              # Skill definition (Claude reads this on /audit)
    └── scripts/
        ├── cli.ts            # Audit entry point
        ├── analyze.ts        # Runs all rules, returns report
        ├── discover-for-audit.ts  # Discovery without excludeAgents filter
        ├── parse-for-audit.ts     # Enriched parsers (filePath, body)
        ├── format-report.ts  # Human-readable formatter
        ├── types.ts          # Audit-specific types
        └── rules/            # One file per detection rule
            ├── duplicate-names.ts
            ├── missing-frontmatter.ts
            ├── excluded-agent-refs.ts
            ├── overlapping-descriptions.ts
            ├── cross-category-collisions.ts
            ├── missing-skill-deps.ts
            └── contradictory-instructions.ts
```

It also adds a `SessionStart` hook to `~/.claude/settings.json` that pre-warms the discovery cache when you start a Claude Code session. This is merged non-destructively — your existing settings and hooks are preserved.

No global binaries, no `node_modules`, no dependencies.

## Usage

In any Claude Code session, type:

```
/enhance <your prompt>
```

### Examples

**Small task** — inline guards, no skill overhead:

```
/enhance add a --verbose flag to the CLI
```

```
Add a --verbose flag to src/cli.ts — parse it in the arg parser and
pass it to the logger. Run `bun test` after changes. Confirm tests
pass before committing.
```

**Medium task** — skill-routed with agents:

```
/enhance fix the login bug
```

```
Use /systematic-debugging to investigate the login flow in src/components/Login.tsx
and src/services/auth.ts. @debugger: Identify root cause using the 4-phase
debugging workflow. Once root cause is found, use /test-driven-development —
write a failing test first, then fix. Run `bun test` after changes.
Use /verification-before-completion before claiming done.
```

**Large task** — multi-skill chain:

```
/enhance build a user dashboard
```

```
Use /brainstorming to explore requirements for the user dashboard feature.
Once design is agreed, use /writing-plans to break into tasks.
Execute with /subagent-driven-development — @frontend-developer for UI
components, @fullstack-developer for API endpoints.
Use /verification-before-completion before claiming done.
```

## Audit

In any Claude Code session, type:

```
/audit
```

This scans your `.claude/agents/` and `.claude/skills/` directories and reports:

| Severity | Rule | What it detects |
|----------|------|----------------|
| **Error** | `duplicate-name` | Two agents or skills with the same name |
| **Warning** | `missing-frontmatter` | `.md` files without valid YAML frontmatter |
| **Warning** | `excluded-agent-ref` | Skill references an agent that config excludes |
| **Warning** | `cross-category-collision` | Same agent name in different category directories |
| **Warning** | `missing-skill-dep` | Skill body references `/skill` that isn't installed |
| **Info** | `overlapping-descriptions` | Skills/agents with very similar descriptions |
| **Info** | `contradictory-instructions` | "always X" vs "never X" across different files |

The audit skill presents findings by severity and offers to fix actionable issues (rename duplicates, add missing frontmatter).

You can also run the audit CLI directly:

```bash
# JSON output (for CI — exits 1 if errors found)
bun src/audit/cli.ts

# Human-readable output
bun src/audit/cli.ts --human

# Audit a specific project
bun src/audit/cli.ts /path/to/project --human
```

### Example output

```
INVENTORY
  Agents: 16 (across 4 categories)
  Skills: 19

FINDINGS (1 error, 0 warnings, 2 infos)

  ERROR    duplicate-name
    Two agents share the name "debugger":
      .claude/agents/performance/debugger.md
      .claude/agents/quality/debugger.md
    Fix: Rename one to avoid ambiguity when using @agent references

  INFO     overlapping-descriptions
    Skills "tdd" and "verify" have similar descriptions (62% overlap)
      .claude/skills/tdd/SKILL.md
      .claude/skills/verify/SKILL.md
    Fix: Differentiate their descriptions so Claude can route to the right skill
```

## What It Does

When you invoke `/enhance`, the skill:

1. **Discovers context** — scans your `.claude/agents/`, `.claude/skills/`, and `package.json` to find available agents, skills, test/lint commands, and project framework
2. **Applies prompt best practices** — uses cross-provider principles (Google TCREI, Anthropic, OpenAI Six Strategies) to strengthen the prompt: action verbs, specific file paths, measurable criteria, positive framing, grounding, and reasoning-before-conclusion ordering
3. **Assesses complexity** — classifies the task as small, medium, or large based on scope and file count
4. **Routes proportionally** — small tasks get inline guards (e.g., "Run `bun test` before committing"); medium/large tasks get full skill workflows like `/systematic-debugging` or `/test-driven-development` with agent assignments
5. **Shows a diff** — presents original vs enhanced prompt
6. **Asks for confirmation** — you can accept, edit, or reject the enhancement

## Configuration

Create `.claude/enhancer-config.json` in your project to customize behavior:

```json
{
  "aliases": {
    "fix": "debug and fix",
    "refactor": "refactor with tests"
  },
  "defaultGuards": ["Run tests after changes"],
  "conventions": ["Use TypeScript strict mode"],
  "excludeAgents": ["agent-to-skip"]
}
```

## Uninstall

```bash
curl -fsSL https://raw.githubusercontent.com/dragolea/claude-prompt-enhancer/main/uninstall.sh | bash
```

For project-level installs:

```bash
curl -fsSL https://raw.githubusercontent.com/dragolea/claude-prompt-enhancer/main/uninstall.sh | bash -s -- --project
```

This removes the skill files and cleans up the `SessionStart` hook from the corresponding settings file.

## Development

```bash
git clone https://github.com/dragolea/claude-prompt-enhancer.git
cd claude-prompt-enhancer
bun install
bun test                        # run all tests (discovery + audit)
bun test tests/audit/           # run only audit tests
bun run audit                   # run audit CLI on current project
bun run audit -- --human        # human-readable output
```

## License

MIT
