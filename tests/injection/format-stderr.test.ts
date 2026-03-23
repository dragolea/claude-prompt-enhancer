import { describe, expect, it } from "bun:test";
import { formatStderr } from "../../src/injection/format-stderr";
import type { AgentInfo, SkillInfo } from "../../src/discovery/types";

describe("formatStderr", () => {
  it("formats agents and skills into a compact box", () => {
    const agents: AgentInfo[] = [
      { name: "debugger", description: "Fix bugs", category: "performance" },
    ];
    const skills: SkillInfo[] = [
      { name: "systematic-debugging", description: "Debug workflow" },
    ];
    const output = formatStderr(agents, skills, []);
    expect(output).toContain("@debugger");
    expect(output).toContain("/systematic-debugging");
    expect(output).toContain("context injected");
  });

  it("includes stack info when provided", () => {
    const output = formatStderr([], [], ["nestjs", "prisma"]);
    expect(output).toContain("nestjs");
    expect(output).toContain("prisma");
  });

  it("returns empty string when nothing to inject", () => {
    const output = formatStderr([], [], []);
    expect(output).toBe("");
  });
});
