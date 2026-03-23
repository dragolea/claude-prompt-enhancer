import { describe, expect, it } from "bun:test";
import { formatContextInjection } from "../../src/injection/format-context-injection";
import type { AgentInfo, SkillInfo } from "../../src/discovery/types";

describe("formatContextInjection", () => {
  it("formats agents with @ prefix", () => {
    const agents: AgentInfo[] = [
      { name: "debugger", description: "Diagnose and fix bugs", category: "performance" },
    ];
    const output = formatContextInjection(agents, [], []);
    expect(output).toContain("@debugger");
    expect(output).toContain("Diagnose and fix bugs");
  });

  it("formats skills with / prefix", () => {
    const skills: SkillInfo[] = [
      { name: "systematic-debugging", description: "Debug workflow for bugs" },
    ];
    const output = formatContextInjection([], skills, []);
    expect(output).toContain("/systematic-debugging");
  });

  it("includes stack context", () => {
    const output = formatContextInjection([], [], ["nestjs", "prisma"]);
    expect(output).toContain("nestjs");
    expect(output).toContain("prisma");
  });

  it("returns empty string when nothing relevant", () => {
    expect(formatContextInjection([], [], [])).toBe("");
  });

  it("combines all sections", () => {
    const agents: AgentInfo[] = [{ name: "debugger", description: "Fix bugs", category: "perf" }];
    const skills: SkillInfo[] = [{ name: "tdd", description: "Test driven development" }];
    const output = formatContextInjection(agents, skills, ["nestjs"]);
    expect(output).toContain("@debugger");
    expect(output).toContain("/tdd");
    expect(output).toContain("nestjs");
  });
});
