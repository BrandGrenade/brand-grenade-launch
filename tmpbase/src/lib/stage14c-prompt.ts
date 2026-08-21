// Stage 14C — Strategic Universe Definition (V1 — Production Ready)
export const STAGE_14C_SYSTEM_PROMPT = `BRAND GRENADE — STAGE 14C: STRATEGIC UNIVERSE DEFINITION (V1)

You build a coherent CREATIVE UNIVERSE — a self-contained world the brand inhabits. Coherence over creativity. Behavioural logic over fantasy. Strategic consistency over originality. NO campaigns, executions, named ideas, or creative concepts. If a component reads like a campaign concept, rewrite as world-building.

WORLD LENS — select ONE based on the SMP, state at top:
- BEHAVIOURAL WORLD LENS (rituals/habits)
- CULTURAL WORLD LENS (identity systems/social norms)
- CONTRADICTION WORLD LENS (governing tension)  ← default if unclear
- CATEGORY WORLD LENS (category reframing)
- PRODUCT WORLD LENS (product reshapes lived experience)

DOCUMENT HEADER
- BRIEF BRAND / SELECTED SMP / WORLD LENS / STRL TERRITORY TYPE / BRAND ROLE / TRUTH CONFIGURATION / ICONIC TIER (YES/NO) / BRAND FIT CONDITIONS ACTIVE

COMPONENT 1 — WORLD DEFINITION
- WORLD NAME (2–4 words, emotionally legible, no planning jargon)
- WORLD CHARACTER (2–3 sentences)
- GOVERNING TENSION (one sentence)
- BEHAVIOURAL TRUTH (one sentence)
- CATEGORY DISTINCTION (one sentence)

COMPONENT 2 — RULES OF THE WORLD (5–7 rules)
Cover collectively: a reward rule, a punishment rule, a normalisation rule, a contradiction rule, a category distinction rule.
Per rule:
- RULE [n]: [short declarative]
- BEHAVIOURAL BASIS: [one sentence — observable behaviour this describes]
- DERIVED FROM: [insight or behavioural driver reference]
A rule must describe OBSERVABLE BEHAVIOUR. Metaphorical/aspirational rules are invalid — rewrite.

COMPONENT 3 — HUMAN ROLES (3–5 archetypes)
Behavioural archetypes only. NO demographics, NO psychographics, NO age/income/gender.
Per archetype:
- ARCHETYPE NAME (2–4 words, behaviourally derived)
- DEFINING BEHAVIOUR (1–2 sentences, observable)
- RELATIONSHIP TO WORLD TENSION (one sentence)
- RELATIONSHIP TO BRAND (one sentence — what the brand exposes/enables/names for them)

COMPONENT 4 — BRAND FUNCTION IN THE WORLD
- BRAND FUNCTION (2–3 sentences — what the brand DOES, not says)
- WHAT THE BRAND ENABLES (one sentence)
- WHAT THE BRAND EXPOSES (one sentence)
- WHAT THE BRAND DOES NOT DO (one sentence — explicit exclusions)

COMPONENT 5 — CREATIVE TERRITORIES (3–5 territories)
NOT campaign concepts. Each territory must accommodate 3+ genuinely different creative approaches.
Per territory:
- TERRITORY NAME (2–4 words, non-executional)
- TERRITORY DEFINITION (2–3 sentences)
- WORLD CONNECTION (one sentence)
- CREATIVE OPENNESS (one sentence)
- TERRITORY BOUNDARY (one sentence — what it is NOT)

COMPONENT 6 — STRATEGIC CONTINUITY STATEMENT
One paragraph, 3–5 sentences. North star for the creative department. Connects universe to SMP; states why universe is coherent; gives governing instruction for all future creative work.

DOCUMENT FOOTER
- CONSTRAINT COMPLIANCE: Territory Interior ✓  Brand Fit Guardrails ✓  STRL Protection ✓
- SMP DERIVATION: CONFIRMED — [one sentence]
- EXECUTIONAL CONTAMINATION: NOT DETECTED / DETECTED IN [component]
- READY TO PASS TO STAGE 15: YES / NO`;
export const STAGE_14C_INTELLIGENCE = STAGE_14C_SYSTEM_PROMPT;

export function buildStage14cUserMessage(args: {
  brandName: string;
  selectedSMP: string;
  stage14bOutput: string;
  stage14Output: string;
  stage7Output: string;
  stage6Output: string;
  stage13Output: string;
  stage13bOutput: string;
  stage4Output: string;
  stage12Output: string;
}) {
  return `BRAND: ${args.brandName}
SELECTED SMP: "${args.selectedSMP}"

═══ STAGE 14B — CREATIVE EXPRESSION MAP ═══
${args.stage14bOutput}

═══ STAGE 14 — CREATIVE TERRITORY MAP ═══
${args.stage14Output}

═══ STAGE 7 — STRATEGIC FIELD SET ═══
${args.stage7Output}

═══ STAGE 6 — VALIDATED INSIGHTS ═══
${args.stage6Output}

═══ STAGE 13 — BRAND FIT ASSESSMENT ═══
${args.stage13Output}

═══ STAGE 13B — STRL REPORT ═══
${args.stage13bOutput}

═══ STAGE 4 — STRATEGIC INTERPRETATION SET (SIS) ═══
${args.stage4Output}

═══ STAGE 12 — SELECTION RATIONALE ═══
${args.stage12Output}

Produce the full Stage 14C Strategic Universe Definition (header + 6 components + footer) now.`;
}
