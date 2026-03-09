// tests/audit/rules/missing-skill-deps.test.ts
import { describe, test, expect } from "bun:test";
import { checkMissingSkillDeps } from "../../../src/audit/rules/missing-skill-deps";
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

describe("checkMissingSkillDeps", () => {
  test("no skill references returns empty", () => {
    const inv = makeInventory({
      skills: [
        { name: "tdd", description: "TDD", filePath: "s.md", body: "Write tests first.", hasFrontmatter: true },
      ],
    });
    expect(checkMissingSkillDeps(inv)).toHaveLength(0);
  });

  test("reference to installed skill returns empty", () => {
    const inv = makeInventory({
      skills: [
        { name: "tdd", description: "TDD", filePath: "s.md", body: "Use /verify after writing code", hasFrontmatter: true },
        { name: "verify", description: "Verify", filePath: "v.md", body: "Run tests", hasFrontmatter: true },
      ],
    });
    expect(checkMissingSkillDeps(inv)).toHaveLength(0);
  });

  test("reference to missing skill produces warning", () => {
    const inv = makeInventory({
      skills: [
        { name: "tdd", description: "TDD", filePath: "s.md", body: "Chain to /systematic-debugging after", hasFrontmatter: true },
      ],
    });
    const findings = checkMissingSkillDeps(inv);
    expect(findings).toHaveLength(1);
    expect(findings[0].rule).toBe("missing-skill-dep");
    expect(findings[0].severity).toBe("warn");
    expect(findings[0].message).toContain("systematic-debugging");
    expect(findings[0].message).toContain("tdd");
  });

  test("filesystem paths are excluded", () => {
    const inv = makeInventory({
      skills: [
        { name: "tdd", description: "TDD", filePath: "s.md", body: "Check /usr/local/bin and /src/index.ts and /etc/config", hasFrontmatter: true },
      ],
    });
    expect(checkMissingSkillDeps(inv)).toHaveLength(0);
  });

  test("self-references are excluded", () => {
    const inv = makeInventory({
      skills: [
        { name: "tdd", description: "TDD", filePath: "s.md", body: "This is /tdd skill", hasFrontmatter: true },
      ],
    });
    expect(checkMissingSkillDeps(inv)).toHaveLength(0);
  });

  test("multiple missing refs produce multiple findings", () => {
    const inv = makeInventory({
      skills: [
        { name: "workflow", description: "Workflow", filePath: "s.md", body: "Use /brainstorm then /code-review", hasFrontmatter: true },
      ],
    });
    const findings = checkMissingSkillDeps(inv);
    expect(findings).toHaveLength(2);
  });
});
