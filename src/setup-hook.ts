// src/setup-hook.ts
// Adds or removes the SessionStart hook from ~/.claude/settings.json
// Usage: bun setup-hook.ts          (install)
//        bun setup-hook.ts --remove  (uninstall)
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";

const SETTINGS_PATH = join(process.env.HOME!, ".claude", "settings.json");
const HOOK_MARKER = "skills/enhance/scripts/cli.ts";
const HOOK_COMMAND = [
  "if command -v bun &>/dev/null;",
  "then bun ~/.claude/skills/enhance/scripts/cli.ts > /dev/null 2>&1;",
  "elif command -v node &>/dev/null;",
  "then node --experimental-strip-types ~/.claude/skills/enhance/scripts/cli.ts > /dev/null 2>&1;",
  "fi",
].join(" ");

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
      (h: any) => !h.command?.includes(HOOK_MARKER)
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
    (h: any) => h.command?.includes(HOOK_MARKER)
  );

  if (alreadyInstalled) {
    console.log("SessionStart hook already configured — skipping");
    process.exit(0);
  }

  settings.hooks.SessionStart.push({
    type: "command",
    command: HOOK_COMMAND,
  });
}

mkdirSync(dirname(SETTINGS_PATH), { recursive: true });
writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2) + "\n");
console.log(remove ? "Removed SessionStart hook" : "Added SessionStart hook for cache pre-warming");
