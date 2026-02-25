// tests/discovery/cache.test.ts
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { readCache, writeCache } from "../../src/discovery/cache";
import { discoverContext } from "../../src/discovery/discover";

const TEST_DIR = join(import.meta.dir, "__fixtures_cache__");

function setupFixtures() {
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
}

beforeEach(() => {
  setupFixtures();
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("discovery cache", () => {
  test("cache miss on first run (no cache file)", async () => {
    const result = await readCache(TEST_DIR);
    expect(result).toBeNull();
  });

  test("cache hit after write (round-trip)", async () => {
    const context = await discoverContext(TEST_DIR);
    await writeCache(TEST_DIR, context);

    const cached = await readCache(TEST_DIR);
    expect(cached).not.toBeNull();
    expect(cached!.agents).toHaveLength(1);
    expect(cached!.agents[0].name).toBe("react-specialist");
    expect(cached!.skills).toHaveLength(1);
    expect(cached!.skills[0].name).toBe("test-driven-development");
    expect(cached!.project.testCommand).toBe("bun test");
  });

  test("invalidates when a file is added", async () => {
    const context = await discoverContext(TEST_DIR);
    await writeCache(TEST_DIR, context);

    // Add a new agent file
    writeFileSync(
      join(TEST_DIR, ".claude", "agents", "core-development", "new-agent.md"),
      `---
name: new-agent
description: 'A new agent.'
---
New.`
    );

    const cached = await readCache(TEST_DIR);
    expect(cached).toBeNull();
  });

  test("invalidates when a file is deleted", async () => {
    const context = await discoverContext(TEST_DIR);
    await writeCache(TEST_DIR, context);

    // Delete agent file
    rmSync(join(TEST_DIR, ".claude", "agents", "core-development", "react-specialist.md"));

    const cached = await readCache(TEST_DIR);
    expect(cached).toBeNull();
  });

  test("invalidates when a file is modified", async () => {
    const context = await discoverContext(TEST_DIR);
    await writeCache(TEST_DIR, context);

    // Wait a tick so mtime changes
    await Bun.sleep(10);

    // Modify agent file
    writeFileSync(
      join(TEST_DIR, ".claude", "agents", "core-development", "react-specialist.md"),
      `---
name: react-specialist
description: 'Updated description.'
---
Updated react agent.`
    );

    const cached = await readCache(TEST_DIR);
    expect(cached).toBeNull();
  });

  test("pre-warmed cache is used without re-discovery", async () => {
    // Simulates SessionStart hook having pre-warmed the cache
    const context = await discoverContext(TEST_DIR);
    await writeCache(TEST_DIR, context);

    // readCache should return data without needing discoverContext
    const cached = await readCache(TEST_DIR);
    expect(cached).not.toBeNull();
    expect(cached!.agents[0].name).toBe("react-specialist");
    expect(cached!.skills[0].name).toBe("test-driven-development");
  });

  test("handles corrupted cache gracefully", async () => {
    mkdirSync(join(TEST_DIR, ".claude", ".cache"), { recursive: true });
    writeFileSync(
      join(TEST_DIR, ".claude", ".cache", "discovery-cache.json"),
      "not valid json{{"
    );

    const cached = await readCache(TEST_DIR);
    expect(cached).toBeNull();
  });

  test("handles version mismatch gracefully", async () => {
    mkdirSync(join(TEST_DIR, ".claude", ".cache"), { recursive: true });
    writeFileSync(
      join(TEST_DIR, ".claude", ".cache", "discovery-cache.json"),
      JSON.stringify({ version: 999, fingerprint: "abc", data: {} })
    );

    const cached = await readCache(TEST_DIR);
    expect(cached).toBeNull();
  });
});
