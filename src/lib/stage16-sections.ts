// Multi-section Stage 16 architecture.
//
// Each format (consulting / agency / workshop) is rendered as a sequence of
// focused, short Claude calls — one per document section. No single call is
// large enough to hit the token ceiling, so truncation is structurally
// impossible. Sections are stitched together by `assembleDocument` with the
// proposition reveal inserted at the correct location.

import type { RunFacts } from "./run-facts";
import { runFactsBlock } from "./run-facts";

export type Stage16Format =
  | "consulting"
  | "agency"
  | "workshop"
  | "vision"
  | "valuation";

export interface SessionForStage16 {
  brand_name: string | null;
  category: string | null;
  selected_smp: string | null;
  selection_rationale_1: string | null;
  stage_1_output: string | null;
  stage_2_output: string | null;
  stage_5_output: string | null;
  stage_7_output: string | null;
  stage_8_output: string | null;
  stage_9_output?: string | null;
  stage_10_output: string | null;
  stage_11_output: string | null;
  stage_12_output: string | null;
  stage_13_output: string | null;
  stage_14_output: string | null;
  stage_14b_output: string | null;
  stage_14c_output: string | null;
  stage_15_output: string | null;
  /** Phase 2 creative lock — agency formats must carry the real campaign line,
   *  creative idea and activation architecture rather than restating strategy. */
  stage_17_selected_territory?: string | null;
  stage_18_detonation_line?: string | null;
  stage_18_selected_detonation?: string | null;
  stage_19_output?: string | null;
  stage_22_output?: string | null;
  locked_campaign_line?: string | null;
  locked_big_idea?: string | null;
  /** Authoritative run-level counts. Every section prompt is handed these and
   *  may state no other figure about the run. */
  run_facts?: RunFacts | null;
}

export interface SectionDef {
  name: string;
  title: string;
  systemPrompt: string;
  pipelineInputs: string[];
  targetWords: number;
  maxTokens: number;
  includesPropositionReveal?: boolean;
  /** Number of proposition cards this section's final format presents. */
  propositionCount?: number;
}

const STAGE_16_UNIVERSAL_RULES = `════════════════════════════════════════
RULE 0 — NO PIPELINE METADATA
════════════════════════════════════════

Do not include any pipeline metadata, system labels, processing notes, or internal flags in the output. This includes but is not limited to phrases like STRATEGIC MODE APPLIED, BRIEF DEPTH LEVEL, PIPELINE DATA HEADER, CATEGORY KNOWLEDGE CONFIDENCE, or any other label that references the internal system rather than the strategic content. These are internal processing markers and must never appear in client-facing documents.

════════════════════════════════════════
RULE 1 — NUMBERS RULE
════════════════════════════════════════

Never invent specific financial figures, percentage targets, headcounts, or dates unless they appear explicitly in the brief or pipeline intelligence.

If a budget reference is needed write "significant investment required — quantum to be determined through business case."

If a timeline is needed write "immediate priority — within 90 days" or "medium term — 6 to 12 months."

If a metric target is needed write "measurable improvement in [specific outcome]" not a specific percentage.

Invented precision is worse than honest uncertainty. Boards trust documents that acknowledge what they do not know.

════════════════════════════════════════
RULE 2 — ALTERNATIVES LOOP RULE
════════════════════════════════════════

The selected proposition must never appear in the alternatives section.

The alternatives section covers only what was genuinely considered and set aside.

Each alternative gets exactly two paragraphs:
- Paragraph 1: what it was and its genuine strengths
- Paragraph 2: the precise structural reason it was rejected

No more than two paragraphs per alternative.
The rejection must be specific enough that a sceptical board member cannot respond with "but couldn't you just."

════════════════════════════════════════
RULE 3 — EVIDENCE RULE
════════════════════════════════════════

Every specific claim about market size, competitor behaviour, or customer data must be traceable to the brief or pipeline intelligence.

If it is not in the brief or pipeline outputs — do not include it.

Do not generate market statistics, share figures, or research findings that do not appear in the evidence base.

If evidence is thin write "available data suggests" or "category patterns indicate" rather than stating unverified facts as established truth.

════════════════════════════════════════
RULE 4 — SPECIFICITY RULE
════════════════════════════════════════

Every paragraph must name the brand.

If you can remove the brand name and the paragraph still makes sense — rewrite it or cut it.

Generic observations that could apply to any brand in any category have no place in this document.

Every sentence must earn its place by being specific to this brand, this category, and this moment.

`;

const SINGLE_PROPOSITION_RULE = `════════════════════════════════════════
RULE 6 — ONE PROPOSITION, ALREADY SELECTED
════════════════════════════════════════

The proposition has already been chosen and signed off. This document presents ONE proposition as the recommendation. It is not a comparison document and the reader is not being asked to choose.

Forbidden entirely — never write these or anything like them:
- "Each of the following propositions…"
- "Read each proposition slowly…"
- "these four propositions", "these five propositions", "collectively they map…"
- numbered or lettered proposition menus, side-by-side comparison tables of live options
- any question that invites the reader to pick between propositions

Pipeline inputs supplied to you (particularly the selection-stage output) were written while several propositions were still live and use that comparison language. Ignore that framing completely. Rejected propositions may only appear in the section explicitly about what was set aside, in the past tense, as decisions already made.

`;

