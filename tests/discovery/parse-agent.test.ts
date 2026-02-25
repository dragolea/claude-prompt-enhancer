import { describe, test, expect } from "bun:test";
import { parseAgentFile } from "../../src/discovery/parse-agent";

describe("parseAgentFile", () => {
  test("extracts name and description from frontmatter", () => {
    const content = `---
name: debugger
color: '#F59E0B'
description: 'Use this agent when you need to diagnose and fix bugs.'
tools: Read, Write, Edit, Bash, Glob, Grep
model: opus
---

You are a senior debugging specialist.`;

    const result = parseAgentFile(content, "performance");
    expect(result).toEqual({
      name: "debugger",
      description: "Use this agent when you need to diagnose and fix bugs.",
      category: "performance",
    });
  });

  test("returns null for files without frontmatter", () => {
    const content = "Just some markdown without frontmatter.";
    const result = parseAgentFile(content, "misc");
    expect(result).toBeNull();
  });

  test("returns null for files with incomplete frontmatter", () => {
    const content = `---
color: '#F59E0B'
---
Missing name and description.`;

    const result = parseAgentFile(content, "misc");
    expect(result).toBeNull();
  });
});
