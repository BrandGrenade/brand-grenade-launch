// BRAND GRENADE — SHARED MINTO CONTENT DERIVATION
// ============================================================================
// One extraction pass over a pipeline session, producing the ten canonical
// Minto sections. Every document type that reports on a strategy run uses
// this — Board Strategy Recommendation, Strategy Executive Summary,
// Consulting Delivery and the Master Detonation Brief — so the argument is
// identical across deliverables and only emphasis and appendix differ.
//
// Nothing is invented. If a value cannot be found in session data the slot is
// left empty and the canonical template renders its declared fallback.

import {
  callout,
  comparisonTable,
  escapeHtml,
  inlineMd,
  proofLine,
  pullQuote,
  reasonGrid,
  renderMarkdown,
  sanitiseText,
  statGrid,
  type CmpRow,
  type Reason,
  type Stat,
} from "./doc-system";
import type { MintoContent } from "./minto";
import { buildCurrentStateSection } from "./current-state";
import { stripDocumentMetadata } from "./strip-document-metadata";
import { extractShortlist } from "./exec-summary-extract";
import { STRATEGY_SCORING_DIMENSION_NAMES } from "@/lib/platform-metrics";

export interface MintoSession {
  brand_name?: string | null;
  category?: string | null;
  selected_smp?: string | null;
  stage_1_output?: string | null;
  stage_2_output?: string | null;
  stage_3_output?: string | null;
  stage_4_output?: string | null;
  stage_5_output?: string | null;
  stage_6_output?: string | null;
  stage_7_output?: string | null;
  stage_8_output?: string | null;
  stage_9_output?: string | null;
  stage_9_leftofcentre_output?: string | null;
  stage_10_output?: string | null;
  stage_11_output?: string | null;
  stage_12_output?: string | null;
  stage_13_output?: string | null;
  stage_14_output?: string | null;
  stage_15_output?: string | null;
  stage_17_selected_territory?: string | null;
  stage_17b_output?: string | null;
  stage_18_selected_detonation?: string | null;
  stage_19_output?: string | null;
  stage_20_output?: string | null;
  stage_22_brand_architecture?: string | null;
  stage_22_distinctive_assets?: string | null;
  /** Room 04 lock — the single winning creative idea and its campaign line. */
  locked_big_idea?: string | null;
  locked_campaign_line?: string | null;
  locked_big_idea_lens?: string | null;
  locked_big_idea_at?: string | null;
  locked_big_idea_run_id?: string | null;
  updated_at?: string | null;
  selection_rationale?: unknown;
}


/* ────────────────────────────────────────────────────────── helpers ── */

const INTERNAL_LINE =
  /(PIPELINE DATA HEADER|BRIEF DEPTH LEVEL:|CATEGORY KNOWLEDGE CONFIDENCE:|BRIEF ELEMENTS PRESENT:|ASSUMPTIONS MADE:|====\s*DELIVERABLE)/i;

export function clean(text: unknown, tag = "minto"): string {
  return sanitiseText(stripDocumentMetadata(String(text ?? ""), tag));
}

export function stripInternals(text: string): string {
  return text
    .split("\n")
    .filter((l) => !INTERNAL_LINE.test(l))
    .join("\n");
}

