// BRAND GRENADE — TERRITORY PRESERVATION CONTRACT (shared, client-safe)
// ============================================================================
// Room 01 (Intelligence Lab / Strategic Territory Intelligence Engine) produces
// ONE authoritative recommended primary territory. Before this module existed,
// that recommendation was dropped by buildHandoffPayload: only the
// [FROM_INTELLIGENCE_ENGINE session=...] marker survived, and the territory
// itself reached Stage 1 (at best) as a paraphrased fragment inside opportunity
// prose. Room 03 then re-synthesised its own territories in Stage 7 and could
// silently diverge from Room 01's own recommendation with nothing in any
// document connecting the two answers.
//
// This module is the single place that:
//   1. extracts the recommended territory from the Intelligence Engine prebrief,
//   2. renders it as a labelled, load-bearing anchor block (the same
//      preservation contract already applied to the Step-4 tension),
//   3. re-extracts it downstream from brief_text so Stage 8 and Stage 12 —
//      not just Stage 1 — see it verbatim,
//   4. reconciles it against whatever proposition was actually locked, so no
//      reader is ever left holding two unreconciled "best answers".
//
// Pure. No server imports. Safe in client bundles and in prompt builders.

export interface RecommendedTerritory {
  /** Territory name, verbatim from Room 01. */
  name: string;
  /** Territory description, verbatim from Room 01 ("" when not supplied). */
  description: string;
  /** Creative territory direction from the prebrief, when present. */
  direction?: string;
}

export const TERRITORY_ANCHOR_HEADING =
  "AUTHORITATIVE RECOMMENDED TERRITORY (ROOM 01 — INTELLIGENCE LAB)";

const NOT_PROVIDED = /^\(?\s*(not provided|none|n\/?a|unspecified)\s*\)?$/i;

function cleanValue(v: string | undefined | null): string {
  const s = (v ?? "").trim();
  if (!s || NOT_PROVIDED.test(s)) return "";
  return s;
}

/**
 * Read a labelled block out of a plain-text document: everything after
 * `LABEL:` up to the next ALL-CAPS label line or a fence.
 */
