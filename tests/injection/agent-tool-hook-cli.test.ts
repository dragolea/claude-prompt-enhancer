// tests/injection/agent-tool-hook-cli.test.ts
// Integration tests for the agent-tool-hook CLI entry point (stdin → stdout/stderr).
import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const SCRIPT = join(import.meta.dir, "../../src/injection/agent-tool-hook.ts");
const TEST_DIR = join(tmpdir(), "agent-hook-cli-" + Date.now());

beforeEach(() => {
  mkdirSync(join(TEST_DIR, ".claude", "agents", "testing"), { recursive: true });
  mkdirSync(join(TEST_DIR, ".claude", "skills", "tdd"), { recursive: true });
  mkdirSync(join(TEST_DIR, ".claude", "skills", "debugging"), { recursive: true });

  writeFileSync(
    join(TEST_DIR, ".claude", "agents", "testing", "debugger.md"),
    "---\nname: debugger\ndescription: 'Diagnose and fix bugs, identify root causes'\n---\nFollows /systematic-debugging workflow."
  );
  // Descriptions must have enough intent keywords to cross the 0.15 relevance threshold
  writeFileSync(
    join(TEST_DIR, ".claude", "skills", "tdd", "SKILL.md"),
    "---\nname: test-driven-development\ndescription: 'Write test spec before implementation for quality coverage'\n---\nTDD skill."
  );
  writeFileSync(
    join(TEST_DIR, ".claude", "skills", "debugging", "SKILL.md"),
    "---\nname: systematic-debugging\ndescription: 'Debug and fix bugs by diagnosing root-cause failures'\n---\nStep 1: Reproduce..."
  );
});

afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

/** Spawn the hook script with JSON on stdin, return stdout + stderr + exit code. */
async function runHook(hookData: Record<string, unknown>) {
  const proc = Bun.spawn(["bun", SCRIPT], {
    stdin: new Blob([JSON.stringify(hookData)]),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode };
}

describe("agent-tool-hook CLI", () => {
  it("exits 0 and injects skills for a relevant agent prompt", async () => {
    const { stdout, exitCode } = await runHook({
      tool_input: {
        subagent_type: "debugger",
        prompt: "fix the login bug and add tests",
      },
      cwd: TEST_DIR,
    });

    expect(exitCode).toBe(0);
    // tdd is relevant and debugger doesn't reference it
    expect(stdout).toContain("test-driven-development");
  });

  it("skips skill already in agent body (Check 1)", async () => {
    const { stdout, exitCode } = await runHook({
      tool_input: {
        subagent_type: "debugger",
        prompt: "debug and fix this crash",
      },
      cwd: TEST_DIR,
    });

    expect(exitCode).toBe(0);
    // debugger.md already references /systematic-debugging → should not inject it
    expect(stdout).not.toContain("systematic-debugging");
  });

  it("writes feedback to stderr when injecting", async () => {
    const { stderr, exitCode } = await runHook({
      tool_input: {
        subagent_type: "debugger",
        prompt: "fix and add tests for this",
      },
      cwd: TEST_DIR,
    });

    expect(exitCode).toBe(0);
    expect(stderr).toBeTruthy();
  });

  it("outputs nothing when no skills are relevant", async () => {
    const { stdout, stderr, exitCode } = await runHook({
      tool_input: {
        subagent_type: "debugger",
        prompt: "rename this variable",
      },
      cwd: TEST_DIR,
    });

    expect(exitCode).toBe(0);
    expect(stdout).toBe("");
    expect(stderr).toBe("");
  });

  it("accepts input.agent format (alternate field name)", async () => {
    const { stdout, exitCode } = await runHook({
      input: {
        agent: "debugger",
        prompt: "write tests for auth with coverage",
      },
      cwd: TEST_DIR,
    });

    expect(exitCode).toBe(0);
    expect(stdout).toContain("test-driven-development");
  });

  it("applies agentSkillMapping config override", async () => {
    writeFileSync(
      join(TEST_DIR, ".claude", "enhancer-config.json"),
      JSON.stringify({
        agentSkillMapping: {
          debugger: ["test-driven-development"],
        },
      })
    );

    const { stdout, exitCode } = await runHook({
      tool_input: {
        subagent_type: "debugger",
        prompt: "do something unrelated",
      },
      cwd: TEST_DIR,
    });

    expect(exitCode).toBe(0);
    expect(stdout).toContain("test-driven-development");
  });

  it("exits 0 on malformed JSON input", async () => {
    const proc = Bun.spawn(["bun", SCRIPT], {
      stdin: new Blob(["{invalid json"]),
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);

    expect(exitCode).toBe(0);
    expect(stdout.trim()).toBe("");
    expect(stderr).toContain("[enhance] agent hook error:");
  });

  it("exits 0 on empty stdin", async () => {
    const proc = Bun.spawn(["bun", SCRIPT], {
      stdin: new Blob([""]),
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);

    expect(exitCode).toBe(0);
    expect(stdout.trim()).toBe("");
    expect(stderr).toContain("[enhance] agent hook error:");
  });

  it("handles unknown agent gracefully", async () => {
    const { stdout, exitCode } = await runHook({
      tool_input: {
        subagent_type: "nonexistent-agent",
        prompt: "fix bugs and add tests",
      },
      cwd: TEST_DIR,
    });

    expect(exitCode).toBe(0);
    // Should still attempt skill injection (agent body is null, skips Check 1 & 3)
    expect(typeof stdout).toBe("string");
  });

  it("handles missing .claude directory gracefully", async () => {
    const emptyDir = join(TEST_DIR, "empty-project");
    mkdirSync(emptyDir, { recursive: true });

    const { stdout, exitCode } = await runHook({
      tool_input: {
        subagent_type: "debugger",
        prompt: "fix a bug",
      },
      cwd: emptyDir,
    });

    expect(exitCode).toBe(0);
    expect(stdout).toBe("");
  });
});
