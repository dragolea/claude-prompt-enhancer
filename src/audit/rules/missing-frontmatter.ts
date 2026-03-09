// src/audit/rules/missing-frontmatter.ts
import type { AuditInventory, AuditFinding } from "../types";

export function checkMissingFrontmatter(inventory: AuditInventory): AuditFinding[] {
  const findings: AuditFinding[] = [];

  for (const agent of inventory.agents) {
    if (!agent.hasFrontmatter) {
      findings.push({
        rule: "missing-frontmatter",
        severity: "warn",
        message: `Agent file missing YAML frontmatter`,
        files: [agent.filePath],
        suggestion: "Add ---\\nname: ...\\ndescription: '...'\\n--- block at the top of the file",
      });
    } else if (!agent.name || !agent.description) {
      findings.push({
        rule: "missing-frontmatter",
        severity: "warn",
        message: `Agent file has frontmatter but missing ${!agent.name ? "name" : "description"} field`,
        files: [agent.filePath],
        suggestion: "Add the missing field to the YAML frontmatter block",
      });
    }
  }

  for (const skill of inventory.skills) {
    if (!skill.hasFrontmatter) {
      findings.push({
        rule: "missing-frontmatter",
        severity: "warn",
        message: `Skill file missing YAML frontmatter`,
        files: [skill.filePath],
        suggestion: "Add ---\\nname: ...\\ndescription: '...'\\n--- block at the top of the file",
      });
    } else if (!skill.name || !skill.description) {
      findings.push({
        rule: "missing-frontmatter",
        severity: "warn",
        message: `Skill file has frontmatter but missing ${!skill.name ? "name" : "description"} field`,
        files: [skill.filePath],
        suggestion: "Add the missing field to the YAML frontmatter block",
      });
    }
  }

  return findings;
}
