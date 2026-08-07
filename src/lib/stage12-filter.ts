// Stage 12 input hardening + Stage 10 in-code selection gate (V6).
//
// V6 unifies core SMP scoring with the LOC validation framework:
//   Six dimensions, weighted composite /100, hard floors on Truth Strength
//   (≥5) and Competitive Impossibility (≥6). Fame / Brand Permission /
//   Clean Air / Commercial Precedent surface human flags only.
//
// Permanent guarantees enforced HERE, not in the prompt alone:
//   1. Stage 10 PASS/ELIMINATED is computed IN CODE from parsed scores.
//   2. Weighted composite /100 is computed IN CODE (ordering + display).
//   3. Human flags are computed IN CODE and rendered per SMP.
//   4. ELIMINATED SMPs from Stage 11 are stripped from the Stage 12 input.
//   5. Stage 10 scores are re-emitted as a FROZEN SCORES block for Stage 12.

export interface Stage10Score {
  smpLine: string;
  fieldName: string;
  fame: number;
  truthStrength: number;
  competitiveImpossibility: number;
  brandPermission: number;
  cleanAir: number;
  commercialPrecedent: number;
  /** Weighted composite score out of 100 (code-computed; authoritative). */
  weightedComposite: number;
  /** Code-computed verdict per V6 floors. */
  codeVerdict: "PASS" | "ELIMINATED";
  /** Reason the code verdict was assigned (empty for PASS). */
  codeReason: string;
  /** Human flags surfaced by V6 thresholds. */
  flags: string[];
}

export interface Stage11Verdict {
  smpLine: string;
  fieldName: string;
  verdict: string;          // VALIDATED | VALIDATED WITH STRATEGIC NOTE | REWRITTEN | ELIMINATED
  iconicStatus: string;     // CONFIRMED | DOWNGRADED | N/A
  block: string;            // raw stage 11 per-SMP block
}

// ─── V6 weighting (percent, sums to 100) ─────────────────────────────────
export const STAGE_10_WEIGHTS = {
  fame: 30,
  truthStrength: 20,
  competitiveImpossibility: 15,
  brandPermission: 10,
  cleanAir: 10,
  commercialPrecedent: 5,
} as const;
export const STAGE_10_WEIGHTED_MAX = 100;

export const STAGE_10_FLOORS = {
  truthStrength: 5,
  competitiveImpossibility: 6,
} as const;

