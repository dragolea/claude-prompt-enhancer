# Claude Prompt Enhancer

A Claude Code skill that transforms raw prompts into structured, agent-orchestrated prompts. It discovers your available agents, skills, and project context, then enhances your prompts with agent assignments, file paths, sequencing, and guards.

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

The install script places the skill at `~/.claude/skills/enhance/`:

```
~/.claude/skills/enhance/
├── SKILL.md              # Skill definition (Claude reads this on /enhance)
└── scripts/
    ├── cli.ts            # Discovery entry point
    ├── discover.ts       # Walks .claude/agents/ and .claude/skills/
    ├── cache.ts          # Stat-fingerprint cache for fast re-runs
    ├── types.ts          # TypeScript interfaces
    ├── parse-agent.ts    # Parses agent .md frontmatter
    ├── parse-skill.ts    # Parses SKILL.md frontmatter
    ├── parse-project.ts  # Parses package.json
    ├── load-config.ts    # Parses enhancer-config.json
    ├── format-context.ts # Formats discovery output
    └── setup-hook.ts     # Manages SessionStart hook
```

It also adds a `SessionStart` hook to `~/.claude/settings.json` that pre-warms the discovery cache when you start a Claude Code session. This is merged non-destructively — your existing settings and hooks are preserved.

No global binaries, no `node_modules`, no dependencies.

## Usage

In any Claude Code session, type:

```
/enhance <your prompt>
```

### Examples

```
/enhance fix the login bug
```

Produces something like:

```
Use /systematic-debugging to investigate the login flow in src/components/Login.tsx
and src/services/auth.ts. @debugger: Identify root cause using the 4-phase
debugging workflow. Once root cause is found, use /test-driven-development —
write a failing test first, then fix. Run `bun test` after changes.
Use /verification-before-completion before claiming done.
```

```
/enhance build a user dashboard
```

Produces something like:

```
Use /brainstorming to explore requirements for the user dashboard feature.
Once design is agreed, use /writing-plans to break into tasks.
Execute with /subagent-driven-development — @frontend-developer for UI
components, @fullstack-developer for API endpoints.
Use /verification-before-completion before claiming done.
```

## What It Does

When you invoke `/enhance`, the skill:

1. **Discovers context** — scans your `.claude/agents/`, `.claude/skills/`, and `package.json` to find available agents, skills, test/lint commands, and project framework
2. **Routes to skills first** — matches your task type (bug fix, new feature, refactor, etc.) to workflow skills like `/systematic-debugging`, `/test-driven-development`, or `/brainstorming`, then assigns agents to roles within those skill workflows
3. **Shows a diff** — presents original vs enhanced prompt
4. **Asks for confirmation** — you can accept, edit, or reject the enhancement

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
bun test
```

## License

MIT
