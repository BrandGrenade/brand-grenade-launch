// Multi-section Stage 16 architecture.
//
// Each format (consulting / agency / workshop) is rendered as a sequence of
// focused, short Claude calls — one per document section. No single call is
// large enough to hit the token ceiling, so truncation is structurally
// impossible. Sections are stitched together by `assembleDocument` with the
// proposition reveal inserted at the correct location.

export type Stage16Format = "consulting" | "agency" | "workshop" | "vision";

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
  stage_10_output: string | null;
  stage_11_output: string | null;
  stage_12_output: string | null;
  stage_13_output: string | null;
  stage_14_output: string | null;
  stage_14b_output: string | null;
  stage_14c_output: string | null;
  stage_15_output: string | null;
}

export interface SectionDef {
  name: string;
  title: string;
  systemPrompt: string;
  pipelineInputs: string[];
  targetWords: number;
  maxTokens: number;
  includesPropositionReveal?: boolean;
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

Tell the reader how to read this document and what it is for. Set expectation that this is a proposition-led document built for the teams who will make the work — not a research deck.

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

Three paragraphs that build the argument without naming the proposition. Then:

PROPOSITION REVEAL:
[blank line — proposition inserted]

Then three paragraphs on what the proposition claims, requires, and unlocks.

Write 450 words maximum total. No heading. No preamble.`;

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
    },
    {
      name: "strategic_context",
      title: "PART ONE — THE STRATEGIC CONTEXT",
      systemPrompt: STAGE_16_UNIVERSAL_RULES + AGENCY_STRATEGIC_CONTEXT_PROMPT,
      pipelineInputs: [cut(s.stage_1_output, 2000), cut(s.stage_2_output, 1500)],
      targetWords: 350,
      maxTokens: 64000,
    },
    {
      name: "category",
      title: "PART TWO — THE CATEGORY",
      systemPrompt: STAGE_16_UNIVERSAL_RULES + AGENCY_CATEGORY_PROMPT,
      pipelineInputs: [cut(s.stage_2_output, 3000)],
      targetWords: 400,
      maxTokens: 64000,
    },
    {
      name: "human_truth",
      title: "PART THREE — THE HUMAN TRUTH",
      systemPrompt: STAGE_16_UNIVERSAL_RULES + AGENCY_HUMAN_TRUTH_PROMPT,
      pipelineInputs: [cut(s.stage_7_output, 2000), cut(s.stage_5_output, 1500)],
      targetWords: 350,
      maxTokens: 64000,
    },
    {
      name: "why_brand",
      title: "PART FOUR — WHY THIS BRAND",
      systemPrompt: STAGE_16_UNIVERSAL_RULES + AGENCY_WHY_BRAND_PROMPT,
      pipelineInputs: [cut(s.stage_13_output, 2500)],
      targetWords: 300,
      maxTokens: 64000,
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
    },
    {
      name: "across_channels",
      title: "PART EIGHT — ACROSS CHANNELS",
      systemPrompt: STAGE_16_UNIVERSAL_RULES + AGENCY_ACROSS_CHANNELS_PROMPT,
      pipelineInputs: [cut(s.stage_14b_output, 2500)],
      targetWords: 400,
      maxTokens: 64000,
    },
    {
      name: "brief_to_creative",
      title: "PART NINE — THE BRIEF TO CREATIVE TEAMS",
      systemPrompt: STAGE_16_UNIVERSAL_RULES + AGENCY_BRIEF_TO_CREATIVE_PROMPT,
      pipelineInputs: [
        `PROPOSITION: "${smp}"`,
        cut(s.stage_14c_output, 1000),
      ],
      targetWords: 250,
      maxTokens: 64000,
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

export function getSectionsForFormat(
  format: Stage16Format,
  session: SessionForStage16,
): SectionDef[] {
  switch (format) {
    case "consulting":
      return getConsultingSections(session);
    case "agency":
      return getAgencySections(session);
    case "workshop":
      return getWorkshopSections(session);
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
