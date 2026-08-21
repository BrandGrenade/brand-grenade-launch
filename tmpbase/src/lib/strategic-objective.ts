// Strategic Objective — real pipeline branching.
//
// Single source of truth for what each of the eight strategic objectives
// actually changes in the pipeline. Client-safe (pure data + pure functions).
//
// Branching is deliberately narrow. Only the stages listed in DIRECTIVES below
// receive any conditional treatment. Every other stage behaves identically
// regardless of objective, and an unset objective produces exactly the legacy
// behaviour (empty string injection).

export const STRATEGIC_OBJECTIVES = [
  "Launch",
  "Refresh (Packaging)",
  "Refresh (Campaign)",
  "Repositioning",
  "Defence",
  "Challenger",
  "Crisis Recovery",
  "Category Creation",
] as const;

export type StrategicObjective = (typeof STRATEGIC_OBJECTIVES)[number];

/** Stage keys that carry objective-conditional logic. Nothing else may. */
export type ObjectiveStageKey =
  | "stage2"
  | "stage4b"
  | "stage5"
  | "stage9"
  | "stage13b"
  | "phase2" // Stages 17, 17B, 18, 19, 20, 21
  | "intelligence";

/**
 * Normalise a raw stored value to a known objective.
 * Legacy sessions stored the single value "Refresh" before the packaging /
 * campaign split; those are read as Refresh (Campaign), which is the
 * behaviour they already had (platform fixed, new campaign).
 */
export function normaliseObjective(raw: unknown): StrategicObjective | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  if (!v) return null;
  const exact = STRATEGIC_OBJECTIVES.find((o) => o.toLowerCase() === v.toLowerCase());
  if (exact) return exact;
  const lower = v.toLowerCase();
  if (lower === "refresh") return "Refresh (Campaign)";
  if (lower.startsWith("refresh") && lower.includes("pack")) return "Refresh (Packaging)";
  if (lower.startsWith("refresh")) return "Refresh (Campaign)";
  // Tolerate prefixed/suffixed prose ("Objective: Launch")
  const loose = STRATEGIC_OBJECTIVES.find((o) => lower.includes(o.toLowerCase()));
  return loose ?? null;
}

type BriefVersion = { fields?: { sections?: Record<string, string> } };

/** Read the selected objective out of a session's brief_versions JSON. */
export function resolveObjective(briefVersions: unknown): StrategicObjective | null {
  if (!Array.isArray(briefVersions) || briefVersions.length === 0) return null;
  const latest = briefVersions[briefVersions.length - 1] as BriefVersion | undefined;
  return normaliseObjective(latest?.fields?.sections?.["f2_objective"]);
}

const HEADER = "STRATEGIC OBJECTIVE DIRECTIVE — MANDATORY, OVERRIDES DEFAULT BEHAVIOUR";

