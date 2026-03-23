import { discoverContext } from "../discovery/discover";
import { findRelevantAgents, findRelevantSkills } from "../shared/relevance";
import { detectStack } from "../shared/stack-detect";
import { formatContextInjection } from "./format-context-injection";
import { formatStderr } from "./format-stderr";
import { updateSession } from "./session";
import { execSync } from "child_process";

export interface HookResult {
  additionalContext: string;
  stderrFeedback: string;
}

function getCurrentBranch(projectRoot: string): string | null {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", {
      cwd: projectRoot,
      encoding: "utf-8",
      timeout: 2000,
    }).trim();
  } catch {
    return null;
  }
}

export async function processUserPrompt(
  prompt: string,
  projectRoot: string
): Promise<HookResult> {
  // Get discovered context (run discovery directly — cache is Bun-only and may not be available in tests)
  const context = await discoverContext(projectRoot);

  // Check if auto-inject is disabled
  if (context.config && context.config.autoInject === false) {
    return { additionalContext: "", stderrFeedback: "" };
  }

  // Find relevant agents and skills
  const agents = findRelevantAgents(prompt, context.agents);
  const skills = findRelevantSkills(prompt, context.skills);

  // Detect stack
  const { stacks } = await detectStack(projectRoot);

  // Format outputs
  const additionalContext = formatContextInjection(agents, skills, stacks);
  const stderrFeedback = formatStderr(agents, skills, stacks);

  // Update session context (non-fatal)
  const branch = getCurrentBranch(projectRoot);
  await updateSession(projectRoot, {
    branch: branch ?? undefined,
    activeStacks: stacks.length > 0 ? stacks : undefined,
  }).catch(() => {});

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
