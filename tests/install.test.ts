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
      "setup-hook.ts",
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

  test("install adds SessionStart hook to settings.json", async () => {
    const proc = Bun.spawn(["bash", join(REPO_ROOT, "install.sh")], {
      stdout: "pipe",
      stderr: "pipe",
      env: installEnv,
    });
    await proc.exited;

    const settingsPath = join(TEST_HOME, ".claude", "settings.json");
    expect(existsSync(settingsPath)).toBe(true);

    const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
    expect(settings.hooks?.SessionStart).toBeArray();
    const entry = settings.hooks.SessionStart.find(
      (e: any) =>
        Array.isArray(e.hooks) &&
        e.hooks.some((h: any) => h.command?.includes("skills/enhance/scripts/cli.ts"))
    );
    expect(entry).toBeDefined();
    expect(entry.matcher).toEqual({});
    expect(entry.hooks[0].type).toBe("command");
  });

  test("install preserves existing settings.json hooks", async () => {
    // Create pre-existing settings with a custom hook
    mkdirSync(join(TEST_HOME, ".claude"), { recursive: true });
    const settingsPath = join(TEST_HOME, ".claude", "settings.json");
    const existing = {
      hooks: {
        SessionStart: [{ type: "command", command: "echo existing" }],
      },
      someOtherSetting: true,
    };
    const { writeFileSync: wfs } = await import("fs");
    wfs(settingsPath, JSON.stringify(existing));

    const proc = Bun.spawn(["bash", join(REPO_ROOT, "install.sh")], {
      stdout: "pipe",
      stderr: "pipe",
      env: installEnv,
    });
    await proc.exited;

    const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
    // Existing hook preserved
    expect(settings.hooks.SessionStart).toHaveLength(2);
    expect(settings.hooks.SessionStart[0].command).toBe("echo existing");
    // Our hook added in new format
    const ourEntry = settings.hooks.SessionStart[1];
    expect(ourEntry.matcher).toEqual({});
    expect(ourEntry.hooks[0].command).toContain("skills/enhance/scripts/cli.ts");
    // Other settings preserved
    expect(settings.someOtherSetting).toBe(true);
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

  test("uninstall removes SessionStart hook from settings.json", async () => {
    // Install first
    const installProc = Bun.spawn(["bash", join(REPO_ROOT, "install.sh")], {
      stdout: "pipe",
      stderr: "pipe",
      env: installEnv,
    });
    await installProc.exited;

    // Verify hook exists
    const settingsPath = join(TEST_HOME, ".claude", "settings.json");
    let settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
    expect(settings.hooks?.SessionStart).toBeArray();

    // Uninstall
    const uninstallProc = Bun.spawn(
      ["bash", join(REPO_ROOT, "uninstall.sh")],
      {
        stdout: "pipe",
        stderr: "pipe",
        env: { ...process.env, HOME: TEST_HOME },
      }
    );
    await uninstallProc.exited;

    // settings.json should be cleaned up (no hooks left = file removed or empty)
    if (existsSync(settingsPath)) {
      settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
      const hooks = settings.hooks?.SessionStart ?? [];
      const ourHook = hooks.find(
        (e: any) =>
          (Array.isArray(e.hooks) &&
            e.hooks.some((h: any) => h.command?.includes("skills/enhance/scripts/cli.ts"))) ||
          e.command?.includes("skills/enhance/scripts/cli.ts")
      );
      expect(ourHook).toBeUndefined();
    }
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
