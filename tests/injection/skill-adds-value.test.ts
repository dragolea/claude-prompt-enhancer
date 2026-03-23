import { describe, expect, it } from "bun:test";
import { skillAddsValue } from "../../src/injection/skill-adds-value";

describe("skillAddsValue", () => {
  it("returns true when skill covers area agent does not", () => {
    const agentDesc = "Build backend APIs and services with NestJS, Express";
    const skillDesc = "Use when encountering any bug, test failure, or unexpected behavior";
    expect(skillAddsValue(agentDesc, skillDesc)).toBe(true);
  });

  it("returns false when agent already covers skill area", () => {
    const agentDesc = "Diagnose and fix bugs, identify root causes, debug test failures";
    const skillDesc = "Use when encountering any bug, test failure, or unexpected behavior";
    expect(skillAddsValue(agentDesc, skillDesc)).toBe(false);
  });

  it("returns true for complementary but different skills", () => {
    const agentDesc = "Build frontend React components with TypeScript";
    const skillDesc = "Test driven development workflow, write tests first";
    expect(skillAddsValue(agentDesc, skillDesc)).toBe(true);
  });

  it("returns true when both descriptions are empty (safe default)", () => {
    expect(skillAddsValue("", "")).toBe(true);
  });
});
