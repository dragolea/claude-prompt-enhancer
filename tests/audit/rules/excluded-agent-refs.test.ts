// tests/audit/rules/excluded-agent-refs.test.ts
import { describe, test, expect } from "bun:test";
import { checkExcludedAgentRefs } from "../../../src/audit/rules/excluded-agent-refs";
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

describe("checkExcludedAgentRefs", () => {
  test("no config returns empty", () => {
    const inv = makeInventory({
      skills: [
        { name: "tdd", description: "TDD", filePath: "s.md", body: "Use @debugger for help", hasFrontmatter: true },
      ],
    });
    expect(checkExcludedAgentRefs(inv)).toHaveLength(0);
  });

  test("empty excludeAgents returns empty", () => {
    const inv = makeInventory({
      config: { aliases: {}, defaultGuards: [], conventions: [], excludeAgents: [] },
      skills: [
        { name: "tdd", description: "TDD", filePath: "s.md", body: "Use @debugger", hasFrontmatter: true },
      ],
    });
    expect(checkExcludedAgentRefs(inv)).toHaveLength(0);
  });

  test("skill referencing excluded agent produces warning", () => {
    const inv = makeInventory({
      config: { aliases: {}, defaultGuards: [], conventions: [], excludeAgents: ["mobile-developer"] },
      skills: [
        { name: "tdd", description: "TDD", filePath: "s.md", body: "Use @mobile-developer for mobile features", hasFrontmatter: true },
      ],
    });
    const findings = checkExcludedAgentRefs(inv);
    expect(findings).toHaveLength(1);
    expect(findings[0].rule).toBe("excluded-agent-ref");
    expect(findings[0].severity).toBe("warn");
    expect(findings[0].message).toContain("mobile-developer");
    expect(findings[0].message).toContain("tdd");
  });

  test("skill not referencing excluded agent is clean", () => {
    const inv = makeInventory({
      config: { aliases: {}, defaultGuards: [], conventions: [], excludeAgents: ["mobile-developer"] },
      skills: [
        { name: "tdd", description: "TDD", filePath: "s.md", body: "Use @debugger for debugging", hasFrontmatter: true },
      ],
    });
    expect(checkExcludedAgentRefs(inv)).toHaveLength(0);
  });

  test("multiple excluded agent refs produce multiple findings", () => {
    const inv = makeInventory({
      config: { aliases: {}, defaultGuards: [], conventions: [], excludeAgents: ["mobile-developer", "debugger"] },
      skills: [
        { name: "tdd", description: "TDD", filePath: "s.md", body: "Use @mobile-developer and @debugger", hasFrontmatter: true },
      ],
    });
    const findings = checkExcludedAgentRefs(inv);
    expect(findings).toHaveLength(2);
  });
});
