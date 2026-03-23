import { describe, expect, it } from "bun:test";
import { tokenize, jaccardSimilarity } from "../../src/shared/similarity";

describe("tokenize", () => {
  it("lowercases and splits on whitespace", () => {
    const tokens = tokenize("Fix the Login Bug");
    expect(tokens).toEqual(new Set(["fix", "login", "bug"]));
  });

  it("removes stop words", () => {
    const tokens = tokenize("use this for testing");
    expect(tokens).toEqual(new Set(["testing"]));
  });

  it("returns empty set for empty string", () => {
    expect(tokenize("")).toEqual(new Set());
  });

  it("filters single-char tokens", () => {
    expect(tokenize("a b c debug")).toEqual(new Set(["debug"]));
  });
});

describe("jaccardSimilarity", () => {
  it("returns 1 for identical sets", () => {
    const a = new Set(["debug", "fix", "error"]);
    expect(jaccardSimilarity(a, a)).toBe(1);
  });

  it("returns 0 for disjoint sets", () => {
    const a = new Set(["debug", "fix"]);
    const b = new Set(["deploy", "build"]);
    expect(jaccardSimilarity(a, b)).toBe(0);
  });

  it("returns 0 for two empty sets", () => {
    expect(jaccardSimilarity(new Set(), new Set())).toBe(0);
  });

  it("calculates correct partial overlap", () => {
    const a = new Set(["debug", "fix", "error"]);
    const b = new Set(["debug", "fix", "deploy"]);
    expect(jaccardSimilarity(a, b)).toBe(0.5);
  });
});
