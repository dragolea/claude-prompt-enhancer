// tests/audit/rules/overlapping-descriptions.test.ts
import { describe, test, expect } from "bun:test";
import { checkOverlappingDescriptions } from "../../../src/audit/rules/overlapping-descriptions";
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

describe("checkOverlappingDescriptions", () => {
  test("different descriptions return no findings", () => {
    const inv = makeInventory({
      skills: [
        { name: "tdd", description: "Write tests before implementation code", filePath: "a.md", body: "", hasFrontmatter: true },
        { name: "deploy", description: "Deploy applications to production servers", filePath: "b.md", body: "", hasFrontmatter: true },
      ],
    });
    expect(checkOverlappingDescriptions(inv)).toHaveLength(0);
  });

  test("very similar descriptions produce info finding", () => {
    const inv = makeInventory({
      skills: [
        { name: "tdd", description: "Write tests before implementing features", filePath: "a.md", body: "", hasFrontmatter: true },
        { name: "verify", description: "Write tests before implementing features correctly", filePath: "b.md", body: "", hasFrontmatter: true },
      ],
    });
    const findings = checkOverlappingDescriptions(inv);
    expect(findings).toHaveLength(1);
    expect(findings[0].rule).toBe("overlapping-descriptions");
    expect(findings[0].severity).toBe("info");
    expect(findings[0].message).toContain("tdd");
    expect(findings[0].message).toContain("verify");
  });

  test("identical descriptions produce finding", () => {
    const inv = makeInventory({
      skills: [
        { name: "skill-a", description: "Optimize React component performance rendering", filePath: "a.md", body: "", hasFrontmatter: true },
        { name: "skill-b", description: "Optimize React component performance rendering", filePath: "b.md", body: "", hasFrontmatter: true },
      ],
    });
    const findings = checkOverlappingDescriptions(inv);
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain("100%");
  });

  test("agent descriptions are also checked", () => {
    const inv = makeInventory({
      agents: [
        { name: "react-dev", description: "Build React components efficiently", category: "dev", filePath: "a.md", body: "", hasFrontmatter: true },
        { name: "react-pro", description: "Build React components efficiently well", category: "dev", filePath: "b.md", body: "", hasFrontmatter: true },
      ],
    });
    const findings = checkOverlappingDescriptions(inv);
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain("react-dev");
  });

  test("empty descriptions are skipped", () => {
    const inv = makeInventory({
      skills: [
        { name: "a", description: "", filePath: "a.md", body: "", hasFrontmatter: true },
        { name: "b", description: "", filePath: "b.md", body: "", hasFrontmatter: true },
      ],
    });
    expect(checkOverlappingDescriptions(inv)).toHaveLength(0);
  });
});
