// tests/audit/format-report.test.ts
import { describe, test, expect } from "bun:test";
import { formatReport } from "../../src/audit/format-report";
import type { AuditReport } from "../../src/audit/types";

describe("formatReport", () => {
  test("clean report shows no issues", () => {
    const report: AuditReport = {
      inventory: { agents: [], skills: [] },
      findings: [],
      summary: { errors: 0, warnings: 0, infos: 0 },
    };
    const output = formatReport(report);
    expect(output).toContain("INVENTORY");
    expect(output).toContain("Agents: 0");
    expect(output).toContain("Skills: 0");
    expect(output).toContain("No issues found.");
  });

  test("shows agent and skill counts", () => {
    const report: AuditReport = {
      inventory: {
        agents: [
          { name: "debugger", description: "Debug", category: "core", filePath: "a.md", body: "", hasFrontmatter: true },
          { name: "reviewer", description: "Review", category: "quality", filePath: "b.md", body: "", hasFrontmatter: true },
        ],
        skills: [
          { name: "tdd", description: "TDD", filePath: "s.md", body: "", hasFrontmatter: true },
        ],
      },
      findings: [],
      summary: { errors: 0, warnings: 0, infos: 0 },
    };
    const output = formatReport(report);
    expect(output).toContain("Agents: 2 (across 2 categories)");
    expect(output).toContain("Skills: 1");
  });

  test("shows findings grouped by severity", () => {
    const report: AuditReport = {
      inventory: { agents: [], skills: [] },
      findings: [
        {
          rule: "duplicate-name",
          severity: "error",
          message: 'Two agents share the name "debugger"',
          files: ["a.md", "b.md"],
          suggestion: "Rename one",
        },
        {
          rule: "overlapping-descriptions",
          severity: "info",
          message: "Skills have similar descriptions",
          files: ["c.md", "d.md"],
          suggestion: "Differentiate them",
        },
      ],
      summary: { errors: 1, warnings: 0, infos: 1 },
    };
    const output = formatReport(report);
    expect(output).toContain("FINDINGS (1 error, 1 info)");
    expect(output).toContain("ERROR");
    expect(output).toContain("duplicate-name");
    expect(output).toContain("a.md");
    expect(output).toContain("b.md");
    expect(output).toContain("Fix: Rename one");
    expect(output).toContain("INFO");
  });

  test("singular vs plural labels", () => {
    const report: AuditReport = {
      inventory: { agents: [], skills: [] },
      findings: [
        { rule: "duplicate-name", severity: "error", message: "dup", files: ["a.md"], suggestion: "fix" },
        { rule: "missing-frontmatter", severity: "warn", message: "missing", files: ["b.md"], suggestion: "add" },
        { rule: "missing-frontmatter", severity: "warn", message: "missing2", files: ["c.md"], suggestion: "add" },
      ],
      summary: { errors: 1, warnings: 2, infos: 0 },
    };
    const output = formatReport(report);
    expect(output).toContain("1 error");
    expect(output).toContain("2 warnings");
  });

  test("single category label", () => {
    const report: AuditReport = {
      inventory: {
        agents: [
          { name: "a", description: "A", category: "core", filePath: "a.md", body: "", hasFrontmatter: true },
          { name: "b", description: "B", category: "core", filePath: "b.md", body: "", hasFrontmatter: true },
        ],
        skills: [],
      },
      findings: [],
      summary: { errors: 0, warnings: 0, infos: 0 },
    };
    const output = formatReport(report);
    expect(output).toContain("1 category");
  });
});
