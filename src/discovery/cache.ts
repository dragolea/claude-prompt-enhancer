// src/discovery/cache.ts
import { join } from "path";
import { Glob } from "bun";
import type { DiscoveredContext } from "./types";

interface CacheEntry {
  version: 1;
  fingerprint: string;
  data: DiscoveredContext;
}

const CACHE_VERSION = 1;
const CACHE_DIR = ".claude/.cache";
const CACHE_FILE = "discovery-cache.json";

async function collectFingerprint(projectRoot: string): Promise<string> {
  const claudeDir = join(projectRoot, ".claude");
  const entries: string[] = [];

  // Glob for agent and skill files
  const agentGlob = new Glob("agents/**/*.md");
  for await (const path of agentGlob.scan({ cwd: claudeDir, absolute: false })) {
    const fullPath = join(claudeDir, path);
    const stat = await Bun.file(fullPath).stat();
    entries.push(`${fullPath}:${stat.mtimeMs}:${stat.size}`);
  }

  const skillGlob = new Glob("skills/*/SKILL.md");
  for await (const path of skillGlob.scan({ cwd: claudeDir, absolute: false })) {
    const fullPath = join(claudeDir, path);
    const stat = await Bun.file(fullPath).stat();
    entries.push(`${fullPath}:${stat.mtimeMs}:${stat.size}`);
  }

  // Stat extra files
  for (const relPath of ["package.json", ".claude/enhancer-config.json"]) {
    const fullPath = join(projectRoot, relPath);
    try {
      const stat = await Bun.file(fullPath).stat();
      entries.push(`${fullPath}:${stat.mtimeMs}:${stat.size}`);
    } catch {
      // File doesn't exist — its absence is part of the fingerprint
      entries.push(`${fullPath}:missing`);
    }
  }

  entries.sort();
  const hash = Bun.hash(entries.join("\n"));
  return hash.toString(16);
}

export async function readCache(
  projectRoot: string
): Promise<DiscoveredContext | null> {
  try {
    const cachePath = join(projectRoot, CACHE_DIR, CACHE_FILE);
    const raw = await Bun.file(cachePath).json();
    const entry = raw as CacheEntry;
    if (entry.version !== CACHE_VERSION) return null;

    const currentFingerprint = await collectFingerprint(projectRoot);
    if (entry.fingerprint !== currentFingerprint) return null;

    return entry.data;
  } catch {
    return null;
  }
}

export async function writeCache(
  projectRoot: string,
  data: DiscoveredContext
): Promise<void> {
  try {
    const fingerprint = await collectFingerprint(projectRoot);
    const entry: CacheEntry = { version: 1, fingerprint, data };
    const cachePath = join(projectRoot, CACHE_DIR, CACHE_FILE);
    await Bun.write(cachePath, JSON.stringify(entry));
  } catch {
    // Cache write failure is non-fatal
  }
}
