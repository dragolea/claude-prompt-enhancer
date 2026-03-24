// tests/injection/user-prompt-hook-cli.test.ts
// Integration tests for the user-prompt-hook CLI entry point (stdin → stdout/stderr).
import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const SCRIPT = join(import.meta.dir, "../../src/injection/user-prompt-hook.ts");
const TEST_DIR = join(tmpdir(), "user-hook-cli-" + Date.now());

beforeEach(() => {
  mkdirSync(join(TEST_DIR, ".claude", "agents", "testing"), { recursive: true });
  mkdirSync(join(TEST_DIR, ".claude", "skills", "tdd"), { recursive: true });

  writeFileSync(
    join(TEST_DIR, ".claude", "agents", "testing", "qa-expert.md"),
    "---\nname: qa-expert\ndescription: 'Quality assurance and test planning agent'\n---\nQA agent."
  );
  // Description must have enough test-intent keywords to cross the 0.15 relevance threshold
  writeFileSync(
    join(TEST_DIR, ".claude", "skills", "tdd", "SKILL.md"),
    "---\nname: test-driven-development\ndescription: 'Write test spec before implementation for quality coverage'\n---\nTDD skill."
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

describe("user-prompt-hook CLI", () => {
  it("exits 0 and outputs context for a relevant prompt", async () => {
    const { stdout, exitCode } = await runHook({
      input: { prompt: "write tests for the auth module" },
      cwd: TEST_DIR,
    });

    expect(exitCode).toBe(0);
    expect(stdout).toContain("@qa-expert");
    expect(stdout).toContain("/test-driven-development");
  });

  it("writes feedback to stderr when injecting", async () => {
    const { stderr, exitCode } = await runHook({
      input: { prompt: "add test coverage for login" },
      cwd: TEST_DIR,
    });

    expect(exitCode).toBe(0);
    // stderr contains hook feedback (may also have git noise from non-repo tmp dir)
    expect(stderr).toContain("qa-expert");
  });

  it("outputs nothing for a general/trivial prompt", async () => {
    const { stdout, stderr, exitCode } = await runHook({
      input: { prompt: "hello" },
      cwd: TEST_DIR,
    });

    expect(exitCode).toBe(0);
    expect(stdout).toBe("");
    // stderr may have git noise ("fatal: not a git repository") but no hook error
    expect(stderr).not.toContain("[enhance] hook error:");
  });

  it("accepts prompt at hookData.prompt (alternate format)", async () => {
    const { stdout, exitCode } = await runHook({
      prompt: "write tests for the auth module",
      cwd: TEST_DIR,
    });

    expect(exitCode).toBe(0);
    expect(stdout).toContain("@qa-expert");
  });

  it("falls back to cwd when hookData.cwd is missing", async () => {
    // Without cwd, the script uses process.cwd() which won't have our fixtures.
    // The hook should still exit 0 — just no relevant agents.
    const { exitCode } = await runHook({
      input: { prompt: "fix a bug" },
    });

    expect(exitCode).toBe(0);
  });

  it("exits 0 on malformed JSON input", async () => {
    const proc = Bun.spawn(["bun", SCRIPT], {
      stdin: new Blob(["not json at all {"]),
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
    expect(stderr).toContain("[enhance] hook error:");
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
    expect(stderr).toContain("[enhance] hook error:");
  });

  it("respects autoInject: false config", async () => {
    writeFileSync(
      join(TEST_DIR, ".claude", "enhancer-config.json"),
      JSON.stringify({ autoInject: false })
    );

    const { stdout, stderr, exitCode } = await runHook({
      input: { prompt: "write tests for auth" },
      cwd: TEST_DIR,
    });

    expect(exitCode).toBe(0);
    expect(stdout).toBe("");
    expect(stderr).not.toContain("qa-expert");
  });

  it("handles missing .claude directory gracefully", async () => {
    const emptyDir = join(TEST_DIR, "empty-project");
    mkdirSync(emptyDir, { recursive: true });

    const { stdout, exitCode } = await runHook({
      input: { prompt: "fix a bug" },
      cwd: emptyDir,
    });

    expect(exitCode).toBe(0);
    expect(stdout).toBe("");
  });
});