function propositionCountRule(count: number): string {
  if (count > 1) {
    return `\nPROPOSITION COUNT CONTRACT\nThis rendered section presents ${count} proposition cards. Set comparison and plural proposition framing are permitted only because those cards are visible in this format.\n`;
  }
  return `\nPROPOSITION COUNT CONTRACT\nPROPOSITION_CARDS_RENDERED: 1\nThe reader sees exactly one already-selected proposition. Describe what THIS proposition claims, why it was selected, and how it differs from category conventions or competitor positions. Never compare it with sibling propositions, options, routes, territories, assumptions, truths, or theories that are not rendered here. Do not use plural or pronoun set framing such as “the propositions”, “these”, “they”, “each one”, “both”, “four” or “five” to refer to candidates.\n`;
}

// ────────────────────────────────────────────────────────────────────────
// CONSULTING SECTION PROMPTS
// ────────────────────────────────────────────────────────────────────────

export const SECTION_SITUATION_PROMPT = `You are a senior partner at a global strategy consultancy writing the opening section of a board strategy recommendation.

This section establishes why this strategy exists and why it must exist now. It names the specific commercial or cultural shift that has created the strategic opportunity. It states the commercial stakes precisely. It creates the urgency that makes the board want to read what follows.

Write 350 words maximum.
3 paragraphs.
One idea per paragraph.
Four sentences maximum per paragraph.
Board level. No padding. No generic observations. Only what is specific to this brand and this moment.

Start with the first word of the first paragraph. No heading. No preamble.`;

export const SECTION_CATEGORY_PROMPT = `You are a senior partner at a global strategy consultancy writing the competitive intelligence section of a board strategy recommendation.

This section demonstrates that the competitive landscape has been rigorously mapped and that the recommended territory is genuinely available. For each major competitor name what they own and the precise structural reason they cannot enter the recommended territory. End by naming what the category has collectively agreed not to say — and why that silence created the opportunity.

Write 400 words maximum.
One paragraph per competitor.
Two closing paragraphs on the category silence.
Board level. Precise. No generic competitive audit language.

End with a pull quote — the single most important insight about the category silence formatted as:
> [One precise sentence]

Start immediately. No heading. No preamble.`;

export const SECTION_HUMAN_TRUTH_PROMPT = `You are a senior partner at a global strategy consultancy writing the human insight section of a board strategy recommendation.

This section reveals the specific human behaviour that the strategy is built on. Not a demographic description. The precise gap between what this audience tells institutions and what they actually do. Write it as a revelation — something the board has perhaps sensed but not articulated, stated with the precision that makes it feel both surprising and obvious.

Write 350 words maximum.
3 paragraphs building to the insight.

End with the Human Contradiction Statement formatted as:
> [The specific contradiction — one precise sentence]

Follow with one paragraph on what this insight makes strategically possible.

Board level. Specific. No segment descriptions.
Start immediately. No heading. No preamble.`;

export const SECTION_WHY_BRAND_PROMPT = `You are a senior partner at a global strategy consultancy writing the brand credibility section of a board strategy recommendation.

This section makes the specific case for why this brand — and not any competitor — can own the recommended territory. Be specific about each advantage. Then be honest about what the brand cannot yet do and what must change before the positioning is fully credible. Do not soften the honest gap — boards respect directness and distrust documents that only say positive things.

Write 300 words maximum.
3 paragraphs on what the brand has.
2 paragraphs on what it cannot yet do.
Board level. Specific. Honest.

Start immediately. No heading. No preamble.`;

export const SECTION_ALTERNATIVES_PROMPT = `You are a senior partner at a global strategy consultancy writing the alternatives evaluation section of a board strategy recommendation.

This section demonstrates rigour — that the recommendation survived comparison with genuine alternatives. For each alternative proposition: name it, acknowledge its genuine strengths, then state the precise strategic, commercial, or operational reason it was not selected. The rejection must be specific enough that a sceptical board member cannot respond with "but couldn't you just."

Write 400 words maximum.
Two paragraphs per alternative.
Board level. The rejections must be intellectually defensible — not preferences.

Start immediately. No heading. No preamble.`;

export const SECTION_EVIDENCE_PROMPT = `You are a senior partner at a global strategy consultancy writing the validation section of a board strategy recommendation.

This section presents the evidence that the recommended territory is available, sustainable, and right for this brand. Present each pressure test as a strategic argument — not a checklist or score table. What was tested. What it confirmed. What it exposed. What the exposure means for implementation.

Write 400 words maximum.
Two paragraphs per test.
Board level. Evidence as argument not as compliance checklist.

Start immediately. No heading. No preamble.`;

export const SECTION_RECOMMENDATION_PROMPT = `You are a senior partner at a global strategy consultancy writing the recommendation section of a board strategy recommendation.

This is the most important section. Build three paragraphs that synthesise the entire argument — the category truth, the human insight, the brand's right to this territory, the evidence of its availability — into a single logical sequence that makes the proposition feel inevitable.

Do not name the proposition in these paragraphs. Complete the argument first. Then write:

PROPOSITION REVEAL:
[leave a blank line here — the proposition will be inserted]

Then write what the recommendation means: what it claims commercially, what it requires of the business, what success looks like. Three paragraphs. Specific. No hedging.

Write 450 words maximum for the pre-reveal and post-reveal sections combined.
Board level. This section must feel like a conclusion, not an announcement.

Start immediately. No heading. No preamble.`;

