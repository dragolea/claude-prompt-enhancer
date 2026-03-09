# Prompt Engineering Best Practices — Cross-Provider Reference

Synthesized from Google (Prompting Essentials, Gemini API, Vertex AI, 2025 Whitepaper), Anthropic (Claude 4.x docs), OpenAI (GPT-4.1 Cookbook, Six Strategies), Microsoft (Azure OpenAI), and academic literature (promptingguide.ai, NeurIPS, ICLR).

---

## Universal Principles (All Providers Agree)

### 1. Be Clear, Specific, and Direct
- Lead with an **action verb**: generate, write, analyze, create, summarize, classify
- Replace vague qualifiers with measurable constraints: "3 sentences" not "brief"; "formal English" not "professional"
- Include all necessary context — never assume the model has it

### 2. Use Structured Delimiters
- **XML tags** (`<context>`, `<task>`, `<format>`, `<examples>`) — best for Claude; excellent for nested structures
- **Markdown headings** (`## Context`, `## Task`) — universally good
- Pick one style per prompt — never mix XML and Markdown delimiters

### 3. Provide Few-Shot Examples (Highest-Impact Technique)
- 3–5 diverse examples covering edge cases
- Consistent formatting across all examples
- For classification, vary label order to prevent positional shortcuts
- Wrap in `<examples>` / `<example>` tags

### 4. Assign a Role/Persona
- One clear sentence: "You are a senior DevOps engineer with 10 years of Kubernetes experience."
- Shapes vocabulary, depth, expertise level, and perspective

### 5. Specify Output Format Explicitly
- State the exact structure: JSON schema, bullet list, table, prose paragraphs
- Use output primers/prefixes to lock format: end with `"JSON:"` or `"Key points:\n-"`
- For programmatic consumption: "Return only valid JSON. No preamble."

### 6. Chain-of-Thought for Reasoning Tasks
- "Think step by step before giving your final answer"
- Show reasoning BEFORE conclusion, not after
- For few-shot CoT: include worked examples with full reasoning chains
- **Exception:** Do NOT use CoT with OpenAI reasoning models (o1, o3) — it's built-in

### 7. Decompose Complex Tasks (Prompt Chaining)
- Break into sequential steps where each output feeds the next
- Each sub-prompt gets the model's full attention
- Makes debugging easier — pinpoint which step failed
- Common pattern: Draft → Review → Refine

### 8. Tell WHY, Not Just WHAT
- "Never use ellipses because this is read by TTS" beats "NEVER use ellipses"
- The model generalizes from the explanation, not just the rule

### 9. Prefer Positive Instructions Over Negation
- "Write in flowing prose" beats "Do not use markdown"
- Negative instructions can prime the model toward the prohibited content

### 10. Iterate — Prompting Is Never One-and-Done
- Google's RSTI: Revisit → Separate → Try different phrasings → Introduce tighter constraints
- Test across edge cases, not just happy paths

---

## Structural Best Practices

### Document/Context Placement
- **Long documents go at the TOP**, task/query at the BOTTOM (up to 30% quality improvement — Anthropic)
- For long prompts: repeat critical constraints at the END (recency bias)
- Use bridge phrases: "Based on the information above..."

### Recommended Prompt Template
```
# Role and Objective
# Context / Documents
# Instructions (numbered steps)
# Output Format
# Examples
# Constraints and Guards
# Final instruction recap (for long prompts)
```

### XML Structure (Claude-Optimized)
```xml
<persona>Senior UX researcher with mobile accessibility expertise</persona>

<context>
Redesigning a banking app for users aged 60+.
Current task completion rate for transfers: 34%.
</context>

<task>
Review the user flow and identify the top 3 friction points.
For each, suggest one specific design change.
</task>

<format>
Numbered list. Each item: friction point name, one-sentence explanation,
one concrete recommendation. Maximum 50 words per item.
</format>

<examples>
  <example>
    <input>...</input>
    <output>...</output>
  </example>
</examples>
```

---

## Technique Catalog

### Basic
| Technique | When to Use | Key Tip |
|-----------|------------|---------|
| **Zero-shot** | Simple, well-defined tasks | Try this first before adding examples |
| **Few-shot** | Format/tone/structure control | 3-5 diverse examples; consistent format |
| **Role/Persona** | Domain expertise needed | One clear sentence in system prompt |
| **System prompting** | Behavioral contract | Separate from user-turn content |

### Intermediate
| Technique | When to Use | Key Tip |
|-----------|------------|---------|
| **Chain-of-Thought (CoT)** | Math, logic, multi-step reasoning | "Think step by step"; temperature=0 for precision |
| **Step-Back prompting** | Complex domain problems | Ask broad background Q first, then apply |
| **Self-Consistency** | One-correct-answer problems | Run N times at temp>0, majority vote |
| **Prompt Chaining** | Multi-phase tasks | Each output feeds next; inspect intermediates |

### Advanced
| Technique | When to Use | Key Tip |
|-----------|------------|---------|
| **Tree of Thoughts (ToT)** | Exploration/creative problems | Generate K candidates → evaluate → search best path |
| **ReAct** | Agentic workflows with tools | Thought → Action → Observation loop |
| **Reflexion** | Iterative improvement across tries | Store verbal self-reflection as episodic memory |
| **Meta-Prompting** | Stuck on a failing prompt | Ask the model to design a better prompt for your goal |
| **Constitutional AI** | Safety/quality self-review | Generate → Critique against principles → Revise |

