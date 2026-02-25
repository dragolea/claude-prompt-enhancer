// src/discovery/discover.ts
import { readdir, readFile } from "fs/promises";
import { join, basename, dirname } from "path";
import type { DiscoveredContext, AgentInfo, SkillInfo } from "./types";
import { parseAgentFile } from "./parse-agent";
import { parseSkillFile } from "./parse-skill";
import { parsePackageJson } from "./parse-project";
import { parseEnhancerConfig } from "./load-config";

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

export async function discoverContext(
  projectRoot: string
): Promise<DiscoveredContext> {
  const claudeDir = join(projectRoot, ".claude");

  // Discover agents
  const agentsDir = join(claudeDir, "agents");
  const agentFiles = (await walkDir(agentsDir)).filter((f) =>
    f.endsWith(".md")
  );
  const agents: AgentInfo[] = [];
  for (const filePath of agentFiles) {
    const content = await readFile(filePath, "utf-8");
    const category = basename(dirname(filePath));
    const agent = parseAgentFile(content, category);
    if (agent) agents.push(agent);
  }

  // Discover skills
  const skillsDir = join(claudeDir, "skills");
  let skills: SkillInfo[] = [];
  try {
    const skillDirs = await readdir(skillsDir, { withFileTypes: true });
    for (const entry of skillDirs) {
      if (!entry.isDirectory()) continue;
      const skillMd = join(skillsDir, entry.name, "SKILL.md");
      try {
        const content = await readFile(skillMd, "utf-8");
        const skill = parseSkillFile(content);
        if (skill) skills.push(skill);
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

  // Apply excludeAgents filter
  const filteredAgents = config
    ? agents.filter((a) => !config!.excludeAgents.includes(a.name))
    : agents;

  return {
    agents: filteredAgents,
    skills,
    project,
    config,
  };
}
