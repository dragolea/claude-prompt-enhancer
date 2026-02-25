// src/discovery/types.ts
export interface AgentInfo {
  name: string;
  description: string;
  category: string;
}

export interface SkillInfo {
  name: string;
  description: string;
}

export interface ProjectInfo {
  testCommand: string | null;
  lintCommand: string | null;
  framework: string | null;
  language: string | null;
}

export interface EnhancerConfig {
  aliases: Record<string, string>;
  defaultGuards: string[];
  conventions: string[];
  excludeAgents: string[];
}

export interface DiscoveredContext {
  agents: AgentInfo[];
  skills: SkillInfo[];
  project: ProjectInfo;
  config: EnhancerConfig | null;
}
