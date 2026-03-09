// src/audit/rules/cross-category-collisions.ts
import type { AuditInventory, AuditFinding } from "../types";

export function checkCrossCategoryCollisions(inventory: AuditInventory): AuditFinding[] {
  const findings: AuditFinding[] = [];

  // Group agents by name, track categories
  const agentsByName = new Map<string, { category: string; filePath: string }[]>();
  for (const agent of inventory.agents) {
    if (!agent.name) continue;
    const entries = agentsByName.get(agent.name) ?? [];
    entries.push({ category: agent.category, filePath: agent.filePath });
    agentsByName.set(agent.name, entries);
  }

  for (const [name, entries] of agentsByName) {
    const categories = new Set(entries.map((e) => e.category));
    if (categories.size > 1) {
      findings.push({
        rule: "cross-category-collision",
        severity: "warn",
        message: `Agent "${name}" exists in ${categories.size} categories: ${[...categories].join(", ")}`,
        files: entries.map((e) => e.filePath),
        suggestion: "Move to a single category or use distinct names per category",
      });
    }
  }

  return findings;
}
