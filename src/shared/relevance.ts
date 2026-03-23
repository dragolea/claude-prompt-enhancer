import type { AgentInfo, SkillInfo } from "../discovery/types";
import { tokenize, jaccardSimilarity } from "./similarity";
import { detectIntent, type Intent } from "./intent";

/** Map intents to keywords that describe relevant capabilities. */
const INTENT_CAPABILITY_KEYWORDS: Record<Intent, string[]> = {
  debug: ["debug", "fix", "bug", "diagnose", "error", "failure", "root-cause", "investigate"],
  feature: ["build", "implement", "create", "feature", "api", "endpoint", "service", "integrate"],
  refactor: ["refactor", "restructure", "clean", "simplify", "pattern", "architecture"],
  test: ["test", "tdd", "spec", "coverage", "assert", "mock", "quality"],
  review: ["review", "quality", "code-review", "inspect", "assess"],
  devops: ["deploy", "ci", "cd", "pipeline", "infrastructure", "docker"],
  ui: ["frontend", "ui", "ux", "design", "component", "page", "layout", "css", "react", "vue", "angular"],
  performance: ["performance", "optimize", "cache", "memory", "bottleneck", "latency", "speed", "profil"],
  security: ["security", "vulnerability", "auth", "permission", "encrypt", "token", "audit"],
  general: [],
};

const RELEVANCE_THRESHOLD = 0.15;
const MAX_RESULTS = 3;

/** Check if two tokens share a common prefix of length >= 3 (poor-man's stemming). */
function fuzzyMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const minLen = Math.min(a.length, b.length);
  if (minLen < 3) return false;
  const prefixLen = Math.min(minLen, 4);
  return a.slice(0, prefixLen) === b.slice(0, prefixLen);
}

/** Count how many keywords fuzzy-match at least one token in the target set. */
function fuzzyOverlapRatio(keywords: string[], targetTokens: Set<string>): number {
  if (keywords.length === 0) return 0;
  const targetArr = [...targetTokens];
  let hits = 0;
  for (const kw of keywords) {
    if (targetArr.some((t) => fuzzyMatch(kw, t))) hits++;
  }
  return hits / keywords.length;
}

function scoreItem(prompt: string, description: string, intents: Intent[]): number {
  const promptTokens = tokenize(prompt);
  const descTokens = tokenize(description);

  // Base score: Jaccard similarity between prompt and description
  let score = jaccardSimilarity(promptTokens, descTokens);

  // Boost: measure what fraction of intent keywords appear in the description
  for (const intent of intents) {
    const keywords = INTENT_CAPABILITY_KEYWORDS[intent];
    const overlapRatio = fuzzyOverlapRatio(keywords, descTokens);
    score = Math.max(score, overlapRatio);
  }

  return score;
}

export function findRelevantAgents(prompt: string, agents: AgentInfo[]): AgentInfo[] {
  const { intents } = detectIntent(prompt);
  if (intents.length === 1 && intents[0] === "general") return [];

  return agents
    .map((agent) => ({ agent, score: scoreItem(prompt, agent.description, intents) }))
    .filter(({ score }) => score >= RELEVANCE_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS)
    .map(({ agent }) => agent);
}

export function findRelevantSkills(prompt: string, skills: SkillInfo[]): SkillInfo[] {
  const { intents } = detectIntent(prompt);
  if (intents.length === 1 && intents[0] === "general") return [];

  return skills
    .map((skill) => ({ skill, score: scoreItem(prompt, skill.description, intents) }))
    .filter(({ score }) => score >= RELEVANCE_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS)
    .map(({ skill }) => skill);
}
