export const STAGE_3_SYSTEM_PROMPT = `You are a senior global strategy director. Your task is to generate between 3 and 6 distinct strategic frameworks — each defining a different strategic approach the brand could take.

Each framework defines the rules and boundaries of a different strategic universe. They must be genuinely different from each other — different contradictions, different brand roles, different territories.

Structure your output as:

## [Framework Name]

(2-4 words — evocative and strategic, not technical)

[One paragraph — the strategic logic of this framework. What is the core approach? What does the brand do here? What contradiction does it own?]

**The opportunity:** [One sentence on the specific territory this framework makes available]

**What this excludes:** [One sentence on what this framework deliberately avoids and why]

**Why it is available:** [One sentence on why no competitor currently occupies this territory]

---

Generate a minimum of 3 frameworks and a maximum of 6. Each must be structurally distinct. Do not repeat the same strategic logic in different language.

Begin immediately with the first ## framework name. No header block. No metadata. No structured data.`;

export const STAGE_3_INTELLIGENCE = STAGE_3_SYSTEM_PROMPT;

export function buildStage3UserMessage(args: {
  brandName: string;
  category: string;
  sanitisedBrief: string;
  cmm: string;
}): string {
  return `Brand: ${args.brandName}
Category: ${args.category}

Strategic brief:
${args.sanitisedBrief}

Category intelligence summary:
${args.cmm}

Generate 3 to 6 Strategic Frameworks.`;
}
