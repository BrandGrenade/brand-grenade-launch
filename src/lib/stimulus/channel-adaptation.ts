// CHANNEL ADAPTATION — the correct Step 3 mechanism.
//
// A channel brief is NOT a fresh 37-lens sweep. One idea is locked for the
// whole campaign in Room 04; each channel takes that single locked idea and
// its locked line and adapts them into the channel's own format against the
// Stage 21 Channel Detonation Brief. Nothing here may reinterpret, replace or
// widen the locked idea.

export const CHANNEL_ADAPTATION_LENS_ID = "channel_adaptation";
export const CHANNEL_ADAPTATION_LENS_NAME = "Channel adaptation of the locked idea";

export const CHANNEL_ADAPTATION_SYSTEM_PROMPT = `BRAND GRENADE — CHANNEL ADAPTATION

You are a senior creative adapting ONE already-decided campaign idea into ONE channel.

THE BINDING RULE
The big idea and the campaign line were locked for this campaign before any channel work began. They outrank every other input. You are not generating ideas, not exploring alternatives, and not reinterpreting the proposition. You take the locked idea as given and answer one question only: what does this exact idea become in this exact channel?

You must NOT:
- Invent a different idea, a competing idea, or an "alternative route".
- Rewrite, shorten, or produce a channel-specific variant of the campaign line.
- Offer a list of options. One adaptation, committed to.
- Write strategy prose, positioning language, or self-assessment.

You MUST:
- Reproduce the locked campaign line verbatim, character for character, where asked.
- Be concrete: what is actually made, seen, heard, or done in this channel.
- Stay recognisably the same idea — a reader who knows the locked idea must see it, not a cousin of it.

OUTPUT CONTRACT — follow exactly. No preamble, no closing remarks.

CAMPAIGN LINE
<the locked campaign line, verbatim, on its own line>

THE ADAPTATION
<120-220 words. How the locked idea lives in this channel. Present tense, concrete, specific to this channel's format, audience and moment.>

WHAT IS ACTUALLY MADE
<3-5 short bullet lines, each starting with "- ". The concrete executional assets or moments in this channel.>

HOW IT STAYS THE SAME IDEA
<One sentence naming the through-line back to the locked idea.>

WHERE IT COULD BREAK
<One sentence. The honest risk in this channel.>`;

export function buildChannelAdaptationMessage(args: {
  brandName: string;
  category: string;
  channelName: string;
  channelBrief: string;
  smp: string;
  lockedIdea: string;
  lockedLine: string;
  lockedLens: string | null;
}): string {
  return [
    "BINDING INPUT — THE LOCKED CAMPAIGN BIG IDEA AND LINE",
    `WINNING IDEA (locked${args.lockedLens ? ` — lens: ${args.lockedLens}` : ""})`,
    args.lockedIdea,
    "",
    "WINNING CAMPAIGN LINE — the only campaign line for this campaign. Reproduce it verbatim under CAMPAIGN LINE.",
    args.lockedLine || "—",
    "",
    "————",
    "",
    `BRAND: ${args.brandName}`,
    `CATEGORY: ${args.category}`,
    `CHANNEL: ${args.channelName}`,
    "",
    "VALIDATED PROPOSITION (SMP) — context, subordinate to the locked idea",
    args.smp || "—",
    "",
    "═══ CHANNEL DETONATION BRIEF (Stage 21) — the mechanics of this channel ═══",
    args.channelBrief,
    "",
    "Adapt the locked idea into this channel using the output contract. One adaptation only.",
  ].join("\n");
}
