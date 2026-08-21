// OFFLINE CREATIVE BRIEF — the human-facing half of Step 3.
//
// Same locked idea and line as the Content Creation Input Prompt, written for
// a completely different reader: a creative team working away from the
// platform, with no tooling. Direction and rationale, never shot-by-shot
// script detail — the interpretation is deliberately left to them.

export const OFFLINE_BRIEF_LENS_ID = "offline_creative_brief";
export const OFFLINE_BRIEF_LENS_NAME = "Offline creative brief";

export const OFFLINE_CREATIVE_BRIEF_SYSTEM_PROMPT = `BRAND GRENADE — OFFLINE CREATIVE BRIEF

You are writing a creative brief for a human creative team who will work on this away from any platform or tool. They will read it on paper. They have no access to the system that produced it.

WHO THIS IS FOR
Art directors, copywriters, directors and designers. People who need to understand what the idea is, why it wins, what this channel is for, and what they must not break — and who then need room to bring their own thinking.

REGISTER
Plain, confident, human. Full sentences. No jargon, no strategy-speak, no scoring language, no platform terminology, no headings other than the ones specified.

YOU MUST NOT
- Write shot-by-shot scripts, storyboards, frame directions, timings, shot lists, VO scripts, headline sets or asset specifications. That is a different document and it is not this one.
- Invent a new idea, or reinterpret, soften or widen the locked idea.
- Rewrite the campaign line, or produce a channel variant of it.
- Prescribe the execution. State the direction and the boundaries, then stop.

YOU MUST
- Reproduce the locked campaign line verbatim, character for character.
- Explain honestly why this idea wins, drawing on the rationale supplied.
- Leave genuine creative room: the team should finish reading with a clear direction and an open field.

OUTPUT CONTRACT — follow exactly. No preamble, no closing remarks.

THE IDEA
<40-90 words. The locked idea stated plainly, in language a creative team reads once and holds.>

THE CAMPAIGN LINE
<the locked campaign line, verbatim, on its own line>

WHY THIS IDEA WINS
<90-150 words. The strategic rationale, drawn from the supplied reasoning. Why this and not something adjacent.>

THIS CHANNEL AND ITS ROLE
<70-120 words. What this channel is for in this campaign, and the job it alone does. No execution detail.>

CREATIVE DIRECTION
<90-150 words. The tone, the feeling, the territory. Direction, not instruction. Leave the execution open.>

NON-NEGOTIABLES
<3-6 short bullet lines, each starting with "- ". The things that must always be true and the things that must never happen.>

WHERE THE FREEDOM IS
<One or two sentences naming, explicitly, what the creative team is free to decide for themselves.>`;

export function buildOfflineCreativeBriefMessage(args: {
  brandName: string;
  category: string;
  channelName: string;
  channelBrief: string;
  smp: string;
  lockedIdea: string;
  lockedLine: string;
  lockedLens: string | null;
  whyItWins: string;
  guardrails: string;
}): string {
  return [
    "BINDING INPUT — THE LOCKED CAMPAIGN BIG IDEA AND LINE",
    `WINNING IDEA (locked${args.lockedLens ? ` — lens: ${args.lockedLens}` : ""})`,
    args.lockedIdea,
    "",
    "WINNING CAMPAIGN LINE — reproduce verbatim under THE CAMPAIGN LINE.",
    args.lockedLine || "—",
    "",
    "WHY THIS IDEA WON — the reasoning already recorded for this idea. Use it; do not invent new reasons.",
    args.whyItWins || "—",
    "",
    "————",
    "",
    `BRAND: ${args.brandName}`,
    `CATEGORY: ${args.category}`,
    `CHANNEL: ${args.channelName}`,
    "",
    "VALIDATED PROPOSITION (SMP) — context only",
    args.smp || "—",
    "",
    "═══ CHANNEL STRATEGY — the role this channel plays ═══",
    args.channelBrief,
    "",
    "═══ ESTABLISHED GUARDRAILS AND BRAND NON-NEGOTIABLES ═══",
    args.guardrails || "—",
    "",
    "Write the offline creative brief using the output contract. Direction and rationale only — no scripts, no shot detail.",
  ].join("\n");
}
