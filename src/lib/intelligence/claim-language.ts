// BRAND GRENADE — CLAIM LANGUAGE DISCIPLINE (template level)
// ============================================================================
// Two overclaim patterns recur in Strategic Territory Intelligence Reports,
// independently of brand or run:
//
//   1. ABSENCE CLAIMS. "No brand owns reliability in this category" is written
//      as a measured fact when it is an absence finding — nothing in the
//      supplied research showed it. Absence of evidence is not evidence of
//      absence, and a board reading a flat assertion cannot tell the two apart.
//
//   2. MODELLED TIMEFRAMES. "18–24 months" reads exactly like a measured
//      observation. Every window, vacancy timeline and saturation horizon in
//      the report is a model output, never a measurement.
//
// Both are fixed here, deterministically, at render time — so the fix applies
// to every existing stored report as well as every future one, and does not
// depend on the model remembering an instruction. The prompt-side rules
// (output-contract.ts, system-prompt.ts) make new runs carry the basis
// explicitly; this module is the floor that holds when they do not.

export type EvidenceBasis = "observed" | "inferred" | "absence_of_evidence";

export const BASIS_LABEL: Record<EvidenceBasis, string> = {
  observed: "Observed in inputs",
  inferred: "Inferred",
  absence_of_evidence: "Absence finding",
};

/** Wording that already states a finding as evidence-of-absence. */
const ALREADY_QUALIFIED =
  /\bno evidence\b|\bnot found in the (?:inputs|research|corpus)\b|\bwas not observed\b|\bnothing in the (?:inputs|research)\b|\babsence finding\b/i;

/** Wording that asserts nobody occupies / nothing exists, as flat fact. */
const ABSENCE_ASSERTION = new RegExp(
  [
    // "no brand owns", "no competitor claims", "none of the players address"
    /\b(?:no|none of the|not one)\b[^.;]{0,90}\b(?:brand|brands|competitor|competitors|player|players|rival|rivals|manufacturer|marque|entrant|incumbent)\b/
      .source,
    // "nobody owns", "no one is claiming"
    /\b(?:nobody|no one)\b[^.;]{0,60}\b(?:own|owns|claim|claims|claiming|occupy|occupies|address|addresses)\b/
      .source,
    // structural vacancy vocabulary
    /\b(?:unoccupied|unclaimed|uncontested|wholly vacant|entirely vacant|stands vacant|is vacant|untouched by|wide open|completely open|is absent from|entirely absent)\b/
      .source,
  ].join("|"),
  "i",
);

export const ABSENCE_QUALIFIER =
  "No evidence of this was found in the research inputs supplied — this is an absence finding, not a measured fact.";

export function looksLikeAbsenceClaim(text: string | null | undefined): boolean {
  const t = (text ?? "").trim();
  if (!t) return false;
  return ABSENCE_ASSERTION.test(t);
}

export function isAlreadyEvidenceOfAbsence(text: string | null | undefined): boolean {
  return ALREADY_QUALIFIED.test((text ?? "").trim());
}

/**
 * Classifies a white-space cell. An explicit `evidence_basis` written by the
 * engine wins; otherwise the basis is read off the prose, and an absence
 * assertion with no supporting evidence line is never treated as observed.
 */
export function classifyEvidenceBasis(cell: {
  assessment?: unknown;
  evidence?: unknown;
  evidence_basis?: unknown;
}): EvidenceBasis {
  const declared = typeof cell?.evidence_basis === "string" ? cell.evidence_basis.trim() : "";
  if (declared === "observed" || declared === "inferred" || declared === "absence_of_evidence") {
    return declared;
  }
  const assessment = typeof cell?.assessment === "string" ? cell.assessment : "";
  const evidence = typeof cell?.evidence === "string" ? cell.evidence : "";
  if (looksLikeAbsenceClaim(assessment) || looksLikeAbsenceClaim(evidence)) {
    return "absence_of_evidence";
  }
  if (!evidence.trim()) return "inferred";
  return "observed";
}

/**
 * Appends the absence qualifier to a finding that asserts vacancy as fact.
 * Prose that already states the finding as evidence-of-absence is untouched,
 * so a well-written report is not double-qualified.
 */
export function qualifyAbsenceClaim(text: string | null | undefined): string {
  const t = (text ?? "").trim();
  if (!t) return "";
  if (isAlreadyEvidenceOfAbsence(t)) return t;
  if (!looksLikeAbsenceClaim(t)) return t;
  const sep = /[.!?]$/.test(t) ? " " : ". ";
  return `${t}${sep}${ABSENCE_QUALIFIER}`;
}

/** A duration, whether written in digits or words. */
const DURATION = new RegExp(
  [
    /\b\d{1,3}\s*(?:[-–—]|\s+to\s+)?\s*\d{0,3}\s*(?:week|month|quarter|year)s?\b/.source,
    /\b(?:one|two|three|four|five|six|nine|twelve|eighteen|twenty-four)\s+(?:week|month|quarter|year)s?\b/
      .source,
  ].join("|"),
  "i",
);

const ALREADY_MODELLED =
  /\bmodelled\b|\bmodeled\b|\bestimate[sd]?\b|\bnot measured\b|\bnot independently verified\b|\bprojection\b|\bassumed\b/i;

export const MODELLED_QUALIFIER = "modelled estimate, not measured";

export function looksLikeTimeframe(text: string | null | undefined): boolean {
  return DURATION.test((text ?? "").trim());
}

/**
 * Labels a stated horizon as modelled. Used for every timeframe the report
 * prints — first-mover window, hermit-crab vacancy, saturation horizon,
 * sequencing phase — so no single one reads as a measurement.
 */
export function labelModelledTimeframe(text: string | null | undefined): string {
  const t = (text ?? "").trim();
  if (!t) return "";
  if (!looksLikeTimeframe(t)) return t;
  if (ALREADY_MODELLED.test(t)) return t;
  const base = t.replace(/[.\s]+$/, "");
  return `${base} — ${MODELLED_QUALIFIER}.`;
}

/** Prompt-side rules, shared by the engine prompt and the reconciliation run. */
export const CLAIM_LANGUAGE_RULES: string = `
═══════════════════════════════════════════════════════════════
CLAIM LANGUAGE DISCIPLINE — MANDATORY
═══════════════════════════════════════════════════════════════

1. ABSENCE FINDINGS. Never state "no brand owns X", "the territory is
   unoccupied", "nobody is claiming Y" as flat fact. What you can know from the
   inputs is that no evidence of it was found. Write absence findings as:
   "No evidence was found in the inputs supplied of <X>." Where you assess a
   white-space dimension on absence, set "evidence_basis": "absence_of_evidence"
   for that cell. Where you have a positive observation in the research, set
   "observed" and cite it in "evidence". Where you are reasoning beyond the
   inputs, set "inferred".

2. MODELLED ESTIMATES. Every timeframe you state — first-mover window,
   vacancy timeline, saturation horizon, sequencing phase, behaviour-change
   timing — is a model output, not a measurement. State it with its basis:
   "18–24 months (modelled estimate, not measured)". Never present a horizon
   in the same register as an observed figure.

3. MEASURED FACTS. A number or claim taken from the supplied research may be
   stated plainly, but must name its source in the accompanying evidence field.
   If you cannot name where it came from, it is not a measured fact.
`;