export const SECTION_CREATIVE_WORLD_PROMPT = `You are a senior partner at a global strategy consultancy writing the creative world section of a board strategy recommendation.

This section helps board members understand what kind of work this strategy produces — not the executions but the world those executions inhabit. Write for a commercially sophisticated reader who does not spend their days in creative briefings. Make the creative world feel real, specific, and distinct from anything competitors are doing.

Write 350 words maximum.
4 paragraphs. No bullet lists. Pure narrative.
Board level. Make it feel like a world worth investing in.

Start immediately. No heading. No preamble.`;

export const SECTION_WHAT_MUST_CHANGE_PROMPT = `You are a senior partner at a global strategy consultancy writing the operational commitments section of a board strategy recommendation.

This is the section where partners earn their fee — by saying the uncomfortable thing clearly. Name specifically what must change in the brand's product, service, operations, and internal culture for the positioning to be credible rather than aspirational. Be direct. Boards respect honesty and distrust documents that only promise upside.

Write 300 words maximum.
3 paragraphs. Direct. No hedging.
This section must feel like advice from someone who is paid for the truth not for agreement.

Start immediately. No heading. No preamble.`;

export const SECTION_NEXT_STEPS_PROMPT = `You are a senior partner at a global strategy consultancy writing the next steps section of a board strategy recommendation.

Three decisions. One paragraph each. Specific action. Named ownership. Specific timing. No "consider" or "explore." What must happen. Who must do it. By when.

Write 200 words maximum.
Three paragraphs only.
Board level. Actionable. Specific.

Start immediately. No heading. No preamble.`;

// ────────────────────────────────────────────────────────────────────────
// AGENCY SECTION PROMPTS
// ────────────────────────────────────────────────────────────────────────

export const AGENCY_BEFORE_YOU_READ_PROMPT = `You are a senior strategy partner at a world-class creative agency writing the opening framing of a strategic platform document for a brand's marketing leadership.

Tell the reader how to read this document and what it is for. One proposition has already been selected and signed off — this document presents that single recommendation and the creative platform built on it. Set the expectation that this is a proposition-led document for the teams who will make the work, not a research deck and not a menu of options to choose between.

Write 300 words maximum. 2 paragraphs. Direct. No preamble. No heading.`;

export const AGENCY_STRATEGIC_CONTEXT_PROMPT = `You are a senior strategy partner at a creative agency writing the strategic context section of a brand platform.

Name the specific commercial or cultural shift the brand is responding to. Why now. What's at stake.

Write 350 words maximum. 3 paragraphs. Specific. No preamble. No heading.`;

export const AGENCY_CATEGORY_PROMPT = `You are a senior strategy partner at a creative agency writing the category section.

What competitors own. What the category has collectively agreed not to say. The opening that creates.

Write 400 words maximum. End with one pull quote formatted as > [sentence]. No heading. No preamble.`;

export const AGENCY_HUMAN_TRUTH_PROMPT = `You are a senior strategy partner at a creative agency writing the human truth section.

The precise contradiction in this audience's behaviour. Stated as a revelation. End with > [contradiction sentence] then one paragraph on what it makes possible.

Write 350 words maximum. No heading. No preamble.`;

export const AGENCY_WHY_BRAND_PROMPT = `You are a senior strategy partner at a creative agency writing why this brand can own this territory.

3 paragraphs on advantages. 2 paragraphs on honest gaps.

Write 300 words maximum. No heading. No preamble.`;

export const AGENCY_WHAT_WAS_SET_ASIDE_PROMPT = `You are a senior strategy partner at a creative agency writing the alternatives section.

Each alternative: name it, acknowledge its strengths, state the specific reason it was set aside.

Write 400 words maximum. Two paragraphs per alternative. No heading. No preamble.`;

export const AGENCY_PROPOSITION_PROMPT = `You are a senior strategy partner at a creative agency writing the proposition section.

Exactly one proposition is being presented — the selected one, supplied in the inputs. Never present it as one of several, never invite comparison, never ask the reader to weigh options.

Three paragraphs that build the argument towards it without naming it. Then:

PROPOSITION REVEAL:
[blank line — proposition inserted]

Then three paragraphs on what this proposition claims, what it requires of the brand, and what it unlocks for the work.

Write 450 words maximum total. No heading. No preamble.`;

export const AGENCY_LOCKED_CREATIVE_PROMPT = `You are a senior strategy partner at a creative agency writing the locked creative section of a strategic platform.

This section carries the creative decisions that have already been made and locked: the campaign line, the creative idea it expresses, and how that idea behaves across channels in activation.

Rules specific to this section:
- The campaign line and creative idea are supplied in the inputs. Reproduce the campaign line VERBATIM — exact words, exact casing. Never rewrite, improve, shorten or invent a line.
- Describe the locked creative idea in the terms supplied. Do not substitute your own idea.
- Summarise the channel activation in one short paragraph per channel, drawn only from the activation architecture supplied.
- If an input reads "[NOT YET LOCKED]", write exactly "*[Pending — not yet locked in the pipeline]*" for that item and write nothing further about it. Never fill the gap with invention.

Write 500 words maximum. No heading. No preamble.`;

export const AGENCY_CREATIVE_WORLD_PROMPT = `You are a senior strategy partner at a creative agency writing the creative world section.

Make the world feel real for the teams who will build it. Visual tone, verbal tone, behaviour, what it never does. Pure narrative — no bullet lists.

Write 600 words maximum. 5-6 paragraphs. No heading. No preamble.`;

