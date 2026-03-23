import type { AgentInfo, SkillInfo } from "../discovery/types";

export function formatContextInjection(
  agents: AgentInfo[],
  skills: SkillInfo[],
  stacks: string[]
): string {
  if (agents.length === 0 && skills.length === 0 && stacks.length === 0) {
    return "";
  }

  const sections: string[] = [];

  if (agents.length > 0) {
    sections.push(
      "Relevant agents available for this task:\n" +
        agents.map((a) => `  @${a.name} — ${a.description}`).join("\n")
    );
  }

  if (skills.length > 0) {
    sections.push(
      "Relevant skills available for this task:\n" +
        skills.map((s) => `  /${s.name} — ${s.description}`).join("\n")
    );
  }

  if (stacks.length > 0) {
    sections.push("Detected stack: " + stacks.join(", "));
  }

  return sections.join("\n\n");
}
