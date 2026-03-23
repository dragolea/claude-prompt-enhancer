import { describe, expect, it } from "bun:test";
import { detectIntent, type IntentResult } from "../../src/shared/intent";

describe("detectIntent", () => {
  it("detects debug intent", () => {
    const result = detectIntent("fix the login bug in auth.service.ts");
    expect(result.intents).toContain("debug");
  });

  it("detects feature intent", () => {
    const result = detectIntent("add stripe webhook endpoint");
    expect(result.intents).toContain("feature");
  });

  it("detects refactor intent", () => {
    const result = detectIntent("refactor the user module to use repository pattern");
    expect(result.intents).toContain("refactor");
  });

  it("detects test intent", () => {
    const result = detectIntent("write tests for the auth service");
    expect(result.intents).toContain("test");
  });

  it("detects review intent", () => {
    const result = detectIntent("review this PR for security issues");
    expect(result.intents).toContain("review");
  });

  it("detects deploy/devops intent", () => {
    const result = detectIntent("set up CI pipeline for the project");
    expect(result.intents).toContain("devops");
  });

  it("detects design/UI intent", () => {
    const result = detectIntent("build a dashboard page with charts");
    expect(result.intents).toContain("ui");
  });

  it("detects multiple intents", () => {
    const result = detectIntent("fix the bug and add tests");
    expect(result.intents).toContain("debug");
    expect(result.intents).toContain("test");
  });

  it("returns general for unrecognized prompts", () => {
    const result = detectIntent("hello");
    expect(result.intents).toContain("general");
  });

  it("detects performance intent", () => {
    const result = detectIntent("optimize the database query performance");
    expect(result.intents).toContain("performance");
  });

  it("detects security intent", () => {
    const result = detectIntent("audit the authentication for vulnerabilities");
    expect(result.intents).toContain("security");
  });
});
