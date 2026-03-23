import { describe, expect, it } from "bun:test";
import { agentHasSkill } from "../../src/injection/agent-has-skill";

describe("agentHasSkill", () => {
  it("returns true when agent body mentions skill by /name", () => {
    const body = "This agent follows /systematic-debugging workflow for all bug fixes.";
    expect(agentHasSkill(body, "systematic-debugging")).toBe(true);
  });

  it("returns true when agent body mentions skill without slash", () => {
    const body = "Uses systematic-debugging approach to diagnose issues.";
    expect(agentHasSkill(body, "systematic-debugging")).toBe(true);
  });

  it("returns false when skill not mentioned", () => {
    const body = "This agent builds frontend components with React.";
    expect(agentHasSkill(body, "systematic-debugging")).toBe(false);
  });

  it("returns false for empty body", () => {
    expect(agentHasSkill("", "systematic-debugging")).toBe(false);
  });

  it("is case insensitive", () => {
    const body = "Uses Systematic-Debugging for complex issues.";
    expect(agentHasSkill(body, "systematic-debugging")).toBe(true);
  });
});
