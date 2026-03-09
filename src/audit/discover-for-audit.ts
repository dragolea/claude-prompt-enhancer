// src/audit/discover-for-audit.ts
import { readdir, readFile } from "fs/promises";
import { join, basename, dirname } from "path";
import { parsePackageJson } from "../discovery/parse-project";
import { parseEnhancerConfig } from "../discovery/load-config";
import { parseAgentForAudit, parseSkillForAudit } from "./parse-for-audit";
import type { AuditInventory } from "./types";

async function walkDir(dir: string): Promise<string[]> {
  const files: string[] = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await walkDir(fullPath)));
      } else {
        files.push(fullPath);
      }
    }
  } catch {
    // Directory doesn't exist
  }
  return files;
}

export async function discoverForAudit(
  projectRoot: string
): Promise<AuditInventory> {
  const claudeDir = join(projectRoot, ".claude");

  // Discover agents (no excludeAgents filtering — audit sees everything)
  const agentsDir = join(claudeDir, "agents");
  const agentFiles = (await walkDir(agentsDir)).filter((f) =>
    f.endsWith(".md")
  );
  const agents = [];
  for (const filePath of agentFiles) {
    const content = await readFile(filePath, "utf-8");
    const category = basename(dirname(filePath));
    agents.push(parseAgentForAudit(content, category, filePath));
  }

  // Discover skills
  const skillsDir = join(claudeDir, "skills");
  const skills = [];
  try {
    const skillDirs = await readdir(skillsDir, { withFileTypes: true });
    for (const entry of skillDirs) {
      if (!entry.isDirectory()) continue;
      const skillMd = join(skillsDir, entry.name, "SKILL.md");
      try {
        const content = await readFile(skillMd, "utf-8");
        skills.push(parseSkillForAudit(content, skillMd));
      } catch {
        // SKILL.md doesn't exist in this dir
      }
    }
  } catch {
    // skills dir doesn't exist
  }

  // Parse project info
  let project = {
    testCommand: null,
    lintCommand: null,
    framework: null,
    language: null,
  } as ReturnType<typeof parsePackageJson>;
  try {
    const pkgContent = await readFile(
      join(projectRoot, "package.json"),
      "utf-8"
    );
    project = parsePackageJson(JSON.parse(pkgContent));
  } catch {
    // No package.json
  }

  // Load optional config
  let config = null;
  try {
    const configContent = await readFile(
      join(claudeDir, "enhancer-config.json"),
      "utf-8"
    );
    config = parseEnhancerConfig(JSON.parse(configContent));
  } catch {
    // No config file
  }

  return { agents, skills, project, config };
}
