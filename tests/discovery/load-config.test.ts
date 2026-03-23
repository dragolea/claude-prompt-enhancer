import { describe, test, expect } from "bun:test";
import { parseEnhancerConfig } from "../../src/discovery/load-config";

describe("parseEnhancerConfig", () => {
  test("parses valid config", () => {
    const raw = {
      aliases: { "@FE": "@react-specialist" },
      defaultGuards: ["Run tests after each change"],
      conventions: ["Always use Vitest"],
      excludeAgents: ["mobile-developer"],
      autoInject: false,
      agentSkillMapping: { debugger: ["systematic-debugging"] },
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
      autoInject: true,
      agentSkillMapping: {},
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

  test("parses autoInject field", () => {
    const config = parseEnhancerConfig({ autoInject: true });
    expect(config.autoInject).toBe(true);
  });

  test("defaults autoInject to true", () => {
    const config = parseEnhancerConfig({});
    expect(config.autoInject).toBe(true);
  });

  test("parses agentSkillMapping", () => {
    const config = parseEnhancerConfig({
      agentSkillMapping: {
        debugger: ["systematic-debugging", "verification-before-completion"],
      },
    });
    expect(config.agentSkillMapping.debugger).toEqual([
      "systematic-debugging",
      "verification-before-completion",
    ]);
  });

  test("defaults agentSkillMapping to empty object", () => {
    const config = parseEnhancerConfig({});
    expect(config.agentSkillMapping).toEqual({});
  });
});
