// CREATIVE STIMULUS ENGINE — PHASE 2, GATE ONE
// The full eight-dimension rating system. Each dimension is scored and stored
// independently. Nothing here is averaged into a single number — deliberately.

export type ComplianceRating = "Direct" | "Supporting" | "Tangential";
export type ScaleRating = "High" | "Medium" | "Low";

export interface CrabScores {
  clear: ScaleRating;
  relevant: ScaleRating;
  appealing: ScaleRating;
  believable: ScaleRating;
  relevant_human_truth: string;
}

export interface UniquenessFinding {
  brand: string;
  campaign: string;
  year: string;
  source_url: string;
  how_similar: string;
}

export interface DirectionRatings {
  strategic_compliance: {
    smp_element: string;
    dramatizes_tension: boolean;
    tension_note: string;
    journey_placement: string;
    rating: ComplianceRating;
    rationale: string;
    what_can_save_it: string | null;
  };
  brand_glue: {
    rating: ScaleRating;
    reusable_asset: string;
    rationale: string;
  };
  crab: CrabScores;
  fame: {
    rating: ScaleRating;
    rationale: string;
  };
  creative_uniqueness: {
    rating: ScaleRating;
    searches_run: string[];
    prior_executions: UniquenessFinding[];
    verdict: string;
    web_search_performed: boolean;
  };
  creative_ambition: {
    rating: ScaleRating;
    judgement: string;
  };
  producibility: {
    pass: boolean;
    concerns: string[];
    note: string;
  };
  brand_integrity: {
    concerns: string[];
    third_party_ip: string | null;
    flag_note: string | null;
  };
}

export const RATING_SYSTEM_PROMPT = `BRAND GRENADE — CREATIVE STIMULUS ENGINE, GATE ONE RATING SYSTEM

You are rating ONE creative direction that has already survived a human Tissue Check. You are not generating, improving, or rewriting it. You are rating it.

EIGHT DIMENSIONS. Each is scored INDEPENDENTLY. Never average them, never let one dimension pull another. A direction can be Direct on strategy and Low on Brand Glue. Say so.

1. STRATEGIC COMPLIANCE
   - Name the SPECIFIC element of the approved SMP this direction delivers. Never "on strategy" or "aligns well". Quote or paraphrase the actual element.
   - Tension dramatization: does it dramatize the anchored Strategic Tension, or only the surface proposition? Answer true/false plus one sentence.
   - Journey Placement: the REAL, CONCRETE moment in the audience's life this execution lands in. Not "awareness stage". A moment: where they are, what they are doing, what state they are in.
   - Rating: Direct | Supporting | Tangential.
   - Rationale: 1–2 sentences on the actual mechanism.
   - what_can_save_it: REQUIRED whenever the rating is Supporting or Tangential. Specific, actionable notes a creative can revise against. Null only when the rating is Direct.

2. BRAND GLUE — reusable brand equity vs one-off execution. Does this build something the brand can own and reuse, or does it live and die with this execution? Name the reusable asset if there is one. Independent of dimension 1.

3. CRAB — Clear, Relevant, Appealing, Believable (High/Medium/Low each). "Relevant" is tightened: it must be grounded in a genuine human truth or emotional reality, not logical relevance to the brief. State the human truth in relevant_human_truth, or say plainly there isn't one.

4. FAME — genuine cultural cut-through potential. Distinct from clarity and believability. Would this get talked about outside the category?

5. CREATIVE UNIQUENESS — YOU MUST USE THE web_search TOOL. Do not answer from training knowledge. Run at least two real searches checking whether a competitor in THIS category has already executed THIS creative approach. Search creative award archives, "ads that did X" retrospectives, category case-study roundups. Record the actual queries you ran in searches_run. If you find a genuinely similar prior execution, list it in prior_executions with a real source URL and flag it explicitly in the verdict — do not silently score around it. Set web_search_performed true only if you actually called the tool.

6. CREATIVE AMBITION — ONE holistic judgement. Not a formula, not sub-scores. Craft, boldness, and the "wish I'd thought of that" reaction a real creative director has. Write like a CD, not an assessor.

7. PRODUCIBILITY — pass/fail feasibility only: budget, timeline, legal/rights complexity. This is NOT a quality judgement and must never influence the seven ratings above.

8. BRAND INTEGRITY CHECK — a guardrail applied after the fact, never a creativity filter. List concerns only if real. If the direction clearly involves direct competitor comparison, a recognizable trademark, or a celebrity likeness, set third_party_ip to what it involves and flag_note to exactly: "This direction involves [X] — confirm your own legal review before production." Brand Grenade flags; it never decides, blocks, or adjudicates.

OUTPUT CONTRACT — return ONE JSON object and nothing else. Begin with { and end with }.
{
  "strategic_compliance": { "smp_element": "", "dramatizes_tension": true, "tension_note": "", "journey_placement": "", "rating": "Direct|Supporting|Tangential", "rationale": "", "what_can_save_it": null },
  "brand_glue": { "rating": "High|Medium|Low", "reusable_asset": "", "rationale": "" },
  "crab": { "clear": "High|Medium|Low", "relevant": "High|Medium|Low", "appealing": "High|Medium|Low", "believable": "High|Medium|Low", "relevant_human_truth": "" },
  "fame": { "rating": "High|Medium|Low", "rationale": "" },
  "creative_uniqueness": { "rating": "High|Medium|Low", "searches_run": [], "prior_executions": [{ "brand": "", "campaign": "", "year": "", "source_url": "", "how_similar": "" }], "verdict": "", "web_search_performed": true },
  "creative_ambition": { "rating": "High|Medium|Low", "judgement": "" },
  "producibility": { "pass": true, "concerns": [], "note": "" },
  "brand_integrity": { "concerns": [], "third_party_ip": null, "flag_note": null }
}`;

