// tests/audit/analyze.test.ts
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { discoverForAudit } from "../../src/audit/discover-for-audit";
import { analyze } from "../../src/audit/analyze";

const TEST_DIR = join(import.meta.dir, "__fixtures__");

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

describe("analyze", () => {
  test("returns report with correct shape", async () => {
    const inventory = await discoverForAudit(TEST_DIR);
    const report = analyze(inventory);

    expect(report).toHaveProperty("inventory");
    expect(report).toHaveProperty("findings");
    expect(report).toHaveProperty("summary");
    expect(report.inventory.agents).toBeArray();
    expect(report.inventory.skills).toBeArray();
    expect(typeof report.summary.errors).toBe("number");
    expect(typeof report.summary.warnings).toBe("number");
    expect(typeof report.summary.infos).toBe("number");
  });

  test("clean project has no findings", async () => {
    const inventory = await discoverForAudit(TEST_DIR);
    const report = analyze(inventory);

    expect(report.findings).toHaveLength(0);
    expect(report.summary.errors).toBe(0);
    expect(report.summary.warnings).toBe(0);
  });

  test("discovers agents without excludeAgents filter", async () => {
    // Add config with excludeAgents
    writeFileSync(
      join(TEST_DIR, ".claude", "enhancer-config.json"),
      JSON.stringify({ excludeAgents: ["debugger"] })
    );

    const inventory = await discoverForAudit(TEST_DIR);
    // Audit should still see the excluded agent
    expect(inventory.agents.find((a) => a.name === "debugger")).toBeDefined();
  });

  test("inventory includes filePath, body, hasFrontmatter", async () => {
    const inventory = await discoverForAudit(TEST_DIR);

    expect(inventory.agents[0].filePath).toContain("debugger.md");
    expect(inventory.agents[0].body).toBe("Debugging agent.");
    expect(inventory.agents[0].hasFrontmatter).toBe(true);

    expect(inventory.skills[0].filePath).toContain("SKILL.md");
    expect(inventory.skills[0].body).toBe("TDD skill body.");
    expect(inventory.skills[0].hasFrontmatter).toBe(true);
  });

  test("findings are sorted by severity (errors first)", async () => {
    // Create duplicate agents (error) + missing frontmatter (warn)
    mkdirSync(join(TEST_DIR, ".claude", "agents", "quality"), { recursive: true });
    writeFileSync(
      join(TEST_DIR, ".claude", "agents", "quality", "debugger.md"),
      `---
name: debugger
description: 'Quality debugging.'
---
Quality debugger.`
    );
    writeFileSync(
      join(TEST_DIR, ".claude", "agents", "quality", "broken.md"),
      "No frontmatter here."
    );

    const inventory = await discoverForAudit(TEST_DIR);
    const report = analyze(inventory);

    expect(report.findings.length).toBeGreaterThan(0);
    // Errors should come before warnings
    const severities = report.findings.map((f) => f.severity);
    const errorIdx = severities.indexOf("error");
    const warnIdx = severities.indexOf("warn");
    if (errorIdx !== -1 && warnIdx !== -1) {
      expect(errorIdx).toBeLessThan(warnIdx);
    }
  });

  test("summary counts match findings", async () => {
    mkdirSync(join(TEST_DIR, ".claude", "agents", "quality"), { recursive: true });
    writeFileSync(
      join(TEST_DIR, ".claude", "agents", "quality", "debugger.md"),
      `---
name: debugger
description: 'Quality debugging.'
---
Quality debugger.`
    );

    const inventory = await discoverForAudit(TEST_DIR);
    const report = analyze(inventory);

    const errors = report.findings.filter((f) => f.severity === "error").length;
    const warnings = report.findings.filter((f) => f.severity === "warn").length;
    const infos = report.findings.filter((f) => f.severity === "info").length;
    expect(report.summary.errors).toBe(errors);
    expect(report.summary.warnings).toBe(warnings);
    expect(report.summary.infos).toBe(infos);
  });
});