function readLabelledBlock(text: string, label: string): string {
  const lines = text.split("\n");
  const idx = lines.findIndex(
    (l) => l.trim().toUpperCase().replace(/\s+/g, " ") === `${label}:`,
  );
  if (idx < 0) {
    // Same-line form: "LABEL: value"
    const inline = lines.find((l) =>
      l.trim().toUpperCase().startsWith(`${label}:`),
    );
    return inline ? cleanValue(inline.slice(inline.indexOf(":") + 1)) : "";
  }
  const out: string[] = [];
  for (let i = idx + 1; i < lines.length; i++) {
    const raw = lines[i];
    const t = raw.trim();
    if (!t && out.length) break;
    if (!t) continue;
    // Next label line, or the end of a fenced anchor block.
    if (/^[A-Z][A-Z0-9 ()/\u2014,'-]{3,}:\s*$/.test(t)) break;
    if (/^[A-Z][A-Z0-9 ()/\u2014,'-]{3,}:\s+\S/.test(t)) break;
    if (t.startsWith("===")) break;
    out.push(t);
  }
  return cleanValue(out.join("\n"));
}

/**
 * Extract the recommended territory from the Intelligence Engine prebrief text
 * (the workspace raw_brief written by buildPreBriefText).
 */
export function extractRecommendedTerritoryFromPrebrief(
  rawBrief: string | null | undefined,
): RecommendedTerritory | null {
  const text = (rawBrief ?? "").trim();
  if (!text) return null;
  const name = readLabelledBlock(text, "RECOMMENDED PRIMARY TERRITORY");
  if (!name) return null;
  return {
    name,
    description: readLabelledBlock(text, "TERRITORY DESCRIPTION"),
    direction: readLabelledBlock(text, "CREATIVE TERRITORY DIRECTION") || undefined,
  };
}

/**
 * Render the load-bearing anchor lines that ship inside the Briefing Room
 * anchor block at the top of brief_text. The label is part of the contract —
 * downstream extraction keys off it.
 */
export function territoryAnchorLines(t: RecommendedTerritory): string[] {
  const lines: string[] = [];
  lines.push(
    `${TERRITORY_ANCHOR_HEADING} — load-bearing, preserve verbatim; Stages 1, 7, 8 and 12 must carry this territory forward or state explicitly why they did not:`,
  );
  lines.push(`  RECOMMENDED PRIMARY TERRITORY: ${t.name}`);
  if (t.description) lines.push(`  TERRITORY DESCRIPTION: ${t.description}`);
  if (t.direction) lines.push(`  CREATIVE TERRITORY DIRECTION: ${t.direction}`);
  return lines;
}

/** The same content as a self-contained block for a brief field / prompt. */
export function territoryAnchorBlock(t: RecommendedTerritory): string {
  return territoryAnchorLines(t).join("\n");
}

/**
 * Re-extract the recommended territory downstream, from a session's
 * brief_text. Handles the new anchor form first, then falls back to the raw
 * prebrief form so sessions created before this contract still resolve.
 */
export function extractRecommendedTerritory(
  briefText: string | null | undefined,
): RecommendedTerritory | null {
  const text = (briefText ?? "").trim();
  if (!text) return null;
  const name =
    readLabelledBlock(text, "RECOMMENDED PRIMARY TERRITORY") ||
    readLabelledBlock(text, "AUTHORITATIVE RECOMMENDED TERRITORY");
  if (!name) return null;
  return {
    name: name.replace(/^["“”']|["“”']$/g, "").trim(),
    description: readLabelledBlock(text, "TERRITORY DESCRIPTION"),
    direction: readLabelledBlock(text, "CREATIVE TERRITORY DIRECTION") || undefined,
  };
}

/** Prompt injection for a generation stage (Stage 8). */
export function territoryPromptBlockForGeneration(t: RecommendedTerritory): string {
  return `==== ${TERRITORY_ANCHOR_HEADING} ====
This territory is Room 01's own authoritative recommendation for this brand. It is a fixed priority input, not a suggestion to interrogate away.

RECOMMENDED PRIMARY TERRITORY: ${t.name}
${t.description ? `TERRITORY DESCRIPTION: ${t.description}\n` : ""}${t.direction ? `CREATIVE TERRITORY DIRECTION: ${t.direction}\n` : ""}
REQUIRED HANDLING:
- At least one proposition in your output MUST be written against this territory, even if the synthesised territory list above names it differently. Where a synthesised territory clearly carries it, use that one and say so.
- Label that proposition's territory heading with the suffix " [ROOM 01 RECOMMENDED]" so the alignment is machine-readable downstream.
- If you judge that this territory cannot carry a proposition, you must still generate it AND add a line "ROOM 01 DIVERGENCE: <one sentence stating why>". Silent omission is a failure.`;
}

/** Prompt injection for the selection stage (Stage 12). */
export function territoryPromptBlockForSelection(t: RecommendedTerritory): string {
  return `==== ${TERRITORY_ANCHOR_HEADING} ====
RECOMMENDED PRIMARY TERRITORY: ${t.name}
${t.description ? `TERRITORY DESCRIPTION: ${t.description}\n` : ""}
REQUIRED HANDLING:
- Add a metadata line to every card: "ROOM01_ALIGNMENT: ALIGNED" when that proposition is built on the recommended territory above, otherwise "ROOM01_ALIGNMENT: DIVERGENT".
- Do NOT privilege the aligned card in the presentation — structural neutrality still applies. The label is provenance, not advocacy.
- In Section 1 (Presentation Context) add one plain-language sentence naming the recommended territory and stating that the propositions below were generated independently of it, so the reader can see where the two answers agree and where they do not.`;
}

// ── Reconciliation ──────────────────────────────────────────────────────────

const STOP = new Set(
  "the a an and or of to in for on with by is are be as it its that this from at into not no but we you they our their your than then so what which who whom whose how why when where all any each more most other some such only own same too very can will just".split(
    " ",
  ),
);

function tokens(s: string): Set<string> {
  return new Set(
    (s ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w)),
  );
}

/** Jaccard overlap of content words, 0..1. */
export function territoryOverlap(a: string, b: string): number {
  const A = tokens(a);
  const B = tokens(b);
  if (!A.size || !B.size) return 0;
  let hit = 0;
  for (const w of A) if (B.has(w)) hit++;
  return hit / (A.size + B.size - hit);
}

export interface TerritoryReconciliation {
  /** True when Room 01's recommendation and the locked proposition differ. */
  divergent: boolean;
  /** Room 01's recommended territory name. */
  recommended: string;
  /** What was actually locked. */
  locked: string;
  /** Plain-text paragraphs, verbatim across every deliverable. */
  paragraphs: string[];
  /** Same content as HTML paragraphs (empty string when nothing to say). */
  html: string;
  heading: string;
}

/** First sentence of a description, trimmed and de-punctuated for inline use. */
function firstSentence(text: string | undefined, max: number): string {
  const t = (text ?? "").trim();
  if (!t) return "";
  const stop = t.search(/[.!?](\s|$)/);
  let out = stop > 40 ? t.slice(0, stop) : t;
  if (out.length > max) out = `${out.slice(0, max).replace(/[\s,;:—-]+\S*$/, "")}…`;
  return out.replace(/[.\s]+$/, "");
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Build the mandatory reconciliation paragraph.
 *
 * Fires whenever a Room 01 recommendation exists, and reads differently
 * depending on whether Room 03 landed on it or somewhere else. When the two
 * agree, it says so in one line — the reader still gets the connection made
 * explicitly rather than having to infer it.
 */
export function reconcileTerritory(args: {
  recommended: RecommendedTerritory | null;
  /** The locked proposition line. */
  lockedSmp: string;
  /** The scored/territory name the locked line came through, when known. */
  lockedTerritoryName?: string | null;
  /** Set when the human overrode a system-ranked recommendation at the gate. */
  humanOverride?: boolean;
  /** Threshold below which the two are treated as different territories. */
  threshold?: number;
}): TerritoryReconciliation | null {
  const rec = args.recommended;
  const smp = (args.lockedSmp ?? "").trim();
  if (!rec?.name || !smp) return null;

  const lockedName = (args.lockedTerritoryName ?? "").trim();
  const recBlob = `${rec.name} ${rec.description ?? ""} ${rec.direction ?? ""}`;
  const lockedBlob = `${smp} ${lockedName}`;
  const score = Math.max(
    territoryOverlap(rec.name, lockedBlob),
    territoryOverlap(recBlob, lockedBlob),
  );
  const threshold = args.threshold ?? 0.12;
  const divergent = score < threshold;
  const locked = lockedName ? `${smp} (territory: ${lockedName})` : smp;

  const heading = divergent
    ? "Reconciling the Intelligence Lab recommendation with the locked proposition"
    : "How the locked proposition relates to the Intelligence Lab recommendation";

  const paragraphs: string[] = [];

  if (!divergent) {
    paragraphs.push(
      `The Intelligence Lab's authoritative recommendation for this brand was the territory “${rec.name}”. The proposition locked at the human selection gate — “${smp}”${
        lockedName ? `, carried through the territory “${lockedName}”` : ""
      } — is built on that same territory. The two rooms reached the same answer by independent routes: the Intelligence Lab arrived at it from the evidence base, the strategy pipeline arrived at it by generating and scoring a competing field without being told the recommendation in advance.`,
    );
    return {
      divergent,
      recommended: rec.name,
      locked,
      paragraphs,
      heading,
      html: paragraphs.map((p) => `<p>${esc(p)}</p>`).join(""),
    };
  }

  const gist = firstSentence(rec.description, 240);
  paragraphs.push(
    `Two recommendations exist in this body of work and they are not the same. The Intelligence Lab recommended the territory “${rec.name}”${
      gist ? ` — ${gist.endsWith("…") ? gist.slice(0, -1) : gist}.` : "."
    } The proposition locked at the selection gate is “${smp}”${
      lockedName ? `, which came through the territory “${lockedName}”` : ""
    }. This paragraph exists so the reader is not left holding two unreconciled best answers.`,
  );

  paragraphs.push(
    args.humanOverride
      ? `The divergence was a conscious decision, not an oversight. The strategy pipeline generated and scored its own field of territories and propositions, and at the human judgement gate the locked line was selected over the alternatives on the record set out elsewhere in this document. The Intelligence Lab recommendation remains the correct reading of the evidence base; the locked proposition is the expression judged most ownable and most campaignable off that evidence.`
      : `The divergence is structural rather than a disagreement about the evidence. The strategy pipeline synthesised its own territories from the same evidence base and generated propositions against those, so it reached its conclusion independently of the Intelligence Lab's recommendation rather than in opposition to it. Where the two differ, the difference is one of expression and emphasis, not of fact.`,
  );

  paragraphs.push(
    `The practical consequence: “${rec.name}” remains live as strategic context and should continue to inform how the locked proposition is evidenced and defended. It has not been rejected on merit, and nothing in the validation record eliminated it. If the intention is to run the Intelligence Lab recommendation instead, that is a live option and should be taken explicitly rather than by default.`,
  );

  return {
    divergent,
    recommended: rec.name,
    locked,
    paragraphs,
    heading,
    html: paragraphs.map((p) => `<p>${esc(p)}</p>`).join(""),
  };
}
