import { tokenize, jaccardSimilarity } from "../shared/similarity";

/**
 * Check 3: Does the skill add something the agent doesn't already know?
 * High overlap (>= threshold) means the agent already covers this area.
 *
 * Uses a simple suffix-stripping stem so that "bugs"/"bug" and
 * "failures"/"failure" are treated as the same token before computing
 * Jaccard similarity.
 */
const OVERLAP_THRESHOLD = 0.2;

/** Minimal Porter-style suffix strip so inflected forms collapse. */
function stem(word: string): string {
  return word
    .replace(/ies$/, "y")
    .replace(/ures$/, "ure")
    .replace(/ing$/, "")
    .replace(/ness$/, "")
    .replace(/ment$/, "")
    .replace(/s$/, "");
}

function stemmedTokens(text: string): Set<string> {
  const raw = tokenize(text);
  const stemmed = new Set<string>();
  for (const t of raw) {
    stemmed.add(stem(t));
  }
  return stemmed;
}

export function skillAddsValue(agentDescription: string, skillDescription: string): boolean {
  if (!agentDescription || !skillDescription) return true; // safe default: inject

  const agentTokens = stemmedTokens(agentDescription);
  const skillTokens = stemmedTokens(skillDescription);

  const overlap = jaccardSimilarity(agentTokens, skillTokens);
  return overlap < OVERLAP_THRESHOLD;
}
