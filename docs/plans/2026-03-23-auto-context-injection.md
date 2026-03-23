# Auto Context Injection Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform claude-prompt-enhancer from a manual `/enhance` skill into an automatic context injection system that silently injects relevant agents and skills into every prompt via hooks, so Claude Code always knows what tools are available.

**Architecture:** Two new hooks — `UserPromptSubmit` (injects relevant agents/skills as `additionalContext` per prompt) and `PreToolUse` with matcher `Agent` (injects relevant skills into subagent prompts with 3-check logic). Both hooks read from the existing discovery cache, use intent detection + Jaccard similarity for relevance filtering, and output CLI feedback via stderr. `/enhance` remains as optional explicit mode.

**Tech Stack:** Bun (primary), Node.js compat via `node:fs`, zero runtime dependencies, `bun:test`

---

## Phase 1: Shared Utilities — Extract & Build Matching Infrastructure

### Task 1: Extract Jaccard similarity to shared module

The Jaccard similarity logic currently lives in `src/audit/rules/overlapping-descriptions.ts`. We need it for intent matching in the injection hooks. Extract to a shared location.

**Files:**
- Create: `src/shared/similarity.ts`
- Create: `tests/shared/similarity.test.ts`
- Modify: `src/audit/rules/overlapping-descriptions.ts` (re-import from shared)

**Step 1: Write the failing test**

```typescript
// tests/shared/similarity.test.ts
import { describe, expect, it } from "bun:test";
import { tokenize, jaccardSimilarity } from "../../src/shared/similarity";

describe("tokenize", () => {
  it("lowercases and splits on whitespace", () => {
    const tokens = tokenize("Fix the Login Bug");
    expect(tokens).toEqual(new Set(["fix", "login", "bug"])); // "the" is stop word
  });

  it("removes stop words", () => {
    const tokens = tokenize("use this for testing");
    expect(tokens).toEqual(new Set(["testing"]));
  });

  it("returns empty set for empty string", () => {
    expect(tokenize("")).toEqual(new Set());
  });

  it("filters single-char tokens", () => {
    expect(tokenize("a b c debug")).toEqual(new Set(["debug"]));
  });
});

describe("jaccardSimilarity", () => {
  it("returns 1 for identical sets", () => {
    const a = new Set(["debug", "fix", "error"]);
    expect(jaccardSimilarity(a, a)).toBe(1);
  });

  it("returns 0 for disjoint sets", () => {
    const a = new Set(["debug", "fix"]);
    const b = new Set(["deploy", "build"]);
    expect(jaccardSimilarity(a, b)).toBe(0);
  });

  it("returns 0 for two empty sets", () => {
    expect(jaccardSimilarity(new Set(), new Set())).toBe(0);
  });

  it("calculates correct partial overlap", () => {
    const a = new Set(["debug", "fix", "error"]);
    const b = new Set(["debug", "fix", "deploy"]);
    // intersection=2, union=4 => 0.5
    expect(jaccardSimilarity(a, b)).toBe(0.5);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/shared/similarity.test.ts`
Expected: FAIL — module not found

**Step 3: Write the shared module**

```typescript
// src/shared/similarity.ts
export const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
  "this", "that", "it", "as", "if", "when", "use", "using", "used",
]);

export function tokenize(text: string): Set<string> {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
  return new Set(tokens);
}

export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/shared/similarity.test.ts`
Expected: PASS

**Step 5: Update overlapping-descriptions to import from shared**

```typescript
// src/audit/rules/overlapping-descriptions.ts — replace local functions with:
import { tokenize, jaccardSimilarity } from "../../shared/similarity";
// Remove local STOP_WORDS, tokenize, jaccardSimilarity definitions
// Keep checkOverlappingDescriptions function and THRESHOLD unchanged
```

**Step 6: Verify audit tests still pass**

Run: `bun test tests/audit/rules/overlapping-descriptions.test.ts`
Expected: PASS

**Step 7: Commit**

```bash
git add src/shared/similarity.ts tests/shared/similarity.test.ts src/audit/rules/overlapping-descriptions.ts
git commit -m "refactor: extract Jaccard similarity to shared module"
```

---

### Task 2: Add intent detection module

Detect user intent from prompt keywords to map to relevant agent categories and skill types.

**Files:**
- Create: `src/shared/intent.ts`
- Create: `tests/shared/intent.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/shared/intent.test.ts
import { describe, expect, it } from "bun:test";
import { detectIntent, type IntentResult } from "../../src/shared/intent";

describe("detectIntent", () => {
  it("detects debug intent", () => {
    const result = detectIntent("fix the login bug in auth.service.ts");
    expect(result.intents).toContain("debug");
  });

  it("detects feature intent", () => {
    const result = detectIntent("add stripe webhook endpoint");
    expect(result.intents).toContain("feature");
  });

  it("detects refactor intent", () => {
    const result = detectIntent("refactor the user module to use repository pattern");
    expect(result.intents).toContain("refactor");
  });

  it("detects test intent", () => {
    const result = detectIntent("write tests for the auth service");
    expect(result.intents).toContain("test");
  });

  it("detects review intent", () => {
    const result = detectIntent("review this PR for security issues");
    expect(result.intents).toContain("review");
  });

  it("detects deploy/devops intent", () => {
    const result = detectIntent("set up CI pipeline for the project");
    expect(result.intents).toContain("devops");
  });

  it("detects design/UI intent", () => {
    const result = detectIntent("build a dashboard page with charts");
    expect(result.intents).toContain("ui");
  });

  it("detects multiple intents", () => {
    const result = detectIntent("fix the bug and add tests");
    expect(result.intents).toContain("debug");
    expect(result.intents).toContain("test");
  });

  it("returns general for unrecognized prompts", () => {
    const result = detectIntent("hello");
    expect(result.intents).toContain("general");
  });

  it("detects performance intent", () => {
    const result = detectIntent("optimize the database query performance");
    expect(result.intents).toContain("performance");
  });

  it("detects security intent", () => {
    const result = detectIntent("audit the authentication for vulnerabilities");
    expect(result.intents).toContain("security");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/shared/intent.test.ts`
Expected: FAIL — module not found

**Step 3: Write the intent detection module**

```typescript
// src/shared/intent.ts
export type Intent =
  | "debug"
  | "feature"
  | "refactor"
  | "test"
  | "review"
  | "devops"
  | "ui"
  | "performance"
  | "security"
  | "general";

export interface IntentResult {
  intents: Intent[];
}

const INTENT_PATTERNS: Array<{ intent: Intent; patterns: RegExp[] }> = [
  {
    intent: "debug",
    patterns: [
      /\b(?:fix|bug|debug|error|issue|broken|crash|fail|wrong|investigate)\b/i,
    ],
  },
  {
    intent: "feature",
    patterns: [
      /\b(?:add|create|implement|build|new|feature|endpoint|integrate|setup|introduce)\b/i,
    ],
  },
  {
    intent: "refactor",
    patterns: [
      /\b(?:refactor|restructure|reorganize|clean\s*up|simplify|extract|rename|move)\b/i,
    ],
  },
  {
    intent: "test",
    patterns: [
      /\b(?:test|spec|coverage|assert|expect|mock|stub|tdd)\b/i,
    ],
  },
  {
    intent: "review",
    patterns: [
      /\b(?:review|audit|check|inspect|examine|assess|evaluate)\b/i,
    ],
  },
  {
    intent: "devops",
    patterns: [
      /\b(?:deploy|ci|cd|pipeline|docker|kubernetes|infrastructure|helm|terraform)\b/i,
    ],
  },
  {
    intent: "ui",
    patterns: [
      /\b(?:ui|ux|design|layout|style|css|component|page|screen|dashboard|frontend|responsive)\b/i,
    ],
  },
  {
    intent: "performance",
    patterns: [
      /\b(?:optimize|performance|slow|fast|cache|memory|bottleneck|profil|latency|speed)\b/i,
    ],
  },
  {
    intent: "security",
    patterns: [
      /\b(?:security|vulnerabilit|auth|permission|encrypt|token|csrf|xss|injection|sanitiz)\b/i,
    ],
  },
];

export function detectIntent(prompt: string): IntentResult {
  const matched: Intent[] = [];

  for (const { intent, patterns } of INTENT_PATTERNS) {
    if (patterns.some((p) => p.test(prompt))) {
      matched.push(intent);
    }
  }

  return { intents: matched.length > 0 ? matched : ["general"] };
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/shared/intent.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/shared/intent.ts tests/shared/intent.test.ts
git commit -m "feat: add intent detection module for prompt analysis"
```

