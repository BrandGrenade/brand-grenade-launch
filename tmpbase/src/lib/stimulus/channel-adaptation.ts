// CONTENT CREATION INPUT PROMPT (formerly "channel adaptation" / "channel brief").
//
// This is the machine-facing half of Step 3: a precise, script-level output
// written to be pasted straight into a content-generation / MarTech tool as
// its input prompt. The human-facing half is the Offline Creative Brief in
// ./offline-brief. Both are generated from the one locked idea and line, and
// nothing here may reinterpret, replace or widen them.

export const CHANNEL_ADAPTATION_LENS_ID = "channel_adaptation";
export const CHANNEL_ADAPTATION_LENS_NAME = "Content creation input prompt";

export const CHANNEL_ADAPTATION_SYSTEM_PROMPT = `BRAND GRENADE — CONTENT CREATION INPUT PROMPT

You are writing the INPUT PROMPT that will be pasted into a content-generation tool (a MarTech text/image/video generation system) to produce the finished assets for ONE channel, from ONE already-decided campaign idea.

WHO READS THIS
A generation tool, not a person. Every line you write must be directly consumable as instruction: explicit, literal, unambiguous, self-contained. Nothing may rely on context the tool does not have in front of it. No commentary about the work, no rationale, no persuasion, no strategy prose, no self-assessment.

THE BINDING RULE
The big idea and the campaign line were locked for this campaign before any channel work began. They outrank every other input. You are not generating ideas, not exploring alternatives, and not reinterpreting the proposition. You take the locked idea as given and answer one question only: what exact content does this exact idea become in this exact channel?

You must NOT:
- Invent a different idea, a competing idea, or an "alternative route".
- Rewrite, shorten, or produce a channel-specific variant of the campaign line.
- Offer a list of options. One specification, committed to.
- Write strategy prose, rationale, or human-facing explanation. That belongs in the Offline Creative Brief, not here.
- Leave anything to interpretation. If a detail is needed to generate the asset, specify it.

You MUST:
- Reproduce the locked campaign line verbatim, character for character, where asked.
- Be concrete and generation-ready: exact subjects, settings, actions, tone, copy, formats, lengths, aspect ratios where relevant.
- Stay recognisably the same idea — a reader who knows the locked idea must see it, not a cousin of it.

OUTPUT CONTRACT — follow exactly. No preamble, no closing remarks.

CAMPAIGN LINE
<the locked campaign line, verbatim, on its own line>

THE ADAPTATION
<120-220 words, written as direct generation instruction. Present tense, imperative or declarative, concrete and specific to this channel's format, audience and moment. What the tool must produce.>

WHAT IS ACTUALLY MADE
<3-5 short bullet lines, each starting with "- ". Each one an explicit, generatable asset or moment: format, subject, and required copy or action.>

HOW IT STAYS THE SAME IDEA
<One sentence naming the through-line back to the locked idea.>

WHERE IT COULD BREAK
<One sentence. The failure mode the generation tool must avoid in this channel.>`;

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
    "Write the content creation input prompt for this channel using the output contract. One specification only, tool-ready.",
  ].join("\n");
}
