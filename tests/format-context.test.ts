// tests/format-context.test.ts
import { describe, test, expect } from "bun:test";
import { formatContext } from "../src/format-context";
import type { DiscoveredContext } from "../src/discovery/types";

describe("formatContext", () => {
  test("formats agents with category grouping", () => {
    const ctx: DiscoveredContext = {
      agents: [
        { name: "debugger", description: "Diagnoses bugs.", category: "performance" },
        { name: "react-specialist", description: "React optimization.", category: "core-development" },
      ],
      skills: [
        { name: "test-driven-development", description: "TDD workflow." },
      ],
      project: {
        testCommand: "bun test",
        lintCommand: "eslint .",
        framework: "react",
        language: "typescript",
      },
      config: null,
    };

    const result = formatContext(ctx);
    expect(result).toContain("@debugger");
    expect(result).toContain("@react-specialist");
    expect(result).toContain("test-driven-development");
    expect(result).toContain("bun test");
    expect(result).toContain("react");
  });

  test("includes config conventions when present", () => {
    const ctx: DiscoveredContext = {
      agents: [],
      skills: [],
      project: { testCommand: null, lintCommand: null, framework: null, language: null },
      config: {
        aliases: { "@FE": "@react-specialist" },
        defaultGuards: ["Run tests after changes"],
        conventions: ["Use Vitest, not Jest"],
        excludeAgents: [],
      },
    };

    const result = formatContext(ctx);
    expect(result).toContain("@FE → @react-specialist");
    expect(result).toContain("Run tests after changes");
    expect(result).toContain("Use Vitest, not Jest");
  });

  test("handles empty context gracefully", () => {
    const ctx: DiscoveredContext = {
      agents: [],
      skills: [],
      project: { testCommand: null, lintCommand: null, framework: null, language: null },
      config: null,
    };

    const result = formatContext(ctx);
    expect(result).toContain("No agents");
    expect(result).toContain("No skills");
  });
});