---

### Task 3: Add stack detection from config files

Extend project detection beyond `package.json` to detect stack from config files like `app.json` (Expo), `nest-cli.json`, `next.config.*`, `.cdsrc.json` (SAP CAP).

**Files:**
- Create: `src/shared/stack-detect.ts`
- Create: `tests/shared/stack-detect.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/shared/stack-detect.test.ts
import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { detectStack, type StackInfo } from "../../src/shared/stack-detect";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const TEST_DIR = join(tmpdir(), "stack-detect-test-" + Date.now());

beforeEach(() => mkdirSync(TEST_DIR, { recursive: true }));
afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

describe("detectStack", () => {
  it("detects Expo from app.json with expo key", async () => {
    writeFileSync(join(TEST_DIR, "app.json"), JSON.stringify({ expo: { name: "myapp" } }));
    const stack = await detectStack(TEST_DIR);
    expect(stack.stacks).toContain("expo");
  });

  it("detects NestJS from nest-cli.json", async () => {
    writeFileSync(join(TEST_DIR, "nest-cli.json"), "{}");
    const stack = await detectStack(TEST_DIR);
    expect(stack.stacks).toContain("nestjs");
  });

  it("detects Next.js from next.config.js", async () => {
    writeFileSync(join(TEST_DIR, "next.config.js"), "module.exports = {}");
    const stack = await detectStack(TEST_DIR);
    expect(stack.stacks).toContain("nextjs");
  });

  it("detects Next.js from next.config.ts", async () => {
    writeFileSync(join(TEST_DIR, "next.config.ts"), "export default {}");
    const stack = await detectStack(TEST_DIR);
    expect(stack.stacks).toContain("nextjs");
  });

  it("detects Next.js from next.config.mjs", async () => {
    writeFileSync(join(TEST_DIR, "next.config.mjs"), "export default {}");
    const stack = await detectStack(TEST_DIR);
    expect(stack.stacks).toContain("nextjs");
  });

  it("detects SAP CAP from .cdsrc.json", async () => {
    writeFileSync(join(TEST_DIR, ".cdsrc.json"), "{}");
    const stack = await detectStack(TEST_DIR);
    expect(stack.stacks).toContain("sap-cap");
  });

  it("detects Prisma from prisma directory", async () => {
    mkdirSync(join(TEST_DIR, "prisma"), { recursive: true });
    writeFileSync(join(TEST_DIR, "prisma", "schema.prisma"), "");
    const stack = await detectStack(TEST_DIR);
    expect(stack.stacks).toContain("prisma");
  });

  it("detects multiple stacks", async () => {
    writeFileSync(join(TEST_DIR, "nest-cli.json"), "{}");
    mkdirSync(join(TEST_DIR, "prisma"), { recursive: true });
    writeFileSync(join(TEST_DIR, "prisma", "schema.prisma"), "");
    const stack = await detectStack(TEST_DIR);
    expect(stack.stacks).toContain("nestjs");
    expect(stack.stacks).toContain("prisma");
  });

  it("returns empty stacks when nothing detected", async () => {
    const stack = await detectStack(TEST_DIR);
    expect(stack.stacks).toEqual([]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/shared/stack-detect.test.ts`
Expected: FAIL — module not found

**Step 3: Write stack detection**

```typescript
// src/shared/stack-detect.ts
import { access, readFile } from "fs/promises";
import { join } from "path";

export type Stack =
  | "expo"
  | "nextjs"
  | "nestjs"
  | "sap-cap"
  | "prisma"
  | "angular"
  | "vue"
  | "svelte"
  | "remix"
  | "astro"
  | "express"
  | "fastify";

export interface StackInfo {
  stacks: Stack[];
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

interface StackProbe {
  stack: Stack;
  check: (root: string) => Promise<boolean>;
}

const PROBES: StackProbe[] = [
  {
    stack: "expo",
    check: async (root) => {
      try {
        const content = await readFile(join(root, "app.json"), "utf-8");
        const parsed = JSON.parse(content);
        return "expo" in parsed;
      } catch {
        return false;
      }
    },
  },
  {
    stack: "nestjs",
    check: (root) => fileExists(join(root, "nest-cli.json")),
  },
  {
    stack: "nextjs",
    check: async (root) => {
      const candidates = ["next.config.js", "next.config.ts", "next.config.mjs"];
      for (const file of candidates) {
        if (await fileExists(join(root, file))) return true;
      }
      return false;
    },
  },
  {
    stack: "sap-cap",
    check: (root) => fileExists(join(root, ".cdsrc.json")),
  },
  {
    stack: "prisma",
    check: (root) => fileExists(join(root, "prisma", "schema.prisma")),
  },
];

export async function detectStack(projectRoot: string): Promise<StackInfo> {
  const results = await Promise.all(
    PROBES.map(async ({ stack, check }) => ({
      stack,
      detected: await check(projectRoot),
    }))
  );
  return { stacks: results.filter((r) => r.detected).map((r) => r.stack) };
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/shared/stack-detect.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/shared/stack-detect.ts tests/shared/stack-detect.test.ts
git commit -m "feat: add stack detection from config files (Expo, NestJS, Next.js, SAP CAP, Prisma)"
```

---

### Task 4: Add relevance matching module

Core matching logic that determines which agents and skills are relevant for a given prompt, using intent detection + Jaccard similarity.

**Files:**
- Create: `src/shared/relevance.ts`
- Create: `tests/shared/relevance.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/shared/relevance.test.ts
import { describe, expect, it } from "bun:test";
import { findRelevantAgents, findRelevantSkills } from "../../src/shared/relevance";
import type { AgentInfo, SkillInfo } from "../../src/discovery/types";

const agents: AgentInfo[] = [
  { name: "debugger", description: "Diagnose and fix bugs, identify root causes of failures", category: "performance" },
  { name: "frontend-developer", description: "Build complete frontend applications across React, Vue, Angular", category: "core-development" },
  { name: "backend-developer", description: "Build backend APIs and services with NestJS, Express", category: "core-development" },
  { name: "security-engineer", description: "Implement security solutions, vulnerability management", category: "security" },
  { name: "code-reviewer", description: "Conduct comprehensive code reviews for quality", category: "quality" },
];

const skills: SkillInfo[] = [
  { name: "systematic-debugging", description: "Use when encountering any bug, test failure, or unexpected behavior" },
  { name: "test-driven-development", description: "Use when implementing any feature or bugfix, before writing implementation code" },
  { name: "verification-before-completion", description: "Use when about to claim work is complete, before committing" },
  { name: "frontend-design", description: "Create distinctive frontend interfaces with high design quality" },
  { name: "writing-plans", description: "Use when you have a spec or requirements for a multi-step task" },
];

describe("findRelevantAgents", () => {
  it("returns debugger for debug prompts", () => {
    const result = findRelevantAgents("fix the login bug", agents);
    expect(result.map((a) => a.name)).toContain("debugger");
  });

  it("returns frontend-developer for UI prompts", () => {
    const result = findRelevantAgents("build a dashboard page", agents);
    expect(result.map((a) => a.name)).toContain("frontend-developer");
  });

  it("returns security-engineer for security prompts", () => {
    const result = findRelevantAgents("audit authentication for vulnerabilities", agents);
    expect(result.map((a) => a.name)).toContain("security-engineer");
  });

  it("returns max 3 agents", () => {
    const result = findRelevantAgents("fix bug and build UI and review security", agents);
    expect(result.length).toBeLessThanOrEqual(3);
  });

  it("returns empty for trivial prompts", () => {
    const result = findRelevantAgents("hello", agents);
    expect(result.length).toBe(0);
  });
});

describe("findRelevantSkills", () => {
  it("returns systematic-debugging for debug prompts", () => {
    const result = findRelevantSkills("fix the login bug", skills);
    expect(result.map((s) => s.name)).toContain("systematic-debugging");
  });

  it("returns tdd for feature prompts", () => {
    const result = findRelevantSkills("implement stripe webhook", skills);
    expect(result.map((s) => s.name)).toContain("test-driven-development");
  });

  it("returns max 3 skills", () => {
    const result = findRelevantSkills("fix bug, implement feature, design UI, write plan", skills);
    expect(result.length).toBeLessThanOrEqual(3);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/shared/relevance.test.ts`
