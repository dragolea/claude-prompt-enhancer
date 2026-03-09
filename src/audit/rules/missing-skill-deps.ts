// src/audit/rules/missing-skill-deps.ts
import type { AuditInventory, AuditFinding } from "../types";

// Matches /skill-name at word boundary, but not when preceded by another path segment
// (i.e., not /foo/bar — bar would be skipped because it's preceded by /)
// We look for /name that is either at start of line, after whitespace, or after a backtick/quote
const SKILL_REF_RE = /(?:^|[\s`"'(])\/([a-z][a-z0-9-]+)\b/gm;

// Common path-like references that look like /skill but aren't
const FALSE_POSITIVE_PREFIXES = new Set([
  "usr", "src", "etc", "bin", "tmp", "var", "opt", "dev", "home",
  "lib", "proc", "sys", "run", "mnt", "root", "boot",
  "Users", "Applications", "Library", "System", "Volumes",
]);

export function checkMissingSkillDeps(inventory: AuditInventory): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const installedSkills = new Set(inventory.skills.map((s) => s.name));

  for (const skill of inventory.skills) {
    const refs = new Set<string>();
    let match;
    // Reset lastIndex before each use
    SKILL_REF_RE.lastIndex = 0;
    while ((match = SKILL_REF_RE.exec(skill.body)) !== null) {
      const name = match[1];
      // Skip false positives (filesystem paths)
      if (FALSE_POSITIVE_PREFIXES.has(name)) continue;
      // Skip self-references
      if (name === skill.name) continue;
      refs.add(name);
    }

    for (const ref of refs) {
      if (!installedSkills.has(ref)) {
        findings.push({
          rule: "missing-skill-dep",
          severity: "warn",
          message: `Skill "${skill.name}" references /${ref}, which is not installed`,
          files: [skill.filePath],
          suggestion: `Install the "${ref}" skill or remove the /${ref} reference`,
        });
      }
    }
  }

  return findings;
}
