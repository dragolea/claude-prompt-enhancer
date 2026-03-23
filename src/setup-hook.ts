// src/setup-hook.ts
// Adds or removes hooks from settings.json:
//   SessionStart    — silent cache pre-warming (cli.ts)
//   UserPromptSubmit — auto context injection (user-prompt-hook.ts)
//   PreToolUse      — skill injection into Agent calls (agent-tool-hook.ts)
//
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
const scriptBase = isUserLevel
  ? "~/.claude/skills/enhance/scripts"
  : ".claude/skills/enhance/scripts";

const HOOK_MARKER = "skills/enhance/scripts/";

function makeCommand(scriptName: string): string {
  const scriptPath = `${scriptBase}/${scriptName}`;
  return [
    "if command -v bun &>/dev/null;",
    `then bun ${scriptPath};`,
    "elif command -v node &>/dev/null;",
    `then node --experimental-strip-types ${scriptPath};`,
    "fi",
  ].join(" ");
}

interface HookDef {
  event: string;
  matcher: string;
  command: string;
}

const HOOK_DEFS: HookDef[] = [
  {
    event: "SessionStart",
    matcher: "startup",
    command: makeCommand("cli.ts").replace(
      /then bun ([^;]+);/,
      "then bun $1 > /dev/null 2>&1;"
    ).replace(
      /then node ([^;]+);/,
      "then node $1 > /dev/null 2>&1;"
    ),
  },
  {
    event: "UserPromptSubmit",
    matcher: "",
    command: makeCommand("user-prompt-hook.ts"),
  },
  {
    event: "PreToolUse",
    matcher: "Agent",
    command: makeCommand("agent-tool-hook.ts"),
  },
];

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
  for (const def of HOOK_DEFS) {
    const hooks = settings.hooks?.[def.event];
    if (Array.isArray(hooks)) {
      settings.hooks[def.event] = hooks.filter(
        (h: any) => !isOurHook(h)
      );
      if (settings.hooks[def.event].length === 0) delete settings.hooks[def.event];
    }
  }
  if (settings.hooks && Object.keys(settings.hooks).length === 0) delete settings.hooks;

  // Clean up empty settings object
  if (Object.keys(settings).length === 0) {
    try {
      const { unlinkSync } = require("fs");
      unlinkSync(SETTINGS_PATH);
      console.log("Removed hooks (settings.json cleaned up)");
    } catch {}
    process.exit(0);
  }
} else {
  if (!settings.hooks) settings.hooks = {};

  let allInstalled = true;
  for (const def of HOOK_DEFS) {
    if (!Array.isArray(settings.hooks[def.event])) settings.hooks[def.event] = [];

    const alreadyInstalled = settings.hooks[def.event].some(
      (h: any) => isOurHook(h)
    );

    if (!alreadyInstalled) {
      allInstalled = false;
      settings.hooks[def.event].push({
        matcher: def.matcher,
        hooks: [{ type: "command", command: def.command }],
      });
    }
  }

  if (allInstalled) {
    console.log("Hooks already configured — skipping");
    process.exit(0);
  }
}

mkdirSync(dirname(SETTINGS_PATH), { recursive: true });
writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2) + "\n");
console.log(remove ? "Removed hooks" : "Added hooks (SessionStart, UserPromptSubmit, PreToolUse)");
