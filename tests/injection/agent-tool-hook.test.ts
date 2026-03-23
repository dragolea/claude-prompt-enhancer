import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { processAgentToolUse } from "../../src/injection/agent-tool-hook";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const TEST_DIR = join(tmpdir(), "agent-hook-test-" + Date.now());

beforeEach(() => {
  mkdirSync(join(TEST_DIR, ".claude", "agents", "performance"), { recursive: true });
  mkdirSync(join(TEST_DIR, ".claude", "skills", "systematic-debugging"), { recursive: true });
  mkdirSync(join(TEST_DIR, ".claude", "skills", "test-driven-development"), { recursive: true });

  // Agent that already knows about systematic-debugging
  writeFileSync(
    join(TEST_DIR, ".claude", "agents", "performance", "debugger.md"),
    "---\nname: debugger\ndescription: 'Diagnose and fix bugs, identify root causes of failures'\n---\nFollows /systematic-debugging workflow."
  );

  writeFileSync(
    join(TEST_DIR, ".claude", "skills", "systematic-debugging", "SKILL.md"),
    "---\nname: systematic-debugging\ndescription: 'Use when encountering any bug or test failure'\n---\nStep 1: Reproduce..."
  );

  writeFileSync(
    join(TEST_DIR, ".claude", "skills", "test-driven-development", "SKILL.md"),
    "---\nname: test-driven-development\ndescription: 'TDD workflow: write test spec before implementation code'\n---\nStep 1: Write failing test..."
  );
});

afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

describe("processAgentToolUse", () => {
  it("skips injection when agent already has skill in body (Check 1)", async () => {
    const result = await processAgentToolUse(
      "debugger",
      "Fix the login bug",
      TEST_DIR
    );
    // systematic-debugging should NOT be injected — debugger.md already references it
    expect(result.additionalContext).not.toContain("systematic-debugging");
  });

  it("injects skill when agent lacks it and it's relevant (Checks 2+3 pass)", async () => {
    const result = await processAgentToolUse(
      "debugger",
      "Fix the login bug and add tests for it",
      TEST_DIR
    );
    // tdd is relevant to "add tests" and debugger doesn't know about it
    expect(result.additionalContext).toContain("test-driven-development");
  });

  it("returns empty when no skills are relevant", async () => {
    const result = await processAgentToolUse(
      "debugger",
      "rename this variable",
      TEST_DIR
    );
    expect(result.additionalContext).toBe("");
  });

  it("uses agentSkillMapping override from config", async () => {
    writeFileSync(
      join(TEST_DIR, ".claude", "enhancer-config.json"),
      JSON.stringify({
        agentSkillMapping: {
          debugger: ["test-driven-development"],
        },
      })
    );
    const result = await processAgentToolUse("debugger", "do something", TEST_DIR);
    // Should inject tdd even though prompt doesn't match — config override
    expect(result.additionalContext).toContain("test-driven-development");
  });
});
