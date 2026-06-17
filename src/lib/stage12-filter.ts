// Stage 12 input hardening.
//
// Two permanent guarantees enforced HERE, not in the prompt alone:
//   1. ELIMINATED SMPs from Stage 11 are stripped from the input.
//      VALIDATED, VALIDATED WITH STRATEGIC NOTE, and accepted REWRITTEN SMPs
//      are forwarded.
//   2. Stage 10 scores are parsed and re-emitted as a FROZEN SCORES block
//      so Stage 12 cannot invent or recalculate scores per SMP.

export interface Stage10Score {
  smpLine: string;
  fieldName: string;
  differentiation: number;
  truthStrength: number;
  culturalRelevance: number;
  commercialPlausibility: number;
  creativeExpandability: number;
  writerQuality: number;
  composite: number;
}

export interface Stage11Verdict {
  smpLine: string;
  fieldName: string;
  verdict: string;          // VALIDATED | VALIDATED WITH STRATEGIC NOTE | REWRITTEN | ELIMINATED
  iconicStatus: string;     // CONFIRMED | DOWNGRADED | N/A
  block: string;            // raw stage 11 per-SMP block
}

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
  // Split on the start of an SMP block; keep the leading marker on each chunk.
  // Upstream stages may emit either `SMP: "..."` or markdown headings like
  // `### SMP One — "..." — FIELD: ...`. Stage 12 must support both because
  // live Stage 10/11 outputs use the latter format.
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

export function parseStage10Scores(text: string): Stage10Score[] {
  const out: Stage10Score[] = [];
  for (const block of splitSmpBlocks(text)) {
    const head = parseSmpHeading(block);
    if (!head) continue;
    const composite = block.match(/COMPOSITE\s*:\s*(\d+(?:\.\d+)?)\s*\/\s*60/i);
    const score: Stage10Score = {
      smpLine: head.smpLine,
      fieldName: head.fieldName,
      differentiation: pickNumber(block, "Differentiation"),
      truthStrength: pickNumber(block, "Truth Strength"),
      culturalRelevance: pickNumber(block, "Cultural Relevance"),
      commercialPlausibility: pickNumber(block, "Commercial Plausibility"),
      creativeExpandability: pickNumber(block, "Creative Expandability"),
      writerQuality: pickNumber(block, "Writer Quality"),
      composite: composite ? Number(composite[1]) : NaN,
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
    // Normalise to one of the canonical labels.
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

  // Preserve any preamble / header text that appears before the first SMP block.
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
      `Differentiation: ${s.differentiation}/10 | Truth Strength: ${s.truthStrength}/10 | Cultural Relevance: ${s.culturalRelevance}/10`,
    );
    lines.push(
      `Commercial Plausibility: ${s.commercialPlausibility}/10 | Creative Expandability: ${s.creativeExpandability}/10 | Writer Quality: ${s.writerQuality}/10`,
    );
    lines.push(`Composite: ${s.composite}/60`);
  }
  return lines.join("\n");
}
