# Claude Prompt Enhancer

A Claude Code skill that transforms raw prompts into structured, agent-orchestrated prompts. It discovers your available agents, skills, and project context, then enhances your prompts with agent assignments, file paths, sequencing, and guards. It assesses task complexity so small changes get lightweight inline guards while larger work gets full skill workflows.

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

## What It Does

When you invoke `/enhance`, the skill:

1. **Discovers context** — scans your `.claude/agents/`, `.claude/skills/`, and `package.json` to find available agents, skills, test/lint commands, and project framework
2. **Assesses complexity** — classifies the task as small, medium, or large based on scope and file count
3. **Routes proportionally** — small tasks get inline guards (e.g., "Run `bun test` before committing"); medium/large tasks get full skill workflows like `/systematic-debugging` or `/test-driven-development` with agent assignments
4. **Shows a diff** — presents original vs enhanced prompt
5. **Asks for confirmation** — you can accept, edit, or reject the enhancement

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
