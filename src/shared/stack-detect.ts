import { access, readFile } from "fs/promises";
import { join } from "path";

export type Stack =
  | "expo"
  | "nextjs"
  | "nestjs"
  | "sap-cap"
  | "prisma"
  | "angular"
  | "vue"
  | "svelte"
  | "remix"
  | "astro"
  | "express"
  | "fastify";

export interface StackInfo {
  stacks: Stack[];
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

interface StackProbe {
  stack: Stack;
  check: (root: string) => Promise<boolean>;
}

const PROBES: StackProbe[] = [
  {
    stack: "expo",
    check: async (root) => {
      try {
        const content = await readFile(join(root, "app.json"), "utf-8");
        const parsed = JSON.parse(content);
        return "expo" in parsed;
      } catch {
        return false;
      }
    },
  },
  {
    stack: "nestjs",
    check: (root) => fileExists(join(root, "nest-cli.json")),
  },
  {
    stack: "nextjs",
    check: async (root) => {
      const candidates = ["next.config.js", "next.config.ts", "next.config.mjs"];
      for (const file of candidates) {
        if (await fileExists(join(root, file))) return true;
      }
      return false;
    },
  },
  {
    stack: "sap-cap",
    check: (root) => fileExists(join(root, ".cdsrc.json")),
  },
  {
    stack: "prisma",
    check: (root) => fileExists(join(root, "prisma", "schema.prisma")),
  },
];

export async function detectStack(projectRoot: string): Promise<StackInfo> {
  const results = await Promise.all(
    PROBES.map(async ({ stack, check }) => ({
      stack,
      detected: await check(projectRoot),
    }))
  );
  return { stacks: results.filter((r) => r.detected).map((r) => r.stack) };
}