Expected: FAIL — module not found

**Step 3: Write the relevance module**

```typescript
// src/shared/relevance.ts
import type { AgentInfo, SkillInfo } from "../discovery/types";
import { tokenize, jaccardSimilarity } from "./similarity";
import { detectIntent, type Intent } from "./intent";

/** Map intents to keywords that describe relevant capabilities. */
const INTENT_CAPABILITY_KEYWORDS: Record<Intent, string[]> = {
  debug: ["debug", "fix", "bug", "diagnose", "error", "failure", "root-cause", "investigate"],
  feature: ["build", "implement", "create", "feature", "api", "endpoint", "service", "integrate"],
  refactor: ["refactor", "restructure", "clean", "simplify", "pattern", "architecture"],
  test: ["test", "tdd", "spec", "coverage", "assert", "mock", "quality"],
  review: ["review", "quality", "code-review", "inspect", "assess"],
  devops: ["deploy", "ci", "cd", "pipeline", "infrastructure", "docker"],
  ui: ["frontend", "ui", "ux", "design", "component", "page", "layout", "css", "react", "vue", "angular"],
  performance: ["performance", "optimize", "cache", "memory", "bottleneck", "latency", "speed", "profil"],
  security: ["security", "vulnerability", "auth", "permission", "encrypt", "token", "audit"],
  general: [],
};

const RELEVANCE_THRESHOLD = 0.15;
const MAX_RESULTS = 3;

function scoreItem(prompt: string, description: string, intents: Intent[]): number {
  const promptTokens = tokenize(prompt);
  const descTokens = tokenize(description);

  // Base score: Jaccard similarity between prompt and description
  let score = jaccardSimilarity(promptTokens, descTokens);

  // Boost: check if description matches intent capability keywords
  for (const intent of intents) {
    const keywords = INTENT_CAPABILITY_KEYWORDS[intent];
    const keywordTokens = new Set(keywords);
    const intentMatch = jaccardSimilarity(descTokens, keywordTokens);
    score = Math.max(score, intentMatch * 0.8);
  }

  return score;
}

export function findRelevantAgents(prompt: string, agents: AgentInfo[]): AgentInfo[] {
  const { intents } = detectIntent(prompt);
  if (intents.length === 1 && intents[0] === "general") return [];

  return agents
    .map((agent) => ({ agent, score: scoreItem(prompt, agent.description, intents) }))
    .filter(({ score }) => score >= RELEVANCE_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS)
    .map(({ agent }) => agent);
}

export function findRelevantSkills(prompt: string, skills: SkillInfo[]): SkillInfo[] {
  const { intents } = detectIntent(prompt);
  if (intents.length === 1 && intents[0] === "general") return [];

  return skills
    .map((skill) => ({ skill, score: scoreItem(prompt, skill.description, intents) }))
    .filter(({ score }) => score >= RELEVANCE_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS)
    .map(({ skill }) => skill);
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/shared/relevance.test.ts`
Expected: PASS (may need to tune `RELEVANCE_THRESHOLD` — start at 0.15 and adjust)

**Step 5: Commit**

```bash
git add src/shared/relevance.ts tests/shared/relevance.test.ts
git commit -m "feat: add relevance matching for agents and skills using intent + Jaccard"
```

---

## Phase 2: UserPromptSubmit Hook

### Task 5: Add CLI feedback formatter for stderr output

**Files:**
- Create: `src/injection/format-stderr.ts`
- Create: `tests/injection/format-stderr.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/injection/format-stderr.test.ts
import { describe, expect, it } from "bun:test";
import { formatStderr } from "../../src/injection/format-stderr";
import type { AgentInfo, SkillInfo } from "../../src/discovery/types";

describe("formatStderr", () => {
  it("formats agents and skills into a compact box", () => {
    const agents: AgentInfo[] = [
      { name: "debugger", description: "Fix bugs", category: "performance" },
    ];
    const skills: SkillInfo[] = [
      { name: "systematic-debugging", description: "Debug workflow" },
    ];
    const output = formatStderr(agents, skills, []);
    expect(output).toContain("@debugger");
    expect(output).toContain("/systematic-debugging");
    expect(output).toContain("context injected");
  });

  it("includes stack info when provided", () => {
    const output = formatStderr([], [], ["nestjs", "prisma"]);
    expect(output).toContain("nestjs");
    expect(output).toContain("prisma");
  });

  it("returns empty string when nothing to inject", () => {
    const output = formatStderr([], [], []);
    expect(output).toBe("");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/injection/format-stderr.test.ts`
Expected: FAIL

**Step 3: Write the formatter**

```typescript
// src/injection/format-stderr.ts
import type { AgentInfo, SkillInfo } from "../discovery/types";

export function formatStderr(
  agents: AgentInfo[],
  skills: SkillInfo[],
  stacks: string[]
): string {
  if (agents.length === 0 && skills.length === 0 && stacks.length === 0) {
    return "";
  }

  const lines: string[] = [];
  lines.push("--- context injected ---");

  if (agents.length > 0) {
    lines.push("  Agents: " + agents.map((a) => `@${a.name}`).join(", "));
  }
  if (skills.length > 0) {
    lines.push("  Skills: " + skills.map((s) => `/${s.name}`).join(", "));
  }
  if (stacks.length > 0) {
    lines.push("  Stack:  " + stacks.join(", "));
  }

  lines.push("------------------------");
  return lines.join("\n");
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/injection/format-stderr.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/injection/format-stderr.ts tests/injection/format-stderr.test.ts
git commit -m "feat: add stderr formatter for CLI injection feedback"
```

---

### Task 6: Build additionalContext formatter for stdout

Formats the injected context that Claude receives alongside the user's unmodified prompt.

**Files:**
- Create: `src/injection/format-context-injection.ts`
- Create: `tests/injection/format-context-injection.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/injection/format-context-injection.test.ts
import { describe, expect, it } from "bun:test";
import { formatContextInjection } from "../../src/injection/format-context-injection";
import type { AgentInfo, SkillInfo } from "../../src/discovery/types";

describe("formatContextInjection", () => {
  it("formats agents with @ prefix", () => {
    const agents: AgentInfo[] = [
      { name: "debugger", description: "Diagnose and fix bugs", category: "performance" },
    ];
    const output = formatContextInjection(agents, [], []);
    expect(output).toContain("@debugger");
    expect(output).toContain("Diagnose and fix bugs");
  });

  it("formats skills with / prefix", () => {
    const skills: SkillInfo[] = [
      { name: "systematic-debugging", description: "Debug workflow for bugs" },
    ];
    const output = formatContextInjection([], skills, []);
    expect(output).toContain("/systematic-debugging");
  });

  it("includes stack context", () => {
    const output = formatContextInjection([], [], ["nestjs", "prisma"]);
    expect(output).toContain("nestjs");
    expect(output).toContain("prisma");
  });

  it("returns empty string when nothing relevant", () => {
    expect(formatContextInjection([], [], [])).toBe("");
  });

  it("combines all sections", () => {
    const agents: AgentInfo[] = [{ name: "debugger", description: "Fix bugs", category: "perf" }];
    const skills: SkillInfo[] = [{ name: "tdd", description: "Test driven development" }];
    const output = formatContextInjection(agents, skills, ["nestjs"]);
    expect(output).toContain("@debugger");
    expect(output).toContain("/tdd");
    expect(output).toContain("nestjs");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/injection/format-context-injection.test.ts`
Expected: FAIL

**Step 3: Write the formatter**

