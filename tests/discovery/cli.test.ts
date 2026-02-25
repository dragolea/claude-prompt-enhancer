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