export const AGENCY_ACROSS_CHANNELS_PROMPT = `You are a senior strategy partner at a creative agency writing the channels section.

How the proposition expresses itself across the brand's most important touchpoints. Not a media plan — a description of behaviour by channel.

Write 400 words maximum. One short paragraph per channel. No heading. No preamble.`;

export const AGENCY_BRIEF_TO_CREATIVE_PROMPT = `You are a senior strategy partner at a creative agency writing the brief to the creative teams.

The single thought. The single feeling. The single thing the work must do. Tight, useful, briefable.

Write 250 words maximum. No heading. No preamble.`;

// ────────────────────────────────────────────────────────────────────────
// WORKSHOP SECTION PROMPTS
// ────────────────────────────────────────────────────────────────────────

export const WORKSHOP_FOR_FACILITATOR_PROMPT = `You are a senior strategy facilitator writing the opening note to the facilitator of a brand strategy workshop.

What this workshop is for. The arc. The single outcome it must produce. Tone to hold in the room.

Write 300 words maximum. No heading. No preamble.`;

export const WORKSHOP_PREPARATION_PROMPT = `You are a senior strategy facilitator writing the preparation note for a brand workshop.

What must be true before the session. Materials. Pre-reads. Room setup.

Write 200 words maximum. No heading. No preamble.`;

export const WORKSHOP_SESSION_ONE_PROMPT = `You are a senior strategy facilitator writing Session One of a brand workshop.

Purpose. Questions. Activity. Outcome to capture. Write it so any senior facilitator could run it.

Write 400 words maximum. No heading. No preamble.`;

export const WORKSHOP_SESSION_TWO_PROMPT = `You are a senior strategy facilitator writing Session Two of a brand workshop, focused on category truth and competitive whitespace.

Purpose. Questions. Activity. Outcome to capture.

Write 400 words maximum. No heading. No preamble.`;

export const WORKSHOP_SESSION_THREE_PROMPT = `You are a senior strategy facilitator writing Session Three of a brand workshop, focused on the human truth and audience contradiction.

Purpose. Questions. Activity. Outcome to capture.

Write 400 words maximum. No heading. No preamble.`;

export const WORKSHOP_SESSION_FOUR_PROMPT = `You are a senior strategy facilitator writing Session Four of a brand workshop — the proposition reveal.

Set up the reveal. The argument before the reveal. Then leave a single line:

PROPOSITION REVEAL:
[blank line — proposition inserted]

Then what to do with the room immediately after the reveal.

Write 350 words maximum. No heading. No preamble.`;

export const WORKSHOP_SESSION_FIVE_PROMPT = `You are a senior strategy facilitator writing Session Five of a brand workshop, focused on what must change inside the business.

Purpose. Questions. Activity. The commitments to capture.

Write 350 words maximum. No heading. No preamble.`;

export const WORKSHOP_APPENDIX_A_PROMPT = `You are a senior strategy facilitator writing Appendix A — the participant cards summary.

The roles in the room. What each is being asked to bring. What each is being asked to leave behind.

Write 250 words maximum. No heading. No preamble.`;

export const WORKSHOP_APPENDIX_B_PROMPT = `You are a senior strategy facilitator writing Appendix B — difficult moments and how to handle them.

The three or four most likely friction points in this workshop and the facilitator move for each.

Write 300 words maximum. No heading. No preamble.`;

// ────────────────────────────────────────────────────────────────────────
// SECTION ASSEMBLY
// ────────────────────────────────────────────────────────────────────────

function cut(s: string | null | undefined, n: number): string {
  return (s ?? "").substring(0, n);
}

