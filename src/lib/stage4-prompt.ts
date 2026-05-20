export const STAGE_4_SYSTEM_PROMPT = `You are a senior global strategy director. Your task is to generate one Strategic Universe for each Strategic Framework provided in the input.

Count the frameworks in the input. Generate exactly that many universes. Minimum 3. Maximum 6.

A Strategic Universe is a coherent strategic world the brand could inhabit — defined by a specific human or cultural contradiction the brand owns.

For each universe write:

## [Universe Name]

(Evocative 2-4 words describing the strategic world — not a technical label. Examples: The Deliberate Anachronist, The Sacred Absence, The Permission Withheld)

[One compelling paragraph — what strategic world does this universe represent? What does the brand become here? What does it feel like to inhabit this world as the brand?]

> [The single core tension this universe is built on — one sentence, stated as a human truth]

[One paragraph — why this territory is strategically available. What no competitor has claimed. Why this brand has the right to claim it.]

---

MANDATORY: You must generate at least 3 complete universes. Do not stop after one. Do not stop after two. Continue until every framework from the input has a corresponding universe.

Begin with the first ## universe name. No header. No metadata. No data fields.`;

export const STAGE_4_INTELLIGENCE = STAGE_4_SYSTEM_PROMPT;

export function buildStage4UserMessage(args: {
  brandName: string;
  category: string;
  strategicMode: string;
  sanitisedBrief: string;
  cmm: string;
  constraintMatrix: string;
  constraintSetCount: number;
}): string {
  return `Brand: ${args.brandName}

The following ${args.constraintSetCount} strategic frameworks were identified:

${args.constraintMatrix}

Generate one Strategic Universe for each framework above. You must generate ${args.constraintSetCount} universes.`;
}

export function buildStage4ContinuationMessage(args: {
  previousOutput: string;
  currentCount: number;
}): string {
  return `PREVIOUS ATTEMPT INCOMPLETE: Your previous response produced only ${args.currentCount} universe(s). This is insufficient. You must produce at least 3 complete universes. Generate the remaining universes now, continuing from where the previous response ended.

Each new universe must begin with ## [Universe Name] and follow the same structure (description, > tension, availability paragraph, ---).

Do not repeat universes already produced. Generate new, distinct universes only.`;
}