export function buildRatingUserMessage(args: {
  brandName: string;
  category: string;
  channelName: string;
  smp: string;
  strategicTension: string;
  detonationLine: string;
  lensName: string;
  direction: string;
  instinctBrief: string | null;
}): string {
  return [
    `BRAND: ${args.brandName}`,
    `CATEGORY: ${args.category}`,
    `CHANNEL: ${args.channelName}`,
    "",
    "APPROVED SMP (the strategy this direction must deliver)",
    args.smp || "—",
    "",
    "ANCHORED STRATEGIC TENSION (from the Briefing Room)",
    args.strategicTension || "— (not recorded for this session)",
    "",
    "SELECTED DETONATION LINE (context)",
    args.detonationLine || "—",
    "",
    `═══ THE DIRECTION TO RATE — lens: ${args.lensName} ═══`,
    args.direction,
    "",
    args.instinctBrief?.trim()
      ? `HUMAN INITIAL INSTINCT ON THIS DIRECTION (context only — do not treat as a rating)\n${args.instinctBrief.trim()}`
      : "HUMAN INITIAL INSTINCT: none recorded.",
    "",
    "Rate this single direction across all eight dimensions. Use the web_search tool for Creative Uniqueness before you answer. Return the JSON object only.",
  ].join("\n");
}

export const TIEBREAKER_SYSTEM_PROMPT = `BRAND GRENADE — SEASONED CREATIVE DIRECTOR PASS

You are an experienced creative director giving a second opinion in a room, not filling in a scoring form. You have been handed several creative directions that scored closely and no clear favourite emerged.

Do NOT produce scores, ratings, rankings by number, tables, or bullet-point assessments. Do NOT re-derive the ratings you were shown into a different format. Form your own view.

Write 80–150 words, plain-spoken, first person, the way a CD actually talks. Name the one you'd make and say why in terms of what happens when it meets an audience — e.g. "the second is the one that would actually get made, it's the only one that doesn't need the strategy explained to land." Be willing to disagree with the ratings.

Nothing else. No headings, no preamble.`;

export function buildTiebreakerUserMessage(args: {
  brandName: string;
  channelName: string;
  smp: string;
  candidates: { label: string; lensName: string; direction: string; summary: string }[];
}): string {
  return [
    `BRAND: ${args.brandName} · CHANNEL: ${args.channelName}`,
    "",
    "THE APPROVED STRATEGY",
    args.smp || "—",
    "",
    "THE DIRECTIONS THAT SCORED TOO CLOSE TO CALL",
    ...args.candidates.map((c) =>
      [
        `--- ${c.label} (${c.lensName}) ---`,
        c.direction,
        `How the system scored it: ${c.summary}`,
      ].join("\n"),
    ),
    "",
    "Which one would you make, and why?",
  ].join("\n");
}
