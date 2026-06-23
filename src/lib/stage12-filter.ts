// Stage 12 input hardening + Stage 10 in-code selection gate (v5.5).
//
// Permanent guarantees enforced HERE, not in the prompt alone:
//   1. Stage 10 PASS/ELIMINATED is computed IN CODE from parsed scores using
//      the v5.5 selection rules — hard floors on Truth and Differentiation,
//      everything else informational. Expandability and Commercial Plausibility
//      can NEVER eliminate.
//   2. A weighted ranking composite is computed IN CODE for ordering only
//      (never a cutoff). It overrides any composite the LLM emits.
//   3. ELIMINATED SMPs from Stage 11 are stripped from the Stage 12 input.
//      VALIDATED, VALIDATED WITH STRATEGIC NOTE, and accepted REWRITTEN SMPs
//      are forwarded.
//   4. Stage 10 scores are parsed and re-emitted as a FROZEN SCORES block
//      so Stage 12 cannot invent or recalculate scores per SMP.

export interface Stage10Score {
  smpLine: string;
  fieldName: string;
  differentiation: number;
  truthStrength: number;
  culturalRelevance: number;
  famePotential: number;
  writerQuality: number;
  commercialPlausibility: number;
  creativeExpandability: number;
  /** Unweighted sum of all seven dimensions, out of 70 (LLM-emitted; may be overwritten by code-recompute). */
  composite: number;
  /** Code-computed weighted ranking score, out of 110. Used for ordering only — never a cutoff. */
  weightedComposite: number;
  /** Code-computed verdict per v5.5 rules. */
  codeVerdict: "PASS" | "ELIMINATED";
  /** Reason the code verdict was assigned (empty for PASS). */
  codeReason: string;
}

export interface Stage11Verdict {
  smpLine: string;
  fieldName: string;
  verdict: string;          // VALIDATED | VALIDATED WITH STRATEGIC NOTE | REWRITTEN | ELIMINATED
  iconicStatus: string;     // CONFIRMED | DOWNGRADED | N/A
  block: string;            // raw stage 11 per-SMP block
}

// ─── v5.5 weighting ──────────────────────────────────────────────────────
// Truth and Differentiation are doubled because they are the "right" floor.
// Fame Potential and Writer Quality are doubled because they are the "famous"
// engine. Cultural Relevance, Commercial Plausibility, Creative Expandability
// carry single weight — they describe the line but do not select it.
// Max possible weighted composite = (4 dims × 2 × 10) + (3 dims × 1 × 10) = 110.
export const STAGE_10_WEIGHTS = {
  differentiation: 2,
  truthStrength: 2,
  famePotential: 2,
  writerQuality: 2,
  culturalRelevance: 1,
  commercialPlausibility: 1,
  creativeExpandability: 1,
} as const;
export const STAGE_10_WEIGHTED_MAX = 110;

export const STAGE_10_FLOORS = {
  truthStrength: 6,
  differentiation: 6,
} as const;

function norm(s: string): string {
  return (s ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2014\u2013]/g, "-")
    .replace(/\s+/g, " ");
}

