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