```typescript
// src/injection/format-context-injection.ts
import type { AgentInfo, SkillInfo } from "../discovery/types";

export function formatContextInjection(
  agents: AgentInfo[],
  skills: SkillInfo[],
  stacks: string[]
): string {
  if (agents.length === 0 && skills.length === 0 && stacks.length === 0) {
    return "";
  }

  const sections: string[] = [];

  if (agents.length > 0) {
    sections.push(
      "Relevant agents available for this task:\n" +
        agents.map((a) => `  @${a.name} — ${a.description}`).join("\n")
    );
  }

  if (skills.length > 0) {
    sections.push(
      "Relevant skills available for this task:\n" +
        skills.map((s) => `  /${s.name} — ${s.description}`).join("\n")
    );
  }

  if (stacks.length > 0) {
    sections.push("Detected stack: " + stacks.join(", "));
  }

  return sections.join("\n\n");
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/injection/format-context-injection.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/injection/format-context-injection.ts tests/injection/format-context-injection.test.ts
git commit -m "feat: add additionalContext formatter for Claude injection"
```

---

### Task 7: Build UserPromptSubmit hook entry point

The main hook script that Claude Code calls on every prompt. Reads stdin JSON, runs discovery + matching, outputs additionalContext to stdout and feedback to stderr.

**Files:**
- Create: `src/injection/user-prompt-hook.ts`
- Create: `tests/injection/user-prompt-hook.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/injection/user-prompt-hook.test.ts
import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { processUserPrompt } from "../../src/injection/user-prompt-hook";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const TEST_DIR = join(tmpdir(), "user-prompt-hook-test-" + Date.now());

beforeEach(() => {
  mkdirSync(join(TEST_DIR, ".claude", "agents", "performance"), { recursive: true });
  mkdirSync(join(TEST_DIR, ".claude", "skills", "systematic-debugging"), { recursive: true });

  writeFileSync(
    join(TEST_DIR, ".claude", "agents", "performance", "debugger.md"),
    "---\nname: debugger\ndescription: 'Diagnose and fix bugs, identify root causes of failures'\n---\nDebugger agent."
  );
  writeFileSync(
    join(TEST_DIR, ".claude", "skills", "systematic-debugging", "SKILL.md"),
    "---\nname: systematic-debugging\ndescription: 'Use when encountering any bug, test failure, or unexpected behavior'\n---\nDebugging skill."
  );
});

afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

describe("processUserPrompt", () => {
  it("returns relevant agents and skills for debug prompt", async () => {
    const result = await processUserPrompt("fix the login bug", TEST_DIR);
    expect(result.additionalContext).toContain("@debugger");
    expect(result.additionalContext).toContain("/systematic-debugging");
    expect(result.stderrFeedback).toContain("@debugger");
  });

  it("returns empty for trivial prompts", async () => {
    const result = await processUserPrompt("hello", TEST_DIR);
    expect(result.additionalContext).toBe("");
    expect(result.stderrFeedback).toBe("");
  });

  it("includes stack info when detected", async () => {
    writeFileSync(join(TEST_DIR, "nest-cli.json"), "{}");
    const result = await processUserPrompt("fix the auth bug", TEST_DIR);
    expect(result.additionalContext).toContain("nestjs");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/injection/user-prompt-hook.test.ts`
Expected: FAIL

**Step 3: Write the hook logic**

```typescript
// src/injection/user-prompt-hook.ts
import { discoverContext } from "../discovery/discover";
import { readCache, writeCache } from "../discovery/cache";
import { findRelevantAgents, findRelevantSkills } from "../shared/relevance";
import { detectStack } from "../shared/stack-detect";
import { formatContextInjection } from "./format-context-injection";
import { formatStderr } from "./format-stderr";

export interface HookResult {
  additionalContext: string;
  stderrFeedback: string;
}

export async function processUserPrompt(
  prompt: string,
  projectRoot: string
): Promise<HookResult> {
  // Get discovered context (cached)
  let context = await readCache(projectRoot);
  if (!context) {
    context = await discoverContext(projectRoot);
    await writeCache(projectRoot, context);
  }

  // Find relevant agents and skills
  const agents = findRelevantAgents(prompt, context.agents);
  const skills = findRelevantSkills(prompt, context.skills);

  // Detect stack
  const { stacks } = await detectStack(projectRoot);

  // Format outputs
  const additionalContext = formatContextInjection(agents, skills, stacks);
  const stderrFeedback = formatStderr(agents, skills, stacks);

  return { additionalContext, stderrFeedback };
}

// CLI entry point — only runs when executed directly
const isMain = typeof process !== "undefined" && process.argv[1]?.includes("user-prompt-hook");
if (isMain) {
  let input = "";
  for await (const chunk of process.stdin) {
    input += typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk);
  }

  try {
    const hookData = JSON.parse(input);
    const prompt = hookData.input?.prompt ?? hookData.prompt ?? "";
    const projectRoot = hookData.cwd ?? process.cwd();

    const { additionalContext, stderrFeedback } = await processUserPrompt(prompt, projectRoot);

    if (stderrFeedback) {
      process.stderr.write(stderrFeedback + "\n");
    }

    if (additionalContext) {
      console.log(JSON.stringify({ additionalContext }));
    }
  } catch (err) {
    // Silent failure — never block the user's prompt
    process.stderr.write(`[enhance] hook error: ${err}\n`);
  }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/injection/user-prompt-hook.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/injection/user-prompt-hook.ts tests/injection/user-prompt-hook.test.ts
git commit -m "feat: add UserPromptSubmit hook for auto context injection"
```

---

## Phase 3: PreToolUse Agent Hook

### Task 8: Add agent frontmatter skill checker

Implements Check 1 of the 3-check logic: does the agent already have the skill in its frontmatter/body?

**Files:**
- Create: `src/injection/agent-has-skill.ts`
- Create: `tests/injection/agent-has-skill.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/injection/agent-has-skill.test.ts
import { describe, expect, it } from "bun:test";
import { agentHasSkill } from "../../src/injection/agent-has-skill";

describe("agentHasSkill", () => {
  it("returns true when agent body mentions skill by name", () => {
    const body = "This agent follows /systematic-debugging workflow for all bug fixes.";
    expect(agentHasSkill(body, "systematic-debugging")).toBe(true);
  });

  it("returns true when agent body mentions skill with description", () => {
    const body = "Uses systematic-debugging approach to diagnose issues.";
    expect(agentHasSkill(body, "systematic-debugging")).toBe(true);
  });

  it("returns false when skill not mentioned", () => {
    const body = "This agent builds frontend components with React.";
    expect(agentHasSkill(body, "systematic-debugging")).toBe(false);
  });

  it("returns false for empty body", () => {
    expect(agentHasSkill("", "systematic-debugging")).toBe(false);
  });

  it("is case insensitive", () => {
    const body = "Uses Systematic-Debugging for complex issues.";
    expect(agentHasSkill(body, "systematic-debugging")).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/injection/agent-has-skill.test.ts`
Expected: FAIL

**Step 3: Write the checker**

```typescript
// src/injection/agent-has-skill.ts

/**
 * Check 1: Does the agent already reference this skill in its body/frontmatter?
 * If so, the skill is already "built-in" to the agent — no need to inject.
 */
export function agentHasSkill(agentBody: string, skillName: string): boolean {
  if (!agentBody || !skillName) return false;

  const lowerBody = agentBody.toLowerCase();
  const lowerSkill = skillName.toLowerCase();

  // Check for /skill-name reference
  if (lowerBody.includes(`/${lowerSkill}`)) return true;

  // Check for skill-name as standalone word
  const pattern = new RegExp(`\\b${lowerSkill.replace(/-/g, "[\\s-]")}\\b`, "i");
  return pattern.test(agentBody);
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/injection/agent-has-skill.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/injection/agent-has-skill.ts tests/injection/agent-has-skill.test.ts
git commit -m "feat: add agent frontmatter skill checker (Check 1 of 3)"
```

---

### Task 9: Add skill-adds-value checker

Implements Check 3: Does the skill add something the agent doesn't already know? Compare agent description with skill description.

