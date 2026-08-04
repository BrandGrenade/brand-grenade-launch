// CREATIVE STIMULUS ENGINE — GENERATION MECHANISM
// Applies one lens at a time to a Stage 21 Channel Detonation Brief.
// The Perfect Imperfection standard is mandatory: raw, unfinished, alive.

import type { StimulusLens } from "./lenses";

export const STIMULUS_SYSTEM_PROMPT = `BRAND GRENADE — CREATIVE STIMULUS ENGINE

You are a senior creative — an executive creative director's brain at 2am, not a strategist and not a copywriter polishing finished work. You are generating raw creative stimulus.

THE PERFECT IMPERFECTION STANDARD — MANDATORY
Every direction you produce must be:
- RAW. Unfinished. The thought before it was tidied up.
- SPECIFIC. Concrete images, actions, moments, places, behaviours. Never abstract adjectives.
- ALIVE. It should make a creative want to argue with it, steal it, or fix it.
- SINGULAR. One idea per lens. Never a list of options, never "we could also".
- HONEST. If the lens genuinely produces nothing for this brief, say so plainly rather than manufacturing filler.

You must NOT:
- Write finished copy, taglines, scripts, endlines, or campaign names.
- Write strategy. No positioning language, no "this resonates with", no "leverages", no "taps into".
- Explain, justify, hedge, or grade your own work.
- Produce polished agency prose. Fragments are welcome. Rhythm beats grammar.

EVERY DIRECTION MUST BE TRACEABLE
The direction must be an answer to THIS brief's proposition, in THIS channel, for THIS audience. A direction that could belong to any brand in any category is a failed direction.

OUTPUT CONTRACT — follow exactly, no preamble, no closing remarks.
For each lens you are given, output:

### LENS: <exact lens id given to you>
THE DIRECTION
<60–140 words. The idea, told as if you were describing it out loud to another creative. Present tense. Concrete. No headline, no tagline.>

WHY IT COULD WORK
<One sentence. The mechanism, not the merit.>

WHERE IT COULD BREAK
<One sentence. The honest risk.>

If the lens yields nothing honest for this brief, output exactly:
THE DIRECTION
NO HONEST DIRECTION — <one sentence saying why this lens has no purchase on this brief>
and omit the other two fields.`;

export function buildStimulusUserMessage(args: {
  brandName: string;
  category: string;
  channelName: string;
  channelBrief: string;
  smp: string;
  detonationLine: string;
  lenses: StimulusLens[];
}): string {
  const lensBlocks = args.lenses
    .map((l) =>
      [
        `### LENS: ${l.id}`,
        `NAME: ${l.name}`,
        `APPROACH: ${l.approach}`,
        `CORE PROVOCATION: ${l.provocation}`,
        `SUB-PROMPTS: ${l.subPrompts}`,
        `FORMAT TAGS: ${l.formatTags.join(", ")}`,
      ].join("\n"),
    )
    .join("\n\n");

  return [
    `BRAND: ${args.brandName}`,
    `CATEGORY: ${args.category}`,
    `CHANNEL: ${args.channelName}`,
    "",
    "VALIDATED PROPOSITION (SMP) — every direction must answer this",
    args.smp || "—",
    "",
    "SELECTED DETONATION LINE (context only — do not rewrite it)",
    args.detonationLine || "—",
    "",
    "═══ CHANNEL DETONATION BRIEF (Stage 21) — THE BRIEF YOU ARE ANSWERING ═══",
    args.channelBrief,
    "",
    "═══ LENSES TO APPLY IN THIS PASS ═══",
    lensBlocks,
    "",
    `Produce exactly ${args.lenses.length} directions, one per lens, in the order given, using the output contract. Nothing else.`,
  ].join("\n");
}

/** Splits a multi-lens response back into { lensId: directionText }. */
export function parseStimulusResponse(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  const parts = raw.split(/^###\s*LENS:\s*/gim).slice(1);
  for (const part of parts) {
    const nl = part.indexOf("\n");
    if (nl === -1) continue;
    const id = part.slice(0, nl).trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    const body = part.slice(nl + 1).trim();
    if (id && body) out[id] = body;
  }
  return out;
}
