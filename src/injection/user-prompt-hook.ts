import { discoverContext } from "../discovery/discover";
import { findRelevantAgents, findRelevantSkills } from "../shared/relevance";
import { detectStack } from "../shared/stack-detect";
import { formatContextInjection } from "./format-context-injection";
import { formatStderr } from "./format-stderr";

export interface HookResult {
  additionalContext: string;
  stderrFeedback: string;
}

export async function processUserPrompt(
  prompt: string,
  projectRoot: string
): Promise<HookResult> {
  // Get discovered context (run discovery directly — cache is Bun-only and may not be available in tests)
  const context = await discoverContext(projectRoot);

  // Find relevant agents and skills
  const agents = findRelevantAgents(prompt, context.agents);
  const skills = findRelevantSkills(prompt, context.skills);

  // Detect stack
  const { stacks } = await detectStack(projectRoot);

  // Format outputs
  const additionalContext = formatContextInjection(agents, skills, stacks);
  const stderrFeedback = formatStderr(agents, skills, stacks);

  return { additionalContext, stderrFeedback };
}

// CLI entry point — only runs when executed directly
const isDirectRun = process.argv[1]?.endsWith("user-prompt-hook.ts");
if (isDirectRun) {
  let input = "";
  for await (const chunk of process.stdin) {
    input += typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk);
  }

  try {
    const hookData = JSON.parse(input);
    const prompt = hookData.input?.prompt ?? hookData.prompt ?? "";
    const projectRoot = hookData.cwd ?? process.cwd();

    const { additionalContext, stderrFeedback } = await processUserPrompt(prompt, projectRoot);

    if (stderrFeedback) {
      process.stderr.write(stderrFeedback + "\n");
    }

    if (additionalContext) {
      console.log(JSON.stringify({ additionalContext }));
    }
  } catch (err) {
    // Silent failure — never block the user's prompt
    process.stderr.write(`[enhance] hook error: ${err}\n`);
  }
}