export function getConsultingSections(s: SessionForStage16): SectionDef[] {
  const smp = s.selected_smp ?? "";
  return [
    {
      name: "situation",
      title: "PART ONE — THE SITUATION",
      systemPrompt: STAGE_16_UNIVERSAL_RULES + SECTION_SITUATION_PROMPT,
      pipelineInputs: [cut(s.stage_1_output, 2000), cut(s.stage_2_output, 1500)],
      targetWords: 350,
      maxTokens: 64000,
    },
    {
      name: "category",
      title: "PART TWO — WHAT THE CATEGORY HAS AGREED NOT TO SAY",
      systemPrompt: STAGE_16_UNIVERSAL_RULES + SECTION_CATEGORY_PROMPT,
      pipelineInputs: [cut(s.stage_2_output, 3000)],
      targetWords: 400,
      maxTokens: 64000,
    },
    {
      name: "human_truth",
      title: "PART THREE — THE PEOPLE THE CATEGORY IS FAILING",
      systemPrompt: STAGE_16_UNIVERSAL_RULES + SECTION_HUMAN_TRUTH_PROMPT,
      pipelineInputs: [cut(s.stage_7_output, 2000), cut(s.stage_5_output, 1500)],
      targetWords: 350,
      maxTokens: 64000,
    },
    {
      name: "why_brand",
      title: "PART FOUR — WHY THIS BRAND",
      systemPrompt: STAGE_16_UNIVERSAL_RULES + SECTION_WHY_BRAND_PROMPT,
      pipelineInputs: [cut(s.stage_13_output, 2500)],
      targetWords: 300,
      maxTokens: 64000,
    },
    {
      name: "alternatives",
      title: "PART FIVE — WHAT WAS TESTED AND SET ASIDE",
      systemPrompt: STAGE_16_UNIVERSAL_RULES + SECTION_ALTERNATIVES_PROMPT,
      pipelineInputs: [
        cut(s.stage_8_output, 3000),
        cut(s.stage_10_output, 1500),
        cut(s.stage_12_output, 1000),
      ],
      targetWords: 400,
      maxTokens: 64000,
    },
    {
      name: "evidence",
      title: "PART SIX — THE EVIDENCE",
      systemPrompt: STAGE_16_UNIVERSAL_RULES + SECTION_EVIDENCE_PROMPT,
      pipelineInputs: [cut(s.stage_11_output, 3000)],
      targetWords: 400,
      maxTokens: 64000,
    },
    {
      name: "recommendation",
      title: "PART SEVEN — THE RECOMMENDATION",
      systemPrompt: STAGE_16_UNIVERSAL_RULES + SECTION_RECOMMENDATION_PROMPT,
      pipelineInputs: [
        cut(s.stage_12_output, 1500),
        cut(s.stage_7_output, 1500),
        `SELECTED PROPOSITION: "${smp}"`,
      ],
      targetWords: 450,
      maxTokens: 64000,
      includesPropositionReveal: true,
    },
    {
      name: "creative_world",
      title: "PART EIGHT — THE CREATIVE WORLD",
      systemPrompt: STAGE_16_UNIVERSAL_RULES + SECTION_CREATIVE_WORLD_PROMPT,
      pipelineInputs: [cut(s.stage_14c_output, 2500), cut(s.stage_14_output, 1500)],
      targetWords: 350,
      maxTokens: 64000,
    },
    {
      name: "what_must_change",
      title: "PART NINE — WHAT MUST CHANGE",
      systemPrompt: STAGE_16_UNIVERSAL_RULES + SECTION_WHAT_MUST_CHANGE_PROMPT,
      pipelineInputs: [cut(s.stage_13_output, 1500), cut(s.stage_15_output, 1000)],
      targetWords: 300,
      maxTokens: 64000,
    },
    {
      name: "next_steps",
      title: "PART TEN — NEXT STEPS",
      systemPrompt: STAGE_16_UNIVERSAL_RULES + SECTION_NEXT_STEPS_PROMPT,
      pipelineInputs: [cut(s.selection_rationale_1, 500)],
      targetWords: 200,
      maxTokens: 64000,
    },
  ];
}

export function getAgencySections(s: SessionForStage16): SectionDef[] {
  const smp = s.selected_smp ?? "";
  return [
    {
      name: "before_you_read",
      title: "BEFORE YOU READ THIS",
      systemPrompt: STAGE_16_UNIVERSAL_RULES + AGENCY_BEFORE_YOU_READ_PROMPT,
      pipelineInputs: [cut(s.stage_1_output, 1500)],
      targetWords: 300,
      maxTokens: 64000,
      propositionCount: 1,
    },
    {
      name: "strategic_context",
      title: "PART ONE — THE STRATEGIC CONTEXT",
      systemPrompt: STAGE_16_UNIVERSAL_RULES + AGENCY_STRATEGIC_CONTEXT_PROMPT,
      pipelineInputs: [cut(s.stage_1_output, 2000), cut(s.stage_2_output, 1500)],
      targetWords: 350,
      maxTokens: 64000,
      propositionCount: 1,
    },
    {
      name: "category",
      title: "PART TWO — THE CATEGORY",
      systemPrompt: STAGE_16_UNIVERSAL_RULES + AGENCY_CATEGORY_PROMPT,
      pipelineInputs: [cut(s.stage_2_output, 3000)],
      targetWords: 400,
      maxTokens: 64000,
      propositionCount: 1,
    },
    {
      name: "human_truth",
      title: "PART THREE — THE HUMAN TRUTH",
      systemPrompt: STAGE_16_UNIVERSAL_RULES + AGENCY_HUMAN_TRUTH_PROMPT,
      pipelineInputs: [cut(s.stage_7_output, 2000), cut(s.stage_5_output, 1500)],
      targetWords: 350,
      maxTokens: 64000,
      propositionCount: 1,
    },
    {
      name: "why_brand",
      title: "PART FOUR — WHY THIS BRAND",
      systemPrompt: STAGE_16_UNIVERSAL_RULES + AGENCY_WHY_BRAND_PROMPT,
      pipelineInputs: [cut(s.stage_13_output, 2500)],
      targetWords: 300,
      maxTokens: 64000,
      propositionCount: 1,
    },
    {
      name: "what_was_set_aside",
      title: "PART FIVE — WHAT WAS SET ASIDE",
      systemPrompt: STAGE_16_UNIVERSAL_RULES + AGENCY_WHAT_WAS_SET_ASIDE_PROMPT,
      pipelineInputs: [
        cut(s.stage_8_output, 3000),
        cut(s.stage_12_output, 1000),
      ],
      targetWords: 400,
      maxTokens: 64000,
      propositionCount: 1,
    },
    {
      name: "proposition",
      title: "PART SIX — THE PROPOSITION",
      systemPrompt: STAGE_16_UNIVERSAL_RULES + AGENCY_PROPOSITION_PROMPT,
      pipelineInputs: [
        cut(s.stage_12_output, 1500),
        cut(s.stage_7_output, 1500),
        `SELECTED PROPOSITION: "${smp}"`,
      ],
      targetWords: 450,
      maxTokens: 64000,
      includesPropositionReveal: true,
      propositionCount: 1,
    },
    {
      name: "creative_world",
      title: "PART SEVEN — THE CREATIVE WORLD",
      systemPrompt: STAGE_16_UNIVERSAL_RULES + AGENCY_CREATIVE_WORLD_PROMPT,
      pipelineInputs: [
        cut(s.stage_14c_output, 3000),
        cut(s.stage_14_output, 1500),
        cut(s.stage_14b_output, 1500),
      ],
      targetWords: 600,
      maxTokens: 64000,
      propositionCount: 1,
    },
    {
      name: "across_channels",
      title: "PART EIGHT — ACROSS CHANNELS",
      systemPrompt: STAGE_16_UNIVERSAL_RULES + AGENCY_ACROSS_CHANNELS_PROMPT,
      pipelineInputs: [cut(s.stage_14b_output, 2500)],
      targetWords: 400,
      maxTokens: 64000,
      propositionCount: 1,
    },
    {
      name: "locked_creative",
      title: "PART NINE — THE LOCKED CREATIVE",
      systemPrompt: STAGE_16_UNIVERSAL_RULES + AGENCY_LOCKED_CREATIVE_PROMPT,
      pipelineInputs: [
        `CAMPAIGN LINE (verbatim, do not alter): ${
          (s.locked_campaign_line ?? s.stage_18_detonation_line ?? "").trim() || "[NOT YET LOCKED]"
        }`,
        `CREATIVE IDEA: ${
          (s.locked_big_idea ?? s.stage_18_selected_detonation ?? "").trim() || "[NOT YET LOCKED]"
        }`,
        `CREATIVE TERRITORY: ${(s.stage_17_selected_territory ?? "").trim() || "[NOT YET LOCKED]"}`,
        `ACTIVATION ARCHITECTURE:\n${cut(s.stage_19_output, 3000) || "[NOT YET LOCKED]"}`,
        `BRAND ARCHITECTURE:\n${cut(s.stage_22_output, 1500) || "[NOT YET LOCKED]"}`,
      ],
      targetWords: 500,
      maxTokens: 64000,
      propositionCount: 1,
    },
    {
      name: "brief_to_creative",
      title: "PART TEN — THE BRIEF TO CREATIVE TEAMS",
      systemPrompt: STAGE_16_UNIVERSAL_RULES + AGENCY_BRIEF_TO_CREATIVE_PROMPT,
      pipelineInputs: [
        `PROPOSITION: "${smp}"`,
        cut(s.stage_14c_output, 1000),
      ],
      targetWords: 250,
      maxTokens: 64000,
      propositionCount: 1,
    },
  ];
}

