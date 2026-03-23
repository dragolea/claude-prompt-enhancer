import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { readSession, updateSession } from "../../src/injection/session";
import { mkdirSync, rmSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const TEST_DIR = join(tmpdir(), "session-test-" + Date.now());

beforeEach(() => mkdirSync(join(TEST_DIR, ".claude"), { recursive: true }));
afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

describe("readSession", () => {
  it("returns null when no session file exists", async () => {
    const session = await readSession(TEST_DIR);
    expect(session).toBeNull();
  });

  it("reads existing session file", async () => {
    const data = { branch: "feat/auth", activeStacks: ["nestjs"], lastEnhancedAt: "2026-03-23" };
    const sessionPath = join(TEST_DIR, ".claude", "session.json");
    await Bun.write(sessionPath, JSON.stringify(data));
    const session = await readSession(TEST_DIR);
    expect(session?.branch).toBe("feat/auth");
  });
});

describe("updateSession", () => {
  it("creates session file with branch and stacks", async () => {
    await updateSession(TEST_DIR, { branch: "feat/payments", activeStacks: ["nestjs", "prisma"] });
    const session = await readSession(TEST_DIR);
    expect(session?.branch).toBe("feat/payments");
    expect(session?.activeStacks).toEqual(["nestjs", "prisma"]);
    expect(session?.lastEnhancedAt).toBeDefined();
  });

  it("merges with existing session", async () => {
    await updateSession(TEST_DIR, { branch: "feat/auth", activeStacks: ["nestjs"] });
    await updateSession(TEST_DIR, { activeStacks: ["nestjs", "prisma"] });
    const session = await readSession(TEST_DIR);
    expect(session?.branch).toBe("feat/auth");
    expect(session?.activeStacks).toEqual(["nestjs", "prisma"]);
  });
});
