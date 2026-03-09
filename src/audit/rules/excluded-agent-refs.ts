// src/audit/rules/excluded-agent-refs.ts
import type { AuditInventory, AuditFinding } from "../types";

export function checkExcludedAgentRefs(inventory: AuditInventory): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const excludeList = inventory.config?.excludeAgents ?? [];
  if (excludeList.length === 0) return findings;

  for (const skill of inventory.skills) {
    for (const excluded of excludeList) {
      // Match @agentName references in skill body
      const pattern = new RegExp(`@${excluded}\\b`, "g");
      if (pattern.test(skill.body)) {
        findings.push({
          rule: "excluded-agent-ref",
          severity: "warn",
          message: `Skill "${skill.name}" references @${excluded}, which is in excludeAgents`,
          files: [skill.filePath],
          suggestion: `Remove the @${excluded} reference or remove "${excluded}" from excludeAgents in enhancer-config.json`,
        });
      }
    }
  }

  return findings;
}
