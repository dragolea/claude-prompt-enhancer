import type { AgentInfo, SkillInfo } from "../discovery/types";

export function formatStderr(
  agents: AgentInfo[],
  skills: SkillInfo[],
  stacks: string[]
): string {
  if (agents.length === 0 && skills.length === 0 && stacks.length === 0) {
    return "";
  }

  const lines: string[] = [];
  lines.push("--- context injected ---");

  if (agents.length > 0) {
    lines.push("  Agents: " + agents.map((a) => `@${a.name}`).join(", "));
  }
  if (skills.length > 0) {
    lines.push("  Skills: " + skills.map((s) => `/${s.name}`).join(", "));
  }
  if (stacks.length > 0) {
    lines.push("  Stack:  " + stacks.join(", "));
  }

  lines.push("------------------------");
  return lines.join("\n");
}
