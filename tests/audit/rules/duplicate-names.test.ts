// tests/audit/rules/duplicate-names.test.ts
import { describe, test, expect } from "bun:test";
import { checkDuplicateNames } from "../../../src/audit/rules/duplicate-names";
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

describe("checkDuplicateNames", () => {
  test("no duplicates returns empty", () => {
    const inv = makeInventory({
      agents: [
        { name: "debugger", description: "Debug", category: "core", filePath: "a.md", body: "", hasFrontmatter: true },
        { name: "reviewer", description: "Review", category: "core", filePath: "b.md", body: "", hasFrontmatter: true },
      ],
    });
    expect(checkDuplicateNames(inv)).toHaveLength(0);
  });

  test("duplicate agent names produce error finding", () => {
    const inv = makeInventory({
      agents: [
        { name: "debugger", description: "Debug 1", category: "core", filePath: "a.md", body: "", hasFrontmatter: true },
        { name: "debugger", description: "Debug 2", category: "quality", filePath: "b.md", body: "", hasFrontmatter: true },
      ],
    });
    const findings = checkDuplicateNames(inv);
    expect(findings).toHaveLength(1);
    expect(findings[0].rule).toBe("duplicate-name");
    expect(findings[0].severity).toBe("error");
    expect(findings[0].files).toEqual(["a.md", "b.md"]);
    expect(findings[0].message).toContain("debugger");
  });

  test("duplicate skill names produce error finding", () => {
    const inv = makeInventory({
      skills: [
        { name: "tdd", description: "TDD 1", filePath: "s1.md", body: "", hasFrontmatter: true },
        { name: "tdd", description: "TDD 2", filePath: "s2.md", body: "", hasFrontmatter: true },
      ],
    });
    const findings = checkDuplicateNames(inv);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("error");
    expect(findings[0].message).toContain("tdd");
  });

  test("three agents with same name reports all files", () => {
    const inv = makeInventory({
      agents: [
        { name: "test", description: "A", category: "a", filePath: "1.md", body: "", hasFrontmatter: true },
        { name: "test", description: "B", category: "b", filePath: "2.md", body: "", hasFrontmatter: true },
        { name: "test", description: "C", category: "c", filePath: "3.md", body: "", hasFrontmatter: true },
      ],
    });
    const findings = checkDuplicateNames(inv);
    expect(findings).toHaveLength(1);
    expect(findings[0].files).toHaveLength(3);
    expect(findings[0].message).toContain("3 agents");
  });

  test("agents with empty name are skipped", () => {
    const inv = makeInventory({
      agents: [
        { name: "", description: "No name", category: "core", filePath: "a.md", body: "", hasFrontmatter: false },
        { name: "", description: "No name", category: "core", filePath: "b.md", body: "", hasFrontmatter: false },
      ],
    });
    expect(checkDuplicateNames(inv)).toHaveLength(0);
  });
});