---

## Reducing Hallucination
1. **Ground in reference text** — "Answer using ONLY the provided context"
2. **Require inline citations** — Forces two errors to fabricate (claim + citation)
3. **Give an escape clause** — "If not found, respond with 'not found'"
4. **Investigate before answering** — "Read the file before making claims about it"
5. **Use RAG** — Retrieve verified documents, paste into prompt

---

## Output Format Selection Guide

| Format | Best For | Token Cost |
|--------|----------|------------|
| **JSON** | API output, structured data, enums | Medium |
| **XML tags** | Claude, nested structures, documents | Higher |
| **Markdown** | Human-readable reports, documentation | Low |
| **Tables** | Structured input data (more efficient than JSON) | Low |
| **Plain text** | TTS, simple tasks, minimal post-processing | Lowest |

---

## Frameworks

### Google TCREI
**T**ask (action verb + persona) → **C**ontext (background, success criteria, constraints) → **R**eferences (few-shot examples) → **E**valuate (accuracy, bias, completeness) → **I**terate (RSTI loop)

### OpenAI Six Strategies
1. Write clear instructions
2. Provide reference text
3. Split complex tasks into subtasks
4. Give the model time to think (CoT)
5. Use external tools
6. Test changes systematically

### POWER Framework
**P**urpose → **O**utput format → **W**ho (persona) → **E**xamples → **R**estrictions

### Anthropic Core Principles
1. Be clear and direct (brilliant-new-employee mental model)
2. Use examples (most reliable steering mechanism)
3. Structure with XML tags
4. Give a role
5. Chain complex prompts
6. Tell why, not just what

---

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| Conflicting instructions ("brief AND comprehensive") | Model can't satisfy both | Prioritize explicitly |
| Negation-heavy ("don't X, don't Y") | Primes toward prohibited content | Reframe as affirmative directives |
| Vague qualifiers ("be good", "do your best") | No signal; baseline behavior | Specify measurable criteria |
| No fallback defined | Model fabricates when uncertain | Add "if not found, say X" |
| Mixing delimiter styles | Reduces structural clarity | Pick XML or Markdown, not both |
| Critical constraints only at the top | Recency bias drops them | Repeat at the end |
| Over-exemplifying (>7 examples) | Overfitting risk | 3-5 diverse examples |
| ALL CAPS for emphasis | No measurable effect (GPT-4.1); overtriggers Claude 4.x | Use normal casing |

---

## Agentic Workflow Best Practices

### Three Most Impactful Instructions (OpenAI SWE-bench, ~20% improvement)
1. **Persistence**: "Do not stop until the full task is complete and verified."
2. **Tool-calling**: "Use available tools rather than guessing. If missing info, ask first."
3. **Planning**: "Before each tool call, plan your action. After each, reflect on the result."

### Autonomy vs Safety (Anthropic)
- Local, reversible actions → proceed freely
- Hard-to-reverse, shared-state, or destructive actions → ask before proceeding
- Encode guardrails in system prompt, not ad-hoc in user turns

### Preventing Over-Engineering
- Only make changes directly requested or clearly necessary
- Don't add features beyond what was asked
- Don't create abstractions for one-time operations
- Three similar lines > premature abstraction

---

## Provider-Specific Notes

### Claude (Anthropic)
- XML tags are highest-signal structural delimiter
- Use `<thinking>` tags in few-shot for extended thinking patterns
- Adaptive thinking (`effort` parameter) outperforms manual extended thinking
- Long docs at TOP, query at BOTTOM
- Tell WHY instructions exist — Claude generalizes from explanations
- Avoid aggressive UPPERCASE pressure on Claude 4.x (overtriggers)

### GPT (OpenAI)
- Markdown delimiters and numeric constraints work well
- System message is the primary behavioral anchor
- Temperature 0–0.2 for factual; 0.7+ for creative
- For reasoning models (o1, o3): simple prompts, no CoT, no few-shot

### Gemini (Google)
- Hierarchical structure with clearly defined instruction layers
- Markdown with nested headers performs well
- Keep temperature at default 1.0 for Gemini 3 (tuned for it)
- Critical constraints must go LAST in complex prompts

---

## Prompt Health Checklist

### Writing Quality
- [ ] Correct spelling in keywords and technical terms
- [ ] No undefined acronyms or jargon
- [ ] Measurable constraints (not "brief", "good", "comprehensive")
- [ ] All necessary info explicitly included
- [ ] Precise word choice — no ambiguous terms

### Instruction Quality
- [ ] No conflicting instructions
- [ ] Output format explicitly specified
- [ ] Role/persona defined when relevant
- [ ] Examples are relevant and representative
- [ ] Positive framing (what to do, not what to avoid)

### Design Quality
- [ ] Edge cases handled or scoped out
- [ ] Single major cognitive action per prompt (chain if complex)
- [ ] Reasoning before conclusion (CoT ordering correct)
- [ ] Consistent delimiter style throughout
- [ ] Critical constraints repeated at end for long prompts

---

*Sources: Google Prompting Essentials (Coursera), Google 2025 Prompt Engineering Whitepaper, Vertex AI docs, Gemini API docs, Anthropic Claude 4.x Best Practices, OpenAI Platform Docs (Six Strategies), GPT-4.1 Cookbook, Azure OpenAI Prompt Engineering Guide, promptingguide.ai, NeurIPS 2023 (Reflexion), ICLR (ReAct, ToT)*
