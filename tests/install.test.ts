// tests/install.test.ts
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync, existsSync, readFileSync } from "fs";
import { join } from "path";

const REPO_ROOT = join(import.meta.dir, "..");
const TEST_HOME = join(import.meta.dir, "__fixtures_install__");
const INSTALL_DIR = join(TEST_HOME, ".claude", "skills", "enhance");

const installEnv = { ...process.env, HOME: TEST_HOME, LOCAL_REPO: REPO_ROOT };

beforeEach(() => {
  mkdirSync(TEST_HOME, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_HOME, { recursive: true, force: true });
});

describe("install.sh", () => {
  test("installs all expected files", async () => {
    const proc = Bun.spawn(["bash", join(REPO_ROOT, "install.sh")], {
      stdout: "pipe",
      stderr: "pipe",
      env: installEnv,
    });
    const stdout = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    expect(exitCode).toBe(0);
    expect(stdout).toContain("Installed claude-prompt-enhancer");

    // Verify SKILL.md exists
    expect(existsSync(join(INSTALL_DIR, "SKILL.md"))).toBe(true);

    // Verify discovery scripts exist
    const expectedScripts = [
      "cli.ts",
      "discover.ts",
      "types.ts",
      "load-config.ts",
      "parse-agent.ts",
      "parse-skill.ts",
      "parse-project.ts",
      "format-context.ts",
    ];
    for (const script of expectedScripts) {
      expect(existsSync(join(INSTALL_DIR, "scripts", script))).toBe(true);
    }
  });

  test("SKILL.md references installed script path", async () => {
    const proc = Bun.spawn(["bash", join(REPO_ROOT, "install.sh")], {
      stdout: "pipe",
      stderr: "pipe",
      env: installEnv,
    });
    await proc.exited;

    const skillContent = readFileSync(join(INSTALL_DIR, "SKILL.md"), "utf-8");
    expect(skillContent).toContain("~/.claude/skills/enhance/scripts/cli.ts");
    expect(skillContent).not.toContain("src/discovery/cli.ts");
  });

  test("format-context.ts has corrected import path", async () => {
    const proc = Bun.spawn(["bash", join(REPO_ROOT, "install.sh")], {
      stdout: "pipe",
      stderr: "pipe",
      env: installEnv,
    });
    await proc.exited;

    const content = readFileSync(
      join(INSTALL_DIR, "scripts", "format-context.ts"),
      "utf-8"
    );
    expect(content).toContain('from "./types"');
    expect(content).not.toContain('from "./discovery/types"');
  });

  test("installed cli.ts runs and outputs valid JSON", async () => {
    // First install
    const installProc = Bun.spawn(["bash", join(REPO_ROOT, "install.sh")], {
      stdout: "pipe",
      stderr: "pipe",
      env: installEnv,
    });
    await installProc.exited;

    // Create a minimal project to scan
    const projectDir = join(TEST_HOME, "test-project");
    mkdirSync(projectDir, { recursive: true });

    // Run the installed CLI
    const cliProc = Bun.spawn(
      ["bun", join(INSTALL_DIR, "scripts", "cli.ts"), projectDir],
      { stdout: "pipe", stderr: "pipe" }
    );
    const output = await new Response(cliProc.stdout).text();
    const exitCode = await cliProc.exited;

    expect(exitCode).toBe(0);
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("agents");
    expect(parsed).toHaveProperty("skills");
    expect(parsed).toHaveProperty("project");
  });
});

describe("uninstall.sh", () => {
  test("removes installed files", async () => {
    // First install
    const installProc = Bun.spawn(["bash", join(REPO_ROOT, "install.sh")], {
      stdout: "pipe",
      stderr: "pipe",
      env: installEnv,
    });
    await installProc.exited;
    expect(existsSync(INSTALL_DIR)).toBe(true);

    // Then uninstall
    const uninstallProc = Bun.spawn(
      ["bash", join(REPO_ROOT, "uninstall.sh")],
      {
        stdout: "pipe",
        stderr: "pipe",
        env: { ...process.env, HOME: TEST_HOME },
      }
    );
    const stdout = await new Response(uninstallProc.stdout).text();
    const exitCode = await uninstallProc.exited;

    expect(exitCode).toBe(0);
    expect(stdout).toContain("Uninstalled");
    expect(existsSync(INSTALL_DIR)).toBe(false);
  });

  test("exits cleanly when not installed", async () => {
    const proc = Bun.spawn(["bash", join(REPO_ROOT, "uninstall.sh")], {
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, HOME: TEST_HOME },
    });
    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    expect(exitCode).toBe(0);
    expect(stderr).toContain("not installed");
  });
});
