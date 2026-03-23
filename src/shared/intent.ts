export type Intent =
  | "debug"
  | "feature"
  | "refactor"
  | "test"
  | "review"
  | "devops"
  | "ui"
  | "performance"
  | "security"
  | "general";

export interface IntentResult {
  intents: Intent[];
}

const INTENT_PATTERNS: Array<{ intent: Intent; patterns: RegExp[] }> = [
  {
    intent: "debug",
    patterns: [
      /\b(?:fix|bug|debug|error|issue|broken|crash|fail|wrong|investigate)\b/i,
    ],
  },
  {
    intent: "feature",
    patterns: [
      /\b(?:add|create|implement|build|new|feature|endpoint|integrate|setup|introduce)\b/i,
    ],
  },
  {
    intent: "refactor",
    patterns: [
      /\b(?:refactor|restructure|reorganize|clean\s*up|simplify|extract|rename|move)\b/i,
    ],
  },
  {
    intent: "test",
    patterns: [
      /\b(?:tests?|spec|coverage|assert|expect|mock|stub|tdd)\b/i,
    ],
  },
  {
    intent: "review",
    patterns: [
      /\b(?:review|audit|check|inspect|examine|assess|evaluate)\b/i,
    ],
  },
  {
    intent: "devops",
    patterns: [
      /\b(?:deploy|ci|cd|pipeline|docker|kubernetes|infrastructure|helm|terraform)\b/i,
    ],
  },
  {
    intent: "ui",
    patterns: [
      /\b(?:ui|ux|design|layout|style|css|component|page|screen|dashboard|frontend|responsive)\b/i,
    ],
  },
  {
    intent: "performance",
    patterns: [
      /\b(?:optimize|performance|slow|fast|cache|memory|bottleneck|profil|latency|speed)\b/i,
    ],
  },
  {
    intent: "security",
    patterns: [
      /\b(?:security|vulnerabilit\w*|auth\w*|permission|encrypt|token|csrf|xss|injection|sanitiz)\b/i,
    ],
  },
];

export function detectIntent(prompt: string): IntentResult {
  const matched: Intent[] = [];

  for (const { intent, patterns } of INTENT_PATTERNS) {
    if (patterns.some((p) => p.test(prompt))) {
      matched.push(intent);
    }
  }

  return { intents: matched.length > 0 ? matched : ["general"] };
}
