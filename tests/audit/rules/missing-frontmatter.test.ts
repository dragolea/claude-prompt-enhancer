// tests/audit/rules/missing-frontmatter.test.ts
import { describe, test, expect } from "bun:test";
import { checkMissingFrontmatter } from "../../../src/audit/rules/missing-frontmatter";
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

describe("checkMissingFrontmatter", () => {
  test("valid frontmatter returns no findings", () => {
    const inv = makeInventory({
      agents: [
        { name: "debugger", description: "Debug", category: "core", filePath: "a.md", body: "", hasFrontmatter: true },
      ],
      skills: [
        { name: "tdd", description: "TDD", filePath: "s.md", body: "", hasFrontmatter: true },
      ],
    });
    expect(checkMissingFrontmatter(inv)).toHaveLength(0);
  });

  test("agent without frontmatter produces warning", () => {
    const inv = makeInventory({
      agents: [
        { name: "", description: "", category: "core", filePath: "broken.md", body: "just text", hasFrontmatter: false },
      ],
    });
    const findings = checkMissingFrontmatter(inv);
    expect(findings).toHaveLength(1);
    expect(findings[0].rule).toBe("missing-frontmatter");
    expect(findings[0].severity).toBe("warn");
    expect(findings[0].files).toEqual(["broken.md"]);
  });

  test("skill without frontmatter produces warning", () => {
    const inv = makeInventory({
      skills: [
        { name: "", description: "", filePath: "skill.md", body: "just text", hasFrontmatter: false },
      ],
    });
    const findings = checkMissingFrontmatter(inv);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("warn");
  });

  test("frontmatter with missing name produces warning", () => {
    const inv = makeInventory({
      agents: [
        { name: "", description: "Has desc", category: "core", filePath: "a.md", body: "", hasFrontmatter: true },
      ],
    });
    const findings = checkMissingFrontmatter(inv);
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain("name");
  });

  test("frontmatter with missing description produces warning", () => {
    const inv = makeInventory({
      skills: [
        { name: "skill-name", description: "", filePath: "s.md", body: "", hasFrontmatter: true },
      ],
    });
    const findings = checkMissingFrontmatter(inv);
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain("description");
  });
});
