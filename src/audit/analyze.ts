// src/audit/analyze.ts
import type { AuditInventory, AuditFinding, AuditReport } from "./types";
import { checkDuplicateNames } from "./rules/duplicate-names";
import { checkMissingFrontmatter } from "./rules/missing-frontmatter";
import { checkExcludedAgentRefs } from "./rules/excluded-agent-refs";
import { checkOverlappingDescriptions } from "./rules/overlapping-descriptions";
import { checkCrossCategoryCollisions } from "./rules/cross-category-collisions";
import { checkMissingSkillDeps } from "./rules/missing-skill-deps";
import { checkContradictoryInstructions } from "./rules/contradictory-instructions";

const SEVERITY_ORDER = { error: 0, warn: 1, info: 2 } as const;

export function analyze(inventory: AuditInventory): AuditReport {
  const rules = [
    checkDuplicateNames,
    checkMissingFrontmatter,
    checkExcludedAgentRefs,
    checkOverlappingDescriptions,
    checkCrossCategoryCollisions,
    checkMissingSkillDeps,
    checkContradictoryInstructions,
  ];

  const findings: AuditFinding[] = [];
  for (const rule of rules) {
    findings.push(...rule(inventory));
  }

  findings.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  return {
    inventory: {
      agents: inventory.agents,
      skills: inventory.skills,
    },
    findings,
    summary: {
      errors: findings.filter((f) => f.severity === "error").length,
      warnings: findings.filter((f) => f.severity === "warn").length,
      infos: findings.filter((f) => f.severity === "info").length,
    },
  };
}
