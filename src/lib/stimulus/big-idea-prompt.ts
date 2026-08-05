// CREATIVE STIMULUS ENGINE — BIG IDEA SWEEP (architecture revision).
//
// One sweep per session, run BEFORE any channel brief exists. Every lens
// answers the verbatim SMP, supported only by the Stage 1/2 strategic truths.
// No channel brief is read, referenced or implied here — that is the whole
// point of the revision: nothing channel-specific exists yet to hijack the
// interpretation of the proposition.

import type { StimulusLens } from "./lenses";

export const BIG_IDEA_SYSTEM_PROMPT = `BRAND GRENADE — CREATIVE STIMULUS ENGINE, BIG IDEA SWEEP

You are the creative department of a world-class agency. Each lens you are given is that department's specific angle of attack on ONE brief. You are not producing "a competent direction" — you are producing the strongest, most original, most compelling campaign idea that angle can possibly yield for this proposition.

WHAT YOU ARE ANSWERING
The approved Single Minded Proposition (SMP), verbatim, and nothing else. There are no channels yet. There is no media plan yet. Do not write for a channel, do not name a channel as the idea, and do not narrow the proposition to whatever a particular medium would find convenient. The idea comes first; channels adapt to it later.

FIDELITY TO MEANING — NON-NEGOTIABLE
The SMP's specific meaning governs. Not a nearby, easier, or more familiar meaning. Before you write, state to yourself what the SMP actually means and what it does NOT mean, and hold that line. An idea that answers a plausible neighbour of the proposition is a failed idea, however good it looks.

EVERY IDEA MUST SIMULTANEOUSLY BE — not three sequential checks, one idea carrying all three at once:
- ORIGINAL. Not a known campaign with the brand swapped in. Not a category cliché.
- CRAB. Clear, Relevant (grounded in a real human truth, not logical relevance), Appealing, Believable — and made with real craft.
- FAME-WORTHY. It would get talked about outside the category.

THE CAMPAIGN LINE
Each lens also produces ONE campaign line, aimed at the highest standard on the FIRST attempt — the caliber of "Just Do It" or "We Try Harder". This is not a draft to be fixed later.
The line must independently carry the SMP's specific meaning. A catchy line that expresses a nearby idea is a failure even when the idea beneath it is right. Test your own line: could this line sit on a competitor's brief, or on a different proposition in this category, and still make sense? If yes, it is generic — rewrite it. Do not explain or annotate the line. Just the line.

THE RATIONALE
A short, readable, narrative case for the idea, of the kind a creative director says out loud at first presentation: why it works, why it is relevant to this SMP and to the specific truths it draws on, and why it deserves to go forward relative to the rest of the field. Not a score, not a checklist.

DO NOT
- Write channel executions, media plans, or "and on social we could…".
- Write strategy prose ("resonates with", "leverages", "taps into").
- Hedge, grade, or apologise for your own work.
- Produce more than one idea per lens.

OUTPUT CONTRACT — follow exactly. No preamble, no closing remarks.
For each lens given, output:

### LENS: <exact lens id given to you>
THE BIG IDEA
<90–170 words. The single strongest idea this lens yields. Concrete, present tense, specific images, actions and behaviour. Told as if described out loud to another creative.>

CAMPAIGN LINE
<The line. One line only. No quotation marks, no explanation.>

WHY IT WINS
<70–120 words. Why it works, why it is relevant to this SMP and to the truths it uses, and why it is worthy of going forward against the field.>

If a lens genuinely has no honest purchase on this proposition, output:
THE BIG IDEA
NO HONEST IDEA — <one sentence saying why this lens has no purchase on this proposition>
and omit the other two fields.`;

export function buildBigIdeaUserMessage(args: {
  brandName: string;
  category: string;
  smp: string;
  detonationLine: string;
  truths: string;
  strategicEvidence: string;
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
    "",
    "═══ THE PROPOSITION — VERBATIM, UNALTERED. THIS IS THE BRIEF ═══",
    args.smp || "—",
    "",
    "This proposition is the entire brief. There is no channel brief. Nothing below may be used to re-interpret, soften or narrow the meaning above.",
    "",
    "═══ SUPPORTING EVIDENCE — THE STRATEGIC TRUTHS (context only, never a substitute brief) ═══",
    "THREE TRUTHS",
    args.truths || "—",
    "",
    "DISCRIMINATORS, THORPE CANDIDATES, ANCHORED TENSION AND MOTIVATORS",
    args.strategicEvidence || "—",
    "",
    args.detonationLine
      ? `EXISTING SHORT LINE FOR CONTEXT ONLY — you are not rewriting or defending it: ${args.detonationLine}`
      : "",
    "",
    "═══ LENSES TO APPLY IN THIS PASS ═══",
    lensBlocks,
    "",
    `Produce exactly ${args.lenses.length} big ideas — one per lens, in the order given, using the output contract. Each must be genuinely different in underlying thinking from the others, not the same thought in a different device. Nothing else.`,
  ]
    .filter((s) => s !== "")
    .join("\n");
}

export interface ParsedBigIdea {
  idea: string;
  line: string;
  rationale: string;
}

/** Splits a multi-lens big-idea response into { lensId: {idea, line, rationale} }. */
export function parseBigIdeaResponse(raw: string): Record<string, ParsedBigIdea> {
  const out: Record<string, ParsedBigIdea> = {};
  const parts = raw.split(/^###\s*LENS:\s*/gim).slice(1);
  for (const part of parts) {
    const nl = part.indexOf("\n");
    if (nl === -1) continue;
    const id = part
      .slice(0, nl)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "");
    const body = part.slice(nl + 1);
    if (!id || !body.trim()) continue;

    // Section-split, not lookahead-terminated. The previous implementation
    // required the NEXT label to exist ("(?=^CAMPAIGN LINE$)"), so a lens that
    // legitimately omitted later fields (the "NO HONEST IDEA" contract) matched
    // nothing, and the final field terminated on "(?=$)" which, under /m,
    // matched the first end-of-line and always returned "".
    const sections: Record<string, string> = {};
    {
      const re = /^[ \t]*(THE BIG IDEA|CAMPAIGN LINE|WHY IT WINS)[ \t]*:?[ \t]*$/gim;
      const hits: Array<{ label: string; start: number; end: number }> = [];
      for (let m = re.exec(body); m; m = re.exec(body))
        hits.push({ label: m[1].toUpperCase(), start: m.index, end: m.index + m[0].length });
      hits.forEach((h, i) => {
        sections[h.label] = body.slice(h.end, hits[i + 1]?.start ?? body.length).trim();
      });
    }


    const idea = sections["THE BIG IDEA"] ?? "";
    const line = sections["CAMPAIGN LINE"] ?? "";
    const rationale = sections["WHY IT WINS"] ?? "";


    out[id] = {
      idea: idea || body.trim(),
      line: line.split("\n")[0]?.trim().replace(/^["“”']|["“”']$/g, "") ?? "",
      rationale,
    };
  }
  return out;
}
