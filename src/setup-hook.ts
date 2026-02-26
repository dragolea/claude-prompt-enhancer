// src/setup-hook.ts
// Adds or removes the SessionStart hook from settings.json
// Usage: bun setup-hook.ts [--settings-path <path>] [--install-dir <path>]          (install)
//        bun setup-hook.ts --remove [--settings-path <path>] [--install-dir <path>]  (uninstall)
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";

function getArgValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 && idx + 1 < process.argv.length ? process.argv[idx + 1] : undefined;
}

const SETTINGS_PATH = getArgValue("--settings-path") ?? join(process.env.HOME!, ".claude", "settings.json");
const installDir = getArgValue("--install-dir") ?? join(process.env.HOME!, ".claude", "skills", "enhance");
const isUserLevel = installDir.startsWith(join(process.env.HOME!, ".claude"));
const scriptPath = isUserLevel
  ? "~/.claude/skills/enhance/scripts/cli.ts"
  : ".claude/skills/enhance/scripts/cli.ts";

const HOOK_MARKER = "skills/enhance/scripts/cli.ts";
const HOOK_COMMAND = [
  "if command -v bun &>/dev/null;",
  `then bun ${scriptPath} > /dev/null 2>&1;`,
  "elif command -v node &>/dev/null;",
  `then node --experimental-strip-types ${scriptPath} > /dev/null 2>&1;`,
  "fi",
].join(" ");

function isOurHook(entry: any): boolean {
  // New format: { matcher, hooks: [{ type, command }] }
  if (Array.isArray(entry.hooks)) {
    return entry.hooks.some((h: any) => h.command?.includes(HOOK_MARKER));
  }
  // Old format: { type, command }
  return entry.command?.includes(HOOK_MARKER);
}

const remove = process.argv.includes("--remove");

let settings: Record<string, any> = {};
try {
  settings = JSON.parse(readFileSync(SETTINGS_PATH, "utf-8"));
} catch {
  // No settings file or invalid JSON — start fresh
}

if (remove) {
  const hooks = settings.hooks?.SessionStart;
  if (Array.isArray(hooks)) {
    settings.hooks.SessionStart = hooks.filter(
      (h: any) => !isOurHook(h)
    );
    if (settings.hooks.SessionStart.length === 0) delete settings.hooks.SessionStart;
    if (settings.hooks && Object.keys(settings.hooks).length === 0) delete settings.hooks;
  }
  // Clean up empty settings object
  if (Object.keys(settings).length === 0) {
    try {
      const { unlinkSync } = require("fs");
      unlinkSync(SETTINGS_PATH);
      console.log("Removed SessionStart hook (settings.json cleaned up)");
    } catch {}
    process.exit(0);
  }
} else {
  if (!settings.hooks) settings.hooks = {};
  if (!Array.isArray(settings.hooks.SessionStart)) settings.hooks.SessionStart = [];

  const alreadyInstalled = settings.hooks.SessionStart.some(
    (h: any) => isOurHook(h)
  );

  if (alreadyInstalled) {
    console.log("SessionStart hook already configured — skipping");
    process.exit(0);
  }

  settings.hooks.SessionStart.push({
    matcher: "startup",
    hooks: [{ type: "command", command: HOOK_COMMAND }],
  });
}

mkdirSync(dirname(SETTINGS_PATH), { recursive: true });
writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2) + "\n");
console.log(remove ? "Removed SessionStart hook" : "Added SessionStart hook for cache pre-warming");
