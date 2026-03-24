// tests/e2e/smoke.test.ts
// E2E smoke test — runs a real Claude prompt (haiku) to verify hook injection works.
// Requires: `claude` CLI installed + API access. Skips gracefully if unavailable.
// Run:  bun test tests/e2e/smoke.test.ts
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { execSync } from "child_process";

const REPO_ROOT = join(import.meta.dir, "../..");
const TEST_DIR = join(tmpdir(), "e2e-smoke-" + Date.now());

// Check if claude CLI is available
let claudeAvailable = false;
try {
  execSync("claude --version", { stdio: "pipe" });
  claudeAvailable = true;
} catch {}

const describeE2E = claudeAvailable ? describe : describe.skip;

function makeHookCommand(scriptName: string): string {
  const scriptPath = join(REPO_ROOT, "src/injection", scriptName);
  return `bun ${scriptPath}`;
}

beforeEach(() => {
  // Create a test project with agents and skills
  mkdirSync(join(TEST_DIR, ".claude", "agents", "testing"), { recursive: true });
  mkdirSync(join(TEST_DIR, ".claude", "skills", "tdd-skill"), { recursive: true });

  writeFileSync(
    join(TEST_DIR, ".claude", "agents", "testing", "qa-expert.md"),
    [
      "---",
      "name: qa-expert",
      "description: 'Quality assurance and comprehensive test planning agent'",
      "---",
      "QA expert agent for testing.",
    ].join("\n")
  );

  writeFileSync(
    join(TEST_DIR, ".claude", "skills", "tdd-skill", "SKILL.md"),
    [
      "---",
      "name: test-driven-development",
      "description: 'Use when implementing any feature or bugfix, before writing implementation code'",
      "---",
      "TDD skill body.",
    ].join("\n")
  );

  // Register hooks pointing to source scripts
  writeFileSync(
    join(TEST_DIR, ".claude", "settings.json"),
    JSON.stringify(
      {
        hooks: {
          UserPromptSubmit: [
            {
              matcher: "",
              hooks: [{ type: "command", command: makeHookCommand("user-prompt-hook.ts") }],
            },
          ],
        },
      },
      null,
      2
    )
  );
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

/** Helper: run a single claude -p prompt and return stdout + stderr + exit code. */
async function runClaude(prompt: string, cwd: string) {
  const proc = Bun.spawn(
    [
      "claude",
      "-p", prompt,
      "--model", "haiku",
      "--tools", "",
      "--no-session-persistence",
      "--max-budget-usd", "0.10",
    ],
    { cwd, stdout: "pipe", stderr: "pipe" }
  );

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { stdout, stderr, exitCode };
}

describeE2E("E2E smoke — hook injection via Claude CLI", () => {
  test(
    "hook injects qa-expert agent for a testing prompt",
    async () => {
      // Prompt triggers "test" intent → hook should inject qa-expert agent
      const { stdout, stderr, exitCode } = await runClaude(
        "I need to write tests for the auth module. " +
          'What agents are available in system-reminder context? Reply ONLY with @-prefixed names, one per line. If none, reply "NONE".',
        TEST_DIR
      );

      expect(exitCode).toBe(0);

      // stderr should show the hook ran and injected something
      const response = stdout.toLowerCase();
      expect(response).toContain("qa-expert");
    },
    60_000
  );

  test(
    "hook injects tdd skill for a testing prompt",
    async () => {
      // Prompt triggers "test" intent → hook should inject test-driven-development skill
      const { stdout, exitCode } = await runClaude(
        "I need to add test coverage for login. " +
          'What skills (slash commands) are available in system-reminder context? Reply ONLY with /prefixed names, one per line. If none, reply "NONE".',
        TEST_DIR
      );

      expect(exitCode).toBe(0);
      expect(stdout.toLowerCase()).toContain("test-driven-development");
    },
    60_000
  );

  test(
    "trivial prompt injects nothing",
    async () => {
      // "hello" triggers "general" intent → no injection
      const { stdout, exitCode } = await runClaude(
        'Reply with ONLY the single word "PONG". Nothing else.',
        TEST_DIR
      );

      expect(exitCode).toBe(0);
      expect(stdout.trim().toLowerCase()).toContain("pong");
    },
    60_000
  );
});
