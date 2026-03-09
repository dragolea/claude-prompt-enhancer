// src/audit/types.ts
import type { AgentInfo, SkillInfo, ProjectInfo, EnhancerConfig } from "../discovery/types";

export type Severity = "error" | "warn" | "info";

export type RuleId =
  | "duplicate-name"
  | "missing-frontmatter"
  | "excluded-agent-ref"
  | "overlapping-descriptions"
  | "cross-category-collision"
  | "missing-skill-dep"
  | "contradictory-instructions";

export interface AuditFinding {
  rule: RuleId;
  severity: Severity;
  message: string;
  files: string[];
  suggestion: string;
}

export interface AuditAgentInfo extends AgentInfo {
  filePath: string;
  body: string;
  hasFrontmatter: boolean;
}

export interface AuditSkillInfo extends SkillInfo {
  filePath: string;
  body: string;
  hasFrontmatter: boolean;
}

export interface AuditInventory {
  agents: AuditAgentInfo[];
  skills: AuditSkillInfo[];
  project: ProjectInfo;
  config: EnhancerConfig | null;
}

export interface AuditReport {
  inventory: {
    agents: AuditAgentInfo[];
    skills: AuditSkillInfo[];
  };
  findings: AuditFinding[];
  summary: {
    errors: number;
    warnings: number;
    infos: number;
  };
}
