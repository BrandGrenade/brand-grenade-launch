// Context trimming utilities used between pipeline stages.
// Goal: pass only the minimum context required for each stage to function,
// so demo/dev runs stay within token budgets. Production runs can bypass
// these by passing the full upstream output directly.

function clip(s: string, max: number): string {
  const t = (s ?? "").trim();
  if (t.length <= max) return t;
  return t.slice(0, max).trimEnd() + "…";
}

/** Extract the body of a markdown section by a heading regex (match must include the trailing newline). */
function sectionBody(text: string, headingRe: RegExp): string {
  const m = text.match(headingRe);
  if (!m || m.index === undefined) return "";
  const start = m.index + m[0].length;
  const rest = text.slice(start);
  const next = rest.search(/\n#{1,4}\s/);
  return (next === -1 ? rest : rest.slice(0, next)).trim();
}

function pickLines(text: string, predicates: RegExp[]): string {
  const out: string[] = [];
  for (const line of (text ?? "").split("\n")) {
    if (predicates.some((re) => re.test(line))) out.push(line);
  }
  return out.join("\n").trim();
}

/** Stage 1 → Stages 2/3/4: keep only Sections 1, 4, 6 (clipped). */
export function trimStage1ForDownstream(s1: string): string {
  if (!s1) return "";
  const sec1 = clip(sectionBody(s1, /##\s*Section\s*1[^\n]*\n/i), 200);
  const sec4 = clip(sectionBody(s1, /##\s*Section\s*4[^\n]*\n/i), 200);
  const sec6 = clip(sectionBody(s1, /##\s*Section\s*6[^\n]*\n/i), 400);
  return [
    sec1 && `## Core Challenge\n${sec1}`,
    sec4 && `## Category Assumption Challenged\n${sec4}`,
    sec6 && `## Sanitised Strategic Brief\n${sec6}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Stage 2 (CMM) → Stages 5/6: keep Forbidden Zones, Whitespace Zones, Dominant Logic. */
export function trimCMMForDownstream(cmm: string): string {
  if (!cmm) return "";
  const forb = sectionBody(cmm, /#{1,4}\s*[^\n]*Forbidden\s+Zones?[^\n]*\n/i);
  const white = sectionBody(cmm, /#{1,4}\s*[^\n]*Whitespace\s+Zones?[^\n]*\n/i);
  const dom = sectionBody(cmm, /#{1,4}\s*[^\n]*(Category\s+)?Dominant\s+Logic[^\n]*\n/i);
  const parts = [
    forb && `## Forbidden Zones\n${forb}`,
    white && `## Whitespace Zones\n${white}`,
    dom && `## Category Dominant Logic\n${dom}`,
  ].filter(Boolean);
  return parts.length ? parts.join("\n\n") : clip(cmm, 600);
}

/** Stage 4 (SIS) → Stages 5/6: keep frame names/numbers, brand roles, required tension types. */
export function trimSISForDownstream(sis: string): string {
  if (!sis) return "";
  const kept = pickLines(sis, [
    /^#{1,4}\s*Frame\s*\d+/i,
    /^Frame\s*\d+/i,
    /Brand\s+Role/i,
    /Required\s+Tension/i,
    /Tension\s+Type/i,
  ]);
  return kept || clip(sis, 800);
}

/** Stage 6 (Validated Insights) → Stages 7/8: titles, one-line tensions, priority flags, Human Contradictions. */
export function trimValidatedInsightsForDownstream(s6: string): string {
  if (!s6) return "";
  const kept = pickLines(s6, [
    /^#{2,4}\s*Insight\s*\d+/i,
    /^Insight\s*\d+/i,
    /^\s*Tension\s*[:\-]/i,
    /^\s*Priority/i,
    /Human\s+Contradiction/i,
  ]);
  return kept || clip(s6, 1000);
}

/** Stage 8 (Draft SMPs) → Stages 9/10/11: SMP lines, brand roles, composite scores. */
export function trimDraftSMPsForDownstream(s8: string): string {
  if (!s8) return "";
  const kept = pickLines(s8, [
    /^#{2,4}\s*SMP\s*\d+/i,
    /^SMP\s*\d+/i,
    /^\s*Line\s*[:\-]/i,
    /^\s*Proposition\s*[:\-]/i,
    /Brand\s+Role/i,
    /Composite\s+Score/i,
    /^\s*Score\s*[:\-]/i,
  ]);
  return kept || clip(s8, 1200);
}

/** Stage 10/11 (Scored / Pressure-tested SMPs) → Stage 12: SMP lines, six dimension scores, pass/fail, one-line rationale. */
export function trimScoredSMPsForDownstream(s: string): string {
  if (!s) return "";
  const kept = pickLines(s, [
    /^#{2,4}\s*SMP\s*\d+/i,
    /^SMP\s*\d+/i,
    /^\s*Line\s*[:\-]/i,
    /^\s*(Distinctiveness|Tension|Memorability|Ownability|Provocation|Coherence|Brand\s+Role)\s*[:\-]/i,
    /\bPASS\b|\bFAIL\b/,
    /^\s*Rationale\s*[:\-]/i,
  ]);
  return kept || clip(s, 1200);
}

/** Stage 13 (Brand Fit) → Stages 13B/14/14B/14C: Brand Fit verdict + positioning adjustments only. */
export function trimBrandFitForDownstream(s13: string): string {
  if (!s13) return "";
  const verdict =
    sectionBody(s13, /#{1,4}\s*[^\n]*Brand\s*Fit\s*Verdict[^\n]*\n/i) ||
    sectionBody(s13, /#{1,4}\s*[^\n]*Verdict[^\n]*\n/i);
  const adj =
    sectionBody(s13, /#{1,4}\s*[^\n]*Positioning\s*Adjustments?[^\n]*\n/i) ||
    sectionBody(s13, /#{1,4}\s*[^\n]*Adjustments?[^\n]*\n/i);
  const parts = [
    verdict && `## Brand Fit Verdict\n${clip(verdict, 500)}`,
    adj && `## Positioning Adjustments\n${clip(adj, 700)}`,
  ].filter(Boolean);
  return parts.length ? parts.join("\n\n") : clip(s13, 800);
}

/** First paragraph of a text block. */
export function firstParagraph(text: string): string {
  const t = (text ?? "").trim();
  const i = t.search(/\n\s*\n/);
  return i === -1 ? t : t.slice(0, i).trim();
}

/** Generic section extractor (heading text-based). */
export function extractSection(text: string, headingRe: RegExp): string {
  return sectionBody(text ?? "", headingRe);
}

/** Stage 13B — Strategic Lineage Statement (single statement). */
export function extractStrategicLineageStatement(s13b: string): string {
  const sec = extractSection(s13b, /#{1,4}\s*[^\n]*Strategic\s+Lineage\s+Statement[^\n]*\n/i);
  return clip(sec || firstParagraph(s13b), 400);
}

/** Stage 14 — Dimension 1 + Dimension 2 sections only. */
export function extractStage14Dimensions12(s14: string): string {
  const d1 = extractSection(s14, /#{1,4}\s*[^\n]*Dimension\s*1[^\n]*\n/i);
  const d2 = extractSection(s14, /#{1,4}\s*[^\n]*Dimension\s*2[^\n]*\n/i);
  const parts = [
    d1 && `## Dimension 1\n${clip(d1, 600)}`,
    d2 && `## Dimension 2\n${clip(d2, 600)}`,
  ].filter(Boolean);
  return parts.length ? parts.join("\n\n") : firstParagraph(s14);
}

/** Stage 14C — World Name, World Character, Strategic Continuity Statement. */
export function extractStage14CCore(s14c: string): string {
  const name = extractSection(s14c, /#{1,4}\s*[^\n]*World\s*Name[^\n]*\n/i);
  const char = extractSection(s14c, /#{1,4}\s*[^\n]*World\s*Character[^\n]*\n/i);
  const cont =
    extractSection(s14c, /#{1,4}\s*[^\n]*Strategic\s+Continuity\s+Statement[^\n]*\n/i) ||
    extractSection(s14c, /#{1,4}\s*[^\n]*Continuity\s+Statement[^\n]*\n/i);
  const parts = [
    name && `## World Name\n${clip(name, 200)}`,
    char && `## World Character\n${clip(char, 500)}`,
    cont && `## Strategic Continuity Statement\n${clip(cont, 500)}`,
  ].filter(Boolean);
  return parts.length ? parts.join("\n\n") : clip(s14c, 700);
}

/** Stage 14C — Strategic Continuity Statement only. */
export function extractStrategicContinuityStatement(s14c: string): string {
  const cont =
    extractSection(s14c, /#{1,4}\s*[^\n]*Strategic\s+Continuity\s+Statement[^\n]*\n/i) ||
    extractSection(s14c, /#{1,4}\s*[^\n]*Continuity\s+Statement[^\n]*\n/i);
  return clip(cont || firstParagraph(s14c), 500);
}
