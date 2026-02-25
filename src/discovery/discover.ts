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

/** Truncate to first sentence (up to first `. `, `.` at end, or 120 chars). */
function firstSentence(text: string): string {
  // Match up to the first period followed by a space, end-of-string, or quote
  const match = text.match(/^(.+?\.)\s/);
  if (match) return match[1];
  // If no sentence break, truncate at 120 chars
  return text.length > 120 ? text.slice(0, 120) + "…" : text;
}

/** Remove keys with null/undefined values. */
function stripNulls<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) continue;
    result[key] = value;
  }
  return result as Partial<T>;
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
    if (agent) agents.push({ ...agent, description: firstSentence(agent.description) });
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
        if (skill) skills.push({ ...skill, description: firstSentence(skill.description) });
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

  return stripNulls({
    agents: filteredAgents,
    skills,
    project,
    config,
  }) as DiscoveredContext;
}
