// The nine LOC engines. Each engine uses one generative tool to find
// territory the brief would never produce. Each engine is forbidden
// from starting from the brief, the category, the customer, or the
// market. Brief inputs are consulted only at the end to check whether
// the brand has structural permission to own what was found.
//
// Every engine returns exactly:
//   { engine, proposition, descriptor }

import type { LocInputs } from "./brief-extract";
import { renderLocInputsBlock } from "./brief-extract";
import { parseJsonLenient } from "./json-sanitize";
import type { EngineName } from "./task-types";
import { LOC_ENGINE_LABEL } from "./task-types";

const COPYWRITER_STANDARD = `PROPOSITION GENERATION — apply this standard to the line you return:

You are one of the greatest advertising copywriters alive. Your job is to find the line — not describe the territory.

You are one of the greatest advertising copywriters alive. Your job is not to summarise the territory this engine found. Your job is to find the single most unexpected, striking, fresh interpretation of it — the line that makes someone stop before they understand it, the line that makes a creative director put down their phone, the line that could only have come from this brand at this moment in this category. Not the obvious expression of the strategy. The version nobody in the room would have written. The twist that makes the familiar suddenly strange. The compression that makes a whole world fit in five words. That is the only standard worth reaching for.

Absorb the brief. Then forget the strategic language and find what it actually means to a real person on a Friday night who has never read a brief in their life.

The line must work as a poster with no other words on it. A stranger who has never heard of this brand, with three seconds of attention and no obligation to care, reads it and feels something before they understand it.

It must be inevitable once heard. Of course. Obviously the only thing it could ever have said.

It must use words real people say. The pub. The kitchen. The commute. Not strategy words. Not category words. Not brief words.

It must be eight words or fewer. Fewer is almost always stronger.

Generate twenty candidate lines internally. Return only the single strongest — the one that passes the pub test, the stranger test, and makes you pause before you move on.`;

const OUTPUT_CONTRACT = (engineId: EngineName) => `OUTPUT — return exactly one JSON object, no prose, no markdown fences:

{
  "engine": "${engineId}",
  "proposition": "<THE LINE — 8 words or fewer>",
  "descriptor": "<one sentence: what creative move this makes and why the brand can own it>"
}`;

const FORBIDDEN_START = `HARD RULE — DO NOT START FROM THE BRIEF.
Do not start from the brief, the category, the customer, or the market. Perform this engine's move first. Only at the very end consult the brief inputs to check whether this brand has the structural permission to own what you found. If it does not, adjust the line so it can — but never let the brief seed the move.`;

const ENGINE_MOVES: Record<EngineName, string> = {
  inversion: `ENGINE 01 — INVERSION.
Take the single most sacred assumption in this category — the thing every brand in this space treats as non-negotiable — and build the complete opposite. Not a twist. A full structural inversion that makes the original assumption look absurd. Generate the line that lives in the inverted world.`,

  constraint: `ENGINE 02 — CONSTRAINT.
Impose this constraint on the brand: it must work with no visuals, no name, and no product description. It must be explainable in a single physical gesture. Build what survives that constraint. Generate the line that comes from what survives.`,

  wrong_room: `ENGINE 03 — WRONG ROOM.
Place this brand in a completely unrelated industry — a nightclub, a religion, a weapon, a sporting team, a children's toy. Build it there using that industry's logic entirely. Then translate it back. Generate the line that survives the translation.`,

  delete_customer: `ENGINE 04 — DELETE THE CUSTOMER.
Build the brand as if it will never have to sell to anyone. It exists as an artifact of pure belief, obsession, or ideology. Ask what it would be if commercial success were irrelevant. Then reintroduce the customer as the last step. Generate the line that comes from the ideology, aimed at the customer.`,

  worst_case: `ENGINE 05 — WORST CASE.
Take the brand's single biggest liability — the thing it would normally suppress, apologise for, or hide — and make it the entire strategy. Not ironic. Not self-deprecating. The liability becomes the spine. Generate the line that makes the liability the point.`,

  random_connection: `ENGINE 06 — RANDOM CONNECTION.
Generate a genuinely random object, concept, or domain completely unrelated to this brief — specific, not a category. Force the brand's entire positioning to be derived from that stimulus. Do not touch the brief until the territory is found from the stimulus alone. Generate the line that comes from the forced connection.`,

  time_displacement: `ENGINE 07 — TIME DISPLACEMENT.
Design the brand as if it existed 50 years ago in this category. Find what was true then that the category has since abandoned. Then translate only what survives to today. Generate the line that carries what survived.`,

  enemy_first: `ENGINE 08 — ENEMY FIRST.
Write a villain statement: what specifically does this brand exist to destroy, insult, or make obsolete? Not a competitor — a belief, a behaviour, a category convention, a cultural assumption. Build the entire proposition downstream of that destruction. Generate the line that names what is being destroyed.`,

  subtract: `ENGINE 09 — SUBTRACT.
Strip every verbal identifier — the brand name, the category name, the product description. Ask what behaviour, belief, or emotional register would still be recognisably this brand. Build from only what remains. Generate the line that comes from what cannot be stripped away.`,
};

export function getEngineSystemPrompt(engine: EngineName): string {
  return `You are ${LOC_ENGINE_LABEL[engine]}, one of nine Left-of-Centre engines.

${FORBIDDEN_START}

${ENGINE_MOVES[engine]}

${COPYWRITER_STANDARD}

${OUTPUT_CONTRACT(engine)}`;
}

export function buildEngineUserMessage(args: {
  engine: EngineName;
  inputs: LocInputs;
}): string {
  return `The brief inputs below are for the FINAL structural-permission check only. Do NOT read them until after you have completed your engine's move.

${renderLocInputsBlock(args.inputs)}

Now perform ${LOC_ENGINE_LABEL[args.engine]} per your system prompt. Return the JSON.`;
}

export type EngineOutput = {
  engine: EngineName;
  proposition: string;
  descriptor: string;
};

export function parseEngineOutput(raw: string, engine: EngineName): EngineOutput {
  const trimmed = raw.trim();
  const jsonStart = trimmed.indexOf("{");
  const jsonEnd = trimmed.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error(`${engine} engine did not return JSON. Raw: ${trimmed.slice(0, 200)}`);
  }
  const slice = trimmed.slice(jsonStart, jsonEnd + 1);
  const parsed = parseJsonLenient<Partial<EngineOutput>>(slice);
  const proposition = (parsed.proposition ?? "").toString().trim();
  const descriptor = (parsed.descriptor ?? "").toString().trim();
  if (!proposition) {
    throw new Error(`${engine} engine returned empty proposition.`);
  }
  return {
    engine,
    proposition,
    descriptor,
  };
}
