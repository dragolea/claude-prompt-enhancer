# Claude Prompt Enhancer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Claude Code skill (`/enhance`) that transforms raw user prompts into structured, agent-orchestrated prompts using dynamic discovery of available skills and agents.

**Architecture:** A skill-only approach — `SKILL.md` provides Claude with enhancement instructions, `discovery.ts` (Bun script) scans `.claude/agents/` and `.claude/skills/` to build context, and the SKILL.md orchestrates the enhance → diff → confirm flow.

**Tech Stack:** TypeScript, Bun, Claude Code Skills API (SKILL.md frontmatter)

---

### Task 1: Project Setup

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`

**Step 1: Initialize Bun project**

Run: `bun init -y`

**Step 2: Configure tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "types": ["bun-types"]
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

**Step 3: Install dev dependencies**

Run: `bun add -d bun-types @types/bun`

**Step 4: Add test script to package.json**

Add to scripts: `"test": "bun test"`

**Step 5: Commit**

```bash
git add package.json tsconfig.json bun.lockb
git commit -m "feat: initialize Bun project with TypeScript config"
```

---

### Task 2: Discovery — Agent Parser (TDD)

**Files:**
- Create: `src/discovery/parse-agent.ts`
- Test: `tests/discovery/parse-agent.test.ts`
- Create: `src/discovery/types.ts`

**Step 1: Create shared types**

```typescript
// src/discovery/types.ts
export interface AgentInfo {
  name: string;
  description: string;
  category: string;  // from directory path (e.g., "core-development", "performance")
}

export interface SkillInfo {
  name: string;
  description: string;
}

export interface ProjectInfo {
  testCommand: string | null;
  lintCommand: string | null;
  framework: string | null;
  language: string | null;
}

export interface EnhancerConfig {
  aliases: Record<string, string>;
  defaultGuards: string[];
  conventions: string[];
  excludeAgents: string[];
}

export interface DiscoveredContext {
  agents: AgentInfo[];
  skills: SkillInfo[];
  project: ProjectInfo;
  config: EnhancerConfig | null;
}
```

**Step 2: Write the failing test for agent parsing**

```typescript
// tests/discovery/parse-agent.test.ts
import { describe, test, expect } from "bun:test";
import { parseAgentFile } from "../../src/discovery/parse-agent";

describe("parseAgentFile", () => {
  test("extracts name and description from frontmatter", () => {
    const content = `---
name: debugger
color: '#F59E0B'
description: 'Use this agent when you need to diagnose and fix bugs.'
tools: Read, Write, Edit, Bash, Glob, Grep
model: opus
---

You are a senior debugging specialist.`;

    const result = parseAgentFile(content, "performance");
    expect(result).toEqual({
      name: "debugger",
      description: "Use this agent when you need to diagnose and fix bugs.",
      category: "performance",
    });
  });

  test("returns null for files without frontmatter", () => {
    const content = "Just some markdown without frontmatter.";
    const result = parseAgentFile(content, "misc");
    expect(result).toBeNull();
  });

  test("returns null for files with incomplete frontmatter", () => {
    const content = `---
color: '#F59E0B'
---
Missing name and description.`;

    const result = parseAgentFile(content, "misc");
    expect(result).toBeNull();
  });
});
```

**Step 3: Run test to verify it fails**

Run: `bun test tests/discovery/parse-agent.test.ts`
Expected: FAIL — module not found

**Step 4: Write minimal implementation**

```typescript
// src/discovery/parse-agent.ts
import type { AgentInfo } from "./types";

