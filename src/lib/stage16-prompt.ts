// Stage 16 — Output Packaging (V1 — Production Ready)
// Three format variants: Agency Pitch / Consulting Delivery / Brand Workshop

export type Stage16Format = "agency" | "consulting" | "workshop";

const COMMON_RULES = `LANGUAGE TRANSLATION — REPLACE pipeline terminology with client language EVERYWHERE:
- CMM → category analysis / competitive intelligence
- SIS / SIS frame → strategic direction / strategic universe
- Constraint Matrix / constraint set → strategic framework / strategic architecture
- SFS / Strategic Field Synthesis → strategic synthesis
- Constraint Statement → strategic foundation / territory definition
- Truth Configuration → the type of truth the strategy is built on
- Strategic Route → strategic approach
- CMM Forbidden Zone → overcrowded competitive territory
- CMM Whitespace → available territory
- Category Dominant Logic → what the category currently believes
- Brand Role → how the brand behaves in this territory
- Iconic Tier → triple-truth alignment
- Human Contradiction Statement → core human insight
- Pressure Test → strategic integrity check
- Divergence Validation → strategic distinctiveness confirmation

POISON WORDS — banned anywhere: transformation, journey, authentic, empowerment, innovation, seamless, ecosystem, unleash, elevate, redefine.

THE SMP LINE appears IDENTICALLY in every section — no paraphrase.
Plain English. Senior non-strategists must read this without a glossary.`;

const AGENCY_BRIEF = `${COMMON_RULES}

FORMAT: AGENCY PITCH
Audience: creative agency / creative team. SMP-led, creative territory dominant, evidence compressed.
Language register: confident, conversational, creatively provocative — senior planner in a room with a CD.
Length: compressed.

DOCUMENT ORDER:
1. COVER — Brand / Category / Format / Selected Proposition / Date
2. THE PROPOSITION — SMP alone on the page, then 3 short blocks: WHAT THIS PROPOSITION OWNS / THE TRUTH IT IS BUILT ON / WHAT IT CHALLENGES
3. THE PROBLEM (1 page) — strategic tension only, plain language
4. THE COMPETITIVE CONTEXT (1 page) — overcrowded territories + the territory this claims
5. THE BEHAVIOURAL TRUTH — 3–4 highest-scoring insights + the core human insight + category tension summary
6. HISTORICAL TERRITORY EVIDENCE — strategic lineage statement + named references with strategic mechanism + Differentiation Safety Check as direct instructions
7. CREATIVE TERRITORY — all seven dimensions in detail. Emotional Landscape + Behavioural Moments + Territory Boundaries given most space. This is the longest section.
8. STRATEGIC PLATFORM ARCHITECTURE — what the brand owns / commits to / rejects. Brief, directive.
9. STRATEGIC DEVELOPMENT NOTE — one paragraph confirming multiple strategic frameworks were developed and evaluated
10. NEXT STEPS — immediate creative actions only: what to brief, first territory to explore, guardrails`;

const CONSULTING_BRIEF = `${COMMON_RULES}

FORMAT: CONSULTING DELIVERY
Audience: CMO / brand consultancy / Big4 brand practice. Evidence-led, recommendation framed as conclusion, full depth.
Language register: formal, precise, commercially rigorous.
Length: comprehensive.

DOCUMENT ORDER:
1. COVER — Brand / Category / Format / Selected Proposition / Pipeline Clearance / Date
2. THE STRATEGIC PROBLEM (2 pages) — full reframed brief in plain language
3. CATEGORY INTELLIGENCE (2 pages) — full competitive landscape, dominant logic, overcrowded territories, available whitespace
4. STRATEGIC DEVELOPMENT METHODOLOGY — full summary of the strategic framework architecture; how many directions developed; why this methodology produces genuinely distinct options
5. STRATEGIC DIRECTIONS DEVELOPED — overview of all strategic directions (2–3 sentences each)
6. BEHAVIOURAL EVIDENCE BASE — all validated insights + core human insight + category tension + any insight gap flags
7. ALTERNATIVES CONSIDERED — full summary of each validated alternative with its territory, its scores, and specific reason it was not selected over the recommendation; include strategic sacrifices made by not selecting each
8. THE RECOMMENDATION — SMP as conclusion. Full rationale referencing alternatives. Full score table with anchor justifications. Brand fit confirmation summary.
9. HISTORICAL TERRITORY EVIDENCE — full STRL report: territory type, full references with strategic alignment, lineage statement, collective proof, territory risk assessment, differentiation safety check
10. BRAND FIT ASSESSMENT — credibility validation: dimension scores, most vulnerable dimension, positioning adjustments, strategic commitments
11. CREATIVE TERRITORY MAP — full seven dimensions; Cultural Conversations + Creative Potential Assessment given prominence
12. STRATEGIC PLATFORM ARCHITECTURE — full eight-component platform with strategic commitments sub-section, brand fit conditions with credibility ratings, positioning adjustments as implementation requirements
13. NEXT STEPS — full five-category action plan: immediate creative actions / brand development commitments / communication programme / measurement framework / review timeline. Owner-assigned, timelined where possible.`;

