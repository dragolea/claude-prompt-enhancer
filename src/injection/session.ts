import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";

export interface SessionContext {
  branch?: string;
  activeStacks?: string[];
  lastEnhancedAt?: string;
}

const SESSION_FILE = "session.json";

function sessionPath(projectRoot: string): string {
  return join(projectRoot, ".claude", SESSION_FILE);
}

export async function readSession(projectRoot: string): Promise<SessionContext | null> {
  try {
    const content = await readFile(sessionPath(projectRoot), "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export async function updateSession(
  projectRoot: string,
  updates: Partial<SessionContext>
): Promise<void> {
  const existing = (await readSession(projectRoot)) ?? {};
  const merged: SessionContext = {
    ...existing,
    ...Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    ),
    lastEnhancedAt: new Date().toISOString(),
  };

  const dir = join(projectRoot, ".claude");
  await mkdir(dir, { recursive: true });
  await writeFile(sessionPath(projectRoot), JSON.stringify(merged, null, 2) + "\n");
}