export function getWorkshopSections(s: SessionForStage16): SectionDef[] {
  const smp = s.selected_smp ?? "";
  return [
    {
      name: "for_facilitator",
      title: "FOR THE FACILITATOR",
      systemPrompt: STAGE_16_UNIVERSAL_RULES + WORKSHOP_FOR_FACILITATOR_PROMPT,
      pipelineInputs: [cut(s.stage_1_output, 1500)],
      targetWords: 300,
      maxTokens: 64000,
    },
    {
      name: "preparation",
      title: "PREPARATION",
      systemPrompt: STAGE_16_UNIVERSAL_RULES + WORKSHOP_PREPARATION_PROMPT,
      pipelineInputs: [cut(s.stage_1_output, 1000)],
      targetWords: 200,
      maxTokens: 64000,
    },
    {
      name: "session_one",
      title: "SESSION ONE — THE SITUATION WE'RE IN",
      systemPrompt: STAGE_16_UNIVERSAL_RULES + WORKSHOP_SESSION_ONE_PROMPT,
      pipelineInputs: [cut(s.stage_1_output, 2000)],
      targetWords: 400,
      maxTokens: 64000,
    },
    {
      name: "session_two",
      title: "SESSION TWO — THE CATEGORY WHITESPACE",
      systemPrompt: STAGE_16_UNIVERSAL_RULES + WORKSHOP_SESSION_TWO_PROMPT,
      pipelineInputs: [cut(s.stage_2_output, 2500)],
      targetWords: 400,
      maxTokens: 64000,
    },
    {
      name: "session_three",
      title: "SESSION THREE — THE HUMAN TRUTH",
      systemPrompt: STAGE_16_UNIVERSAL_RULES + WORKSHOP_SESSION_THREE_PROMPT,
      pipelineInputs: [cut(s.stage_7_output, 2500)],
      targetWords: 400,
      maxTokens: 64000,
    },
    {
      name: "session_four",
      title: "SESSION FOUR — THE REVEAL",
      systemPrompt: STAGE_16_UNIVERSAL_RULES + WORKSHOP_SESSION_FOUR_PROMPT,
      pipelineInputs: [
        cut(s.stage_12_output, 1500),
        `SELECTED PROPOSITION: "${smp}"`,
      ],
      targetWords: 350,
      maxTokens: 64000,
      includesPropositionReveal: true,
    },
    {
      name: "session_five",
      title: "SESSION FIVE — WHAT MUST CHANGE",
      systemPrompt: STAGE_16_UNIVERSAL_RULES + WORKSHOP_SESSION_FIVE_PROMPT,
      pipelineInputs: [cut(s.stage_13_output, 1500), cut(s.stage_15_output, 1000)],
      targetWords: 350,
      maxTokens: 64000,
    },
    {
      name: "appendix_a",
      title: "APPENDIX A — PARTICIPANT CARDS",
      systemPrompt: STAGE_16_UNIVERSAL_RULES + WORKSHOP_APPENDIX_A_PROMPT,
      pipelineInputs: [cut(s.stage_7_output, 1500)],
      targetWords: 250,
      maxTokens: 64000,
    },
    {
      name: "appendix_b",
      title: "APPENDIX B — DIFFICULT MOMENTS",
      systemPrompt: STAGE_16_UNIVERSAL_RULES + WORKSHOP_APPENDIX_B_PROMPT,
      pipelineInputs: [cut(s.stage_13_output, 1500)],
      targetWords: 300,
      maxTokens: 64000,
    },
  ];
}

