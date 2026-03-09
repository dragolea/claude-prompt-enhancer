// tests/audit/rules/contradictory-instructions.test.ts
import { describe, test, expect } from "bun:test";
import { checkContradictoryInstructions } from "../../../src/audit/rules/contradictory-instructions";
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

describe("checkContradictoryInstructions", () => {
  test("no directives returns empty", () => {
    const inv = makeInventory({
      skills: [
        { name: "tdd", description: "TDD", filePath: "a.md", body: "Write tests first.", hasFrontmatter: true },
      ],
    });
    expect(checkContradictoryInstructions(inv)).toHaveLength(0);
  });

  test("same polarity across skills returns empty", () => {
    const inv = makeInventory({
      skills: [
        { name: "skill-a", description: "A", filePath: "a.md", body: "Always write tests.", hasFrontmatter: true },
        { name: "skill-b", description: "B", filePath: "b.md", body: "Always write tests.", hasFrontmatter: true },
      ],
    });
    expect(checkContradictoryInstructions(inv)).toHaveLength(0);
  });

  test("opposite directives in same skill returns empty", () => {
    const inv = makeInventory({
      skills: [
        { name: "skill-a", description: "A", filePath: "a.md", body: "Always write tests. Never write tests.", hasFrontmatter: true },
      ],
    });
    expect(checkContradictoryInstructions(inv)).toHaveLength(0);
  });

  test("always vs never across skills produces info finding", () => {
    const inv = makeInventory({
      skills: [
        { name: "strict", description: "Strict", filePath: "a.md", body: "Always run lint checks.", hasFrontmatter: true },
        { name: "fast", description: "Fast", filePath: "b.md", body: "Never run lint checks.", hasFrontmatter: true },
      ],
    });
    const findings = checkContradictoryInstructions(inv);
    expect(findings).toHaveLength(1);
    expect(findings[0].rule).toBe("contradictory-instructions");
    expect(findings[0].severity).toBe("info");
    expect(findings[0].message).toContain("strict");
    expect(findings[0].message).toContain("fast");
  });

  test("must vs do not across skills produces finding", () => {
    const inv = makeInventory({
      skills: [
        { name: "style-a", description: "A", filePath: "a.md", body: "Must use semicolons.", hasFrontmatter: true },
        { name: "style-b", description: "B", filePath: "b.md", body: "Do not use semicolons.", hasFrontmatter: true },
      ],
    });
    const findings = checkContradictoryInstructions(inv);
    expect(findings).toHaveLength(1);
  });

  test("unrelated directives return empty", () => {
    const inv = makeInventory({
      skills: [
        { name: "skill-a", description: "A", filePath: "a.md", body: "Always write tests.", hasFrontmatter: true },
        { name: "skill-b", description: "B", filePath: "b.md", body: "Never deploy on Friday.", hasFrontmatter: true },
      ],
    });
    expect(checkContradictoryInstructions(inv)).toHaveLength(0);
  });
});
