import { describe, test, expect } from "bun:test";
import { parseSkillFile } from "../../src/discovery/parse-skill";

describe("parseSkillFile", () => {
  test("extracts name and description from frontmatter", () => {
    const content = `---
name: test-driven-development
description: Use when implementing any feature or bugfix, before writing implementation code
---

# Test-Driven Development (TDD)

## Overview
Write the test first.`;

    const result = parseSkillFile(content);
    expect(result).toEqual({
      name: "test-driven-development",
      description:
        "Use when implementing any feature or bugfix, before writing implementation code",
    });
  });

  test("handles quoted description", () => {
    const content = `---
name: brainstorming
description: "You MUST use this before any creative work."
---

# Brainstorming`;

    const result = parseSkillFile(content);
    expect(result).toEqual({
      name: "brainstorming",
      description: "You MUST use this before any creative work.",
    });
  });

  test("returns null for files without frontmatter", () => {
    const content = "# Just markdown";
    const result = parseSkillFile(content);
    expect(result).toBeNull();
  });
});
