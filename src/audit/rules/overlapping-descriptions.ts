// src/audit/rules/overlapping-descriptions.ts
import type { AuditInventory, AuditFinding } from "../types";
import { tokenize, jaccardSimilarity } from "../../shared/similarity";

const THRESHOLD = 0.5;

export function checkOverlappingDescriptions(inventory: AuditInventory): AuditFinding[] {
  const findings: AuditFinding[] = [];

  // Check skills against each other
  const skills = inventory.skills.filter((s) => s.description);
  for (let i = 0; i < skills.length; i++) {
    const tokensA = tokenize(skills[i].description);
    for (let j = i + 1; j < skills.length; j++) {
      const tokensB = tokenize(skills[j].description);
      const similarity = jaccardSimilarity(tokensA, tokensB);
      if (similarity >= THRESHOLD) {
        findings.push({
          rule: "overlapping-descriptions",
          severity: "info",
          message: `Skills "${skills[i].name}" and "${skills[j].name}" have similar descriptions (${Math.round(similarity * 100)}% overlap)`,
          files: [skills[i].filePath, skills[j].filePath],
          suggestion: "Differentiate their descriptions so Claude can route to the right skill",
        });
      }
    }
  }

  // Check agents against each other
  const agents = inventory.agents.filter((a) => a.description);
  for (let i = 0; i < agents.length; i++) {
    const tokensA = tokenize(agents[i].description);
    for (let j = i + 1; j < agents.length; j++) {
      const tokensB = tokenize(agents[j].description);
      const similarity = jaccardSimilarity(tokensA, tokensB);
      if (similarity >= THRESHOLD) {
        findings.push({
          rule: "overlapping-descriptions",
          severity: "info",
          message: `Agents "${agents[i].name}" and "${agents[j].name}" have similar descriptions (${Math.round(similarity * 100)}% overlap)`,
          files: [agents[i].filePath, agents[j].filePath],
          suggestion: "Differentiate their descriptions so Claude can route to the right agent",
        });
      }
    }
  }

  return findings;
}
