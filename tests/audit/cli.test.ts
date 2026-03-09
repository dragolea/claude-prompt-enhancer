// tests/audit/cli.test.ts
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";

const CLI_PATH = join(import.meta.dir, "..", "..", "src", "audit", "cli.ts");
const TEST_DIR = join(import.meta.dir, "__fixtures_cli__");

beforeEach(() => {
  mkdirSync(join(TEST_DIR, ".claude", "agents", "core"), { recursive: true });
  mkdirSync(join(TEST_DIR, ".claude", "skills", "tdd"), { recursive: true });

  writeFileSync(
    join(TEST_DIR, ".claude", "agents", "core", "debugger.md"),
    `---
name: debugger
description: 'Debug code issues.'
---
Debugging agent.`
  );

  writeFileSync(
    join(TEST_DIR, ".claude", "skills", "tdd", "SKILL.md"),
    `---
name: test-driven-development
description: Use when implementing features with TDD
---
TDD skill body.`
  );
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("audit cli", () => {
  test("outputs valid JSON by default", async () => {
    const proc = Bun.spawn(["bun", CLI_PATH, TEST_DIR], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const stdout = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    expect(exitCode).toBe(0);
    const report = JSON.parse(stdout);
    expect(report).toHaveProperty("inventory");
    expect(report).toHaveProperty("findings");
    expect(report).toHaveProperty("summary");
    expect(report.inventory.agents).toBeArray();
    expect(report.inventory.skills).toBeArray();
  });

  test("--human flag outputs text format", async () => {
    const proc = Bun.spawn(["bun", CLI_PATH, TEST_DIR, "--human"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const stdout = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    expect(exitCode).toBe(0);
    expect(stdout).toContain("INVENTORY");
    expect(stdout).toContain("Agents:");
    expect(stdout).toContain("Skills:");
  });

  test("exit code 0 when no errors", async () => {
    const proc = Bun.spawn(["bun", CLI_PATH, TEST_DIR], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const exitCode = await proc.exited;
    expect(exitCode).toBe(0);
  });

  test("exit code 1 when errors found", async () => {
    // Create duplicate agent name to trigger error
    mkdirSync(join(TEST_DIR, ".claude", "agents", "quality"), { recursive: true });
    writeFileSync(
      join(TEST_DIR, ".claude", "agents", "quality", "debugger.md"),
      `---
name: debugger
description: 'Quality debugging.'
---
Quality debugger.`
    );

    const proc = Bun.spawn(["bun", CLI_PATH, TEST_DIR], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const stdout = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    expect(exitCode).toBe(1);
    const report = JSON.parse(stdout);
    expect(report.summary.errors).toBeGreaterThan(0);
  });

  test("handles empty project gracefully", async () => {
    const emptyDir = join(TEST_DIR, "empty");
    mkdirSync(emptyDir, { recursive: true });

    const proc = Bun.spawn(["bun", CLI_PATH, emptyDir], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const stdout = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    expect(exitCode).toBe(0);
    const report = JSON.parse(stdout);
    expect(report.inventory.agents).toHaveLength(0);
    expect(report.inventory.skills).toHaveLength(0);
    expect(report.findings).toHaveLength(0);
  });
});
