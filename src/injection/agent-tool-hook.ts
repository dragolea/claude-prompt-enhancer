import { readFile, readdir } from "fs/promises";
import { join } from "path";
import { discoverContext } from "../discovery/discover";
import { findRelevantSkills } from "../shared/relevance";
import { agentHasSkill } from "./agent-has-skill";
import { skillAddsValue } from "./skill-adds-value";
import { formatStderr } from "./format-stderr";

export interface AgentHookResult {
  additionalContext: string;
  stderrFeedback: string;
}

/** Read the raw body and description of an agent file by agent name. */
async function readAgentBody(
  projectRoot: string,
  agentName: string
): Promise<{ body: string; description: string } | null> {
  const agentsDir = join(projectRoot, ".claude", "agents");
  try {
    const categories = await readdir(agentsDir, { withFileTypes: true });
    for (const cat of categories) {
      if (!cat.isDirectory()) continue;
      const files = await readdir(join(agentsDir, cat.name));
      for (const file of files) {
        if (!file.endsWith(".md")) continue;
        const content = await readFile(join(agentsDir, cat.name, file), "utf-8");
        const nameMatch = content.match(/^name:\s*(.+)$/m);
        if (nameMatch && nameMatch[1].trim() === agentName) {
          const descMatch = content.match(/^description:\s*['"](.+?)['"]$/m);
          const frontmatterEnd = content.indexOf("---", 3);
          const body = frontmatterEnd !== -1 ? content.slice(frontmatterEnd + 3) : content;
          return {
            body,
            description: descMatch?.[1]?.trim() ?? "",
          };
        }
      }
    }
  } catch {
    // agents dir doesn't exist
  }
  return null;
}

export async function processAgentToolUse(
  agentName: string,
  prompt: string,
  projectRoot: string
): Promise<AgentHookResult> {
  // Get discovered context
  const context = await discoverContext(projectRoot);

  // Read agent body (needed for Check 1 in both mapping override and auto-detection)
  const agentData = await readAgentBody(projectRoot, agentName);

  // Check for manual mapping override
  if (context.config?.agentSkillMapping?.[agentName]) {
    const mappedSkillNames = context.config.agentSkillMapping[agentName];
    const mappedSkills = context.skills.filter((s) =>
      mappedSkillNames.includes(s.name)
    );
    if (mappedSkills.length > 0) {
      // Still apply Check 1 (agent already has skill)
      const filtered = agentData
        ? mappedSkills.filter((s) => !agentHasSkill(agentData.body, s.name))
        : mappedSkills;

      if (filtered.length > 0) {
        const contextLines = filtered.map((s) => `  /${s.name} — ${s.description}`);
        return {
          additionalContext: "Relevant skills for this task:\n" + contextLines.join("\n"),
          stderrFeedback: formatStderr([], filtered, []),
        };
      }
    }
  }

  // Find skills relevant to the subagent's prompt (Check 2)
  const relevantSkills = findRelevantSkills(prompt, context.skills);
  if (relevantSkills.length === 0) {
    return { additionalContext: "", stderrFeedback: "" };
  }

  // Apply 3-check filter
  const skillsToInject = relevantSkills.filter((skill) => {
    // Check 1: Agent already has skill in body?
    if (agentData && agentHasSkill(agentData.body, skill.name)) return false;

    // Check 2: Already passed (skill is relevant from findRelevantSkills)

    // Check 3: Skill adds value beyond what agent already knows?
    if (agentData && !skillAddsValue(agentData.description, skill.description)) return false;

    return true;
  });

  if (skillsToInject.length === 0) {
    return { additionalContext: "", stderrFeedback: "" };
  }

  const contextLines = skillsToInject.map(
    (s) => `  /${s.name} — ${s.description}`
  );
  const additionalContext =
    `Relevant skills for this task:\n` + contextLines.join("\n");

  const stderrFeedback = formatStderr([], skillsToInject, []);

  return { additionalContext, stderrFeedback };
}

// CLI entry point — only runs when executed directly
const isDirectRun = process.argv[1]?.endsWith("agent-tool-hook.ts");
if (isDirectRun) {
  try {
    let input = "";
    for await (const chunk of process.stdin) {
      input += typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk);
    }

    const hookData = JSON.parse(input);
    const toolInput = hookData.tool_input ?? hookData.input ?? {};
    const agentName = toolInput.subagent_type ?? toolInput.agent ?? "";
    const prompt = toolInput.prompt ?? "";
    const projectRoot = hookData.cwd ?? process.cwd();

    const { additionalContext, stderrFeedback } = await processAgentToolUse(
      agentName,
      prompt,
      projectRoot
    );

    if (stderrFeedback) {
      process.stderr.write(stderrFeedback + "\n");
    }

    if (additionalContext) {
      // Plain text to stdout is automatically added as context by Claude Code
      console.log(additionalContext);
    }
  } catch (err) {
    process.stderr.write(`[enhance] agent hook error: ${err}\n`);
  }
}
