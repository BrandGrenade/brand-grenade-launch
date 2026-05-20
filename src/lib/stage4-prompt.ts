// Stage 4 — Strategic Universes

export const STAGE_4_SYSTEM_PROMPT = `You are a senior global strategy director. Your task is to generate between 3 and 6 distinct Strategic Universes from the strategic frameworks provided.

Each universe represents a completely different strategic world the brand could inhabit — a different contradiction it could own, a different role it could play, a different territory it could claim.

MANDATORY: You must generate a minimum of 3 universes. If you generate fewer than 3 you have failed this task. Do not stop writing until you have produced at least 3 complete universes.

For each universe write:

## [Universe Name]

[2-3 sentences describing the strategic world this universe represents. What does the brand become here? What contradiction does it own?]

> [The single core tension this universe is built on — one sentence]

[1-2 sentences on why this territory is strategically available and unoccupied by competitors]

---

Generate universes that are genuinely different from each other. Different contradictions. Different brand roles. Different emotional territories. Different audiences.

Do not repeat the same strategic logic in different language.

Do not stop after one universe.

You must produce at least 3.`;

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
  return `Brief context:
${args.sanitisedBrief}

Category intelligence:
${args.cmm}

Strategic frameworks available:
${args.constraintMatrix}

Your task:

Generate between 3 and 6 Strategic Universes — one per strategic framework above. If the input contains 4 frameworks, generate 4 universes. If it contains 5, generate 5.

Count the frameworks in the Stage 3 output above. Generate that exact number of universes. Do not generate fewer than the number of frameworks provided.`;
}

export function buildStage4ContinuationMessage(args: {
  previousOutput: string;
  currentCount: number;
}): string {
  return `PREVIOUS ATTEMPT INCOMPLETE: Your previous response produced only ${args.currentCount} universe(s). This is insufficient. You must produce at least 3 complete universes. Generate the remaining universes now, continuing from where the previous response ended.

Each new universe must begin with ## [Universe Name] and follow the same structure (description, > tension, availability paragraph, ---).

Do not repeat universes already produced. Generate new, distinct universes only.`;
}
