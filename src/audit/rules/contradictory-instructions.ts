// src/audit/rules/contradictory-instructions.ts
import type { AuditInventory, AuditFinding } from "../types";

interface Directive {
  polarity: "positive" | "negative";
  subject: string;
  source: string;
  filePath: string;
}

// Match patterns like "always X", "never X", "do not X", "must X", "must not X", "skip X"
const DIRECTIVE_PATTERNS: { re: RegExp; polarity: "positive" | "negative" }[] = [
  { re: /\b(?:always|must)\s+(.{3,60}?)(?:\.|,|$)/gim, polarity: "positive" },
  { re: /\b(?:never|do not|don't|must not|mustn't|skip)\s+(.{3,60}?)(?:\.|,|$)/gim, polarity: "negative" },
];

function extractDirectives(body: string, sourceName: string, filePath: string): Directive[] {
  const directives: Directive[] = [];
  for (const { re, polarity } of DIRECTIVE_PATTERNS) {
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(body)) !== null) {
      directives.push({
        polarity,
        subject: match[1].trim().toLowerCase(),
        source: sourceName,
        filePath,
      });
    }
  }
  return directives;
}

function normalizeSubject(text: string): string {
  return text.replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

function subjectsOverlap(a: string, b: string): boolean {
  const normA = normalizeSubject(a);
  const normB = normalizeSubject(b);
  if (normA === normB) return true;
  // Check if one contains the other (for short directives)
  if (normA.length >= 5 && normB.length >= 5) {
    return normA.includes(normB) || normB.includes(normA);
  }
  return false;
}

export function checkContradictoryInstructions(inventory: AuditInventory): AuditFinding[] {
  const findings: AuditFinding[] = [];

  // Collect directives from all skills
  const allDirectives: Directive[] = [];
  for (const skill of inventory.skills) {
    allDirectives.push(...extractDirectives(skill.body, skill.name, skill.filePath));
  }
  for (const agent of inventory.agents) {
    allDirectives.push(...extractDirectives(agent.body, agent.name, agent.filePath));
  }

  // Compare directives with opposite polarities from different sources
  const reported = new Set<string>();
  for (let i = 0; i < allDirectives.length; i++) {
    for (let j = i + 1; j < allDirectives.length; j++) {
      const a = allDirectives[i];
      const b = allDirectives[j];
      // Same source — not a conflict
      if (a.source === b.source) continue;
      // Same polarity — not a conflict
      if (a.polarity === b.polarity) continue;
      // Check if subjects overlap
      if (!subjectsOverlap(a.subject, b.subject)) continue;

      const key = [a.filePath, b.filePath].sort().join("|");
      if (reported.has(key + a.subject)) continue;
      reported.add(key + a.subject);

      const positive = a.polarity === "positive" ? a : b;
      const negative = a.polarity === "negative" ? a : b;

      findings.push({
        rule: "contradictory-instructions",
        severity: "info",
        message: `"${positive.source}" says to always/must "${positive.subject}" but "${negative.source}" says never/skip "${negative.subject}"`,
        files: [positive.filePath, negative.filePath],
        suggestion: "Review these directives and align them to avoid conflicting instructions",
      });
    }
  }

  return findings;
}