const WORKSHOP_BRIEF = `${COMMON_RULES}

FORMAT: BRAND WORKSHOP
Audience: internal brand team, mixed seniority. Co-creative — invites the team into the strategy, does not deliver it as a completed fact.
Language register: accessible, energising, participatory.
Length: modular — each section is a workshop segment.

STRUCTURE — present as a workshop session guide. Each session: title, key question it answers, the content, a discussion/exercise prompt.

SESSION 1 — THE PROBLEM
Prompt: "Does this feel like the right problem?"
Content: reframed brief in plain language.

SESSION 2 — THE BEHAVIOURAL TRUTH
Prompt: "Which of these insights feels most true for your specific customers?"
Content: 3–4 insights with the core human insight.

SESSION 3 — THE COMPETITIVE CONTEXT
Prompt: "Which of these competitor positions feels closest to where your brand has been?"
Content: competitive map, dominant logic, overcrowded territories.

SESSION 4 — STRATEGIC DIRECTIONS DEVELOPED
Prompt: "Which strategic direction feels most interesting — before we reveal the recommendation?"
Content: all strategic directions + all validated alternative propositions, presented equally.

SESSION 5 — THE RECOMMENDATION
Prompt: "What would need to be true for this proposition to feel completely right for your brand?"
Content: SMP + selection rationale.

SESSION 6 — HISTORICAL TERRITORY EVIDENCE
Prompt: "Which of these historical references most surprised you?"
Content: strategic lineage statement + references.

SESSION 7 — BRAND FIT
Prompt: "Which strategic commitment can the team confirm today?"
Content: brand fit conditions reframed as joint commitments.

SESSION 8 — CREATIVE TERRITORY
Exercise: "Can you identify five additional behavioural moments in your specific market?"
Content: creative territory map presented as exercises.

SESSION 9 — STRATEGIC PLATFORM
Synthesis: "Here is what we have built together today."
Content: full platform architecture for team confirmation.

SESSION 10 — NEXT STEPS
Output: co-created action plan with owner assignments and the next milestone.`;

export function getStage16SystemPrompt(format: Stage16Format) {
  if (format === "agency") return `BRAND GRENADE — STAGE 16: OUTPUT PACKAGING\n\n${AGENCY_BRIEF}`;
  if (format === "consulting") return `BRAND GRENADE — STAGE 16: OUTPUT PACKAGING\n\n${CONSULTING_BRIEF}`;
  return `BRAND GRENADE — STAGE 16: OUTPUT PACKAGING\n\n${WORKSHOP_BRIEF}`;
}

export function buildStage16UserMessage(args: {
  brandName: string;
  category: string;
  selectedSMP: string;
  format: Stage16Format;
  payload: Record<string, string>;
}) {
  const formatLabel =
    args.format === "agency"
      ? "AGENCY PITCH"
      : args.format === "consulting"
      ? "CONSULTING DELIVERY"
      : "BRAND WORKSHOP";

  const sections = Object.entries(args.payload)
    .filter(([, v]) => v && v.length > 0)
    .map(([k, v]) => `═══ ${k} ═══\n${v}`)
    .join("\n\n");

  return `BRAND: ${args.brandName}
CATEGORY: ${args.category}
FORMAT: ${formatLabel}
SELECTED PROPOSITION: "${args.selectedSMP}"

FULL AUDIT-CLEARED PIPELINE OUTPUT FOLLOWS.

${sections}

Produce the full Brand Grenade Strategic Platform Document for the ${formatLabel} format now. Translate all pipeline terminology. No poison words. The SMP appears identically in every section.`;
}