export function parseAgentFile(
  content: string,
  category: string
): AgentInfo | null {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) return null;

  const frontmatter = frontmatterMatch[1];
  const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
  const descMatch = frontmatter.match(/^description:\s*['"](.+?)['"]$/m);

  if (!nameMatch || !descMatch) return null;

  return {
    name: nameMatch[1].trim(),
    description: descMatch[1].trim(),
    category,
  };
}
```

**Step 5: Run test to verify it passes**

Run: `bun test tests/discovery/parse-agent.test.ts`
Expected: PASS — all 3 tests green

**Step 6: Commit**

```bash
git add src/discovery/types.ts src/discovery/parse-agent.ts tests/discovery/parse-agent.test.ts
git commit -m "feat: add agent file parser with frontmatter extraction"
```

---

### Task 3: Discovery — Skill Parser (TDD)

**Files:**
- Create: `src/discovery/parse-skill.ts`
- Test: `tests/discovery/parse-skill.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/discovery/parse-skill.test.ts
import { describe, test, expect } from "bun:test";
import { parseSkillFile } from "../../src/discovery/parse-skill";

describe("parseSkillFile", () => {
  test("extracts name and description from frontmatter", () => {
    const content = `---
name: test-driven-development
description: Use when implementing any feature or bugfix, before writing implementation code
---

# Test-Driven Development (TDD)

## Overview
Write the test first.`;

    const result = parseSkillFile(content);
    expect(result).toEqual({
      name: "test-driven-development",
      description:
        "Use when implementing any feature or bugfix, before writing implementation code",
    });
  });

  test("handles quoted description", () => {
    const content = `---
name: brainstorming
description: "You MUST use this before any creative work."
---

# Brainstorming`;

    const result = parseSkillFile(content);
    expect(result).toEqual({
      name: "brainstorming",
      description: "You MUST use this before any creative work.",
    });
  });

  test("returns null for files without frontmatter", () => {
    const content = "# Just markdown";
    const result = parseSkillFile(content);
    expect(result).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/discovery/parse-skill.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// src/discovery/parse-skill.ts
import type { SkillInfo } from "./types";

export function parseSkillFile(content: string): SkillInfo | null {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) return null;

  const frontmatter = frontmatterMatch[1];
  const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
  const descMatch = frontmatter.match(/^description:\s*['"]?(.+?)['"]?\s*$/m);

  if (!nameMatch || !descMatch) return null;

  return {
    name: nameMatch[1].trim(),
    description: descMatch[1].trim(),
  };
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/discovery/parse-skill.test.ts`
Expected: PASS — all 3 tests green

**Step 5: Commit**

```bash
git add src/discovery/parse-skill.ts tests/discovery/parse-skill.test.ts
git commit -m "feat: add skill file parser with frontmatter extraction"
```

---

### Task 4: Discovery — Project Info Parser (TDD)

**Files:**
- Create: `src/discovery/parse-project.ts`
- Test: `tests/discovery/parse-project.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/discovery/parse-project.test.ts
import { describe, test, expect } from "bun:test";
import { parsePackageJson } from "../../src/discovery/parse-project";

describe("parsePackageJson", () => {
  test("extracts test and lint commands", () => {
    const pkg = {
      scripts: {
        test: "vitest",
        lint: "eslint .",
      },
      dependencies: {
        react: "^18.0.0",
      },
    };
    const result = parsePackageJson(pkg);
    expect(result).toEqual({
      testCommand: "vitest",
      lintCommand: "eslint .",
      framework: "react",
      language: null,
    });
  });

  test("detects TypeScript from devDependencies", () => {
    const pkg = {
      scripts: {},
      devDependencies: {
        typescript: "^5.0.0",
      },
    };
    const result = parsePackageJson(pkg);
    expect(result.language).toBe("typescript");
  });

  test("returns nulls for empty package.json", () => {
    const result = parsePackageJson({});
    expect(result).toEqual({
      testCommand: null,
      lintCommand: null,
      framework: null,
      language: null,
    });
  });

  test("detects multiple frameworks", () => {
    const pkg = {
      dependencies: { next: "^14.0.0" },
    };
    const result = parsePackageJson(pkg);
    expect(result.framework).toBe("next");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/discovery/parse-project.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// src/discovery/parse-project.ts
import type { ProjectInfo } from "./types";

const FRAMEWORKS = [
  "next",
  "react",
  "vue",
  "angular",
  "svelte",
  "express",
  "fastify",
  "nestjs",
  "nuxt",
  "remix",
  "astro",
] as const;

export function parsePackageJson(pkg: Record<string, any>): ProjectInfo {
  const scripts = pkg.scripts ?? {};
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };

  const testCommand = scripts.test ?? null;
  const lintCommand = scripts.lint ?? null;

  let framework: string | null = null;
  for (const fw of FRAMEWORKS) {
    if (deps[fw]) {
      framework = fw;
      break;
    }
  }

  const language = deps.typescript ? "typescript" : null;

  return { testCommand, lintCommand, framework, language };
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/discovery/parse-project.test.ts`
Expected: PASS — all 4 tests green

**Step 5: Commit**

```bash
git add src/discovery/parse-project.ts tests/discovery/parse-project.test.ts
git commit -m "feat: add package.json parser for project info extraction"
```

---

### Task 5: Discovery — Config Loader (TDD)

**Files:**
- Create: `src/discovery/load-config.ts`
- Test: `tests/discovery/load-config.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/discovery/load-config.test.ts
import { describe, test, expect } from "bun:test";
import { parseEnhancerConfig } from "../../src/discovery/load-config";

describe("parseEnhancerConfig", () => {
  test("parses valid config", () => {
    const raw = {
      aliases: { "@FE": "@react-specialist" },
      defaultGuards: ["Run tests after each change"],
      conventions: ["Always use Vitest"],
      excludeAgents: ["mobile-developer"],
    };
    const result = parseEnhancerConfig(raw);
    expect(result).toEqual(raw);
  });

  test("applies defaults for missing fields", () => {
    const result = parseEnhancerConfig({});
    expect(result).toEqual({
      aliases: {},
      defaultGuards: [],
      conventions: [],
      excludeAgents: [],
    });
  });

  test("ignores unknown fields", () => {
    const raw = {
      aliases: {},
      unknownField: "ignored",
    };
    const result = parseEnhancerConfig(raw);
    expect(result).not.toHaveProperty("unknownField");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/discovery/load-config.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// src/discovery/load-config.ts
import type { EnhancerConfig } from "./types";

export function parseEnhancerConfig(raw: Record<string, any>): EnhancerConfig {
  return {
    aliases: raw.aliases ?? {},
    defaultGuards: raw.defaultGuards ?? [],
    conventions: raw.conventions ?? [],
    excludeAgents: raw.excludeAgents ?? [],
  };
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/discovery/load-config.test.ts`
Expected: PASS — all 3 tests green

**Step 5: Commit**

```bash
git add src/discovery/load-config.ts tests/discovery/load-config.test.ts
git commit -m "feat: add enhancer config parser with defaults"
```

---

### Task 6: Discovery — Main Discovery Script (TDD)

**Files:**
- Create: `src/discovery/discover.ts`
- Test: `tests/discovery/discover.test.ts`

This is the main orchestrator that calls all parsers and walks the filesystem.

**Step 1: Write the failing test**

```typescript
// tests/discovery/discover.test.ts
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { discoverContext } from "../../src/discovery/discover";

const TEST_DIR = join(import.meta.dir, "__fixtures__");

beforeEach(() => {
  mkdirSync(join(TEST_DIR, ".claude", "agents", "core-development"), {
    recursive: true,
  });
  mkdirSync(join(TEST_DIR, ".claude", "skills", "tdd"), { recursive: true });

  writeFileSync(
    join(TEST_DIR, ".claude", "agents", "core-development", "react-specialist.md"),
    `---
name: react-specialist
description: 'Use for React optimization.'
---
React agent.`
  );

  writeFileSync(
    join(TEST_DIR, ".claude", "skills", "tdd", "SKILL.md"),
    `---
name: test-driven-development
description: Use when implementing features
---
TDD skill.`
  );

  writeFileSync(
    join(TEST_DIR, "package.json"),
    JSON.stringify({
      scripts: { test: "bun test", lint: "eslint ." },
      dependencies: { react: "^18.0.0" },
      devDependencies: { typescript: "^5.0.0" },
    })
  );
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("discoverContext", () => {
  test("discovers agents, skills, and project info", async () => {
    const ctx = await discoverContext(TEST_DIR);

    expect(ctx.agents).toHaveLength(1);
    expect(ctx.agents[0].name).toBe("react-specialist");
    expect(ctx.agents[0].category).toBe("core-development");

    expect(ctx.skills).toHaveLength(1);
    expect(ctx.skills[0].name).toBe("test-driven-development");

    expect(ctx.project.testCommand).toBe("bun test");
    expect(ctx.project.framework).toBe("react");
    expect(ctx.project.language).toBe("typescript");
  });

  test("returns empty arrays when directories don't exist", async () => {
    const emptyDir = join(TEST_DIR, "empty");
    mkdirSync(emptyDir, { recursive: true });

    const ctx = await discoverContext(emptyDir);
    expect(ctx.agents).toHaveLength(0);
    expect(ctx.skills).toHaveLength(0);
    expect(ctx.project.testCommand).toBeNull();
  });

  test("loads enhancer config when present", async () => {
    writeFileSync(
      join(TEST_DIR, ".claude", "enhancer-config.json"),
      JSON.stringify({
        aliases: { "@FE": "@react-specialist" },
        defaultGuards: ["Run tests"],
      })
    );

    const ctx = await discoverContext(TEST_DIR);
    expect(ctx.config).not.toBeNull();
    expect(ctx.config!.aliases["@FE"]).toBe("@react-specialist");
  });

  test("excludes agents listed in config excludeAgents", async () => {
    writeFileSync(
      join(TEST_DIR, ".claude", "agents", "core-development", "mobile-developer.md"),
      `---
name: mobile-developer
description: 'Mobile dev.'
---
Mobile.`
    );

    writeFileSync(
      join(TEST_DIR, ".claude", "enhancer-config.json"),
      JSON.stringify({ excludeAgents: ["mobile-developer"] })
    );

    const ctx = await discoverContext(TEST_DIR);
    expect(ctx.agents.find((a) => a.name === "mobile-developer")).toBeUndefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/discovery/discover.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// src/discovery/discover.ts
import { readdir, readFile } from "fs/promises";
import { join, basename, dirname } from "path";
import type { DiscoveredContext, AgentInfo, SkillInfo } from "./types";
import { parseAgentFile } from "./parse-agent";
import { parseSkillFile } from "./parse-skill";
import { parsePackageJson } from "./parse-project";
import { parseEnhancerConfig } from "./load-config";

async function exists(path: string): Promise<boolean> {
  try {
    await Bun.file(path).exists();
    return true;
  } catch {
    return false;
  }
}

async function walkDir(dir: string): Promise<string[]> {
  const files: string[] = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await walkDir(fullPath)));
      } else {
        files.push(fullPath);
      }
    }
  } catch {
    // Directory doesn't exist
  }
  return files;
}

export async function discoverContext(
  projectRoot: string
): Promise<DiscoveredContext> {
  const claudeDir = join(projectRoot, ".claude");

  // Discover agents
  const agentsDir = join(claudeDir, "agents");
  const agentFiles = (await walkDir(agentsDir)).filter((f) =>
    f.endsWith(".md")
  );
  const agents: AgentInfo[] = [];
  for (const filePath of agentFiles) {
    const content = await readFile(filePath, "utf-8");
    const category = basename(dirname(filePath));
    const agent = parseAgentFile(content, category);
    if (agent) agents.push(agent);
  }

  // Discover skills
  const skillsDir = join(claudeDir, "skills");
  let skills: SkillInfo[] = [];
  try {
    const skillDirs = await readdir(skillsDir, { withFileTypes: true });
    for (const entry of skillDirs) {
      if (!entry.isDirectory()) continue;
      const skillMd = join(skillsDir, entry.name, "SKILL.md");
      try {
        const content = await readFile(skillMd, "utf-8");
        const skill = parseSkillFile(content);
        if (skill) skills.push(skill);
      } catch {
        // SKILL.md doesn't exist in this dir
      }
    }
  } catch {
    // skills dir doesn't exist
  }

  // Parse project info
  let project = { testCommand: null, lintCommand: null, framework: null, language: null } as ReturnType<typeof parsePackageJson>;
  try {
    const pkgContent = await readFile(join(projectRoot, "package.json"), "utf-8");
    project = parsePackageJson(JSON.parse(pkgContent));
  } catch {
    // No package.json
  }

  // Load optional config
  let config = null;
  try {
    const configContent = await readFile(
      join(claudeDir, "enhancer-config.json"),
      "utf-8"
    );
    config = parseEnhancerConfig(JSON.parse(configContent));
  } catch {
    // No config file
  }

  // Apply excludeAgents filter
  const filteredAgents = config
    ? agents.filter((a) => !config!.excludeAgents.includes(a.name))
    : agents;

  return {
    agents: filteredAgents,
    skills,
    project,
    config,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/discovery/discover.test.ts`
Expected: PASS — all 4 tests green

**Step 5: Commit**

```bash
git add src/discovery/discover.ts tests/discovery/discover.test.ts
git commit -m "feat: add main discovery orchestrator for agents, skills, and project context"
```

---

### Task 7: Discovery CLI Entry Point (TDD)

**Files:**
- Create: `src/discovery/cli.ts`
- Test: `tests/discovery/cli.test.ts`

This is the script that Claude will run via Bash to get discovery context as JSON.

**Step 1: Write the failing test**

```typescript
// tests/discovery/cli.test.ts
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";

const TEST_DIR = join(import.meta.dir, "__fixtures_cli__");

beforeEach(() => {
  mkdirSync(join(TEST_DIR, ".claude", "agents", "tooling"), { recursive: true });
  writeFileSync(
    join(TEST_DIR, ".claude", "agents", "tooling", "researcher.md"),
    `---
name: researcher
description: 'Fast codebase exploration.'
---
Researcher.`
  );
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("discovery CLI", () => {
  test("outputs valid JSON to stdout", async () => {
    const proc = Bun.spawn(
      ["bun", "run", join(import.meta.dir, "../../src/discovery/cli.ts"), TEST_DIR],
      { stdout: "pipe", stderr: "pipe" }
    );
    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    expect(exitCode).toBe(0);
    const parsed = JSON.parse(output);
    expect(parsed.agents).toBeArray();
    expect(parsed.agents[0].name).toBe("researcher");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/discovery/cli.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// src/discovery/cli.ts
import { discoverContext } from "./discover";

const projectRoot = process.argv[2] || process.cwd();
const context = await discoverContext(projectRoot);
console.log(JSON.stringify(context, null, 2));
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/discovery/cli.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/discovery/cli.ts tests/discovery/cli.test.ts
git commit -m "feat: add discovery CLI entry point for JSON output"
```

---

### Task 8: Context Formatter (TDD)

**Files:**
- Create: `src/format-context.ts`
- Test: `tests/format-context.test.ts`

Formats the discovered context into a human-readable string for the enhancement prompt.

**Step 1: Write the failing test**

```typescript
// tests/format-context.test.ts
import { describe, test, expect } from "bun:test";
import { formatContext } from "../src/format-context";
import type { DiscoveredContext } from "../src/discovery/types";

describe("formatContext", () => {
  test("formats agents with category grouping", () => {
    const ctx: DiscoveredContext = {
      agents: [
        { name: "debugger", description: "Diagnoses bugs.", category: "performance" },
        { name: "react-specialist", description: "React optimization.", category: "core-development" },
      ],
      skills: [
        { name: "test-driven-development", description: "TDD workflow." },
      ],
      project: {
        testCommand: "bun test",
        lintCommand: "eslint .",
        framework: "react",
        language: "typescript",
      },
      config: null,
    };

    const result = formatContext(ctx);
    expect(result).toContain("@debugger");
    expect(result).toContain("@react-specialist");
    expect(result).toContain("test-driven-development");
    expect(result).toContain("bun test");
    expect(result).toContain("react");
  });

  test("includes config conventions when present", () => {
    const ctx: DiscoveredContext = {
      agents: [],
      skills: [],
      project: { testCommand: null, lintCommand: null, framework: null, language: null },
      config: {
        aliases: { "@FE": "@react-specialist" },
        defaultGuards: ["Run tests after changes"],
        conventions: ["Use Vitest, not Jest"],
        excludeAgents: [],
      },
    };

    const result = formatContext(ctx);
    expect(result).toContain("@FE → @react-specialist");
    expect(result).toContain("Run tests after changes");
    expect(result).toContain("Use Vitest, not Jest");
  });

  test("handles empty context gracefully", () => {
    const ctx: DiscoveredContext = {
      agents: [],
      skills: [],
      project: { testCommand: null, lintCommand: null, framework: null, language: null },
      config: null,
    };

    const result = formatContext(ctx);
    expect(result).toContain("No agents");
    expect(result).toContain("No skills");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/format-context.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// src/format-context.ts
import type { DiscoveredContext } from "./discovery/types";

export function formatContext(ctx: DiscoveredContext): string {
  const sections: string[] = [];

  // Agents
  if (ctx.agents.length > 0) {
    const grouped = new Map<string, typeof ctx.agents>();
    for (const agent of ctx.agents) {
      const list = grouped.get(agent.category) ?? [];
      list.push(agent);
      grouped.set(agent.category, list);
    }
    const lines = ["AVAILABLE AGENTS:"];
    for (const [category, agents] of grouped) {
      lines.push(`  [${category}]`);
      for (const a of agents) {
        lines.push(`    @${a.name} — ${a.description}`);
      }
    }
    sections.push(lines.join("\n"));
  } else {
    sections.push("AVAILABLE AGENTS: No agents discovered.");
  }

  // Skills
  if (ctx.skills.length > 0) {
    const lines = ["AVAILABLE SKILLS:"];
    for (const s of ctx.skills) {
      lines.push(`  /${s.name} — ${s.description}`);
    }
    sections.push(lines.join("\n"));
  } else {
    sections.push("AVAILABLE SKILLS: No skills discovered.");
  }

  // Project
  const projLines = ["PROJECT CONTEXT:"];
  if (ctx.project.framework) projLines.push(`  Framework: ${ctx.project.framework}`);
  if (ctx.project.language) projLines.push(`  Language: ${ctx.project.language}`);
  if (ctx.project.testCommand) projLines.push(`  Test command: ${ctx.project.testCommand}`);
  if (ctx.project.lintCommand) projLines.push(`  Lint command: ${ctx.project.lintCommand}`);
  if (projLines.length === 1) projLines.push("  No project info detected.");
  sections.push(projLines.join("\n"));

  // Config
  if (ctx.config) {
    const cfgLines = ["CUSTOM CONFIGURATION:"];
    if (Object.keys(ctx.config.aliases).length > 0) {
      cfgLines.push("  Aliases:");
      for (const [alias, target] of Object.entries(ctx.config.aliases)) {
        cfgLines.push(`    ${alias} → ${target}`);
      }
    }
    if (ctx.config.defaultGuards.length > 0) {
      cfgLines.push("  Default guards:");
      for (const guard of ctx.config.defaultGuards) {
        cfgLines.push(`    - ${guard}`);
      }
    }
    if (ctx.config.conventions.length > 0) {
      cfgLines.push("  Conventions:");
      for (const conv of ctx.config.conventions) {
        cfgLines.push(`    - ${conv}`);
      }
    }
    sections.push(cfgLines.join("\n"));
  }

  return sections.join("\n\n");
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/format-context.test.ts`
Expected: PASS — all 3 tests green

**Step 5: Commit**

```bash
git add src/format-context.ts tests/format-context.test.ts
git commit -m "feat: add context formatter for human-readable discovery output"
```

---

### Task 9: Create the SKILL.md

**Files:**
- Create: `.claude/skills/prompt-enhancer/SKILL.md`

This is the core of the enhancer — the instructions Claude reads when `/enhance` is invoked.

**Step 1: Create the skill directory**

Run: `mkdir -p .claude/skills/prompt-enhancer`

**Step 2: Write the SKILL.md**

```markdown
---
name: prompt-enhancer
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
bun run src/discovery/cli.ts
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
```

**Step 3: Commit**

```bash
git add .claude/skills/prompt-enhancer/SKILL.md
git commit -m "feat: add prompt-enhancer skill with enhancement instructions"
```

---

### Task 10: Run Full Test Suite & Verify

**Step 1: Run all tests**

Run: `bun test`
Expected: All tests pass (agent parser: 3, skill parser: 3, project parser: 4, config: 3, discover: 4, CLI: 1, format: 3 = 21 tests)

**Step 2: Test the discovery CLI against the real project**

Run: `bun run src/discovery/cli.ts`
Expected: JSON output listing all 15+ agents from `.claude/agents/` and all 19+ skills from `.claude/skills/`

**Step 3: Verify SKILL.md is discoverable**

Check that the prompt-enhancer skill appears in the discovery output:
Run: `bun run src/discovery/cli.ts | grep prompt-enhancer`
Expected: Shows the prompt-enhancer skill

**Step 4: Commit (if any fixes were needed)**

```bash
git add -A
git commit -m "fix: address test/integration issues from full verification"
```

---

### Task 11: Final Integration Test — Manual

**Step 1: Test the `/enhance` command in Claude Code**

Open Claude Code in this project directory and type:
```
/enhance fix the login component
```

**Step 2: Verify the flow**

- Claude should run discovery, show discovered agents/skills
- Claude should present a diff (original vs enhanced)
- Claude should ask Accept/Edit/Reject
- Accept should execute the enhanced prompt

**Step 3: Test with no agents/skills (empty project)**

Create a temp directory, run `/enhance` there, verify graceful degradation.

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete prompt enhancer v1 — skill + discovery + tests"
```