**Files:**
- Create: `src/injection/skill-adds-value.ts`
- Create: `tests/injection/skill-adds-value.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/injection/skill-adds-value.test.ts
import { describe, expect, it } from "bun:test";
import { skillAddsValue } from "../../src/injection/skill-adds-value";

describe("skillAddsValue", () => {
  it("returns true when skill covers area agent does not", () => {
    // Agent is backend, skill is debugging — different domains
    const agentDesc = "Build backend APIs and services with NestJS, Express";
    const skillDesc = "Use when encountering any bug, test failure, or unexpected behavior";
    expect(skillAddsValue(agentDesc, skillDesc)).toBe(true);
  });

  it("returns false when agent already covers skill area", () => {
    // Agent already describes debugging
    const agentDesc = "Diagnose and fix bugs, identify root causes, debug test failures";
    const skillDesc = "Use when encountering any bug, test failure, or unexpected behavior";
    expect(skillAddsValue(agentDesc, skillDesc)).toBe(false);
  });

  it("returns true for complementary but different skills", () => {
    const agentDesc = "Build frontend React components with TypeScript";
    const skillDesc = "Test driven development workflow, write tests first";
    expect(skillAddsValue(agentDesc, skillDesc)).toBe(true);
  });

  it("returns true when both descriptions are empty (safe default)", () => {
    expect(skillAddsValue("", "")).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/injection/skill-adds-value.test.ts`
Expected: FAIL

**Step 3: Write the checker**

```typescript
// src/injection/skill-adds-value.ts
import { tokenize, jaccardSimilarity } from "../shared/similarity";

/**
 * Check 3: Does the skill add something the agent doesn't already know?
 * High overlap (>= 60%) means the agent already covers this area.
 */
const OVERLAP_THRESHOLD = 0.6;

export function skillAddsValue(agentDescription: string, skillDescription: string): boolean {
  if (!agentDescription || !skillDescription) return true; // safe default: inject

  const agentTokens = tokenize(agentDescription);
  const skillTokens = tokenize(skillDescription);

  const overlap = jaccardSimilarity(agentTokens, skillTokens);
  return overlap < OVERLAP_THRESHOLD;
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/injection/skill-adds-value.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/injection/skill-adds-value.ts tests/injection/skill-adds-value.test.ts
git commit -m "feat: add skill-adds-value checker (Check 3 of 3)"
```

---

### Task 10: Build PreToolUse Agent hook entry point

The hook that intercepts agent spawning and injects relevant skills into the subagent prompt. Implements the full 3-check logic.

**Files:**
- Create: `src/injection/agent-tool-hook.ts`
- Create: `tests/injection/agent-tool-hook.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/injection/agent-tool-hook.test.ts
import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { processAgentToolUse } from "../../src/injection/agent-tool-hook";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const TEST_DIR = join(tmpdir(), "agent-hook-test-" + Date.now());

beforeEach(() => {
  mkdirSync(join(TEST_DIR, ".claude", "agents", "performance"), { recursive: true });
  mkdirSync(join(TEST_DIR, ".claude", "skills", "systematic-debugging"), { recursive: true });
  mkdirSync(join(TEST_DIR, ".claude", "skills", "test-driven-development"), { recursive: true });

  // Agent that already knows about systematic-debugging
  writeFileSync(
    join(TEST_DIR, ".claude", "agents", "performance", "debugger.md"),
    "---\nname: debugger\ndescription: 'Diagnose and fix bugs, identify root causes'\n---\nFollows /systematic-debugging workflow."
  );

  writeFileSync(
    join(TEST_DIR, ".claude", "skills", "systematic-debugging", "SKILL.md"),
    "---\nname: systematic-debugging\ndescription: 'Use when encountering any bug or test failure'\n---\nStep 1: Reproduce..."
  );

  writeFileSync(
    join(TEST_DIR, ".claude", "skills", "test-driven-development", "SKILL.md"),
    "---\nname: test-driven-development\ndescription: 'Write tests before implementation code'\n---\nStep 1: Write failing test..."
  );
});

afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

describe("processAgentToolUse", () => {
  it("skips injection when agent already has skill in body (Check 1)", async () => {
    const result = await processAgentToolUse(
      "debugger",
      "Fix the login bug",
      TEST_DIR
    );
    // systematic-debugging should NOT be injected — debugger.md already references it
    expect(result.additionalContext).not.toContain("systematic-debugging");
  });

  it("injects skill when agent lacks it and it's relevant (Checks 2+3 pass)", async () => {
    const result = await processAgentToolUse(
      "debugger",
      "Fix the login bug and add tests",
      TEST_DIR
    );
    // tdd is relevant to "add tests" and debugger doesn't know about it
    expect(result.additionalContext).toContain("test-driven-development");
  });

  it("returns empty when no skills are relevant", async () => {
    const result = await processAgentToolUse(
      "debugger",
      "rename this variable",
      TEST_DIR
    );
    expect(result.additionalContext).toBe("");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/injection/agent-tool-hook.test.ts`
Expected: FAIL

**Step 3: Write the hook logic**

```typescript
// src/injection/agent-tool-hook.ts
import { readFile } from "fs/promises";
import { readdir } from "fs/promises";
import { join, basename, dirname } from "path";
import { discoverContext } from "../discovery/discover";
import { readCache, writeCache } from "../discovery/cache";
import { findRelevantSkills } from "../shared/relevance";
import { agentHasSkill } from "./agent-has-skill";
import { skillAddsValue } from "./skill-adds-value";
import { formatStderr } from "./format-stderr";

export interface AgentHookResult {
  additionalContext: string;
  stderrFeedback: string;
}

/** Read the raw body of an agent file by agent name. */
async function readAgentBody(projectRoot: string, agentName: string): Promise<{ body: string; description: string } | null> {
  const agentsDir = join(projectRoot, ".claude", "agents");
  try {
    const categories = await readdir(agentsDir, { withFileTypes: true });
    for (const cat of categories) {
      if (!cat.isDirectory()) continue;
      const files = await readdir(join(agentsDir, cat.name));
      for (const file of files) {
        if (!file.endsWith(".md")) continue;
        const content = await readFile(join(agentsDir, cat.name, file), "utf-8");
        // Quick check: does this file define the agent?
        const nameMatch = content.match(/^name:\s*(.+)$/m);
        if (nameMatch && nameMatch[1].trim() === agentName) {
          const descMatch = content.match(/^description:\s*['"](.+?)['"]$/m);
          const frontmatterEnd = content.indexOf("---", 3);
          const body = frontmatterEnd !== -1 ? content.slice(frontmatterEnd + 3) : content;
          return {
            body,
            description: descMatch?.[1]?.trim() ?? "",
          };
        }
      }
    }
  } catch {
    // agents dir doesn't exist
  }
  return null;
}

export async function processAgentToolUse(
  agentName: string,
  prompt: string,
  projectRoot: string
): Promise<AgentHookResult> {
  // Get discovered context
  let context = await readCache(projectRoot);
  if (!context) {
    context = await discoverContext(projectRoot);
    await writeCache(projectRoot, context);
  }

  // Find skills relevant to the subagent's prompt
  const relevantSkills = findRelevantSkills(prompt, context.skills);
  if (relevantSkills.length === 0) {
    return { additionalContext: "", stderrFeedback: "" };
  }

  // Read agent body for 3-check logic
  const agentData = await readAgentBody(projectRoot, agentName);

  // Apply 3-check filter
  const skillsToInject = relevantSkills.filter((skill) => {
    // Check 1: Agent already has skill in body?
    if (agentData && agentHasSkill(agentData.body, skill.name)) return false;

    // Check 2: Already passed — skill is relevant (from findRelevantSkills)

    // Check 3: Skill adds value beyond what agent already knows?
    if (agentData && !skillAddsValue(agentData.description, skill.description)) return false;

    return true;
  });

  if (skillsToInject.length === 0) {
    return { additionalContext: "", stderrFeedback: "" };
  }

  const contextLines = skillsToInject.map(
    (s) => `  /${s.name} — ${s.description}`
  );
  const additionalContext =
    `Relevant skills for this task:\n` + contextLines.join("\n");

  const stderrFeedback = formatStderr([], skillsToInject, []);

  return { additionalContext, stderrFeedback };
}

// CLI entry point — only runs when executed directly
const isMain = typeof process !== "undefined" && process.argv[1]?.includes("agent-tool-hook");
if (isMain) {
  let input = "";
  for await (const chunk of process.stdin) {
    input += typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk);
  }

  try {
    const hookData = JSON.parse(input);
    const agentName = hookData.input?.subagent_type ?? hookData.input?.agent ?? "";
    const prompt = hookData.input?.prompt ?? "";
    const projectRoot = hookData.cwd ?? process.cwd();

    const { additionalContext, stderrFeedback } = await processAgentToolUse(
      agentName,
      prompt,
      projectRoot
    );

    if (stderrFeedback) {
      process.stderr.write(stderrFeedback + "\n");
    }

    if (additionalContext) {
      console.log(JSON.stringify({ additionalContext }));
    }
  } catch (err) {
    process.stderr.write(`[enhance] agent hook error: ${err}\n`);
  }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/injection/agent-tool-hook.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/injection/agent-tool-hook.ts tests/injection/agent-tool-hook.test.ts
git commit -m "feat: add PreToolUse:Agent hook with 3-check skill injection"
```