export const STAGE_10_FLAG_THRESHOLDS = {
  fame: 6,
  brandPermission: 5,
  cleanAir: 5,
  commercialPrecedent: 4,
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

/** Stage 10/11 models routinely emit markdown emphasis inside the structural
 *  labels ("**SMP:**", "**FIELD:**", "**Fame:** 8/10"). The parsers below are
 *  structural, not typographic — strip emphasis markers before matching so a
 *  bolded label can never make an SMP invisible to the filter. */
export function stripEmphasis(text: string): string {
  return (text ?? "").replace(/\*\*/g, "").replace(/(?<![A-Za-z0-9])__(?![A-Za-z0-9])/g, "");
}

function splitSmpBlocks(text: string): string[] {
  if (!text) return [];
  const parts = stripEmphasis(text).split(
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

interface V6Dims {
  fame: number;
  truthStrength: number;
  competitiveImpossibility: number;
  brandPermission: number;
  cleanAir: number;
  commercialPrecedent: number;
}

export function computeWeightedComposite(s: V6Dims): number {
  // weights are percent and sum to 100; each score is 0–10, so weighted = Σ(score × weight) / 10.
  const raw =
    (s.fame || 0) * STAGE_10_WEIGHTS.fame +
    (s.truthStrength || 0) * STAGE_10_WEIGHTS.truthStrength +
    (s.competitiveImpossibility || 0) * STAGE_10_WEIGHTS.competitiveImpossibility +
    (s.brandPermission || 0) * STAGE_10_WEIGHTS.brandPermission +
    (s.cleanAir || 0) * STAGE_10_WEIGHTS.cleanAir +
    (s.commercialPrecedent || 0) * STAGE_10_WEIGHTS.commercialPrecedent;
  return Math.round((raw / 10) * 10) / 10;
}

export function evaluateStage10Verdict(s: V6Dims): { verdict: "PASS" | "ELIMINATED"; reason: string } {
  if ((s.truthStrength || 0) < STAGE_10_FLOORS.truthStrength) {
    return {
      verdict: "ELIMINATED",
      reason: `Truth Strength ${s.truthStrength}/10 below hard floor of ${STAGE_10_FLOORS.truthStrength}`,
    };
  }
  if ((s.competitiveImpossibility || 0) < STAGE_10_FLOORS.competitiveImpossibility) {
    return {
      verdict: "ELIMINATED",
      reason: `Competitive Impossibility ${s.competitiveImpossibility}/10 below hard floor of ${STAGE_10_FLOORS.competitiveImpossibility}`,
    };
  }
  return { verdict: "PASS", reason: "" };
}

export function computeStage10Flags(s: V6Dims): string[] {
  const flags: string[] = [];
  if ((s.fame || 0) < STAGE_10_FLAG_THRESHOLDS.fame) {
    flags.push("⚠ FAME: this proposition may not cut through in market");
  }
  if ((s.brandPermission || 0) < STAGE_10_FLAG_THRESHOLDS.brandPermission) {
    flags.push("⚠ BRAND PERMISSION: significant gap between this claim and demonstrated brand behaviour");
  }
  if ((s.cleanAir || 0) < STAGE_10_FLAG_THRESHOLDS.cleanAir) {
    flags.push("⚠ CLEAN AIR: this territory has competitive presence — occupancy risk");
  }
  if ((s.commercialPrecedent || 0) < STAGE_10_FLAG_THRESHOLDS.commercialPrecedent) {
    flags.push("⚠ COMMERCIAL PRECEDENT: first-mover move — no commercial validation exists — human judgment required");
  }
  return flags;
}

export function parseStage10Scores(text: string): Stage10Score[] {
  const out: Stage10Score[] = [];
  for (const block of splitSmpBlocks(text)) {
    const head = parseSmpHeading(block);
    if (!head) continue;
    const dims: V6Dims = {
      fame: pickNumber(block, "Fame"),
      truthStrength: pickNumber(block, "Truth Strength"),
      competitiveImpossibility: pickNumber(block, "Competitive Impossibility"),
      brandPermission: pickNumber(block, "Brand Permission"),
      cleanAir: pickNumber(block, "Clean Air"),
      commercialPrecedent: pickNumber(block, "Commercial Precedent"),
    };
    const weightedComposite = computeWeightedComposite(dims);
    const { verdict, reason } = evaluateStage10Verdict(dims);
    const flags = computeStage10Flags(dims);
    const score: Stage10Score = {
      smpLine: head.smpLine,
      fieldName: head.fieldName,
      ...dims,
      weightedComposite,
      codeVerdict: verdict,
      codeReason: reason,
      flags,
    };
    if (!Number.isNaN(score.fame) || !Number.isNaN(score.truthStrength)) out.push(score);
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

  const flat = stripEmphasis(stage11Output);
  const firstIdx = flat.search(/\n?SMP:\s*"/);
  const preamble = firstIdx > 0 ? flat.slice(0, firstIdx).trim() : "";


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
    "==== FROZEN STAGE 10 SCORES (V6 SIX-DIMENSION FRAMEWORK) — USE VERBATIM IN STAGE 12 CARDS. DO NOT RECALCULATE OR ADJUST. ====",
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
      `Fame: ${s.fame}/10 (30%) | Truth Strength: ${s.truthStrength}/10 (20%) | Competitive Impossibility: ${s.competitiveImpossibility}/10 (15%)`,
    );
    lines.push(
      `Brand Permission: ${s.brandPermission}/10 (10%) | Clean Air: ${s.cleanAir}/10 (10%) | Commercial Precedent: ${s.commercialPrecedent}/10 (5%)`,
    );
    lines.push(`Weighted Composite: ${s.weightedComposite}/100`);
    if (s.flags.length) {
      for (const f of s.flags) lines.push(f);
    }
  }
  return lines.join("\n");
}

/**
 * Post-process raw Stage 10 LLM output under V6:
 *  - Append CODE VERDICT, CODE COMPOSITE (weighted /100), and CODE FLAGS
 *    lines to every Per-SMP block.
 *  - Emit a CODE-COMPUTED STAGE 10 SUMMARY block at the end that Stage 11
 *    and Stage 12 consume as authoritative.
 * isPreflight=true bypasses elimination (everything PASSes); composites and
 * flags are still computed.
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
    const verdictLine =
      effective.verdict === "PASS"
        ? `CODE VERDICT: PASS — clears Stage 10 hard floors (Truth Strength ≥ ${STAGE_10_FLOORS.truthStrength}, Competitive Impossibility ≥ ${STAGE_10_FLOORS.competitiveImpossibility}).`
        : `CODE VERDICT: ELIMINATED — ${effective.reason}.`;
    const compositeLine = `CODE COMPOSITE: ${s.weightedComposite}/${STAGE_10_WEIGHTED_MAX} weighted (Fame 30% · Truth 20% · Competitive Impossibility 15% · Brand Permission 10% · Clean Air 10% · Commercial Precedent 5%).`;
    const flagsLine = s.flags.length
      ? `CODE FLAGS:\n${s.flags.map((f) => `  ${f}`).join("\n")}`
      : `CODE FLAGS: none`;

    // Inject after the Commercial Precedent line for this SMP block.
    const escLine = s.smpLine.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const smpBlockHeadRe = new RegExp(
      `(SMP:\\s*"${escLine}"[\\s\\S]*?\\n[\\t ]*Commercial\\s+Precedent\\s*:[^\\n]*\\n)`,
      "i",
    );
    if (smpBlockHeadRe.test(patched)) {
      patched = patched.replace(
        smpBlockHeadRe,
        (_m, head: string) => `${head}${verdictLine}\n${compositeLine}\n${flagsLine}\n`,
      );
    }
  }

  const summaryLines: string[] = [];
  summaryLines.push("");
  summaryLines.push(
    "==== CODE-COMPUTED STAGE 10 SUMMARY (V6 UNIFIED SIX-DIMENSION FRAMEWORK — AUTHORITATIVE; OVERRIDES ANY LLM VERDICT) ====",
  );
  if (opts.isPreflight) {
    summaryLines.push(
      "PRE-FLIGHT MODE: Truth Strength and Competitive Impossibility floors bypassed — every SMP is forced PASS for end-to-end pipeline integrity testing. Composites and flags are real.",
    );
  } else {
    summaryLines.push(
      `Selection rule: ELIMINATED if Truth Strength < ${STAGE_10_FLOORS.truthStrength} OR Competitive Impossibility < ${STAGE_10_FLOORS.competitiveImpossibility}. Fame, Brand Permission, Clean Air and Commercial Precedent surface human flags but do not eliminate. Weighted composite /100 is for ranking and display.`,
    );
  }
  const sorted = [...scores].sort((a, b) => b.weightedComposite - a.weightedComposite);
  for (const s of sorted) {
    const v = opts.isPreflight ? "PASS" : s.codeVerdict;
    const reason =
      opts.isPreflight && s.codeVerdict === "ELIMINATED"
        ? ` (would-eliminate: ${s.codeReason})`
        : v === "ELIMINATED"
        ? ` — ${s.codeReason}`
        : "";
    summaryLines.push(
      `- ${v} · weighted ${s.weightedComposite}/${STAGE_10_WEIGHTED_MAX} · "${s.smpLine}" — FIELD: ${s.fieldName}${reason}`,
    );
    if (s.flags.length) {
      for (const f of s.flags) summaryLines.push(`    ${f}`);
    }
  }
  patched = `${patched.trimEnd()}\n\n${summaryLines.join("\n")}\n`;
  return { output: patched, scores };
}