/** Paragraphs of running prose, ignoring headings, bullets and label lines. */
export function prose(text: string, limit: number): string[] {
  const out: string[] = [];
  for (const raw of text.split(/\n\s*\n/)) {
    const p = raw.trim().replace(/\s+/g, " ");
    if (!p) continue;
    if (/^[#>*\-—•=]/.test(p)) continue;
    if (/^[A-Z0-9 .—–:'"()/]{0,60}:\s*$/.test(p)) continue;
    if (p.length < 90) continue;
    if (isScaffoldProse(p)) continue;
    out.push(p);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Process bookkeeping that a model emits at the top of a stage transcript
 * ("SMPS RECEIVED FROM STAGE 10: 5 / PRESSURE TESTS APPLIED PER SMP: 5").
 * It is not evidence and must never be promoted into a document section.
 */
export function isScaffoldProse(p: string): boolean {
  if (/\b[A-Z][A-Z /()-]{6,}:\s*\d/.test(p)) return true;
  if (/\b(SMPS?|TESTS?|CANDIDATES?|ITEMS?|SECTIONS?)\s+(RECEIVED|APPLIED|RETURNED|GENERATED|PROCESSED)\b/i.test(p))
    return true;
  const letters = p.replace(/[^A-Za-z]/g, "");
  if (letters.length > 20 && letters.replace(/[^A-Z]/g, "").length / letters.length > 0.6) return true;
  return false;
}

/**
 * Reorders a multi-candidate stage transcript so the block that names the
 * selected proposition comes first. Nothing is dropped — but because every
 * downstream consumer (condensing, prose(), "first paragraph" pickers) reads
 * from the top, positional reading would otherwise surface whichever
 * candidate the model happened to write first. That is how a document ends
 * up describing a proposition other than the one on its own cover.
 */
export function orderBySelected(raw: string, smp: string, aliases: string[] = []): string {
  // A stage rarely repeats the proposition line verbatim: Stage 7 names the
  // territory ("The Designed Spontaneity"), Stage 9 names it in bold at the
  // head of a paragraph. Aliases let the same reorder work on those stages.
  const keys = [smp, ...aliases].map(smpKey).filter((k) => k.length >= 6);
  if (!raw.trim() || !keys.length) return raw;
  const has = (s: string) => {
    const k = smpKey(s);
    return keys.some((key) => k.includes(key));
  };
  const lines = raw.split("\n");

  // Boundaries must sit at candidate level, not at every sub-heading, or a
  // candidate's own body is torn away from its header and the reorder moves
  // a bare title instead of the evidence beneath it.
  //
  // Ordering matters: a candidate's TITLE is what a reader sees as the
  // section header, so title-bearing boundaries (markdown headings,
  // "PROPOSITION 2") are tried before body-level labels such as `SMP: "..."`.
  // Splitting on `SMP:` leaves the first candidate's title stranded in the
  // preamble, which is how a scoring section ended up headed by one
  // proposition while the line beneath it belonged to another.
  const candidates: Array<(l: string) => boolean> = [
    (l) => /^\s*\*{0,2}(?:PROPOSITION|SMP|CANDIDATE|OPTION|CARD|TERRITORY)\s*\d+\*{0,2}\s*$/i.test(l),
    (l) => /^\s*(?:#{1,6}\s*)?\*{0,2}(?:Proposition|Candidate|Option|Card|Field)\s*\d+\s*[:—–-]/i.test(l),
    (l) => /^\s*###\s+\S/.test(l),
    (l) => /^\s*##\s+\S/.test(l),
    (l) => /^\s*#\s+\S/.test(l),
    (l) => /^\s*(?:#{1,6}\s*)?\*{0,2}SMP\s*\d*\s*:/i.test(l),
    // Bold-only lines are the weakest signal: they are often sub-labels
    // inside a candidate block, so they are tried last.
    (l) => /^\s*\*\*[^*]{3,90}\*\*\s*$/.test(l),
  ];

  /** A preamble line that reads as a candidate title rather than context. */
  const looksLikeTitle = (l: string) =>
    /^\s*#{1,6}\s+\S/.test(l) || /^\s*\*\*[^*]{3,90}\*\*\s*$/.test(l);

  const apply = (starts: number[], blocks: string[][], hit: number): string => {
    const preamble = lines.slice(0, starts[0]);
    // Any trailing preamble title belongs to whichever candidate happened to
    // be written first. Once the order changes it would mislabel the block
    // beneath it, so it is dropped unless it names the selected proposition.
    while (preamble.length) {
      const last = preamble[preamble.length - 1];
      if (!last.trim()) {
        preamble.pop();
        continue;
      }
      if (looksLikeTitle(last) && !has(last)) {
        preamble.pop();
        continue;
      }
      break;
    }
    if (hit === 0 && preamble.length === starts[0]) return promoteParagraphs(raw, has);
    const ordered = [blocks[hit], ...blocks.filter((_, i) => i !== hit)];
    return promoteParagraphs([...preamble, ...ordered.flat()].join("\n"), has);
  };

  const segment = (isBoundary: (l: string) => boolean) => {
    const starts: number[] = [];
    lines.forEach((l, i) => {
      if (isBoundary(l)) starts.push(i);
    });
    if (starts.length < 2) return null;
    return { starts, blocks: starts.map((s, n) => lines.slice(s, starts[n + 1] ?? lines.length)) };
  };

  // A block whose own HEADER names the proposition is unambiguous. A block
  // that merely mentions it somewhere in its body may be a coarse grouping
  // that opens with a different candidate — promoting that would move the
  // wrong title to the front. So every segmentation is tried for a header
  // match first, and body matches are only used when no header match exists.
  for (const isBoundary of candidates) {
    const seg = segment(isBoundary);
    if (!seg) continue;
    const hit = seg.blocks.findIndex((b) => has(b[0] ?? ""));
    if (hit >= 0) return apply(seg.starts, seg.blocks, hit);
  }
  for (const isBoundary of candidates) {
    const seg = segment(isBoundary);
    if (!seg) continue;
    const hit = seg.blocks.findIndex((b) => has(b.join(" ")));
    if (hit >= 0) return apply(seg.starts, seg.blocks, hit);
  }
  return promoteParagraphs(raw, has);
}

/**
 * Returns only evidence belonging to the locked proposition from a stage that
 * contains several candidate write-ups. Reordering is not enough for a
 * document appendix: the later candidate blocks still render and read as a
 * second recommendation. This selector preserves shared stage context, but
 * removes every candidate-owned block/paragraph except the selected one.
 */
export function scopeToSelected(raw: string, smp: string, aliases: string[] = []): string {
  const keys = [smp, ...aliases].map(smpKey).filter((k) => k.length >= 6);
  if (!raw.trim() || !keys.length) return raw;
  const has = (s: string) => {
    const keyed = smpKey(s);
    return keys.some((key) => keyed.includes(key) || key.includes(keyed));
  };
  const lines = raw.split("\n");
  const boundaries: Array<{ matches: (line: string) => boolean; allowBodyMatch: boolean }> = [
    { matches: (line) => /^\s*\*{0,2}(?:PROPOSITION|SMP|CANDIDATE|OPTION|CARD|TERRITORY)\s*\d+\*{0,2}\s*$/i.test(line), allowBodyMatch: true },
    { matches: (line) => /^\s*(?:#{1,6}\s*)?\*{0,2}(?:Proposition|Candidate|Option|Card|Field)\s*\d+\s*[:—–-]/i.test(line), allowBodyMatch: true },
    // A generic markdown heading may own an entire themed section containing
    // several candidates. Its body mentioning the selected line does not make
    // that whole section selected-candidate evidence; require a header match.
    { matches: (line) => /^\s*#{1,6}\s+\S/.test(line), allowBodyMatch: false },
    { matches: (line) => /^\s*(?:#{1,6}\s*)?\*{0,2}SMP\s*\d*\s*:/i.test(line), allowBodyMatch: true },
  ];

  for (const boundary of boundaries) {
    const starts: number[] = [];
    lines.forEach((line, index) => {
      if (boundary.matches(line)) starts.push(index);
    });
    if (starts.length < 2) continue;
    const blocks = starts.map((start, index) => lines.slice(start, starts[index + 1] ?? lines.length));
    const headerHit = blocks.findIndex((block) => has(block[0] ?? ""));
    const bodyHit = headerHit >= 0
      ? headerHit
      : boundary.allowBodyMatch
        ? blocks.findIndex((block) => has(block.join(" ")))
        : -1;
    if (bodyHit < 0) continue;
    const preamble = lines.slice(0, starts[0]);
    while (preamble.length && /^\s*(?:#{1,6}\s+\S|\*\*[^*]{3,90}\*\*\s*)$/.test(preamble[preamble.length - 1])) {
      preamble.pop();
    }
    return [...preamble, ...blocks[bodyHit]].join("\n").trim();
  }

  // Theme-led stages (notably Stage 9) place one bold candidate paragraph
  // beneath each shared heading. Keep shared prose and the selected paragraph,
  // but never carry the sibling paragraphs into the document.
  const paragraphs = raw.split(/\n\s*\n/);
  const named = paragraphs.filter((paragraph) => /^\s*\*\*[^*]{3,90}\*\*/.test(paragraph));
  if (named.length >= 2 && named.some(has)) {
    // Collect every bold territory name, including names embedded in later
    // comparative-summary paragraphs, before filtering candidate blocks.
    const siblingNames = [...raw.matchAll(/\*\*([^*\n]{3,90})\*\*/g)]
      .map((match) => match[1].trim())
      .filter((name) => name && !has(name));
    return paragraphs
      .filter((paragraph) => {
        if (/^\s*\*\*[^*]{3,90}\*\*/.test(paragraph)) return has(paragraph);
        // Summary paragraphs that explicitly enumerate sibling territory
        // names are comparative set evidence, not evidence for the selected
        // proposition. They belong in rejection records, never in its own
        // distinctiveness appendix card.
        const paragraphKey = smpKey(paragraph);
        const siblingMentions = siblingNames.filter((name) => paragraphKey.includes(smpKey(name))).length;
        return siblingMentions === 0;
      })
      .join("\n\n")
      .trim();
  }
  return raw;
}


/**
 * Some stages are organised by theme rather than by candidate: each themed
 * heading contains one paragraph per proposition, in generation order. The
 * block reorder cannot help there, so within every heading section the
 * paragraph that names the selected proposition is moved to the front.
 */
function promoteParagraphs(raw: string, has: (s: string) => boolean): string {
  const lines = raw.split("\n");
  const headIdx: number[] = [];
  lines.forEach((l, i) => {
    if (/^\s*#{1,6}\s+\S/.test(l)) headIdx.push(i);
  });
  if (!headIdx.length) return raw;

  const out: string[] = lines.slice(0, headIdx[0]);
  headIdx.forEach((start, n) => {
    const end = headIdx[n + 1] ?? lines.length;
    const heading = lines[start];
    const body = lines.slice(start + 1, end).join("\n");
    const paras = body.split(/\n\s*\n/);
    // Only sections that enumerate several named candidates qualify.
    const named = paras.filter((p) => /^\s*\*\*[^*]{3,90}\*\*/.test(p.trim()));
    if (named.length >= 2) {
      const hit = paras.findIndex((p) => /^\s*\*\*[^*]{3,90}\*\*/.test(p.trim()) && has(p.split("\n")[0]));
      if (hit > 0) {
        const reordered = [paras[hit], ...paras.filter((_, i) => i !== hit)];
        out.push(heading, "", reordered.join("\n\n").replace(/^\n+/, ""));
        return;
      }
    }
    out.push(heading, body);
  });
  return out.join("\n");
}

/**
 * Names the selected proposition also travels under: the FIELD/territory
 * label recorded alongside it in the pipeline transcripts. Used so stages
 * that never repeat the proposition line can still be scoped to it.
 */
export function selectedAliases(session: MintoSession): string[] {
  const smpKeyed = smpKey(clean(session.selected_smp));
  if (smpKeyed.length < 6) return [];
  const haystack = [
    clean(session.stage_10_output),
    clean(session.stage_12_output),
    clean(session.stage_8_output),
  ].join("\n");
  const out = new Set<string>();
  for (const line of haystack.split("\n")) {
    const m = line.match(/SMP\s*\d*\s*:\s*["“'”]?(.+?)["“'”]?\s*[—–-]\s*FIELD:\s*(.+?)\s*$/i);
    if (!m) continue;
    if (!smpKey(m[1]).includes(smpKeyed) && !smpKeyed.includes(smpKey(m[1]))) continue;
    const field = m[2].replace(/\*+/g, "").trim();
    if (field.length >= 6) out.add(field);
  }
  return [...out];
}





/** Text under a heading-ish marker, up to the next marker. */
export function blockAfter(text: string, marker: RegExp): string {
  const lines = text.split("\n");
  const start = lines.findIndex((l) => marker.test(l));
  if (start === -1) return "";
  const body: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i];
    if (/^\s*(SECTION\s+\d|#{1,4}\s|={3,}|-{3,})/.test(l) && body.join("").trim()) break;
    body.push(l);
    if (body.length > 60) break;
  }
  return body.join("\n").trim();
}

export function bullets(text: string, limit: number): string[] {
  const out: string[] = [];
  for (const raw of text.split("\n")) {
    const m = raw.trim().match(/^[-—•]\s+(.{20,})$/);
    if (!m) continue;
    out.push(m[1].replace(/\s+/g, " "));
    if (out.length >= limit) break;
  }
  return out;
}

/* ──────────────────────────────────────────── Stage 10 score parsing ── */

export interface ScoredCandidate {
  name: string;
  composite: number | null;
  verdict: "PASS" | "FAIL" | null;
  verdictNote: string;
  dims: Record<string, number>;
}

export const DIMENSIONS = STRATEGY_SCORING_DIMENSION_NAMES;

export function parseScoredCandidates(stage10: string): ScoredCandidate[] {
  const out: ScoredCandidate[] = [];
  let current: ScoredCandidate | null = null;
  const push = () => {
    if (current && current.name) out.push(current);
  };
  for (const raw of stage10.split("\n")) {
    // Markdown emphasis and heading markers are cosmetic; strip them before
    // matching so a re-scored block written as `**Fame:** 7/10` parses
    // identically to the plain `Fame: 7/10` the original pass emits.
    const line = raw.trim().replace(/^#{1,6}\s*/, "").replace(/\*\*/g, "").trim();
    const smp = line.match(/^SMP:\s*[""“”"']?(.+?)[""“”"']?\s*(?:—\s*FIELD:.*)?$/i);
    if (smp) {
      push();
      current = { name: smp[1].trim(), composite: null, verdict: null, verdictNote: "", dims: {} };
      continue;
    }
    if (!current) continue;
    for (const dim of DIMENSIONS) {
      const m = line.match(new RegExp(`^${dim}\\s*:\\s*(\\d+(?:\\.\\d+)?)\\s*/\\s*10`, "i"));
      if (m) current.dims[dim] = Number(m[1]);
    }
    const comp = line.match(/CODE COMPOSITE:\s*(\d+(?:\.\d+)?)\s*\/\s*100/i);
    if (comp) current.composite = Number(comp[1]);
    const verdict = line.match(/CODE VERDICT:\s*(PASS|FAIL|ELIMINATED)\s*(?:—\s*(.*))?/i);
    if (verdict) {
      const v = verdict[1].toUpperCase();
      current.verdict = v === "PASS" ? "PASS" : "FAIL";
      current.verdictNote = (verdict[2] ?? "").trim();
    }
  }
  push();
  // Re-scores are appended to the same Stage 10 output, so the same
  // proposition can appear twice. The last block wins; earlier values are
  // kept only where the later block is silent.
  const merged: ScoredCandidate[] = [];
  for (const c of out) {
    const prior = merged.findIndex((m) => normalise(m.name) === normalise(c.name));
    if (prior < 0) {
      merged.push(c);
      continue;
    }
    merged[prior] = {
      name: c.name,
      composite: c.composite ?? merged[prior].composite,
      verdict: c.verdict ?? merged[prior].verdict,
      verdictNote: c.verdictNote || merged[prior].verdictNote,
      dims: { ...merged[prior].dims, ...c.dims },
    };
  }
  return merged;
}

function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Stage outputs that enumerate several candidate propositions. Every document
 * builder must promote the locked proposition's block to the top of these
 * before condensing, or the section's subject is whichever candidate the
 * model happened to write first.
 */
export const CANDIDATE_STAGE_KEYS = new Set([
  "stage_7_output",
  "stage_8_output",
  "stage_9_output",
  "stage_10_output",
  "stage_11_output",
  "stage_12_output",
  "stage_13_output",
  "stage_14_output",
]);

function findWinner(candidates: ScoredCandidate[], smp: string): ScoredCandidate | null {
  // Exact match only. Substring matching used to attach a parent or sibling
  // proposition's Stage 10 score to a refined final line; that is forbidden.
  // If the locked SMP was never scored in its own right, no winner is
  // returned and every score slot renders "not independently scored".
  const target = normalise(smp);
  if (!target) return null;
  return candidates.find((c) => normalise(c.name) === target) ?? null;
}

/* ─────────────────────────────── score provenance (honest framing) ── */

/**
 * Stage 10 can carry two different kinds of score for the same session:
 *
 *  1. the competitive field — every candidate scored against each other in the
 *     original pass; and
 *  2. a re-score block appended later, after a human locked a refined
 *     expression of the winning territory at the judgement gate.
 *
 * A re-score is NOT a competitive result. No deliverable may present it as a
 * rank, a win, or a "cleared the field" number. This helper is the single
 * place that tells every document builder which kind of score it is holding.
 */
const RESCORE_MARKER =
  /^\s*=*\s*(?:stage\s*10\s*)?re[\s-]?score\b|locked proposition\s*re[\s-]?score|\bre[\s-]?score\s*[—-]\s*locked/im;

export interface SmpScoreProvenance {
  /** true when the selected SMP's only score comes from a post-lock re-score. */
  postSelection: boolean;
  /** Candidates scored in the original competitive pass. */
  competitive: ScoredCandidate[];
  /** Highest-scoring candidate of the genuine competitive field. */
  topCompetitive: ScoredCandidate | null;
  /** One-sentence plain-text statement of the accurate story ("" when clean). */
  sentence: string;
  /** Callout HTML for the accurate story ("" when clean). */
  html: string;
}

export function smpScoreProvenance(stage10: string, smp: string): SmpScoreProvenance {
  const empty: SmpScoreProvenance = {
    postSelection: false,
    competitive: parseScoredCandidates(stage10),
    topCompetitive: null,
    sentence: "",
    html: "",
  };
  const target = normalise(smp);
  if (!target || !stage10.trim()) return empty;

  const lines = stage10.split("\n");
  const markerAt = lines.findIndex((l) => RESCORE_MARKER.test(l));
  if (markerAt < 0) return empty;

  const competitive = parseScoredCandidates(lines.slice(0, markerAt).join("\n"));
  const topCompetitive =
    competitive
      .filter((c) => c.composite != null)
      .sort((a, b) => (b.composite ?? 0) - (a.composite ?? 0))[0] ?? null;
  const inCompetitiveField = competitive.some((c) => normalise(c.name) === target);
  if (inCompetitiveField || !competitive.length) {
    return { ...empty, competitive, topCompetitive };
  }

  const rank =
    topCompetitive && topCompetitive.composite != null
      ? `“${topCompetitive.name}” (${topCompetitive.composite}/100, the highest of ${competitive.length} candidate${
          competitive.length === 1 ? "" : "s"
        } in the scored field)`
      : "the highest-scoring candidate in the scored field";
  const sentence =
    `The territory behind “${smp}” was validated through genuine competitive scoring as ${rank
      .replace(/<[^>]+>/g, "")}. ` +
    `“${smp}” is the refined expression of that territory, locked by human judgement after the competitive pass closed. ` +
    `Any score shown against this exact wording is a post-lock re-score of the final line, not a competitive rank.`;
  const html = callout(
    "How this proposition was arrived at",
    `<p>The system explored and scored the field; a human made the final call. ` +
      `The territory question was settled competitively: ${rank
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")} carried the territory through the six-dimension framework against the full candidate set.</p>` +
      `<p><strong>${escapeHtml(smp)}</strong> is the refined, locked expression of that same territory, ` +
      `written at the human judgement gate after the competitive pass had closed. ` +
      `Where a score appears against this exact wording, it is a post-lock re-score of the final line ` +
      `against the same rubric — it is not a competitive result and does not rank it against the field.</p>`,
  );
  return { postSelection: true, competitive, topCompetitive, sentence, html };
}



/* ─────────────────────────────────────────────── appendix condensing ── */

/** Placeholder body for a canonical section with no stored output. */
export const NO_STAGE_OUTPUT = "No output was recorded for this stage in this session.";

export const PIPELINE_APPENDIX: Array<{ title: string; key: string }> = [
  { title: "Brief & Context", key: "stage_1_output" },
  { title: "Category Intelligence", key: "stage_2_output" },
  { title: "Strategic Frameworks", key: "stage_3_output" },
  { title: "Strategic Universes", key: "stage_4_output" },
  { title: "Insight Generation", key: "stage_5_output" },
  { title: "Insight Validation", key: "stage_6_output" },
  { title: "Territory Synthesis", key: "stage_7_output" },
  { title: "Proposition Generation", key: "stage_8_output" },
  { title: "Distinctiveness Check", key: "stage_9_output" },
  { title: "Proposition Scoring", key: "stage_10_output" },
  { title: "Integrity Testing", key: "stage_11_output" },
  { title: "Proposition Selection", key: "stage_12_output" },
  { title: "Brand Fit Validation", key: "stage_13_output" },
  { title: "Territory Mapping", key: "stage_14_output" },
  { title: "Coherence Audit", key: "stage_15_output" },
];

export const DETONATION_APPENDIX: Array<{ title: string; key: string }> = [
  { title: "Detonation Territory", key: "stage_17_selected_territory" },
  { title: "Detonation Intelligence", key: "stage_17b_output" },
  { title: "The Detonation", key: "stage_18_selected_detonation" },
  { title: "Activation Architecture", key: "stage_19_output" },
  { title: "Master Brief Detail", key: "stage_20_output" },
  { title: "Brand Architecture", key: "stage_22_brand_architecture" },
];

/** Process scaffolding that carries no evidence for a board reader. */
const SCAFFOLD_LINE =
  /^(ok[,.]|understood|here (is|are)|i('| wi)ll |let me |as requested|below (is|are)|note:|reminder:|continuing|proceeding|end of (stage|section)|word count|token|instruction)/i;

/** Run-count bookkeeping a model writes above its own output. */
export const BOOKKEEPING_LINE =
  /^\*{0,2}[A-Za-z][A-Za-z0-9/()-]*(?: [A-Za-z0-9/()-]+){1,8}:\s*\*{0,2}\s*\d+\s*\*{0,2}\s*(?:\([^)]{0,90}\))?\*{0,2}\s*$/;


/**
 * Condenses one stage output into appendix evidence: headings kept as
 * structure, the strongest substantive lines kept beneath them, everything
 * else dropped. Nothing is rewritten — lines are kept verbatim or cut.
 */
export function condenseStage(
  raw: string,
  opts: { maxUnits?: number; maxChars?: number } = {},
): string {
  const maxUnits = opts.maxUnits ?? 22;
  const maxChars = opts.maxChars ?? 2600;
  const out: string[] = [];
  let chars = 0;
  let units = 0;
  let sinceHeading = 0;

  const headingText = (line: string) => line.replace(/^#{1,4}\s+/, "").replace(/^\*\*(.*?)\*\*\s*(?:[—–-]\s*Validated)?\s*$/i, "$1").trim();
  const isHeading = (line: string) => {
    const unwrapped = headingText(line);
    return /^#{1,4}\s/.test(line) ||
      /^(SECTION|STAGE|PART)\b/i.test(unwrapped) ||
      /^\*\*[^*]{3,90}\*\*\s*(?:[—–-]\s*Validated)?\s*$/i.test(line) ||
      /^[A-Z0-9 .,'&()/–—-]{6,70}:?$/.test(unwrapped);
  };

  for (const rawLine of raw.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/^[=_*-]{3,}$/.test(line)) continue;
    if (SCAFFOLD_LINE.test(line) || BOOKKEEPING_LINE.test(line)) continue;

    if (isHeading(line)) {
      if (units >= maxUnits || chars >= maxChars) continue;
      if (out.length && out[out.length - 1].startsWith("### ")) out.pop();
      out.push(`### ${headingText(line).replace(/:$/, "")}`);
      sinceHeading = 0;
      continue;
    }
    if (units >= maxUnits || chars >= maxChars) continue;
    if (sinceHeading >= 4) continue;
    if (line.length < 25 && !/^[-—•]/.test(line)) continue;

    out.push(line);
    sinceHeading++;
    units++;
    chars += line.length;
  }
  while (out.length && out[out.length - 1].startsWith("### ")) out.pop();
  return out.join("\n\n");
}

export interface AppendixOptions {
  sections?: Array<{ title: string; key: string }>;
  mode?: "condensed" | "full" | "brief";
  intro?: string;
}

export function buildAppendix(session: MintoSession, opts: AppendixOptions = {}): string {
  const defs = opts.sections ?? PIPELINE_APPENDIX;
  const mode = opts.mode ?? "condensed";
  const budget =
    mode === "brief" ? { maxUnits: 8, maxChars: 900 } : { maxUnits: 22, maxChars: 2600 };

  // Stages that enumerate several candidate propositions. Condensing reads
  // from the top, so the selected proposition's block is promoted first;
  // otherwise the appendix evidences a candidate the document did not choose.
  const CANDIDATE_STAGES = CANDIDATE_STAGE_KEYS;

  const selectedSmp = clean(session.selected_smp).trim();
  const aliases = selectedAliases(session);

  const blocks = defs
    .map((s, i) => {
      let raw = clean((session as Record<string, unknown>)[s.key]);
      if (s.key === "stage_9_output") raw += `\n${clean(session.stage_9_leftofcentre_output)}`;
      raw = stripInternals(raw);
      // Run-count bookkeeping is never evidence, in either appendix mode.
      raw = raw
        .split("\n")
        .filter((l) => !BOOKKEEPING_LINE.test(l.trim()))
        .join("\n");

      const card = (inner: string) =>
        `<div class="section keep-together"><p class="kicker"><span class="idx">${String(
          i + 1,
        ).padStart(2, "0")}</span>${escapeHtml(s.title)}</p>${inner}</div>`;

      // A canonical card is never dropped. Dropping one silently renumbered
      // the appendix and is how "Brand Fit Validation" disappeared from a
      // document that still reported complete.
      if (!raw.trim()) return card(`<p class="minto-missing">${escapeHtml(NO_STAGE_OUTPUT)}</p>`);

      const scoped = CANDIDATE_STAGES.has(s.key)
        ? scopeToSelected(raw, selectedSmp, aliases)
        : raw;
      // Scoping to the locked proposition must never empty a stage that has
      // real evidence: fall back to the unscoped transcript rather than
      // rendering nothing.
      const source = scoped.trim() ? scoped : raw;
      let body = mode === "full" ? source : condenseStage(source, budget);
      if (!body.trim()) body = condenseStage(raw, { maxUnits: 6, maxChars: 700 });
      if (!body.trim()) {
        return card(`<p class="minto-missing">${escapeHtml(NO_STAGE_OUTPUT)}</p>`);
      }

      return card(renderMarkdown(body));
    })
    .filter(Boolean);


  if (!blocks.length) return "";
  const intro =
    opts.intro ??
    (mode === "full"
      ? "Every stage output behind the recommendation above, in pipeline order. The front matter is the decision; this is the evidence."
      : "The load-bearing evidence from each validation stage, in pipeline order. Cut to what supports the decision; the complete transcripts remain in the session record.");
  return `<p>${escapeHtml(intro)}</p>` + blocks.join("\n");
}

/* ───────────────────────────────────────────────────── derivation ── */

export interface DerivedMinto {
  brand: string;
  category: string;
  smp: string;
  candidates: ScoredCandidate[];
  winner: ScoredCandidate | null;
  stagesRun: number;
  /** Room 04 lock block — locked campaign line and winning idea, or "". */
  lockedIdeaHtml: string;
  headlineStats: Stat[];
  content: MintoContent;
}

export interface DeriveOptions {
  appendix?: AppendixOptions;
  /** Extra HTML appended inside the "why this wins" section. */
  extraWhyHtml?: string;
}

/* ─────────────────────── "why this wins" evidence (shared) ─────────── */

function tidy(s: string): string {
  return s
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function smpKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Stage 11 pressure tests recorded against the selected proposition.
 * Handles both "Test 1 — Name: VERDICT" headings and "Verdict: X — reason"
 * lines beneath them. Returns [] when Stage 11 never tested this line
 * (which happens when the proposition was refined after Stage 11).
 */
function stage11TestReasons(s11: string, smp: string): Reason[] {
  if (!s11 || !smp) return [];
  const key = smpKey(smp);
  if (key.length < 6) return [];
  const lines = s11.split("\n");
  const isHeader = (l: string) => /^\s*(#{2,4}\s*)?\*{0,2}SMP:/i.test(l);
  // Last matching block wins: a re-score is appended after the original.
  const start = lines.reduce(
    (acc, l, i) => (isHeader(l) && smpKey(tidy(l)).includes(key) ? i : acc),
    -1,
  );
  if (start < 0) return [];
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (isHeader(lines[i])) {
      end = i;
      break;
    }
  }
  const block = lines.slice(start + 1, end);
  const out: Reason[] = [];
  for (let i = 0; i < block.length && out.length < 3; i++) {
    const h = tidy(block[i]).replace(/^#{1,4}\s*/, "");
    const m = h.match(/^Test\s*\d+\s*[—–-]\s*([^:]{3,60}):\s*([A-Z][A-Z/ ()-]{1,30})(?:\s*[—–-]\s*(.*))?$/);
    if (!m) continue;
    let detail = tidy(m[3] ?? "");
    for (let j = i + 1; j < Math.min(i + 6, block.length) && detail.length < 40; j++) {
      const c = tidy(block[j]);
      if (!c || /^Test\s*\d+/i.test(c)) break;
      detail = `${detail} ${c.replace(/^Verdict:\s*/i, "")}`.trim();
    }
    if (!detail) continue;
    out.push({
      title: `${m[1].trim()} — ${m[2].trim().toLowerCase()}`,
      detail: detail.slice(0, 260),
    });
  }
  return out;
}

/**
 * Stage 13 brand-fit verdict plus its credibility dimension scores.
 * This is the fallback authority for "why this wins" when the recommended
 * proposition post-dates Stage 10 scoring and Stage 11 pressure testing.
 */
function stage13Reasons(s13: string): Reason[] {
  if (!s13) return [];
  const out: Reason[] = [];
  const lines = s13.split("\n");
  const verdictIdx = lines.findIndex((l) => /Brand Fit Verdict/i.test(l));
  if (verdictIdx >= 0) {
    const headline = lines
      .slice(verdictIdx + 1, verdictIdx + 4)
      .map(tidy)
      .find((l) => /^[A-Z][A-Z ,—–-]{6,}/.test(l));
    const rationale = lines
      .slice(verdictIdx + 1, verdictIdx + 10)
      .map(tidy)
      .find((l) => l.length > 120);
    if (headline || rationale) {
      out.push({
        title: headline ? `Brand fit — ${headline.replace(/\.$/, "").toLowerCase()}` : "Brand fit confirmed",
        detail: (rationale ?? headline ?? "").slice(0, 300),
      });
    }
  }
  for (const raw of lines) {
    if (out.length >= 4) break;
    const c = tidy(raw).replace(/^[-•*]\s*/, "");
    const m = c.match(/^([A-Z][A-Za-z /-]{4,44})\s*[—–-]\s*(\d{1,2})\s*\/\s*10\.?\s*(.*)$/);
    if (!m || !m[3] || m[3].length < 30) continue;
    out.push({ title: `${m[1].trim()} ${m[2]}/10`, detail: m[3].slice(0, 260) });
  }
  return out;
}

export function deriveMintoContent(session: MintoSession, opts: DeriveOptions = {}): DerivedMinto {
  const brand = (session.brand_name ?? "Untitled Brand").trim();
  const category = (session.category ?? "").trim();
  const smp = clean(session.selected_smp).trim();

  const s1 = stripInternals(clean(session.stage_1_output));
  const s5 = clean(session.stage_5_output);
  const s10 = clean(session.stage_10_output);
  const s11 = clean(session.stage_11_output);
  const s12 = clean(session.stage_12_output);
  const s13 = clean(session.stage_13_output);
  const s14 = clean(session.stage_14_output);
  const s15 = clean(session.stage_15_output);

  const candidates = parseScoredCandidates(s10);
  const provenance = smpScoreProvenance(s10, smp);
  const winner = findWinner(candidates, smp);
  const passed = candidates.filter((c) => c.verdict === "PASS");
  const rejected = candidates.filter((c) => c !== winner);

  const stagesRun = PIPELINE_APPENDIX.filter((s) =>
    String((session as Record<string, unknown>)[s.key] ?? "").trim(),
  ).length;

  /* Room 04 lock — authoritative campaign line and winning idea. Stage 14/15
   * text predates the lock, so the lock is stated first and verbatim. */
  const lockedLine = (session.locked_campaign_line ?? "").trim();
  const lockedIdea = clean(session.locked_big_idea).trim();
  const lockedLens = (session.locked_big_idea_lens ?? "").trim();
  const lockedIdeaHtml =
    lockedLine || lockedIdea
      ? (lockedLine
          ? pullQuote(lockedLine, {
              label: lockedLens ? `Locked campaign line — ${lockedLens}` : "Locked campaign line",
            })
          : "") +
        (lockedIdea
          ? callout(
              lockedLens ? `Locked creative idea — ${lockedLens}` : "Locked creative idea",
              // Verbatim and complete: the winning Room 04 idea is never
              // truncated or summarised in any deliverable.
              renderMarkdown(lockedIdea),
            )
          : "")

      : "";

  const sourceStamp = session.locked_big_idea_at
    ? `Room 04 winning idea resolved from the locked run at ${new Date(session.locked_big_idea_at).toLocaleString("en-AU")}${session.locked_big_idea_run_id ? ` · run ${escapeHtml(session.locked_big_idea_run_id.slice(0, 8))}` : ""}.`
    : `No Room 04 winning idea was locked when this document was rendered.`;



  /* 01 — recommendation */
  const recommendation = smp
    ? pullQuote(smp, { label: "The recommendation", variant: "hero" })
    : "";

  const headlineStats: Stat[] = [];
  if (winner?.composite != null) {
    headlineStats.push({
      value: winner.composite,
      suffix: "/100",
      label: provenance.postSelection ? "Locked line — post-lock re-score" : "Recommended SMP score",
      note: provenance.postSelection
        ? "Re-score of the final wording after the competitive pass closed. Not a competitive rank."
        : "Weighted composite across six scoring dimensions.",
    });
  }
  if (provenance.postSelection && provenance.topCompetitive?.composite != null) {
    headlineStats.push({
      value: provenance.topCompetitive.composite,
      suffix: "/100",
      label: "Territory — competitive score",
      note: `“${provenance.topCompetitive.name}” carried this territory through the scored field.`,
    });
  }
  const scoredCount = provenance.postSelection ? provenance.competitive.length : candidates.length;
  if (scoredCount) {
    headlineStats.push({
      value: scoredCount,
      label: "Propositions competitively scored",
      note: `${passed.length} cleared the hard floors.`,
    });
  }
  headlineStats.push({
    value: stagesRun,
    label: "Validation stages run",
    note: "Each stage is evidenced in the appendix.",
  });

  /* 02 — background and context. Stated plainly every time: what this is,
   * where it came from, and what decision it serves. */
  const background =
    `<p>This document was generated by the Brand Grenade Strategy Intelligence System for <strong>${escapeHtml(
      brand,
    )}</strong>${category ? ` in the ${escapeHtml(category)} category` : ""}. It is assembled entirely from one strategy session: ${stagesRun} validation stage${
      stagesRun === 1 ? "" : "s"
    } were run and are reproduced in the appendix, ${scoredCount || "no"} proposition${
      scoredCount === 1 ? "" : "s"
    } were generated and competitively scored, and the recommendation above is ${
      provenance.postSelection
        ? "the locked expression of the territory that survived that process — refined by human judgement after the scoring pass closed"
        : "the one that survived that process"
    }.</p>` +

    `<p>Nothing here is written from outside the session. Where a stage produced no output, the section says so rather than filling the gap.</p>` +
    `<p>It serves one decision: whether to adopt the recommended Single-Minded Proposition and release it into creative development. The argument is ordered to that decision — recommendation first, evidence behind it, and the action requested at the end.</p>`;

  /* 03 — business issue */
  const issueSource = blockAfter(s12, /SECTION\s+1\s*[—-]\s*PRESENTATION CONTEXT/i) || s1;
  const issueParas = prose(issueSource, 2);
  const business_issue = issueParas.length
    ? issueParas.map((p) => `<p>${inlineMd(p)}</p>`).join("")
    : renderMarkdown(issueSource.slice(0, 1800));


  /* 03 — key insight */
  const insightSource = blockAfter(s5, /INSIGHT|^##/i) || s5;
  const insightParas = prose(insightSource, 1);
  const key_insight = insightParas.length
    ? pullQuote(insightParas[0], { label: "The insight it rests on", variant: "quiet" })
    : renderMarkdown(insightSource.slice(0, 1200));

  /* 04 — proposition. Scores shown here belong to this exact proposition or
   * are not shown at all; a parent/earlier-stage line's score is never used. */
  const winnerVerdictHtml = winner
    ? callout(
        provenance.postSelection ? "Post-lock re-score of the final wording" : "Stage 10 verdict",
        `<p><strong>${winner.verdict === "FAIL" ? "ELIMINATED" : (winner.verdict ?? "PASS")}</strong>${
          winner.composite != null
            ? ` · ${provenance.postSelection ? "re-score" : "composite"} ${winner.composite}/100 across the six-dimension framework`
            : ""
        }.${winner.verdictNote ? ` ${escapeHtml(winner.verdictNote)}` : ""}</p>${
          provenance.postSelection
            ? `<p>This number was produced after the competitive pass closed, against the locked wording alone. It is not a rank against the field.</p>`
            : ""
        }`,
      )
    : "";
  const proposition = smp
    ? pullQuote(smp, { label: "Single-Minded Proposition" }) +
      (winner
        ? statGrid(
            DIMENSIONS.filter((d) => winner.dims[d] != null).map((d) => ({
              value: winner.dims[d],
              suffix: "/10",
              label: d,
            })),
            3,
          ) + winnerVerdictHtml
        : candidates.length
          ? callout(
              "Not independently scored",
              `<p>This proposition was finalised after the Stage 10 scoring pass, so it carries no composite of its own. No earlier proposition's score is substituted here; the scored candidate set appears in the validation section.</p>`,
            )
          : "") +
      provenance.html
    : "";

  /* 05 — why this wins */
  const runnerUp = candidates
    .filter((c) => c !== winner && c.composite != null)
    .sort((a, b) => (b.composite ?? 0) - (a.composite ?? 0))[0];
  const whyReasons: Reason[] = [];
  if (provenance.postSelection && provenance.topCompetitive?.composite != null) {
    whyReasons.push({
      title: "The territory was won competitively",
      detail: `“${provenance.topCompetitive.name}” scored ${provenance.topCompetitive.composite}/100 against ${provenance.competitive.length} candidates in the scored field. The locked line is the refined expression of that territory, chosen by human judgement at the selection gate.`,
    });
  }
  if (winner) {
    const strongest = Object.entries(winner.dims).sort((a, b) => b[1] - a[1])[0];
    if (strongest) {
      whyReasons.push({
        title: `Strongest on ${strongest[0].toLowerCase()}`,
        detail: `Scores ${strongest[1]}/10 on the dimension that carries the campaign.`,
      });
    }
    if (!provenance.postSelection && runnerUp?.composite != null && winner.composite != null) {
      whyReasons.push({
        title: "Clears the field",
        detail: `“${smp}” scores ${winner.composite}/100 against ${runnerUp.composite}/100 for the next-best candidate (${runnerUp.name}).`,
      });
    }

  }
  // Stage 11 — pressure tests recorded against the selected proposition.
  for (const r of stage11TestReasons(s11, smp)) whyReasons.push(r);
  // The integrity line must come from the selected proposition's own Stage 11
  // block, never from the top of the transcript (which is bookkeeping, or
  // another candidate's testing).
  const integrityLine = prose(orderBySelected(s11, smp), 1)[0];
  if (integrityLine && !isScaffoldProse(integrityLine)) {
    whyReasons.push({ title: "Survives integrity testing", detail: integrityLine.slice(0, 260) });
  }

  const why_this_wins =
    (whyReasons.length
      ? reasonGrid(whyReasons.slice(0, 6))
      : "") + (opts.extraWhyHtml ?? "");

  /* 07 — current state versus recommended change. Existing activity is quoted
   * from the session's own brief and brand-architecture inputs; the asks are
   * the activation lines the recommendation carries. Nothing is invented — if
   * the session recorded no current activity, the section says so. */
  const current_state = buildCurrentStateSection({
    brand,
    evidence: [
      { label: "Session brief and category context (Stage 1)", text: s1 },
      { label: "Insight and evidence base (Stage 5)", text: s5 },
      {
        label: "Current brand architecture (Stage 22)",
        text: clean(session.stage_22_brand_architecture),
      },
      {
        label: "Current distinctive assets (Stage 22)",
        text: clean(session.stage_22_distinctive_assets),
      },
    ].filter((e) => e.text.trim()),
    proposedActions: [...bullets(s14, 6), ...bullets(s15, 6)].slice(0, 8),
  });

  /* 08 — validation summary. When the locked line was written after the
   * competitive pass, the table is the genuine competitive field only — the
   * post-lock re-score is reported separately so it can never read as a rank. */
  const tableCandidates = provenance.postSelection ? provenance.competitive : candidates;
  const tableRows: CmpRow[] = tableCandidates
    .slice()
    .sort((a, b) => (b.composite ?? -1) - (a.composite ?? -1))
    .slice(0, 12)
    .map((c) => ({
      win: provenance.postSelection ? c === provenance.topCompetitive : c === winner,
      cells: {
        name: c.name,
        fame: c.dims["Fame"],
        truth: c.dims["Truth Strength"],
        impossibility: c.dims["Competitive Impossibility"],
        permission: c.dims["Brand Permission"],
        cleanAir: c.dims["Clean Air"],
        precedent: c.dims["Commercial Precedent"],
        composite: c.composite,
        verdict: c.verdict === "FAIL" ? "ELIMINATED" : (c.verdict ?? ""),
      },
    }));
  const validationTable = comparisonTable(
    [
      { key: "name", label: "Proposition" },
      { key: "fame", label: "Fame", numeric: true },
      { key: "truth", label: "Truth", numeric: true },
      { key: "impossibility", label: "Impossibility", numeric: true },
      { key: "permission", label: "Permission", numeric: true },
      { key: "cleanAir", label: "Clean air", numeric: true },
      { key: "precedent", label: "Precedent", numeric: true },
      { key: "composite", label: "Score /100", numeric: true },
      { key: "verdict", label: "Verdict" },
    ],
    tableRows,
    provenance.postSelection
      ? "Competitively scored field — highlighted row carried the winning territory"
      : winner
        ? "Scored candidate set — highlighted row is the recommendation"
        : "Scored candidate set — Stage 10 scoring, ranked",
  );
  const selectionNote =
    !winner && smp && candidates.length
      ? callout(
          "How the recommendation relates to this set",
          `<p>The recommended proposition was resolved at selection, after the scored set above was tested for integrity and brand fit. It is not a row in the Stage 10 table.</p>`,
        )
      : "";
  const validation =
    (validationTable || renderMarkdown(s10.slice(0, 2000)) || "") +
    provenance.html +
    (provenance.postSelection && winner?.composite != null
      ? callout(
          "Re-score of the locked line",
          `<p>“${escapeHtml(smp)}” was re-scored against the same rubric after locking: <strong>${winner.composite}/100</strong>. ` +
            `That number measures the final wording in isolation. It was never in the competitive field above and is not a rank against it.</p>`,
        )
      : "") +
    selectionNote;


  /* 07 — rejected */
  const isFailureNote = (n?: string) =>
    !!n && /fail|reject|below|does not|doesn't|not carried|weak|breach/i.test(n);
  const rationaleText = (() => {
    const raw = session.selection_rationale;
    if (!raw) return "";
    if (typeof raw === "string") return raw;
    try { return JSON.stringify(raw); } catch { return ""; }
  })();
  const liveReasonFor = (name: string): string | null => {
    if (!rationaleText) return null;
    const key = normalise(name);
    const entries = typeof session.selection_rationale === "object" && session.selection_rationale
      ? Object.entries(session.selection_rationale as Record<string, unknown>)
      : [];
    const hit = entries.find(([k, value]) => {
      const haystack = normalise(`${k} ${typeof value === "string" ? value : JSON.stringify(value)}`);
      return key.length > 5 && (haystack.includes(key) || key.includes(haystack.slice(0, key.length)));
    });
    if (!hit) return null;
    const value = hit[1];
    if (typeof value === "string") return value;
    if (value && typeof value === "object") {
      const row = value as Record<string, unknown>;
      const reason = row.reason ?? row.rationale ?? row.note ?? row.rejection_reason;
      return typeof reason === "string" ? reason : null;
    }
    return null;
  };
  const rejectReasons: Reason[] = rejected
    .slice()
    .sort((a, b) => (a.composite ?? 999) - (b.composite ?? 999))
    .slice(0, 4)
    .map((c) => {
      const weakest = Object.entries(c.dims).sort((a, b) => a[1] - b[1])[0];
      const currentSelectionReason = liveReasonFor(c.name);
      const detail = currentSelectionReason
        ? currentSelectionReason
        : isFailureNote(c.verdictNote)
        ? (c.verdictNote as string)
        : weakest
          ? `Not carried forward. Weakest on ${weakest[0].toLowerCase()} (${weakest[1]}/10)${
              c.composite != null ? ` · ${c.composite}/100 composite` : ""
            }.`
          : "Not carried forward at selection.";
      return { title: c.name, detail };
    });
  // Shared fallback: when Stage 10 carries only the selected proposition (a
  // re-scored session, or a line resolved after the scoring pass), the
  // considered-and-set-aside field lives in the Stage 12 shortlist. Every
  // document type reads it from here, so no document can fall through to the
  // "no rejected alternatives" placeholder while a real field exists.
  if (!rejectReasons.length) {
    // A Stage 12 pressure-test note is not always set-aside reasoning; it can
    // read as endorsement of a line that was in fact carried forward. Only
    // genuine rejection reasoning is admitted here.
    const readsAsRejection = (n: string) =>
      /not\s|never|fail|weak|narrow|risk|limit|thin|lack|misses|breach|too\s|cannot|struggle|reject|set aside|second|less/i.test(
        n,
      ) && !/^carried forward|is carried forward|selected as|chosen as/i.test(n.trim());
    for (const item of extractShortlist(s12, { selectedSmp: smp, stage11: s11 })) {
      if (item.selected || !item.proposition) continue;
      const note = (item.setAsideReason ?? "").trim();
      rejectReasons.push({
        title: item.proposition,
        detail:
          note && readsAsRejection(note)
            ? `Not carried forward: ${note}`
            : "Considered at selection and set aside — the recommended proposition tested stronger against the Stage 10 framework.",
      });
      if (rejectReasons.length >= 4) break;
    }
  }
  const rejectedHtml = rejectReasons.length ? reasonGrid(rejectReasons) : "";

  /* 08 — implications */
  const implicationItems = bullets(s14, 5).length ? bullets(s14, 5) : bullets(s15, 5);
  const brandArchitecture = (session.stage_22_brand_architecture ?? "").trim();
  const distinctiveAssets = (session.stage_22_distinctive_assets ?? "").trim();
  const implications =
    lockedIdeaHtml +
    (implicationItems.length
      ? `<ul>${implicationItems.map((b) => `<li>${inlineMd(b)}</li>`).join("")}</ul>`
      : renderMarkdown((s14 || s15).slice(0, 1600))) +
    (brandArchitecture
      ? callout("Current brand architecture", renderMarkdown(brandArchitecture.slice(0, 1400)))
      : "") +
    (distinctiveAssets
      ? callout("Current distinctive assets", renderMarkdown(distinctiveAssets.slice(0, 1000)))
      : "");


  /* 09 — next step */
  const nextCandidates = [
    ...bullets(blockAfter(s15, /NEXT STEP|RECOMMENDED ACTION|IMMEDIATE/i), 3),
    ...bullets(blockAfter(s14, /NEXT STEP|RECOMMENDED ACTION|ACTIVATION/i), 3),
  ].slice(0, 3);
  const decisionAsk = smp
    ? `<p>The decision requested is a single one: adopt <strong>${escapeHtml(
        smp,
      )}</strong> as the Single-Minded Proposition for ${escapeHtml(brand)}, and release it into creative development.</p>`
    : "";
  const next_step =
    decisionAsk +
    (nextCandidates.length
      ? `<ul>${nextCandidates.map((b) => `<li>${inlineMd(b)}</li>`).join("")}</ul>`
      : "") +
    callout(
      "On approval",
      `<p>Sign-off releases the proposition to the Detonation phase — territory, activation architecture and channel briefs are generated against this proposition and no other.</p>`,
    );

  /* 10 — appendix */
  const appendix =
    buildAppendix(session, opts.appendix) +
    callout("Source authority", `<p>${sourceStamp}</p><p>Strategic stage outputs in the appendix are historical snapshots. The selected SMP and Room 04 lock above are resolved from their current authoritative fields at render time.</p>`) +
    proofLine({
      stagesRun,
      documents: stagesRun ? PIPELINE_APPENDIX.length : undefined,
      extra: candidates.length ? `${candidates.length} propositions scored` : undefined,
    });

  return {
    brand,
    category,
    smp,
    candidates,
    winner,
    stagesRun,
    lockedIdeaHtml,
    headlineStats,
    content: {
      recommendation,
      background,

      business_issue,
      key_insight,
      proposition,
      why_this_wins,
      current_state,
      validation,
      rejected: rejectedHtml,
      implications,
      next_step,
      appendix,
    },
  };
}

/** Structured client-facing outputs produced by a full run (pipeline + detonation appendices). */
export const STRUCTURED_OUTPUT_COUNT =
  PIPELINE_APPENDIX.length + DETONATION_APPENDIX.length;