// ────────────────────────────────────────────────────────────────────────
// VALUATION INPUT BRIEF
// ────────────────────────────────────────────────────────────────────────
// A reformatting of already-frozen Stage 9 / 10 / 11 / 13 output into the
// qualitative inputs a professional brand valuer needs upstream of their own
// certified model. Brand Grenade never produces a dollar figure, a royalty
// rate or a discount rate; the boundary disclaimer is inserted in code by the
// assembler and never passes through the model.

export const VALUATION_RULES = `════════════════════════════════════════
RULE 5 — VALUATION BOUNDARY (THIS DOCUMENT ONLY)
════════════════════════════════════════

This is a qualitative input pack for a professional valuer. It is NOT a valuation.

Never produce, estimate, imply or "illustrate" any of the following: a monetary value or dollar figure, a royalty rate, a discount rate, a WACC, a brand contribution percentage, a multiple, a growth rate, or any percentage that is not already present verbatim in the supplied stage output.

Never reference ISO 10668, USPAP, Royalty Relief, Earnings Attribution or Capital Premium as methods you are applying. You may note only that the findings below are the qualitative inputs a valuer may use; method selection, modelling and certification belong entirely to the receiving firm.

If the underlying stage data contains no number for a finding, describe the finding qualitatively. Never estimate one.

Score scales: individual dimensions are scored out of 10. Weighted composites use the six-dimension framework whose weights total 90, so every composite is printed as /90 — including any composite the source labels "/100", which is legacy labelling of the same 90-point figure. Carry the numeric value exactly as recorded and never rescale it. State once, in the strength-index section only, that dimensions are /10 and composites are /90; never repeat a scale explanation elsewhere.

Do not draw on any material other than the four supplied stage inputs. Creative, campaign, activation and brand-architecture material is out of scope for this document even if you know it exists.

Each section is supplied only with the stage output it needs. Never remark on, apologise for, or draw inferences from stages that are not supplied to the section you are writing — the other stages are carried in their own sections of this same brief. Write only from what is in front of you.

Cite the source stage inline for every substantive claim, in the form (Stage 10 — Proposition Scoring), (Stage 9 — Distinctiveness Check), (Stage 11 — Integrity Testing) or (Stage 13 — Brand Fit Validation).

`;

export const VALUATION_INDEX_PROMPT = `You are a brand strategist preparing an input pack for a professional intangible-asset valuer.

Write the Brand Strength Index Summary. Translate the composite proposition score and each of its six dimensions — Fame, Truth Strength, Competitive Impossibility, Brand Permission, Clean Air, Commercial Precedent — into a clearly labelled qualitative index. Report each dimension's score exactly as it appears in the supplied output, with the reasoning that produced it retained. Where the supplied output has no score for a dimension, say so plainly.

Use a labelled paragraph or short table per dimension, then one closing paragraph on what the composite indicates about brand strength qualitatively.

Write 600 words maximum. No heading. No preamble. Start immediately.`;

export const VALUATION_DEFENSIBILITY_PROMPT = `You are a brand strategist preparing an input pack for a professional intangible-asset valuer.

Write the Competitive Defensibility Narrative, drawn only from the supplied distinctiveness analysis. For each named competitor: what they currently own, and the precise structural reason they cannot occupy the same position. Name the competitors exactly as the source names them; do not add competitors the source does not name.

Close with one paragraph on what this means for the durability of the brand's position — qualitatively, with no rate or figure of any kind.

Write 600 words maximum. No heading. No preamble. Start immediately.`;

export const VALUATION_DURABILITY_PROMPT = `You are a brand strategist preparing an input pack for a professional intangible-asset valuer.

Write the Durability and Risk Read from the supplied pressure-test output. Take each of the five conditions in turn, state the verdict exactly as recorded (Holds / Wobbles / Cracks), summarise the reasoning, and describe the qualitative risk factor a valuer would want reflected when they select their own rates. Never suggest a rate, a direction of adjustment in numeric terms, or a magnitude.

Close with one paragraph naming the strongest durability signal and the most material residual risk.

Write 600 words maximum. No heading. No preamble. Start immediately.`;

export const VALUATION_FIT_PROMPT = `You are a brand strategist preparing an input pack for a professional intangible-asset valuer.

Write the Brand Fit Cross-Check from the supplied brand-fit validation. Summarise each of the six dimensions and its verdict, then state plainly whether the fit assessment supports, qualifies or contradicts the durability read. Where the fit assessment exposes a gap, name it.

Write 450 words maximum. No heading. No preamble. Start immediately.`;

export const VALUATION_APPENDIX_PROMPT = `You are a brand strategist preparing an input pack for a professional intangible-asset valuer.

Write the Evidence Appendix. List every substantive claim carried in this brief as a bullet, each followed by its source stage in the form (Stage 9 — Distinctiveness Check), (Stage 10 — Proposition Scoring), (Stage 11 — Integrity Testing) or (Stage 13 — Brand Fit Validation). Quote scores and verdicts exactly as recorded in the source. Nothing may appear here that is not in the supplied source material, and nothing carried above may be omitted.

Write 700 words maximum. Bullets only. No heading. No preamble. Start immediately.`;