---

## Phase 4: Session Context

### Task 11: Add session context tracking

Track current feature/branch/stack across prompts in `.claude/session.json`.

**Files:**
- Create: `src/injection/session.ts`
- Create: `tests/injection/session.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/injection/session.test.ts
import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { readSession, updateSession } from "../../src/injection/session";
import { mkdirSync, rmSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const TEST_DIR = join(tmpdir(), "session-test-" + Date.now());

beforeEach(() => mkdirSync(join(TEST_DIR, ".claude"), { recursive: true }));
afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

describe("readSession", () => {
  it("returns null when no session file exists", async () => {
    const session = await readSession(TEST_DIR);
    expect(session).toBeNull();
  });

  it("reads existing session file", async () => {
    const data = { branch: "feat/auth", activeStacks: ["nestjs"], lastEnhancedAt: "2026-03-23" };
    const sessionPath = join(TEST_DIR, ".claude", "session.json");
    await Bun.write(sessionPath, JSON.stringify(data));
    const session = await readSession(TEST_DIR);
    expect(session?.branch).toBe("feat/auth");
  });
});

describe("updateSession", () => {
  it("creates session file with branch and stacks", async () => {
    await updateSession(TEST_DIR, { branch: "feat/payments", activeStacks: ["nestjs", "prisma"] });
    const session = await readSession(TEST_DIR);
    expect(session?.branch).toBe("feat/payments");
    expect(session?.activeStacks).toEqual(["nestjs", "prisma"]);
    expect(session?.lastEnhancedAt).toBeDefined();
  });

  it("merges with existing session", async () => {
    await updateSession(TEST_DIR, { branch: "feat/auth", activeStacks: ["nestjs"] });
    await updateSession(TEST_DIR, { activeStacks: ["nestjs", "prisma"] });
    const session = await readSession(TEST_DIR);
    expect(session?.branch).toBe("feat/auth");
    expect(session?.activeStacks).toEqual(["nestjs", "prisma"]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/injection/session.test.ts`
Expected: FAIL

**Step 3: Write session module**

```typescript
// src/injection/session.ts
import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";

export interface SessionContext {
  branch?: string;
  activeStacks?: string[];
  lastEnhancedAt?: string;
}

const SESSION_FILE = "session.json";

function sessionPath(projectRoot: string): string {
  return join(projectRoot, ".claude", SESSION_FILE);
}

export async function readSession(projectRoot: string): Promise<SessionContext | null> {
  try {
    const content = await readFile(sessionPath(projectRoot), "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export async function updateSession(
  projectRoot: string,
  updates: Partial<SessionContext>
): Promise<void> {
  const existing = (await readSession(projectRoot)) ?? {};
  const merged: SessionContext = {
    ...existing,
    ...Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    ),
    lastEnhancedAt: new Date().toISOString(),
  };

  const dir = join(projectRoot, ".claude");
  await mkdir(dir, { recursive: true });
  await writeFile(sessionPath(projectRoot), JSON.stringify(merged, null, 2) + "\n");
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/injection/session.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/injection/session.ts tests/injection/session.test.ts
git commit -m "feat: add session context tracking in .claude/session.json"
```

---

## Phase 5: Config, Setup & Install Updates

### Task 12: Extend EnhancerConfig with injection settings

Add new config fields: `autoInject` (boolean) and `agentSkillMapping` (manual overrides).

**Files:**
- Modify: `src/discovery/types.ts`
- Modify: `src/discovery/load-config.ts`
- Modify: `tests/discovery/load-config.test.ts`

**Step 1: Add a failing test for new config fields**

Add to `tests/discovery/load-config.test.ts`:

```typescript
it("parses autoInject field", () => {
  const config = parseEnhancerConfig({ autoInject: true });
  expect(config.autoInject).toBe(true);
});

it("defaults autoInject to true", () => {
  const config = parseEnhancerConfig({});
  expect(config.autoInject).toBe(true);
});

it("parses agentSkillMapping", () => {
  const config = parseEnhancerConfig({
    agentSkillMapping: {
      debugger: ["systematic-debugging", "verification-before-completion"],
    },
  });
  expect(config.agentSkillMapping.debugger).toEqual([
    "systematic-debugging",
    "verification-before-completion",
  ]);
});

it("defaults agentSkillMapping to empty object", () => {
  const config = parseEnhancerConfig({});
  expect(config.agentSkillMapping).toEqual({});
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/discovery/load-config.test.ts`
Expected: FAIL — `autoInject` and `agentSkillMapping` not in config

**Step 3: Update types and config parser**

In `src/discovery/types.ts`, add to `EnhancerConfig`:

```typescript
export interface EnhancerConfig {
  aliases: Record<string, string>;
  defaultGuards: string[];
  conventions: string[];
  excludeAgents: string[];
  autoInject: boolean;
  agentSkillMapping: Record<string, string[]>;
}
```

In `src/discovery/load-config.ts`:

```typescript
export function parseEnhancerConfig(raw: Record<string, any>): EnhancerConfig {
  return {
    aliases: raw.aliases ?? {},
    defaultGuards: raw.defaultGuards ?? [],
    conventions: raw.conventions ?? [],
    excludeAgents: raw.excludeAgents ?? [],
    autoInject: raw.autoInject ?? true,
    agentSkillMapping: raw.agentSkillMapping ?? {},
  };
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/discovery/load-config.test.ts`
Expected: PASS

**Step 5: Run all existing tests to verify no regressions**

Run: `bun test`
Expected: ALL PASS

**Step 6: Commit**

```bash
git add src/discovery/types.ts src/discovery/load-config.ts tests/discovery/load-config.test.ts
git commit -m "feat: add autoInject and agentSkillMapping to EnhancerConfig"
```

---

### Task 13: Update setup-hook.ts to register new hooks

Extend the hook setup to register `UserPromptSubmit` and `PreToolUse` hooks alongside the existing `SessionStart` hook.

**Files:**
- Modify: `src/setup-hook.ts`

**Step 1: Read current setup-hook.ts** (already read above)

**Step 2: Update to register all three hooks**

Replace the entire `src/setup-hook.ts` with:

```typescript
// src/setup-hook.ts
// Manages hooks in settings.json: SessionStart (cache), UserPromptSubmit (auto-inject), PreToolUse (agent skill inject)
// Usage: bun setup-hook.ts [--settings-path <path>] [--install-dir <path>]          (install)
//        bun setup-hook.ts --remove [--settings-path <path>] [--install-dir <path>]  (uninstall)
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";

function getArgValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 && idx + 1 < process.argv.length ? process.argv[idx + 1] : undefined;
}

const SETTINGS_PATH = getArgValue("--settings-path") ?? join(process.env.HOME!, ".claude", "settings.json");
const installDir = getArgValue("--install-dir") ?? join(process.env.HOME!, ".claude", "skills", "enhance");
const isUserLevel = installDir.startsWith(join(process.env.HOME!, ".claude"));
const scriptBase = isUserLevel
  ? "~/.claude/skills/enhance/scripts"
  : ".claude/skills/enhance/scripts";

const HOOK_MARKER = "skills/enhance/scripts/";

function makeCommand(scriptName: string): string {
  const scriptPath = `${scriptBase}/${scriptName}`;
  return [
    "if command -v bun &>/dev/null;",
    `then bun ${scriptPath};`,
    "elif command -v node &>/dev/null;",
    `then node --experimental-strip-types ${scriptPath};`,
    "fi",
  ].join(" ");
}

function isOurHook(entry: any): boolean {
  if (Array.isArray(entry.hooks)) {
    return entry.hooks.some((h: any) => h.command?.includes(HOOK_MARKER));
  }
  return entry.command?.includes(HOOK_MARKER);
}

const remove = process.argv.includes("--remove");

let settings: Record<string, any> = {};
try {
  settings = JSON.parse(readFileSync(SETTINGS_PATH, "utf-8"));
} catch {
  // No settings file or invalid JSON — start fresh
}

if (remove) {
  // Remove all our hooks from all event types
  for (const event of ["SessionStart", "UserPromptSubmit", "PreToolUse"]) {
    const hooks = settings.hooks?.[event];
    if (Array.isArray(hooks)) {
      settings.hooks[event] = hooks.filter((h: any) => !isOurHook(h));
      if (settings.hooks[event].length === 0) delete settings.hooks[event];
    }
  }
  if (settings.hooks && Object.keys(settings.hooks).length === 0) delete settings.hooks;

  if (Object.keys(settings).length === 0) {
    try {
      const { unlinkSync } = require("fs");
      unlinkSync(SETTINGS_PATH);
      console.log("Removed all enhance hooks (settings.json cleaned up)");
    } catch {}
    process.exit(0);
  }
} else {
  if (!settings.hooks) settings.hooks = {};

  // 1. SessionStart — cache pre-warming (silent)
  if (!Array.isArray(settings.hooks.SessionStart)) settings.hooks.SessionStart = [];
  if (!settings.hooks.SessionStart.some((h: any) => isOurHook(h))) {
    settings.hooks.SessionStart.push({
      matcher: "startup",
      hooks: [{ type: "command", command: makeCommand("cli.ts") + " > /dev/null 2>&1" }],
    });
  }

  // 2. UserPromptSubmit — auto context injection
  if (!Array.isArray(settings.hooks.UserPromptSubmit)) settings.hooks.UserPromptSubmit = [];
  if (!settings.hooks.UserPromptSubmit.some((h: any) => isOurHook(h))) {
    settings.hooks.UserPromptSubmit.push({
      matcher: "",
      hooks: [{ type: "command", command: makeCommand("user-prompt-hook.ts") }],
    });
  }

  // 3. PreToolUse — agent skill injection
  if (!Array.isArray(settings.hooks.PreToolUse)) settings.hooks.PreToolUse = [];
  if (!settings.hooks.PreToolUse.some((h: any) => isOurHook(h))) {
    settings.hooks.PreToolUse.push({
      matcher: "Agent",
      hooks: [{ type: "command", command: makeCommand("agent-tool-hook.ts") }],
    });
  }
}

mkdirSync(dirname(SETTINGS_PATH), { recursive: true });
writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2) + "\n");
console.log(remove ? "Removed all enhance hooks" : "Added SessionStart, UserPromptSubmit, and PreToolUse hooks");
```

**Step 3: Run all tests**

Run: `bun test`
Expected: ALL PASS (setup-hook tests may need updating if they exist)

**Step 4: Commit**

```bash
git add src/setup-hook.ts
git commit -m "feat: register UserPromptSubmit and PreToolUse hooks in setup"
```

---

### Task 14: Update install.sh to copy injection scripts

**Files:**
- Modify: `install.sh`

**Step 1: Read current install.sh**

Run: Read `install.sh` to understand current copy logic.

**Step 2: Add copy commands for injection scripts**

After the existing copy of `src/discovery/*.ts`, add:

```bash
# Copy injection scripts
echo "  Copying injection scripts..."
cp "$SOURCE_DIR/src/injection/user-prompt-hook.ts" "$ENHANCE_SCRIPTS/"
cp "$SOURCE_DIR/src/injection/agent-tool-hook.ts" "$ENHANCE_SCRIPTS/"
cp "$SOURCE_DIR/src/injection/format-stderr.ts" "$ENHANCE_SCRIPTS/"
cp "$SOURCE_DIR/src/injection/format-context-injection.ts" "$ENHANCE_SCRIPTS/"
cp "$SOURCE_DIR/src/injection/agent-has-skill.ts" "$ENHANCE_SCRIPTS/"
cp "$SOURCE_DIR/src/injection/skill-adds-value.ts" "$ENHANCE_SCRIPTS/"
cp "$SOURCE_DIR/src/injection/session.ts" "$ENHANCE_SCRIPTS/"

# Copy shared modules
echo "  Copying shared modules..."
cp "$SOURCE_DIR/src/shared/similarity.ts" "$ENHANCE_SCRIPTS/"
cp "$SOURCE_DIR/src/shared/intent.ts" "$ENHANCE_SCRIPTS/"
cp "$SOURCE_DIR/src/shared/stack-detect.ts" "$ENHANCE_SCRIPTS/"
cp "$SOURCE_DIR/src/shared/relevance.ts" "$ENHANCE_SCRIPTS/"
```

Also add sed rewrites for import paths since the installed layout is flat:

```bash
# Rewrite injection script imports for flat layout
for f in "$ENHANCE_SCRIPTS"/user-prompt-hook.ts \
         "$ENHANCE_SCRIPTS"/agent-tool-hook.ts \
         "$ENHANCE_SCRIPTS"/format-context-injection.ts \
         "$ENHANCE_SCRIPTS"/format-stderr.ts \
         "$ENHANCE_SCRIPTS"/agent-has-skill.ts \
         "$ENHANCE_SCRIPTS"/skill-adds-value.ts \
         "$ENHANCE_SCRIPTS"/session.ts; do
  sed -i.bak 's|from "../discovery/|from "./|g' "$f"
  sed -i.bak 's|from "../shared/|from "./|g' "$f"
  sed -i.bak 's|from "./format-|from "./format-|g' "$f"
  rm -f "$f.bak"
done

for f in "$ENHANCE_SCRIPTS"/relevance.ts \
         "$ENHANCE_SCRIPTS"/similarity.ts \
         "$ENHANCE_SCRIPTS"/intent.ts \
         "$ENHANCE_SCRIPTS"/stack-detect.ts; do
  sed -i.bak 's|from "../discovery/|from "./|g' "$f"
  rm -f "$f.bak"
done
```

**Step 3: Test installation**

Run: `LOCAL_REPO=/Users/dragolea/Developer/personal-projects/claude-prompt-enhancer bun test tests/install.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add install.sh
git commit -m "feat: update install.sh to copy injection and shared scripts"
```

---

### Task 15: Update uninstall.sh

Ensure uninstall removes the new hooks (UserPromptSubmit, PreToolUse) along with existing ones.

**Files:**
- Modify: `uninstall.sh`

**Step 1: Verify uninstall already calls `setup-hook.ts --remove`** — it does, and Task 13 already updated setup-hook.ts to remove all three hook types. No code change needed unless uninstall script has hardcoded hook names.

**Step 2: Read and verify uninstall.sh, update if needed**

The existing `setup-hook.ts --remove` now handles all three hooks, so uninstall.sh should work as-is. Verify with a test.

**Step 3: Commit** (only if changes were made)

```bash
git add uninstall.sh
git commit -m "chore: verify uninstall removes all hook types"
```

---

## Phase 6: Integration & Polish

### Task 16: Wire session updates into UserPromptSubmit hook

Update `user-prompt-hook.ts` to write session context after each injection.

**Files:**
- Modify: `src/injection/user-prompt-hook.ts`

**Step 1: Add session update to processUserPrompt**

After the existing logic in `processUserPrompt`, add:

```typescript
import { updateSession } from "./session";

// ... inside processUserPrompt, after stack detection:

// Update session context
const branch = await getCurrentBranch(projectRoot);
await updateSession(projectRoot, {
  branch: branch ?? undefined,
  activeStacks: stacks.length > 0 ? stacks : undefined,
}).catch(() => {}); // non-fatal
```

Add helper for git branch:

```typescript
import { execSync } from "child_process";

function getCurrentBranch(projectRoot: string): string | null {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", {
      cwd: projectRoot,
      encoding: "utf-8",
      timeout: 2000,
    }).trim();
  } catch {
    return null;
  }
}
```

**Step 2: Update test to verify session is written**

Add to `tests/injection/user-prompt-hook.test.ts`:

