import { describe, expect, it } from "bun:test";
import { findRelevantAgents, findRelevantSkills } from "../../src/shared/relevance";
import type { AgentInfo, SkillInfo } from "../../src/discovery/types";

const agents: AgentInfo[] = [
  { name: "debugger", description: "Diagnose and fix bugs, identify root causes of failures", category: "performance" },
  { name: "frontend-developer", description: "Build complete frontend applications across React, Vue, Angular", category: "core-development" },
  { name: "backend-developer", description: "Build backend APIs and services with NestJS, Express", category: "core-development" },
  { name: "security-engineer", description: "Implement security solutions, vulnerability management", category: "security" },
  { name: "code-reviewer", description: "Conduct comprehensive code reviews for quality", category: "quality" },
];

const skills: SkillInfo[] = [
  { name: "systematic-debugging", description: "Use when encountering any bug, test failure, or unexpected behavior" },
  { name: "test-driven-development", description: "Use when implementing any feature or bugfix, before writing implementation code" },
  { name: "verification-before-completion", description: "Use when about to claim work is complete, before committing" },
  { name: "frontend-design", description: "Create distinctive frontend interfaces with high design quality" },
  { name: "writing-plans", description: "Use when you have a spec or requirements for a multi-step task" },
];

describe("findRelevantAgents", () => {
  it("returns debugger for debug prompts", () => {
    const result = findRelevantAgents("fix the login bug", agents);
    expect(result.map((a) => a.name)).toContain("debugger");
  });

  it("returns frontend-developer for UI prompts", () => {
    const result = findRelevantAgents("build a dashboard page", agents);
    expect(result.map((a) => a.name)).toContain("frontend-developer");
  });

  it("returns security-engineer for security prompts", () => {
    const result = findRelevantAgents("audit authentication for vulnerabilities", agents);
    expect(result.map((a) => a.name)).toContain("security-engineer");
  });

  it("returns max 3 agents", () => {
    const result = findRelevantAgents("fix bug and build UI and review security", agents);
    expect(result.length).toBeLessThanOrEqual(3);
  });

  it("returns empty for trivial prompts", () => {
    const result = findRelevantAgents("hello", agents);
    expect(result.length).toBe(0);
  });
});

describe("findRelevantSkills", () => {
  it("returns systematic-debugging for debug prompts", () => {
    const result = findRelevantSkills("fix the login bug", skills);
    expect(result.map((s) => s.name)).toContain("systematic-debugging");
  });

  it("returns tdd for feature prompts", () => {
    const result = findRelevantSkills("implement stripe webhook", skills);
    expect(result.map((s) => s.name)).toContain("test-driven-development");
  });

  it("returns max 3 skills", () => {
    const result = findRelevantSkills("fix bug, implement feature, design UI, write plan", skills);
    expect(result.length).toBeLessThanOrEqual(3);
  });
});
