import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { detectStack } from "../../src/shared/stack-detect";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const TEST_DIR = join(tmpdir(), "stack-detect-test-" + Date.now());

beforeEach(() => mkdirSync(TEST_DIR, { recursive: true }));
afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

describe("detectStack", () => {
  it("detects Expo from app.json with expo key", async () => {
    writeFileSync(join(TEST_DIR, "app.json"), JSON.stringify({ expo: { name: "myapp" } }));
    const stack = await detectStack(TEST_DIR);
    expect(stack.stacks).toContain("expo");
  });

  it("detects NestJS from nest-cli.json", async () => {
    writeFileSync(join(TEST_DIR, "nest-cli.json"), "{}");
    const stack = await detectStack(TEST_DIR);
    expect(stack.stacks).toContain("nestjs");
  });

  it("detects Next.js from next.config.js", async () => {
    writeFileSync(join(TEST_DIR, "next.config.js"), "module.exports = {}");
    const stack = await detectStack(TEST_DIR);
    expect(stack.stacks).toContain("nextjs");
  });

  it("detects Next.js from next.config.ts", async () => {
    writeFileSync(join(TEST_DIR, "next.config.ts"), "export default {}");
    const stack = await detectStack(TEST_DIR);
    expect(stack.stacks).toContain("nextjs");
  });

  it("detects Next.js from next.config.mjs", async () => {
    writeFileSync(join(TEST_DIR, "next.config.mjs"), "export default {}");
    const stack = await detectStack(TEST_DIR);
    expect(stack.stacks).toContain("nextjs");
  });

  it("detects SAP CAP from .cdsrc.json", async () => {
    writeFileSync(join(TEST_DIR, ".cdsrc.json"), "{}");
    const stack = await detectStack(TEST_DIR);
    expect(stack.stacks).toContain("sap-cap");
  });

  it("detects Prisma from prisma directory", async () => {
    mkdirSync(join(TEST_DIR, "prisma"), { recursive: true });
    writeFileSync(join(TEST_DIR, "prisma", "schema.prisma"), "");
    const stack = await detectStack(TEST_DIR);
    expect(stack.stacks).toContain("prisma");
  });

  it("detects multiple stacks", async () => {
    writeFileSync(join(TEST_DIR, "nest-cli.json"), "{}");
    mkdirSync(join(TEST_DIR, "prisma"), { recursive: true });
    writeFileSync(join(TEST_DIR, "prisma", "schema.prisma"), "");
    const stack = await detectStack(TEST_DIR);
    expect(stack.stacks).toContain("nestjs");
    expect(stack.stacks).toContain("prisma");
  });

  it("returns empty stacks when nothing detected", async () => {
    const stack = await detectStack(TEST_DIR);
    expect(stack.stacks).toEqual([]);
  });
});
