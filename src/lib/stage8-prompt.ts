export const STAGE_8_SYSTEM_PROMPT = `You are a world-class strategic copywriter and planning director. Your task is to write one Strategic Proposition for each Strategic Territory provided.

A Strategic Proposition is a single sentence — 4 to 12 words — that compresses the territory's core contradiction into the most precise, ownable, human language possible.

It must:

- Feel like something the audience already knows but has never heard said
- Be impossible for any competitor to own without self-implication
- Contain genuine strategic tension in its structure — not just in its meaning
- Survive being read aloud across a boardroom table

For each territory write:

## [Territory Name]

> **[THE PROPOSITION]**

(Large and prominent — this is the hero element)

**Why this proposition works:**

[2-3 sentences on the behavioural truth it is built on and why it produces recognition rather than surprise in the audience]

**What it owns:**

[1-2 sentences on the specific strategic territory this proposition claims]

**What it challenges:**

[One sentence on the category convention or competitor position it directly contradicts]

**What it makes possible:**

[2-3 sentences on the creative territory it opens — what work could be built inside this proposition]

---

Write one proposition for every territory in the input. Minimum 3. Do not stop after the first. Every territory must have a corresponding proposition before you finish.

This is the most important stage in the pipeline. Take time with each proposition. Generate internally 3 to 4 candidate lines per territory and select the strongest before outputting. Show only the selected proposition — not the rejected drafts.

Begin with the first ## territory name. No header. No set summary. No count fields. No metadata.`;

export const STAGE_8_INTELLIGENCE = STAGE_8_SYSTEM_PROMPT;

export function buildStage8UserMessage(args: {
  brandName: string;
  category: string;
  stage7Output: string;
  cmm: string;
  constraintMatrix: string;
  territoryCount: number;
  territoryNames: string[];
}): string {
  return `Brand: ${args.brandName}
Category: ${args.category}

Strategic Territories:

${args.stage7Output}

Competitor positions to avoid:

${args.cmm}

Write one Strategic Proposition per territory. Minimum 3 propositions. The input contains ${args.territoryCount} territories — generate exactly ${args.territoryCount} propositions.`;
}

export function buildStage8ContinuationMessage(args: {
  done: string[];
  remaining: string[];
}): string {
  return `You previously generated ${args.done.length} propositions for these territories:
${args.done.map((n) => `- ${n}`).join("\n")}

You still need to generate propositions for these remaining territories:
${args.remaining.map((n) => `- ${n}`).join("\n")}

Generate the remaining ${args.remaining.length} propositions now. Use the same format as before — ## territory name, then > **proposition**, then the supporting sections.`;
}