export function getValuationSections(s: SessionForStage16): SectionDef[] {
  const rules = STAGE_16_UNIVERSAL_RULES + VALUATION_RULES;
  return [
    {
      name: "strength_index",
      title: "SECTION ONE — BRAND STRENGTH INDEX SUMMARY",
      systemPrompt: rules + VALUATION_INDEX_PROMPT,
      pipelineInputs: [
        `SOURCE — STAGE 10, PROPOSITION SCORING:\n${cut(s.stage_10_output, 45000)}`,
      ],
      targetWords: 600,
      maxTokens: 32000,
    },
    {
      name: "defensibility",
      title: "SECTION TWO — COMPETITIVE DEFENSIBILITY NARRATIVE",
      systemPrompt: rules + VALUATION_DEFENSIBILITY_PROMPT,
      pipelineInputs: [
        `SOURCE — STAGE 9, DISTINCTIVENESS CHECK:\n${cut(s.stage_9_output, 45000)}`,
      ],
      targetWords: 600,
      maxTokens: 32000,
    },
    {
      name: "durability_risk",
      title: "SECTION THREE — DURABILITY AND RISK READ",
      systemPrompt: rules + VALUATION_DURABILITY_PROMPT,
      pipelineInputs: [
        `SOURCE — STAGE 11, INTEGRITY TESTING:\n${cut(s.stage_11_output, 45000)}`,
      ],
      targetWords: 600,
      maxTokens: 32000,
    },
    {
      name: "brand_fit_cross_check",
      title: "SECTION FOUR — BRAND FIT CROSS-CHECK",
      systemPrompt: rules + VALUATION_FIT_PROMPT,
      pipelineInputs: [
        `SOURCE — STAGE 13, BRAND FIT VALIDATION:\n${cut(s.stage_13_output, 45000)}`,
      ],
      targetWords: 450,
      maxTokens: 32000,
    },
    {
      name: "evidence_appendix",
      title: "SECTION FIVE — EVIDENCE APPENDIX",
      systemPrompt: rules + VALUATION_APPENDIX_PROMPT,
      pipelineInputs: [
        `SOURCE — STAGE 9, DISTINCTIVENESS CHECK:\n${cut(s.stage_9_output, 22000)}`,
        `SOURCE — STAGE 10, PROPOSITION SCORING:\n${cut(s.stage_10_output, 22000)}`,
        `SOURCE — STAGE 11, INTEGRITY TESTING:\n${cut(s.stage_11_output, 22000)}`,
        `SOURCE — STAGE 13, BRAND FIT VALIDATION:\n${cut(s.stage_13_output, 22000)}`,
      ],
      targetWords: 700,
      maxTokens: 32000,
    },
  ];
}

/** Prepend the authoritative run-facts block (and, post-selection, the
 *  single-proposition rule) to every section prompt in a format. No section
 *  may state a run count that is not interpolated here. */
function withSharedRules(
  sections: SectionDef[],
  session: SessionForStage16,
): SectionDef[] {
  const facts = session.run_facts ? runFactsBlock(session.run_facts) : "";
  const single = session.selected_smp?.trim() ? SINGLE_PROPOSITION_RULE : "";
  if (!facts && !single) return sections;
  return sections.map((sec) => ({
    ...sec,
    systemPrompt: `${sec.systemPrompt}\n${facts}${single}${
      sec.propositionCount != null ? propositionCountRule(sec.propositionCount) : ""
    }`,
  }));
}

export function getSectionsForFormat(
  format: Stage16Format,
  session: SessionForStage16,
): SectionDef[] {
  switch (format) {
    case "consulting":
      return withSharedRules(getConsultingSections(session), session);
    case "agency":
      return withSharedRules(getAgencySections(session), session);
    case "workshop":
      return withSharedRules(getWorkshopSections(session), session);
    case "valuation":
      // Valuation carries no proposition-set framing and no run-facts counts —
      // it is a restatement of frozen evidence, not a narrative about the run.
      return getValuationSections(session);
    case "vision":
      // Vision is generated as a single unified narrative — not sectioned.
      // The runStage16 handler special-cases this format.
      return [];
  }
}

// Human-readable progress label for the section currently being written.
export function sectionStatusLabel(section: SectionDef): string {
  const pretty = section.title
    .replace(/^(PART [A-Z]+ — |APPENDIX [A-Z] — |SESSION [A-Z]+ — )/i, "")
    .replace(/^(BEFORE YOU READ THIS|FOR THE FACILITATOR|PREPARATION)$/i, (m) =>
      m
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase()),
    );
  const titleCase = pretty
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return `Writing: ${titleCase}…`;
}

export function buildSectionUserMessage(
  section: SectionDef,
  brand: string,
  category: string,
): string {
  const inputs = section.pipelineInputs
    .filter((p) => p && p.trim().length > 0)
    .map((p, i) => `--- INPUT ${i + 1} ---\n${p}`)
    .join("\n\n");
  return `BRAND: ${brand}
CATEGORY: ${category}
SECTION: ${section.title}
TARGET LENGTH: ${section.targetWords} words

PIPELINE INPUTS:

${inputs}

Write the section now. Follow the writing standard in the system prompt exactly. ${section.targetWords} words maximum. Start with the first word — no heading, no preamble.`;
}
