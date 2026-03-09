// tests/audit/rules/cross-category-collisions.test.ts
import { describe, test, expect } from "bun:test";
import { checkCrossCategoryCollisions } from "../../../src/audit/rules/cross-category-collisions";
import type { AuditInventory } from "../../../src/audit/types";

function makeInventory(overrides: Partial<AuditInventory> = {}): AuditInventory {
  return {
    agents: [],
    skills: [],
    project: { testCommand: null, lintCommand: null, framework: null, language: null },
    config: null,
    ...overrides,
  };
}

describe("checkCrossCategoryCollisions", () => {
  test("agents in same category return no findings", () => {
    const inv = makeInventory({
      agents: [
        { name: "debugger", description: "Debug", category: "core", filePath: "a.md", body: "", hasFrontmatter: true },
        { name: "reviewer", description: "Review", category: "core", filePath: "b.md", body: "", hasFrontmatter: true },
      ],
    });
    expect(checkCrossCategoryCollisions(inv)).toHaveLength(0);
  });

  test("same name in different categories produces warning", () => {
    const inv = makeInventory({
      agents: [
        { name: "debugger", description: "Debug 1", category: "performance", filePath: "perf/debugger.md", body: "", hasFrontmatter: true },
        { name: "debugger", description: "Debug 2", category: "quality", filePath: "quality/debugger.md", body: "", hasFrontmatter: true },
      ],
    });
    const findings = checkCrossCategoryCollisions(inv);
    expect(findings).toHaveLength(1);
    expect(findings[0].rule).toBe("cross-category-collision");
    expect(findings[0].severity).toBe("warn");
    expect(findings[0].message).toContain("performance");
    expect(findings[0].message).toContain("quality");
    expect(findings[0].files).toHaveLength(2);
  });

  test("different names across categories are fine", () => {
    const inv = makeInventory({
      agents: [
        { name: "perf-debugger", description: "Perf", category: "performance", filePath: "a.md", body: "", hasFrontmatter: true },
        { name: "quality-debugger", description: "Quality", category: "quality", filePath: "b.md", body: "", hasFrontmatter: true },
      ],
    });
    expect(checkCrossCategoryCollisions(inv)).toHaveLength(0);
  });

  test("agents with empty name are skipped", () => {
    const inv = makeInventory({
      agents: [
        { name: "", description: "", category: "a", filePath: "a.md", body: "", hasFrontmatter: false },
        { name: "", description: "", category: "b", filePath: "b.md", body: "", hasFrontmatter: false },
      ],
    });
    expect(checkCrossCategoryCollisions(inv)).toHaveLength(0);
  });
});
