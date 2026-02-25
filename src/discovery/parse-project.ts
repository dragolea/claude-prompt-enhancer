import type { ProjectInfo } from "./types";

const FRAMEWORKS = [
  "next",
  "react",
  "vue",
  "angular",
  "svelte",
  "express",
  "fastify",
  "nestjs",
  "nuxt",
  "remix",
  "astro",
] as const;

export function parsePackageJson(pkg: Record<string, any>): ProjectInfo {
  const scripts = pkg.scripts ?? {};
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };

  const testCommand = scripts.test ?? null;
  const lintCommand = scripts.lint ?? null;

  let framework: string | null = null;
  for (const fw of FRAMEWORKS) {
    if (deps[fw]) {
      framework = fw;
      break;
    }
  }

  const language = deps.typescript ? "typescript" : null;

  return { testCommand, lintCommand, framework, language };
}
