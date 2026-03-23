import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { processUserPrompt } from "../../src/injection/user-prompt-hook";
import { mkdirSync, writeFileSync, rmSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const TEST_DIR = join(tmpdir(), "user-prompt-hook-test-" + Date.now());

beforeEach(() => {
  mkdirSync(join(TEST_DIR, ".claude", "agents", "performance"), { recursive: true });
  mkdirSync(join(TEST_DIR, ".claude", "skills", "systematic-debugging"), { recursive: true });

  writeFileSync(
    join(TEST_DIR, ".claude", "agents", "performance", "debugger.md"),
    "---\nname: debugger\ndescription: 'Diagnose and fix bugs, identify root causes of failures'\n---\nDebugger agent."
  );
  writeFileSync(
    join(TEST_DIR, ".claude", "skills", "systematic-debugging", "SKILL.md"),
    "---\nname: systematic-debugging\ndescription: 'Use when encountering any bug, test failure, or unexpected behavior'\n---\nDebugging skill."
  );
});

afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

describe("processUserPrompt", () => {
  it("returns relevant agents and skills for debug prompt", async () => {
    const result = await processUserPrompt("fix the login bug", TEST_DIR);
    expect(result.additionalContext).toContain("@debugger");
    expect(result.additionalContext).toContain("/systematic-debugging");
    expect(result.stderrFeedback).toContain("@debugger");
  });

  it("returns empty for trivial prompts", async () => {
    const result = await processUserPrompt("hello", TEST_DIR);
    expect(result.additionalContext).toBe("");
    expect(result.stderrFeedback).toBe("");
  });

  it("includes stack info when detected", async () => {
    writeFileSync(join(TEST_DIR, "nest-cli.json"), "{}");
    const result = await processUserPrompt("fix the auth bug", TEST_DIR);
    expect(result.additionalContext).toContain("nestjs");
  });

  it("returns empty when autoInject is false", async () => {
    writeFileSync(
      join(TEST_DIR, ".claude", "enhancer-config.json"),
      JSON.stringify({ autoInject: false })
    );
    const result = await processUserPrompt("fix the login bug", TEST_DIR);
    expect(result.additionalContext).toBe("");
    expect(result.stderrFeedback).toBe("");
  });

  it("updates session context after injection", async () => {
    await processUserPrompt("fix the login bug", TEST_DIR);
    const sessionPath = join(TEST_DIR, ".claude", "session.json");
    const session = JSON.parse(readFileSync(sessionPath, "utf-8"));
    expect(session.lastEnhancedAt).toBeDefined();
  });
});