const DIRECTIVES: Record<StrategicObjective, Partial<Record<ObjectiveStageKey, string>>> = {
  Launch: {
    stage5: `The strategic objective for this brief is LAUNCH — introducing something the market does not yet know exists.

GENUINE FIRST CLAIM CHECK — MANDATORY:
Before generating insights, interrogate explicitly whether this brand has a genuine first claim: something it is demonstrably first to do, first to make possible, or first to say in this category. State the verdict in one line at the very top of your output as either "GENUINE FIRST CLAIM: [the claim]" or "GENUINE FIRST CLAIM: none defensible".
If a genuine first claim exists, it is NOT optional — it must appear as a candidate territory carried through the insight set, tagged "[FIRST CLAIM]" on the insight that carries it. Do not bury it inside a Product Truth insight and move on.
If none exists, say so plainly and do not manufacture one.`,
    phase2: `The strategic objective for this brief is LAUNCH.

CHANNEL AND ACTIVATION WEIGHTING — MANDATORY:
Weight the channel mix toward earned media and PR, and toward category education. The audience does not yet have a mental model for this product, so paid reach against an uneducated market is wasted spend.
- Earned/PR must appear as a PRIMARY or AMPLIFICATION channel, never merely SUSTAINING.
- At least one activation must exist whose explicit job is category education — teaching the audience what this thing is and why the category now contains it.
- Do not lead with retargeting, loyalty, or CRM mechanics; there is no existing base to work.`,
  },

  "Refresh (Packaging)": {
    phase2: `The strategic objective for this brief is REFRESH (PACKAGING) — the physical or visual expression changes; what the brand stands for does not.

MANDATORY STRUCTURE:
- The activation architecture must contain an explicit REVEAL MOMENT beat: a single, dated, unmistakable point at which the new expression becomes public. Name it, describe what happens in it, and state what the audience sees for the first time.
- The lifecycle is BOUNDED. Give the activation an explicit start, reveal, and end. Do not architect an always-on platform. State the intended duration.
- Continuity is the point: name what deliberately does NOT change, so the audience recognises the brand through the change.`,
  },

  "Refresh (Campaign)": {
    phase2: `The strategic objective for this brief is REFRESH (CAMPAIGN) — a new campaign inside an existing, fixed brand platform.

FIXED CONSTRAINTS — NOT VARIABLES:
- The brand's existing distinctive assets and brand architecture are FIXED CONSTRAINTS. You may deploy them in new ways; you may not replace, retire, or redesign them. Any recommendation that alters the platform, the architecture, or a distinctive asset is out of scope and must not appear.
- State explicitly which distinctive assets you are building on.

TERRITORY-FATIGUE CHECK — MANDATORY WHERE HISTORY IS AVAILABLE:
Where prior campaign history is present in the inputs, run an explicit territory-fatigue check: name the territories this brand has already run, and state for each whether the proposed work repeats it, extends it, or departs from it. Reject anything that repeats a territory the brand has already exhausted. If no prior campaign history is available in the inputs, say "TERRITORY FATIGUE: no prior campaign history supplied" and move on — do not invent history.`,
  },

  Repositioning: {
    stage5: `The strategic objective for this brief is REPOSITIONING — moving an established brand from a territory it owns to one it does not.

STRUCTURAL REQUIREMENT — NOT OPTIONAL:
Every tension you generate must be built on an explicit "what we were vs what we're becoming" contrast. This is a structural component of the tension, not a framing device you may omit. For each universe, state the contrast in the form:
WAS: [the position the brand currently occupies in the audience's head]
BECOMING: [the position it must occupy]
The insight must then name the human truth that makes that specific movement credible. An insight that would read identically for a brand that had always occupied the new position is a failed insight — regenerate it.`,
    stage13b: `The strategic objective for this brief is REPOSITIONING.

HISTORICAL PRECEDENT WEIGHTING — ELEVATED:
Weight repositioning-specific historical precedent above general effectiveness precedent. The relevant evidence base is brands that successfully moved from one owned territory to another, and brands that attempted it and failed. Prioritise:
- precedents where an established brand shed an existing association rather than added a new one;
- the documented time horizon over which the reposition took hold;
- the failure mode where the old position reasserted itself.
Say explicitly how each cited precedent maps to this brand's specific WAS → BECOMING movement. General brand-building precedent is secondary here and should be labelled as such.`,
  },

  Defence: {
    stage2: `The strategic objective for this brief is DEFENCE — protecting owned territory against a named competitive threat.

PRIORITY WEIGHTING — MANDATORY:
The named competitive threat in the brief is not one competitor among many. In the competitive set and the Competitive Mapping:
- Place the named threat FIRST and give it explicit priority weighting, stated as such.
- Analyse it at materially greater depth than any other competitor: its line of attack, what territory it is taking, the mechanism by which it is taking it, and what it structurally cannot follow the defending brand into.
- The Category Silence Map must identify which silences the named threat is currently exploiting.
If the brief names no specific threat, say "NAMED THREAT: none supplied" and weight by market share instead.`,
    stage9: `The strategic objective for this brief is DEFENCE.

COMPETITIVE IMPOSSIBILITY — STRESS-TEST AGAINST THE NAMED COMPETITOR:
The Competitive Impossibility test is not generic here. For every proposition, stress-test it specifically against the named competitive threat: could that named competitor say this, tomorrow, credibly? Answer per proposition in the form "IMPOSSIBLE FOR [competitor] BECAUSE: [structural reason]".
A structural reason is a business-model, heritage, product, or ownership fact that blocks them. "They haven't said it yet" is not a structural reason and fails the test. Any proposition the named competitor could adopt within a quarter must be marked FAILED on Competitive Impossibility regardless of how well it scores elsewhere.`,
  },

  Challenger: {
    stage5: `The strategic objective for this brief is CHALLENGER — taking share from a dominant incumbent.

MANDATORY INTERROGATION:
Before generating insights, interrogate explicitly what the named incumbent is STRUCTURALLY BLOCKED from claiming — not what they have merely chosen not to say. Output this at the top of your response as:
INCUMBENT: [name]
STRUCTURALLY BLOCKED FROM CLAIMING: [2-4 specific claims, each with the structural reason: scale, business model, heritage, ownership, supply chain, regulatory position, or existing customer promise]
Those blocked claims are the primary hunting ground for the Whitespace and Tension insights. At least two insights across the set must sit inside territory the incumbent cannot follow the brand into, and must be tagged "[INCUMBENT-BLOCKED]".`,
  },

  "Crisis Recovery": {
    stage4b: `The strategic objective for this brief is CRISIS RECOVERY.

FACT-VERIFICATION RIGOR — ELEVATED:
Every asset and product fact you record must carry an explicit provenance and confidence rating. In a crisis-recovery context an unverified claim is a liability, not a nice-to-have.
- Tag every fact as VERIFIED (present in the supplied inputs, quotable), INFERRED (reasonable but not stated), or UNVERIFIED (cannot be substantiated).
- Do NOT carry any UNVERIFIED fact forward as usable proof material. List them separately under "UNVERIFIED — DO NOT USE AS PROOF".
- Where a fact touches the subject of the crisis itself, it must be VERIFIED or it is excluded outright.`,
    phase2: `The strategic objective for this brief is CRISIS RECOVERY.

TONAL CONSTRAINTS — MANDATORY, NON-NEGOTIABLE:
- NO BRAVADO. No swagger, no boasting, no challenger-brand posture, no "we're back" triumphalism.
- NO MINIMISING. Do not soften, hedge, or reframe the event as a learning opportunity, a chapter, or a misunderstanding.
- DIRECT ACKNOWLEDGMENT REQUIRED. The work must acknowledge what happened plainly and early. An activation architecture whose first beat is not an acknowledgment is wrong.
- Proof over promise: every claim must be attached to a demonstrable action already taken or committed to with a date.

RELEASE GATE — MANDATORY FOR THIS OBJECTIVE:
Every output must end with a RELEASE GATE block that states, for each recommendation: whether it survives a hostile read by someone directly harmed by the event, and whether it could be quoted back at the brand as evidence of tone-deafness. Anything that fails is removed, not caveated. This gate is mandatory here, not advisory.`,
  },

  "Category Creation": {
    stage5: `The strategic objective for this brief is CATEGORY CREATION.

MANDATORY OUTPUT FIELD:
Your output must open with an explicit CATEGORY DEFINITION block, before the first universe:
CATEGORY DEFINITION: [one sentence naming the new category — what it is, what it is not, and what previously-separate or previously-nonexistent behaviour it contains]
WHY THIS IS NOT A PRODUCT BENEFIT: [one sentence]
A category definition describes a space that can contain other entrants. A product benefit describes what one product does for one person. If your definition collapses into "our product, but described broadly", it is a product benefit and must be rewritten.
Every universe must then be tested against that category definition: does this insight help the audience understand the new category exists, or only that this product is good?`,
    intelligence: `The strategic objective for this brief is CATEGORY CREATION.

PRIMARY LENS — MANDATORY:
Type 03 (Category Creation territory) is the PRIMARY lens for this analysis, not one option among the territory types. Lead with it, weight it highest, and evaluate every other territory type against whether it supports or undermines the category-creation task. Do not present Type 03 as optional or co-equal.`,
  },
};

/** The directive block for a given objective at a given stage, or "" if none. */
export function objectiveDirective(
  objective: StrategicObjective | null,
  stage: ObjectiveStageKey,
): string {
  if (!objective) return "";
  const body = DIRECTIVES[objective]?.[stage];
  if (!body) return "";
  return `\n\n═══════════════════════════════════════\n${HEADER}\n═══════════════════════════════════════\n${body}\n`;
}

/** True when Engine 08 (Enemy First) must be guaranteed and priority-flagged. */
export function requiresEnemyFirstPriority(objective: StrategicObjective | null): boolean {
  return objective === "Challenger";
}
