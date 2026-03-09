// src/audit/rules/duplicate-names.ts
import type { AuditInventory, AuditFinding } from "../types";

export function checkDuplicateNames(inventory: AuditInventory): AuditFinding[] {
  const findings: AuditFinding[] = [];

  // Check duplicate agent names
  const agentsByName = new Map<string, string[]>();
  for (const agent of inventory.agents) {
    if (!agent.name) continue;
    const files = agentsByName.get(agent.name) ?? [];
    files.push(agent.filePath);
    agentsByName.set(agent.name, files);
  }
  for (const [name, files] of agentsByName) {
    if (files.length > 1) {
      findings.push({
        rule: "duplicate-name",
        severity: "error",
        message: `${files.length} agents share the name "${name}"`,
        files,
        suggestion: "Rename one to avoid ambiguity when using @agent references",
      });
    }
  }

  // Check duplicate skill names
  const skillsByName = new Map<string, string[]>();
  for (const skill of inventory.skills) {
    if (!skill.name) continue;
    const files = skillsByName.get(skill.name) ?? [];
    files.push(skill.filePath);
    skillsByName.set(skill.name, files);
  }
  for (const [name, files] of skillsByName) {
    if (files.length > 1) {
      findings.push({
        rule: "duplicate-name",
        severity: "error",
        message: `${files.length} skills share the name "${name}"`,
        files,
        suggestion: "Rename one to avoid ambiguity when using /skill references",
      });
    }
  }

  return findings;
}
