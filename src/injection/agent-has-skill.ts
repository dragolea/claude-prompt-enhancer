/**
 * Check 1: Does the agent already reference this skill in its body/frontmatter?
 * If so, the skill is already "built-in" to the agent — no need to inject.
 */
export function agentHasSkill(agentBody: string, skillName: string): boolean {
  if (!agentBody || !skillName) return false;

  const lowerBody = agentBody.toLowerCase();
  const lowerSkill = skillName.toLowerCase();

  // Check for /skill-name reference
  if (lowerBody.includes(`/${lowerSkill}`)) return true;

  // Check for skill-name as standalone word (hyphens may be spaces)
  const pattern = new RegExp(`\\b${lowerSkill.replace(/-/g, "[\\s-]")}\\b`, "i");
  return pattern.test(agentBody);
}