```typescript
it("updates session context after injection", async () => {
  await processUserPrompt("fix the login bug", TEST_DIR);
  const sessionPath = join(TEST_DIR, ".claude", "session.json");
  const session = JSON.parse(readFileSync(sessionPath, "utf-8"));
  expect(session.lastEnhancedAt).toBeDefined();
});
```

**Step 3: Run tests**

Run: `bun test tests/injection/user-prompt-hook.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/injection/user-prompt-hook.ts tests/injection/user-prompt-hook.test.ts
git commit -m "feat: wire session context updates into UserPromptSubmit hook"
```

---

### Task 17: Respect autoInject config flag

When `autoInject: false` in enhancer-config.json, the UserPromptSubmit hook should be a no-op.

**Files:**
- Modify: `src/injection/user-prompt-hook.ts`
- Add test to: `tests/injection/user-prompt-hook.test.ts`

**Step 1: Add failing test**

```typescript
it("returns empty when autoInject is false", async () => {
  writeFileSync(
    join(TEST_DIR, ".claude", "enhancer-config.json"),
    JSON.stringify({ autoInject: false })
  );
  const result = await processUserPrompt("fix the login bug", TEST_DIR);
  expect(result.additionalContext).toBe("");
});
```

**Step 2: Run test — fails**

**Step 3: Add check at top of processUserPrompt**

```typescript
// Check if auto-inject is disabled
if (context.config && context.config.autoInject === false) {
  return { additionalContext: "", stderrFeedback: "" };
}
```

**Step 4: Run test — passes**

**Step 5: Commit**

```bash
git add src/injection/user-prompt-hook.ts tests/injection/user-prompt-hook.test.ts
git commit -m "feat: respect autoInject config flag in UserPromptSubmit hook"
```

---

### Task 18: Support manual agentSkillMapping overrides in PreToolUse hook

When `agentSkillMapping` is configured, use it as override before falling back to auto-detection.

**Files:**
- Modify: `src/injection/agent-tool-hook.ts`
- Add test to: `tests/injection/agent-tool-hook.test.ts`

**Step 1: Add failing test**

```typescript
it("uses agentSkillMapping override from config", async () => {
  writeFileSync(
    join(TEST_DIR, ".claude", "enhancer-config.json"),
    JSON.stringify({
      agentSkillMapping: {
        debugger: ["test-driven-development"],
      },
    })
  );
  const result = await processAgentToolUse("debugger", "do something", TEST_DIR);
  // Should inject tdd even though prompt doesn't match — config override
  expect(result.additionalContext).toContain("test-driven-development");
});
```

**Step 2: Run test — fails**

**Step 3: Add config override logic to processAgentToolUse**

At the start of the function, after loading context:

```typescript
// Check for manual mapping override
if (context.config?.agentSkillMapping?.[agentName]) {
  const mappedSkillNames = context.config.agentSkillMapping[agentName];
  const mappedSkills = context.skills.filter((s) =>
    mappedSkillNames.includes(s.name)
  );
  if (mappedSkills.length > 0) {
    // Still apply Check 1 (agent already has skill)
    const filtered = agentData
      ? mappedSkills.filter((s) => !agentHasSkill(agentData.body, s.name))
      : mappedSkills;

    if (filtered.length > 0) {
      const contextLines = filtered.map((s) => `  /${s.name} — ${s.description}`);
      return {
        additionalContext: "Relevant skills for this task:\n" + contextLines.join("\n"),
        stderrFeedback: formatStderr([], filtered, []),
      };
    }
  }
}
```

**Step 4: Run test — passes**

**Step 5: Commit**

```bash
git add src/injection/agent-tool-hook.ts tests/injection/agent-tool-hook.test.ts
git commit -m "feat: support agentSkillMapping config overrides in PreToolUse hook"
```

---

### Task 19: Run full test suite and fix any regressions

**Step 1: Run all tests**

Run: `bun test`
Expected: ALL PASS

**Step 2: Fix any failures** — adjust imports, thresholds, or test fixtures as needed.

**Step 3: Commit**

```bash
git add -A
git commit -m "fix: resolve test regressions from auto-injection feature"
```

---

### Task 20: Update CLAUDE.md with new architecture

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Add new sections to CLAUDE.md**

Add under Architecture:

```markdown
### Injection Hooks (`src/injection/`)

Auto context injection system — the core of the project. Two hooks that run silently:

1. **`user-prompt-hook.ts`** — `UserPromptSubmit` hook. Reads stdin (prompt JSON), runs discovery + intent detection + relevance matching, outputs `additionalContext` (stdout) and CLI feedback (stderr).
2. **`agent-tool-hook.ts`** — `PreToolUse` hook with `Agent` matcher. Intercepts subagent spawning, applies 3-check logic (agent has skill? → skill relevant? → skill adds value?), injects relevant skills into subagent context.
3. **`format-stderr.ts`** — Formats compact CLI feedback for stderr.
4. **`format-context-injection.ts`** — Formats `additionalContext` string for Claude.
5. **`agent-has-skill.ts`** — Check 1: does agent body already reference the skill?
6. **`skill-adds-value.ts`** — Check 3: does skill add knowledge the agent lacks? (Jaccard comparison)
7. **`session.ts`** — Reads/writes `.claude/session.json` for cross-prompt continuity.

### Shared Utilities (`src/shared/`)

Modules used by both injection hooks and audit:

1. **`similarity.ts`** — Jaccard similarity + tokenization (extracted from audit).
2. **`intent.ts`** — Detects prompt intent (debug, feature, refactor, test, etc.) from keywords.
3. **`stack-detect.ts`** — Detects project stack from config files (Expo, NestJS, Next.js, SAP CAP, Prisma).
4. **`relevance.ts`** — Finds relevant agents/skills for a prompt using intent + Jaccard scoring.
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with injection hooks and shared modules architecture"
```

---

## Summary of New File Structure

```
src/
├── shared/                          # NEW — shared utilities
│   ├── similarity.ts                # Jaccard (extracted from audit)
│   ├── intent.ts                    # Intent detection
│   ├── stack-detect.ts              # Stack detection from config files
│   └── relevance.ts                 # Agent/skill relevance matching
├── injection/                       # NEW — auto injection hooks
│   ├── user-prompt-hook.ts          # UserPromptSubmit entry point
│   ├── agent-tool-hook.ts           # PreToolUse:Agent entry point
│   ├── format-stderr.ts             # CLI feedback formatter
│   ├── format-context-injection.ts  # additionalContext formatter
│   ├── agent-has-skill.ts           # Check 1: agent has skill?
│   ├── skill-adds-value.ts          # Check 3: skill adds value?
│   └── session.ts                   # Session context tracking
├── discovery/                       # EXISTING — unchanged except types.ts
│   ├── types.ts                     # +autoInject, +agentSkillMapping
│   ├── load-config.ts               # Updated to parse new fields
│   └── ... (rest unchanged)
├── audit/                           # EXISTING — overlapping-descriptions imports from shared
│   └── rules/overlapping-descriptions.ts  # Re-imports from shared/similarity
├── format-context.ts                # EXISTING — unchanged
└── setup-hook.ts                    # UPDATED — registers 3 hooks

tests/
├── shared/                          # NEW
│   ├── similarity.test.ts
│   ├── intent.test.ts
│   ├── stack-detect.test.ts
│   └── relevance.test.ts
├── injection/                       # NEW
│   ├── user-prompt-hook.test.ts
│   ├── agent-tool-hook.test.ts
│   ├── format-stderr.test.ts
│   ├── format-context-injection.test.ts
│   ├── agent-has-skill.test.ts
│   ├── skill-adds-value.test.ts
│   └── session.test.ts
├── discovery/                       # EXISTING — load-config test updated
└── audit/                           # EXISTING — unchanged
```

## Out of Scope (Future Work)

These items from the conversation are deferred:

1. **Extract /audit to separate repo** — separate initiative, not part of this plan
2. **README rewrite with new positioning** — do after code is stable
3. **`/e` alias for `/enhance`** — trivial, add to SKILL.md frontmatter later
4. **Stack-aware guards** — extend after stack detection proves useful
5. **Agent Teams awareness for large tasks** — future enhancement to relevance module
