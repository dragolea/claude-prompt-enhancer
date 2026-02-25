// src/format-context.ts
import type { DiscoveredContext } from "./discovery/types";

export function formatContext(ctx: DiscoveredContext): string {
  const sections: string[] = [];

  // Agents
  if (ctx.agents.length > 0) {
    const grouped = new Map<string, typeof ctx.agents>();
    for (const agent of ctx.agents) {
      const list = grouped.get(agent.category) ?? [];
      list.push(agent);
      grouped.set(agent.category, list);
    }
    const lines = ["AVAILABLE AGENTS:"];
    for (const [category, agents] of grouped) {
      lines.push(`  [${category}]`);
      for (const a of agents) {
        lines.push(`    @${a.name} — ${a.description}`);
      }
    }
    sections.push(lines.join("\n"));
  } else {
    sections.push("AVAILABLE AGENTS: No agents discovered.");
  }

  // Skills
  if (ctx.skills.length > 0) {
    const lines = ["AVAILABLE SKILLS:"];
    for (const s of ctx.skills) {
      lines.push(`  /${s.name} — ${s.description}`);
    }
    sections.push(lines.join("\n"));
  } else {
    sections.push("AVAILABLE SKILLS: No skills discovered.");
  }

  // Project
  const projLines = ["PROJECT CONTEXT:"];
  if (ctx.project.framework) projLines.push(`  Framework: ${ctx.project.framework}`);
  if (ctx.project.language) projLines.push(`  Language: ${ctx.project.language}`);
  if (ctx.project.testCommand) projLines.push(`  Test command: ${ctx.project.testCommand}`);
  if (ctx.project.lintCommand) projLines.push(`  Lint command: ${ctx.project.lintCommand}`);
  if (projLines.length === 1) projLines.push("  No project info detected.");
  sections.push(projLines.join("\n"));

  // Config
  if (ctx.config) {
    const cfgLines = ["CUSTOM CONFIGURATION:"];
    if (Object.keys(ctx.config.aliases).length > 0) {
      cfgLines.push("  Aliases:");
      for (const [alias, target] of Object.entries(ctx.config.aliases)) {
        cfgLines.push(`    ${alias} → ${target}`);
      }
    }
    if (ctx.config.defaultGuards.length > 0) {
      cfgLines.push("  Default guards:");
      for (const guard of ctx.config.defaultGuards) {
        cfgLines.push(`    - ${guard}`);
      }
    }
    if (ctx.config.conventions.length > 0) {
      cfgLines.push("  Conventions:");
      for (const conv of ctx.config.conventions) {
        cfgLines.push(`    - ${conv}`);
      }
    }
    sections.push(cfgLines.join("\n"));
  }

  return sections.join("\n\n");
}