function splitSmpBlocks(text: string): string[] {
  if (!text) return [];
  const parts = text.split(
    /\n(?=(?:#{1,6}\s*)?\*{0,2}(?:SMP:\s*"|SMP\s+(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|\d+)\s*[—–-]\s*"))/gi,
  );
  return parts
    .map((p) => p.trim())
    .filter((p) =>
      /^(?:#{1,6}\s*)?\*{0,2}(?:SMP:\s*"|SMP\s+(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|\d+)\s*[—–-]\s*")/im.test(
        p,
      ),
    );
}

function parseSmpHeading(block: string): { smpLine: string; fieldName: string } | null {
  const structured = block.match(
    /^(?:#{1,6}\s*)?\*{0,2}SMP:\s*"([^"]+)"\s*[—\-–]\s*FIELD:\s*(.+?)(?:\s*[—\-–]\s*ICONIC\b[^\n]*)?(?:\*{0,2})\s*$/im,
  );
  const heading = block.match(
    /^(?:#{1,6}\s*)?\*{0,2}SMP\s+(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|\d+)\s*[—\-–]\s*"([^"]+)"\s*[—\-–]\s*FIELD:\s*(.+?)(?:\s*[—\-–]\s*ICONIC\b[^\n]*)?(?:\*{0,2})\s*$/im,
  );
  const match = structured ?? heading;
  if (!match) return null;
  return {
    smpLine: match[1].trim(),
    fieldName: match[2].replace(/\*+$/g, "").trim(),
  };
}

function extractRewriteLine(block: string): string | null {
  const rewrite = block.match(/REWRITE\s*(?:\([^)]*\))?\s*:\s*"([^"]+)"/i);
  return rewrite ? rewrite[1].trim() : null;
}

function pickNumber(block: string, label: string): number {
  const re = new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*:\\s*(\\d+(?:\\.\\d+)?)\\s*/\\s*10", "i");
  const m = block.match(re);
  return m ? Number(m[1]) : NaN;
}

export function computeWeightedComposite(s: {
  differentiation: number;
  truthStrength: number;
  culturalRelevance: number;
  famePotential: number;
  writerQuality: number;
  commercialPlausibility: number;
  creativeExpandability: number;
}): number {
  return (
    (s.differentiation || 0) * STAGE_10_WEIGHTS.differentiation +
    (s.truthStrength || 0) * STAGE_10_WEIGHTS.truthStrength +
    (s.famePotential || 0) * STAGE_10_WEIGHTS.famePotential +
    (s.writerQuality || 0) * STAGE_10_WEIGHTS.writerQuality +
    (s.culturalRelevance || 0) * STAGE_10_WEIGHTS.culturalRelevance +
    (s.commercialPlausibility || 0) * STAGE_10_WEIGHTS.commercialPlausibility +
    (s.creativeExpandability || 0) * STAGE_10_WEIGHTS.creativeExpandability
  );
}

export function evaluateStage10Verdict(s: {
  differentiation: number;
  truthStrength: number;
}): { verdict: "PASS" | "ELIMINATED"; reason: string } {
  if ((s.truthStrength || 0) < STAGE_10_FLOORS.truthStrength) {
    return {
      verdict: "ELIMINATED",
      reason: `Truth Strength ${s.truthStrength}/10 below floor of ${STAGE_10_FLOORS.truthStrength} (Stage 7 reconstruction)`,
    };
  }
  if ((s.differentiation || 0) < STAGE_10_FLOORS.differentiation) {
    return {
      verdict: "ELIMINATED",
      reason: `Differentiation ${s.differentiation}/10 below floor of ${STAGE_10_FLOORS.differentiation} (Stage 8 regen from same CS)`,
    };
  }
  return { verdict: "PASS", reason: "" };
}

export function parseStage10Scores(text: string): Stage10Score[] {
  const out: Stage10Score[] = [];
  for (const block of splitSmpBlocks(text)) {
    const head = parseSmpHeading(block);
    if (!head) continue;
    // Composite is now /70 (sum of 7 dims). Accept legacy /60 for back-compat
    // on any historical Stage 10 output that pre-dates v5.5.
    const compositeMatch = block.match(/COMPOSITE\s*:\s*(\d+(?:\.\d+)?)\s*\/\s*(?:70|60)/i);
    const dims = {
      differentiation: pickNumber(block, "Differentiation"),
      truthStrength: pickNumber(block, "Truth Strength"),
      culturalRelevance: pickNumber(block, "Cultural Relevance"),
      famePotential: pickNumber(block, "Fame Potential"),
      writerQuality: pickNumber(block, "Writer Quality"),
      commercialPlausibility: pickNumber(block, "Commercial Plausibility"),
      creativeExpandability: pickNumber(block, "Creative Expandability"),
    };
    const weightedComposite = computeWeightedComposite(dims);
    const { verdict, reason } = evaluateStage10Verdict(dims);
    const score: Stage10Score = {
      smpLine: head.smpLine,
      fieldName: head.fieldName,
      ...dims,
      composite: compositeMatch ? Number(compositeMatch[1]) : NaN,
      weightedComposite,
      codeVerdict: verdict,
      codeReason: reason,
    };
    if (!Number.isNaN(score.differentiation)) out.push(score);
  }
  return out;
}

export function parseStage11Verdicts(text: string): Stage11Verdict[] {
  const out: Stage11Verdict[] = [];
  for (const block of splitSmpBlocks(text)) {
    const head = parseSmpHeading(block);
    if (!head) continue;
    const verdictLine = block.match(/SMP\s+VERDICT\s*:\s*([^\n]+)/i);
    const rawVerdict = verdictLine ? verdictLine[1].trim().toUpperCase() : "";
    let verdict = rawVerdict;
    if (/ELIMINAT/.test(rawVerdict)) verdict = "ELIMINATED";
    else if (/REWRIT/.test(rawVerdict)) verdict = "REWRITTEN";
    else if (/VALIDATED\s+WITH\s+STRATEGIC\s+NOTE/.test(rawVerdict)) verdict = "VALIDATED WITH STRATEGIC NOTE";
    else if (/VALIDATED/.test(rawVerdict)) verdict = "VALIDATED";

    const iconic = block.match(/ICONIC\s+TIER\s+FINAL\s+STATUS\s*:\s*([A-Z\/ ]+)/i);
    const rewriteLine = verdict === "REWRITTEN" ? extractRewriteLine(block) : null;
    const smpLine = rewriteLine ?? head.smpLine;
    const fieldName = head.fieldName;
    out.push({
      smpLine,
      fieldName,
      verdict,
      iconicStatus: iconic ? iconic[1].trim().toUpperCase() : "N/A",
      block: rewriteLine
        ? `SMP: "${rewriteLine}" — FIELD: ${fieldName}\nSMP VERDICT: REWRITTEN\nREWRITE SOURCE: original line "${head.smpLine}"\n\n${block}`
        : block,
    });
  }
  return out;
}

export interface FilteredStage11 {
  filteredOutput: string;
  validated: Stage11Verdict[];
  eliminated: Stage11Verdict[];
}

export function filterValidatedFromStage11(stage11Output: string): FilteredStage11 {
  const verdicts = parseStage11Verdicts(stage11Output);
  const keep = (v: string) =>
    v === "VALIDATED" || v === "VALIDATED WITH STRATEGIC NOTE" || v === "REWRITTEN";
  const validated = verdicts.filter((v) => keep(v.verdict));
  const eliminated = verdicts.filter((v) => !keep(v.verdict));

  const firstIdx = stage11Output.search(/\n?SMP:\s*"/);
  const preamble = firstIdx > 0 ? stage11Output.slice(0, firstIdx).trim() : "";

  const sections: string[] = [];
  if (preamble) sections.push(preamble);
  sections.push(
    `==== FILTERED PRESSURE TEST RESULTS — VALIDATED SMPS ONLY (${validated.length}) ====`,
  );
  if (validated.length) {
    sections.push(validated.map((v) => v.block).join("\n\n"));
  } else {
    sections.push("(no validated SMPs — Stage 12 cannot proceed)");
  }
  sections.push(`==== EXCLUDED FROM STAGE 12 — DO NOT PRESENT ====`);
  sections.push(
    eliminated.length
      ? eliminated
          .map((v) => `- "${v.smpLine}" — FIELD: ${v.fieldName} — VERDICT: ${v.verdict}`)
          .join("\n")
      : "(none)",
  );

  return { filteredOutput: sections.join("\n\n"), validated, eliminated };
}

export function countStage12PropositionCards(output: string): number {
  if (!output?.trim()) return 0;
  const scoped = output.split(/={2,}\s*DELIVERABLE\s+2|={2,}\s*DELIVERABLE\s+3|={2,}\s*PRESENTATION\s+ORDER|={2,}\s*SELF[-\s]AUDIT/i)[0] ?? output;
  const propositionBlocks = scoped.match(/(?:^|\n)\s*(?:[═=]{3,}\s*\n)?\s*\*{0,2}PROPOSITION\s+\d+\*{0,2}/gi);
  if (propositionBlocks?.length) return propositionBlocks.length;
  const metadataBlocks = scoped.match(/\[METADATA\][\s\S]*?FIELD_NAME\s*:/gi);
  return metadataBlocks?.length ?? 0;
}

export function buildFrozenScoresBlock(
  validated: Stage11Verdict[],
  scores: Stage10Score[],
): string {
  const byField = new Map<string, Stage10Score>();
  const byLine = new Map<string, Stage10Score>();
  for (const s of scores) {
    byField.set(norm(s.fieldName), s);
    byLine.set(norm(s.smpLine), s);
  }

  const lines: string[] = [];
  lines.push(
    "==== FROZEN STAGE 10 SCORES — USE VERBATIM IN STAGE 12 CARDS. DO NOT RECALCULATE OR ADJUST. ====",
  );
  for (const v of validated) {
    const s = byField.get(norm(v.fieldName)) ?? byLine.get(norm(v.smpLine));
    lines.push("");
    lines.push(`SMP: "${v.smpLine}" — FIELD: ${v.fieldName}`);
    if (!s) {
      lines.push(
        `SCORES UNAVAILABLE IN STAGE 10 OUTPUT — render score row as "Scores: not available" verbatim. Do not invent.`,
      );
      continue;
    }
    lines.push(
      `Differentiation: ${s.differentiation}/10 | Truth Strength: ${s.truthStrength}/10 | Cultural Relevance: ${s.culturalRelevance}/10 | Fame Potential: ${s.famePotential}/10`,
    );
    lines.push(
      `Writer Quality: ${s.writerQuality}/10 | Commercial Plausibility: ${s.commercialPlausibility}/10 | Creative Expandability: ${s.creativeExpandability}/10`,
    );
    const composite = Number.isFinite(s.composite)
      ? s.composite
      : (s.differentiation || 0) +
        (s.truthStrength || 0) +
        (s.culturalRelevance || 0) +
        (s.famePotential || 0) +
        (s.writerQuality || 0) +
        (s.commercialPlausibility || 0) +
        (s.creativeExpandability || 0);
    lines.push(`Composite: ${composite}/70`);
  }
  return lines.join("\n");
}

/**
 * Post-process raw Stage 10 LLM output:
 *  - Append a CODE VERDICT line to every Per-SMP block based on the v5.5 floors.
 *  - Append a CODE COMPOSITE line restating the unweighted /70 (recomputed from
 *    the seven dimensions) and the weighted ranking composite /110.
 *  - Emit a CODE-COMPUTED STAGE 10 SUMMARY block at the end of the output that
 *    Stage 11 / Stage 12 consume as authoritative.
 * isPreflight=true bypasses elimination (everything PASSes) but still computes
 * composites. Original LLM verdict lines (if any) are kept; the appended CODE
 * VERDICT is the binding one.
 */
export function applyStage10CodeGate(
  stage10Output: string,
  opts: { isPreflight?: boolean } = {},
): { output: string; scores: Stage10Score[] } {
  if (!stage10Output?.trim()) return { output: stage10Output, scores: [] };
  const scores = parseStage10Scores(stage10Output);
  if (scores.length === 0) return { output: stage10Output, scores };

  let patched = stage10Output;
  for (const s of scores) {
    const effective = opts.isPreflight
      ? { verdict: "PASS" as const, reason: s.codeReason }
      : { verdict: s.codeVerdict, reason: s.codeReason };
    const recomputedUnweighted =
      (s.differentiation || 0) +
      (s.truthStrength || 0) +
      (s.culturalRelevance || 0) +
      (s.famePotential || 0) +
      (s.writerQuality || 0) +
      (s.commercialPlausibility || 0) +
      (s.creativeExpandability || 0);
    const verdictLine =
      effective.verdict === "PASS"
        ? `CODE VERDICT: PASS — clears Stage 10 floors (Truth ≥ 6, Differentiation ≥ 6).`
        : `CODE VERDICT: ELIMINATED — ${effective.reason}.`;
    const compositeLine = `CODE COMPOSITE: ${recomputedUnweighted}/70 unweighted · ${s.weightedComposite}/${STAGE_10_WEIGHTED_MAX} weighted (ranking only).`;
    // Inject the two lines immediately after the per-SMP block's
    // PROXIMITY WARNING line, if present; otherwise after the COMPOSITE line.
    const escLine = s.smpLine.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const smpBlockHeadRe = new RegExp(
      `(SMP:\\s*"${escLine}"[\\s\\S]*?)(\\n[\\t ]*PROXIMITY\\s+WARNING[^\\n]*\\n|\\n[\\t ]*COMPOSITE\\s*:[^\\n]*\\n)`,
      "i",
    );
    if (smpBlockHeadRe.test(patched)) {
      patched = patched.replace(
        smpBlockHeadRe,
        (_m, head: string, marker: string) => `${head}${marker}${verdictLine}\n${compositeLine}\n`,
      );
    } else {
      // Block not found verbatim — fall back to appending at end-of-output summary only.
    }
  }

  const summaryLines: string[] = [];
  summaryLines.push("");
  summaryLines.push(
    "==== CODE-COMPUTED STAGE 10 SUMMARY (v5.5 — AUTHORITATIVE; OVERRIDES ANY LLM VERDICT) ====",
  );
  if (opts.isPreflight) {
    summaryLines.push(
      "PRE-FLIGHT MODE: Truth / Differentiation floors bypassed — every SMP is forced PASS for end-to-end pipeline integrity testing. Composites are real.",
    );
  } else {
    summaryLines.push(
      "Selection rule: ELIMINATED if Truth Strength < 6 OR Differentiation < 6. Expandability and Commercial Plausibility never eliminate. Weighted composite is for ranking only (never a cutoff).",
    );
  }
  const sorted = [...scores].sort((a, b) => b.weightedComposite - a.weightedComposite);
  for (const s of sorted) {
    const v = opts.isPreflight ? "PASS" : s.codeVerdict;
    const reason = opts.isPreflight && s.codeVerdict === "ELIMINATED" ? ` (would-eliminate: ${s.codeReason})` : v === "ELIMINATED" ? ` — ${s.codeReason}` : "";
    summaryLines.push(
      `- ${v} · weighted ${s.weightedComposite}/${STAGE_10_WEIGHTED_MAX} · unweighted ${
        (s.differentiation || 0) +
        (s.truthStrength || 0) +
        (s.culturalRelevance || 0) +
        (s.famePotential || 0) +
        (s.writerQuality || 0) +
        (s.commercialPlausibility || 0) +
        (s.creativeExpandability || 0)
      }/70 · "${s.smpLine}" — FIELD: ${s.fieldName}${reason}`,
    );
  }
  patched = `${patched.trimEnd()}\n\n${summaryLines.join("\n")}\n`;
  return { output: patched, scores };
}
