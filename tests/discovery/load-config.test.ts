import { describe, test, expect } from "bun:test";
import { parseEnhancerConfig } from "../../src/discovery/load-config";

describe("parseEnhancerConfig", () => {
  test("parses valid config", () => {
    const raw = {
      aliases: { "@FE": "@react-specialist" },
      defaultGuards: ["Run tests after each change"],
      conventions: ["Always use Vitest"],
      excludeAgents: ["mobile-developer"],
    };
    const result = parseEnhancerConfig(raw);
    expect(result).toEqual(raw);
  });

  test("applies defaults for missing fields", () => {
    const result = parseEnhancerConfig({});
    expect(result).toEqual({
      aliases: {},
      defaultGuards: [],
      conventions: [],
      excludeAgents: [],
    });
  });

  test("ignores unknown fields", () => {
    const raw = {
      aliases: {},
      unknownField: "ignored",
    };
    const result = parseEnhancerConfig(raw);
    expect(result).not.toHaveProperty("unknownField");
  });
});
