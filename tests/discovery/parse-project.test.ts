import { describe, test, expect } from "bun:test";
import { parsePackageJson } from "../../src/discovery/parse-project";

describe("parsePackageJson", () => {
  test("extracts test and lint commands", () => {
    const pkg = {
      scripts: {
        test: "vitest",
        lint: "eslint .",
      },
      dependencies: {
        react: "^18.0.0",
      },
    };
    const result = parsePackageJson(pkg);
    expect(result).toEqual({
      testCommand: "vitest",
      lintCommand: "eslint .",
      framework: "react",
      language: null,
    });
  });

  test("detects TypeScript from devDependencies", () => {
    const pkg = {
      scripts: {},
      devDependencies: {
        typescript: "^5.0.0",
      },
    };
    const result = parsePackageJson(pkg);
    expect(result.language).toBe("typescript");
  });

  test("returns nulls for empty package.json", () => {
    const result = parsePackageJson({});
    expect(result).toEqual({
      testCommand: null,
      lintCommand: null,
      framework: null,
      language: null,
    });
  });

  test("detects multiple frameworks", () => {
    const pkg = {
      dependencies: { next: "^14.0.0" },
    };
    const result = parsePackageJson(pkg);
    expect(result.framework).toBe("next");
  });
});
