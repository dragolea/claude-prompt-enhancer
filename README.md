# Claude Prompt Enhancer

A Claude Code skill that transforms raw prompts into structured, agent-orchestrated prompts. It discovers your available agents, skills, and project context, then enhances your prompts with agent assignments, file paths, sequencing, and guards.

## Installation

```bash
curl -fsSL https://raw.githubusercontent.com/dragolea/claude-prompt-enhancer/main/install.sh | bash
```

Requires `git` and either `bun` or `node` (v22.6+).

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
@debugger: Investigate the login flow in src/components/Login.tsx and
src/services/auth.ts. Identify the root cause of the bug.
@react-specialist: Fix the identified issue. Ensure existing tests at
tests/components/Login.test.tsx pass. Run `bun test` after changes.
If any step fails, stop and report before continuing.
```

```
/enhance refactor the services folder
```

Produces something like:

```
@typescript-pro: Move all inline types from src/services/ to a central
src/types/api.d.ts. @code-reviewer: Review each refactored file for
correctness. @debugger: Remove all console.logs and unused imports from
src/services/. Run `eslint . --fix` after each file is touched.
```

## What It Does

When you invoke `/enhance`, the skill:

1. **Discovers context** — scans your `.claude/agents/`, `.claude/skills/`, and `package.json` to find available agents, skills, test/lint commands, and project framework
2. **Enhances your prompt** — assigns relevant agents, adds file paths, defines execution order, and includes verification guards
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

Or manually:

```bash
rm -rf ~/.claude/skills/enhance
```

## Development

```bash
git clone https://github.com/dragolea/claude-prompt-enhancer.git
cd claude-prompt-enhancer
bun install
bun test
```

## License

MIT
