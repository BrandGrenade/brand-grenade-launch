// Context utilities used between pipeline stages.
//
// IMPORTANT — TRUNCATION POLICY:
// Every stage in the pipeline must receive the COMPLETE upstream output from
// the previous stage. The historical `trim*ForDownstream` helpers used to
// pick a few lines or sections out of the upstream output to save tokens;
// that behaviour caused downstream stages (notably Stage 7, which consumes
// Stage 6's validated insight set) to receive only a fragment of the
// upstream output and produce partial results.
//
// All `trim*ForDownstream` helpers below are now pass-through. They keep
// their original names so existing call sites do not need to change, but
// they return the full upstream output verbatim.
//
// The `extract*` / `firstParagraph` helpers further down are NOT generic
// stage handoffs — they are deliberate, narrow extractions of named
// statements (e.g. the Strategic Lineage Statement) that are wired in as
// specific inputs to specific stages. They remain unchanged.

function passThrough(s: string | null | undefined): string {
  return (s ?? "").trim();
}

/** Stage 1 → Stages 2/3/4: full Stage 1 output. */
export function trimStage1ForDownstream(s1: string): string {
  return passThrough(s1);
}

/** Stage 2 (CMM) → Stages 5/6: full CMM. */
export function trimCMMForDownstream(cmm: string): string {
  return passThrough(cmm);
}

/** Stage 4 (SIS) → Stages 5/6: full SIS. */
export function trimSISForDownstream(sis: string): string {
  return passThrough(sis);
}

/** Stage 6 (Validated Insights) → Stages 7/8: full validated insight set. */
export function trimValidatedInsightsForDownstream(s6: string): string {
  return passThrough(s6);
}

/** Stage 8 (Draft SMPs) → Stages 9/10/11: full Draft SMP set. */
export function trimDraftSMPsForDownstream(s8: string): string {
  return passThrough(s8);
}

/** Stage 10/11 (Scored / Pressure-tested SMPs) → Stage 12: full scored set. */
export function trimScoredSMPsForDownstream(s: string): string {
  return passThrough(s);
}

/** Stage 13 (Brand Fit) → Stages 13B/14/14B/14C: full Brand Fit verdict. */
export function trimBrandFitForDownstream(s13: string): string {
  return passThrough(s13);
}

// ---------------------------------------------------------------------------
// Narrow extraction helpers (intentional, not stage-wide handoffs).
// ---------------------------------------------------------------------------

function clip(s: string, max: number): string {
  const t = (s ?? "").trim();
  if (t.length <= max) return t;
  return t.slice(0, max).trimEnd() + "…";
}

function sectionBody(text: string, headingRe: RegExp): string {
  const m = text.match(headingRe);
  if (!m || m.index === undefined) return "";
  const start = m.index + m[0].length;
  const rest = text.slice(start);
  const next = rest.search(/\n#{1,4}\s/);
  return (next === -1 ? rest : rest.slice(0, next)).trim();
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
