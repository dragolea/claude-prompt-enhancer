// src/audit/parse-for-audit.ts
import { parseAgentFile } from "../discovery/parse-agent";
import { parseSkillFile } from "../discovery/parse-skill";
import type { AuditAgentInfo, AuditSkillInfo } from "./types";

const FRONTMATTER_RE = /^---\n[\s\S]*?\n---/;

export function parseAgentForAudit(
  content: string,
  category: string,
  filePath: string
): AuditAgentInfo {
  const hasFrontmatter = FRONTMATTER_RE.test(content);
  const parsed = parseAgentFile(content, category);
  const body = content.replace(FRONTMATTER_RE, "").trim();

  return {
    name: parsed?.name ?? "",
    description: parsed?.description ?? "",
    category,
    filePath,
    body,
    hasFrontmatter,
  };
}

export function parseSkillForAudit(
  content: string,
  filePath: string
): AuditSkillInfo {
  const hasFrontmatter = FRONTMATTER_RE.test(content);
  const parsed = parseSkillFile(content);
  const body = content.replace(FRONTMATTER_RE, "").trim();

  return {
    name: parsed?.name ?? "",
    description: parsed?.description ?? "",
    filePath,
    body,
    hasFrontmatter,
  };
}
