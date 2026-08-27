import { cleanProposition } from "@/lib/clean-proposition";
// Strategy Executive Summary — section extraction layer.
//
// Deterministic only. No AI, no summarisation, no invented sentences. Every
// value returned here is lifted verbatim (or trimmed to whole sentences) out
// of text already stored on the session row. Where a value cannot be found,
// the extractor returns null/empty and the document renders the explicit
// "not available for this session" line for that item.

import { STAGE_MANIFEST } from "./pipeline-integrity";
import { TOTAL_PIPELINE_STEPS } from "./stage-manifest";

export type ExecSessionRow = Record<string, unknown>;

/* ── shared helpers ─────────────────────────────────────────────── */

export function clean(line: string): string {
  return (line ?? "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/~~/g, "")
    .replace(/\*\*/g, "")
    .replace(/(^|\s)\*(\S[^*]*?)\*(?=\s|$|[.,;:)])/g, "$1$2")
    .replace(/(^|\s)_(\S[^_]*?)_(?=\s|$|[.,;:)])/g, "$1$2")
    .replace(/```+/g, "")
    .replace(/`/g, "")
    .replace(/^[>\s]+/, "")
    .replace(/^\s*#{1,6}\s*/, "")
    .replace(/\|/g, " ")
    .replace(/[═─━]{3,}/g, "")
    .replace(/^\s*[-*_]{3,}\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/* ── deduplication ──────────────────────────────────────────────── */

/** Split a passage into whole sentences (markdown already stripped). */
export function splitSentences(text: string | null | undefined): string[] {
  return sentences(text ?? "");
}

export interface Deduper {
  /** Register text as spoken; nothing later may repeat these sentences. */
  claim(text: string | null | undefined): void;
  /** Return only the sentences not already spoken, and claim them. */
  take(text: string | null | undefined, max?: number): string | null;
  /** True when a short line (label, bullet, quote) has not been used yet. */
  fresh(line: string | null | undefined): boolean;
}

export function createDeduper(): Deduper {
  const seen = new Set<string>();
  const key = (s: string) => matchKey(s).slice(0, 90);
  const overlaps = (k: string) => {
    if (!k) return true;
    if (seen.has(k)) return true;
    for (const s of seen) {
      if (k.length >= 24 && s.length >= 24 && (s.includes(k) || k.includes(s))) return true;
    }
    return false;
  };
  return {
    claim(text) {
      for (const s of sentences(text ?? "")) seen.add(key(s));
    },
    take(text, max) {
      const kept: string[] = [];
      for (const s of sentences(text ?? "")) {
        const k = key(s);
        if (overlaps(k)) continue;
        seen.add(k);
        kept.push(s);
        if (max && kept.length >= max) break;
      }
      const out = kept.join(" ").trim();
      return out.length >= 20 ? out : null;
    },
    fresh(line) {
      const c = clean(line ?? "");
      if (!c) return false;
      const k = key(c);
      if (overlaps(k)) return false;
      seen.add(k);
      return true;
    },
  };
}

export function matchKey(s: string): string {
  return clean(s)
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sentences(text: string): string[] {
  const c = clean(text);
  if (!c) return [];
  const raw = (c.match(/[^.?!]+[.?!]["'”’)]?/g) ?? [c]).map((s) => s.trim()).filter(Boolean);
  // A full stop inside a quoted phrase — e.g. Westpac could deploy "Build
  // equity. Build wealth." — is not a sentence boundary. Re-join fragments
  // until the quote marks balance so nothing is published mid-quotation.
  const out: string[] = [];
  for (const piece of raw) {
    const prev = out.length ? out[out.length - 1] : null;
    const unbalanced = (s: string) => ((s.match(/["“”]/g) ?? []).length % 2) === 1;
    if (prev && unbalanced(prev)) out[out.length - 1] = `${prev} ${piece}`;
    else out.push(piece);
  }
  return out;
}


/** First `n` whole sentences of a passage, markdown stripped. */
export function firstSentencesOf(text: string | null | undefined, n: number): string | null {
  if (!text) return null;
  const flat = plainText(text).split("\n").filter((l) => !/^(section|stage)\s+\d/i.test(l)).join(" ");
  const out = sentences(flat).slice(0, n).join(" ").trim();
  return out.length >= 20 ? out : null;
}

function str(session: ExecSessionRow, key: string): string {
  const v = session[key];
  return typeof v === "string" ? v : "";
}

/** Paragraph text under a markdown heading matching `re`, up to the next heading. */
function headingBlock(text: string, re: RegExp): string[] {
  if (!text) return [];
  const lines = text.split("\n");
  const start = lines.findIndex((l) => /^#{1,4}\s/.test(l) && re.test(l));
  if (start < 0) return [];
  const out: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^#{1,4}\s/.test(lines[i])) break;
    if (/^-{3,}$/.test(lines[i].trim())) break;
    const c = clean(lines[i]);
    if (c) out.push(c);
  }
  return out;
}

/* ── 02 — The Business Issue ────────────────────────────────────── */

export function extractBusinessIssue(
  session: ExecSessionRow,
  intelTension?: string | null,
): string | null {
  const s1 = str(session, "stage_1_output");
  const underlying = headingBlock(s1, /Underlying Strategic Problem/i).join(" ");
  const fromS1 = firstSentencesOf(underlying, 3);
  if (fromS1) return fromS1;

  const s12 = str(session, "stage_12_output");
  const ctxIdx = s12.indexOf("PRESENTATION CONTEXT");
  if (ctxIdx >= 0) {
    const body = s12
      .slice(ctxIdx + "PRESENTATION CONTEXT".length, ctxIdx + 2600)
      .split("\n")
      .map(clean)
      .filter(Boolean)
      .join(" ");
    const fromS12 = firstSentencesOf(body, 3);
    if (fromS12) return fromS12;
  }
  return firstSentencesOf(intelTension ?? null, 3);
}

/* ── 03 — Research ──────────────────────────────────────────────── */

export interface ResearchItem {
  label: string;
  body: string;
}

/**
 * Line-by-line markdown strip. Headings, rules, table pipes and bullet
 * markers are removed before any sentence splitting so no raw syntax can
 * survive into the rendered document.
 */
function plainText(text: string): string {
  return (text ?? "")
    .split("\n")
    .map((l) => clean(l).replace(/^\s*[-*+•]\s+/, "").replace(/^\s*\d+[.)]\s+/, ""))
    .filter((l) => l.length > 0 && !/^[-*_=─━═]+$/.test(l))
    .join("\n");
}

/**
 * Find the first heading matching `pattern` and return the first paragraph
 * that appears after it, skipping any duplicate heading lines. This is more
 * robust than a single block scan when stage outputs repeat headings (e.g.
 * "# What This Category Believes" immediately followed by the same H2).
 */
function paragraphAfterHeading(text: string, pattern: RegExp): string | null {
  const lines = plainText(text)
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  for (let i = 0; i < lines.length; i++) {
    if (!pattern.test(lines[i])) continue;
    let j = i + 1;
    while (j < lines.length && pattern.test(lines[j])) j++;
    if (j < lines.length) return lines[j];
  }
  return null;
}

/** Evidence sentences carrying a real figure — the countable proof base. */
function statSentences(text: string, limit: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const line of plainText(text).split("\n")) {
    for (const raw of sentences(line)) {
      if (!/\d/.test(raw)) continue;
      if (!/%|\bper cent\b|\bx\b|\bmillion\b|\bbillion\b|\b\d{4}\b/i.test(raw)) continue;
      if (raw.length < 40 || raw.length > 300) continue;
      if (/^(section|stage|test)\b/i.test(raw)) continue;
      const key = matchKey(raw).slice(0, 50);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(raw);
      if (out.length >= limit) return out;
    }
  }
  return out;
}

export function extractResearch(
  session: ExecSessionRow,
  intel: { executiveSummary?: string | null } = {},
): ResearchItem[] {
  const items: ResearchItem[] = [];

  const brief = clean(str(session, "brief_text"));
  if (brief) {
    const words = brief.split(/\s+/).length;
    items.push({
      label: "Client brief",
      body: `${words.toLocaleString("en-AU")} words, carried into the pipeline verbatim as the source document.`,
    });
  }

  if (intel.executiveSummary && clean(intel.executiveSummary)) {
    const line = firstSentencesOf(intel.executiveSummary, 1);
    if (line) items.push({ label: "Intelligence Lab run", body: line });
  }

  const s2 = str(session, "stage_2_output");
  if (clean(s2)) {
    items.push({
      label: "Category audit",
      body: "Category belief structure, shared silences and competitive positions audited in full (Stage 2).",
    });
  }

  const evidence = statSentences(
    `${str(session, "stage_1_output")}\n${intel.executiveSummary ?? ""}`,
    5,
  );
  for (const e of evidence) items.push({ label: "Evidence", body: e });

  return items;
}

/* ── 04 — Findings ──────────────────────────────────────────────── */

export function extractFindings(
  session: ExecSessionRow,
  intel: { executiveSummary?: string | null } = {},
): string | null {
  const fromIntel = firstSentencesOf(intel.executiveSummary ?? null, 3);
  if (fromIntel) return fromIntel;

  // Template-level priority: synthesised early-stage outputs carry the
  // strategic findings. The Stage 2 category-belief paragraph is usually the
  // cleanest statement of what the brand can actually exploit, so it is
  // preferred before legacy Stage 1 headings.
  const s2 = str(session, "stage_2_output");
  const s2Para = paragraphAfterHeading(
    s2,
    /What This Category Believes|Category Believes|Category Truth/i,
  );
  const fromS2 = firstSentencesOf(s2Para, 3);
  if (fromS2) return fromS2;

  const s3 = str(session, "stage_3_output");
  const s3Para = paragraphAfterHeading(
    s3,
    /Ledger of Proof|Proof|Strategic Mechanism|What This Brand Can Claim/i,
  );
  const fromS3 = firstSentencesOf(s3Para, 3);
  if (fromS3) return fromS3;

  const s4 = str(session, "stage_4_output");
  const s4Para = paragraphAfterHeading(s4, /Open Ledger|Strategic Territory|Territory/i);
  const fromS4 = firstSentencesOf(s4Para, 3);
  if (fromS4) return fromS4;

  // Legacy Stage 1 headings used by older sessions.
  const s1 = str(session, "stage_1_output");
  const shift = headingBlock(s1, /Human\s*\/?\s*Cultural Shift/i).join(" ");
  const fromShift = firstSentencesOf(shift, 3);
  if (fromShift) return fromShift;

  const challenged = headingBlock(s1, /Category Assumption Challenged/i).join(" ");
  const fromChallenged = firstSentencesOf(challenged, 3);
  if (fromChallenged) return fromChallenged;

  return firstSentencesOf(s1, 3);
}

/* ── 05 — Frameworks ────────────────────────────────────────────── */

const LEGACY_ENGINE_LABEL: Record<string, string> = {
  naive: "Naive Reframe",
  breach: "Breach",
  synect: "Synectics",
  displace: "Time Displacement",
  fuse: "Fuse",
  flashpoint: "Flashpoint",
};

function engineLabel(key: string): string {
  if (LEGACY_ENGINE_LABEL[key]) return LEGACY_ENGINE_LABEL[key];
  return key
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export interface FrameworksResult {
  stages: string[];
  engines: string[];
}

export function extractFrameworks(session: ExecSessionRow): FrameworksResult {
  const stages: string[] = [];
  for (const entry of STAGE_MANIFEST) {
    const filled = entry.columns.some((c) => {
      const v = session[c];
      if (typeof v === "string") return clean(v).length > 0;
      return v != null && typeof v === "object" && Object.keys(v as object).length > 0;
    });
    if (filled) stages.push(`Stage ${entry.id.toUpperCase()} — ${entry.label}`);
  }

  const engines: string[] = [];
  const raw = session["loc_engine_outputs"];
  if (raw && typeof raw === "object") {
    for (const k of Object.keys(raw as Record<string, unknown>)) engines.push(engineLabel(k));
  }
  return { stages, engines };
}

/* ── 06 — The Propositions Field ────────────────────────────────── */

export interface FieldItem {
  proposition: string;
  origin: string;
  selected: boolean;
  reason: string | null;
  /** Stage 12 composite score, e.g. "43/60", when the stage recorded one. */
  composite?: string | null;
}

/** Stage 9 candidates: "## Heading" blocks carrying a "The SMP:" line. */
function stage9Candidates(stage9: string): Array<{ smp: string; note: string | null }> {
  if (!stage9) return [];
  const lines = stage9.split("\n");
  const out: Array<{ smp: string; note: string | null }> = [];

  // Ranking lines, kept whole. The note is whatever follows the proposition
  // itself, so it is sliced at match time (propositions often contain dashes).
  const rankLines: string[] = [];
  const rankIdx = lines.findIndex((l) => /^#{1,4}\s*RANKING\s*$/i.test(l));
  if (rankIdx >= 0) {
    for (let i = rankIdx + 1; i < lines.length; i++) {
      if (/^#{1,4}\s/.test(lines[i])) break;
      const c = clean(lines[i]);
      if (/^\d+\.\s+\S/.test(c)) rankLines.push(c.replace(/^\d+\.\s+/, ""));
    }
  }

  const noteFor = (smp: string): string | null => {
    const smpKey = matchKey(smp);
    if (smpKey.length < 5) return null;
    for (const line of rankLines) {
      // Walk the line, tracking the normalised key position, so the note can
      // be sliced immediately after the proposition ends.
      let norm = "";
      let cut = -1;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i].toLowerCase();
        if (/[a-z0-9]/.test(ch)) norm += ch;
        else if (/\s/.test(ch) && norm && !norm.endsWith(" ")) norm += " ";
        else continue;
        if (norm.trim().endsWith(smpKey)) {
          cut = i + 1;
          break;
        }
      }
      if (cut < 0) continue;
      const tail = line.slice(cut).replace(/^[\s.”"'’]*[—–-]?\s*/, "").trim();
      if (tail.length > 20) return tail;
    }
    return null;
  };

  for (let i = 0; i < lines.length; i++) {
    if (!/^##\s+\S/.test(lines[i])) continue;
    let smp = "";
    for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
      const c = clean(lines[j]);
      const m = c.match(/^The SMP:\s*["“](.+?)["”]\.?$/i);
      if (m) {
        smp = m[1].trim();
        break;
      }
    }
    if (!smp) continue;
    out.push({ smp, note: noteFor(smp) });
  }
  return out;
}

/** Stage 12 cards: proposition line + PRESSURE_TEST_NOTE. */
function stage12Cards(
  stage12: string,
): Array<{ smp: string; note: string | null; composite: string | null }> {
  if (!stage12) return [];
  const lines = stage12.split("\n");
  const starts: number[] = [];
  lines.forEach((l, i) => {
    if (/^\s*\**PROPOSITION\s+\d+\**\s*$/i.test(l)) starts.push(i);
  });
  const out: Array<{ smp: string; note: string | null; composite: string | null }> = [];

  starts.forEach((start, n) => {
    const end = starts[n + 1] ?? lines.length;
    const block = lines.slice(start + 1, end);
    let smp = "";
    for (const l of block) {
      const c = clean(l);
      if (!c || /^[═─━_=-]+$/.test(c)) continue;
      if (/^[A-Z][A-Z ’'—-]{6,}$/.test(c)) break;
      smp = c;
      break;
    }
    if (!smp) return;
    const noteLine = block.find((l) => /PRESSURE_TEST_NOTE\s*:/i.test(l));
    let note: string | null = null;
    if (noteLine) {
      const body = clean(noteLine.replace(/^.*?PRESSURE_TEST_NOTE\s*:/i, ""));
      const s = sentences(body);
      note = s.length ? s.slice(0, 2).join(" ") : null;
    }
    const composite =
      block.join("\n").match(/Composite\s*[:.]?\s*\**\s*(\d{1,3}\s*\/\s*\d{1,3})/i)?.[1] ?? null;
    out.push({
      smp: smp.replace(/^["“](.+)["”]$/, "$1"),
      note,
      composite: composite ? composite.replace(/\s+/g, "") : null,
    });
  });
  return out;
}

export function extractPropositionsField(session: ExecSessionRow): FieldItem[] {
  const selectedKey = matchKey(str(session, "selected_smp"));
  const items: FieldItem[] = [];
  const seen = new Set<string>();

  const push = (
    smp: string,
    origin: string,
    reason: string | null,
    composite: string | null = null,
  ) => {
    const key = matchKey(smp);
    if (!key || key.length < 5) return;
    if (seen.has(key)) return;
    seen.add(key);
    const selected = !!selectedKey && (key.includes(selectedKey) || selectedKey.includes(key));
    items.push({
      proposition: smp,
      origin,
      selected,
      reason: selected ? null : reason,
      composite,
    });
  };

  for (const c of stage12Cards(str(session, "stage_12_output"))) {
    push(c.smp, "Stage 12 shortlist", c.note, c.composite);
  }
  for (const c of stage9Candidates(str(session, "stage_9_output"))) {
    push(c.smp, "Stage 9 distinctiveness field", c.note);
  }
  for (const c of stage9Candidates(str(session, "stage_9_leftofcentre_output"))) {
    push(c.smp, "Left-of-Centre engines", c.note);
  }
  return items;
}

/* ── 07 — Winning Proposition ───────────────────────────────────── */

export interface WinningResult {
  smp: string | null;
  owns: string | null;
  alignment: string | null;
}

export function extractWinning(session: ExecSessionRow): WinningResult {
  const smp = clean(cleanProposition(str(session, "selected_smp"))) || null;
  const key = smp ? matchKey(smp) : "";
  let owns: string | null = null;

  const s12 = str(session, "stage_12_output");
  if (s12 && key) {
    const lines = s12.split("\n");
    const starts: number[] = [];
    lines.forEach((l, i) => {
      if (/^\s*\**PROPOSITION\s+\d+\**\s*$/i.test(l)) starts.push(i);
    });
    starts.forEach((start, n) => {
      if (owns) return;
      const end = starts[n + 1] ?? lines.length;
      const block = lines.slice(start + 1, end);
      const blockKey = matchKey(block.slice(0, 6).join(" "));
      if (!blockKey.includes(key)) return;
      const ownsIdx = block.findIndex((l) => /WHAT THIS PROPOSITION OWNS/i.test(l));
      if (ownsIdx < 0) return;
      const body: string[] = [];
      for (let i = ownsIdx + 1; i < block.length; i++) {
        const c = clean(block[i]);
        if (/^[═─━_=-]+$/.test(c)) {
          if (body.length) break;
          continue;
        }
        if (!c) continue;
        if (/^[A-Z][A-Z ’'—-]{6,}$/.test(c)) break;
        body.push(c);
      }
      owns = firstSentencesOf(body.join(" "), 3);
    });
  }

  // Stage 10 "C — Best alignment with Strategic Opportunity".
  let alignment: string | null = null;
  const s10 = str(session, "stage_10_output");
  for (const raw of s10.split("\n")) {
    const c = clean(raw);
    if (!/^C\s*[—-]\s*Best alignment/i.test(c)) continue;
    const tail = c.replace(/^C\s*[—-]\s*Best alignment[^:]*:\s*/i, "");
    alignment = firstSentencesOf(tail, 2);
    break;
  }
  if (!alignment) {
    const s13 = str(session, "stage_13_output");
    alignment = firstSentencesOf(headingBlock(s13, /Section\s*1\b.*Verdict/i).join(" "), 2);
  }
  return { smp, owns, alignment };
}

/* ── 08 — Verification ──────────────────────────────────────────── */

export interface VerificationTest {
  name: string;
  verdict: string | null;
  note: string | null;
}

export interface VerificationResult {
  verdict: string | null;
  tests: VerificationTest[];
}

/** Stage 11 block for the selected SMP. */
function stage11Block(stage11: string, selectedSmp: string): string[] | null {
  if (!stage11 || !selectedSmp) return null;
  const key = matchKey(selectedSmp);
  if (key.length < 6) return null;
  const lines = stage11.split("\n");
  const isHeader = (l: string) => /^\s*(#{2,4}\s*)?\*{0,2}SMP:/i.test(l);
  const start = lines.findIndex((l) => isHeader(l) && matchKey(l).includes(key));
  if (start < 0) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (isHeader(lines[i])) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end);
}

export function extractVerification(session: ExecSessionRow): VerificationResult {
  const block = stage11Block(str(session, "stage_11_output"), str(session, "selected_smp"));
  if (!block) return { verdict: null, tests: [] };

  const tests: VerificationTest[] = [];
  for (let i = 0; i < block.length; i++) {
    // `clean()` already strips markdown hashes, so the heading may arrive
    // with or without them.
    const h = clean(block[i]).match(/^(?:#{1,4}\s*)?(Test\s*\d+\s*[—-]\s*.+)$/i);
    if (!h) continue;
    let name = h[1].replace(/\s*\(diagnostic\)\s*$/i, "").trim();
    let verdict: string | null = null;
    let note: string | null = null;

    // Stage 11 writes the verdict into the heading itself:
    //   "Test 1 — Competitive Counter: WOBBLES"
    const inline = name.match(/^(.*?):\s*([A-Z][A-Z/ ()-]{1,30})$/);
    if (inline) {
      name = inline[1].trim();
      verdict = inline[2].trim();
    }

    for (let j = i + 1; j < Math.min(i + 8, block.length); j++) {
      const c = clean(block[j]);
      if (!c) continue;
      if (/^(?:#{1,4}\s*)?Test\s*\d+\s*[—-]/i.test(c)) break;
      if (/SMP VERDICT|STRATEGIC NOTE/i.test(c)) break;
      // Older format: an explicit "Verdict: X — reasoning" line.
      const m = c.match(/^Verdict:\s*([A-Z][A-Z ,()a-z-]*?)\s+[—–-]\s+(.+)$/);
      if (m) {
        // Keep the verdict token short enough to read as a badge; any
        // parenthetical qualifier belongs with the note, not the label.
        const full = m[1].trim();
        const bracket = full.indexOf("(");
        verdict = (bracket > 0 ? full.slice(0, bracket) : full).trim();
        const qualifier = bracket > 0 ? full.slice(bracket).trim() : "";
        note = firstSentencesOf(qualifier ? `${qualifier} ${m[2]}` : m[2], 1);
        break;
      }
      // Current format: the reasoning is simply the prose that follows the
      // heading, sometimes preceded by a "Counter:" line worth keeping.
      const counter = c.match(/^Counter:\s*(.+)$/i);
      if (counter) {
        note = `Counter — ${counter[1].replace(/\s*$/, "")}`;
        continue;
      }
      const prose = firstSentencesOf(c, 1);
      if (prose) {
        note = note ? `${note} ${prose}` : prose;
        break;
      }
    }
    tests.push({ name, verdict, note });
  }


  let verdict: string | null = null;
  const vLine = block.find((l) => /SMP VERDICT:/i.test(l));
  if (vLine) {
    const c = clean(vLine).replace(/^.*?SMP VERDICT:\s*/i, "");
    verdict = firstSentencesOf(c, 2);
  }
  return { verdict, tests };
}

/* ── 09 — Scoring and Validation ────────────────────────────────── */

export interface ScoreRow {
  dimension: string;
  score: string;
  note: string | null;
}

export interface ScoringResult {
  rows: ScoreRow[];
  composite: string | null;
  weighted: string | null;
  /** Code-computed Stage 10 verdict for this exact proposition (PASS/ELIMINATED). */
  verdict: string | null;
  /** True when the scored block genuinely belongs to the selected SMP. */
  matched: boolean;
  /** Name of the SMP the returned scores were recorded against. */
  scoredSmp: string | null;
}

export function extractScoring(session: ExecSessionRow): ScoringResult {
  const s10 = str(session, "stage_10_output");
  const selected = str(session, "selected_smp");
  const key = matchKey(selected);
  const rows: ScoreRow[] = [];
  let composite: string | null = null;
  let weighted: string | null = null;
  let matched = false;
  let scoredSmp: string | null = null;
  let verdict: string | null = null;
  if (!s10) return { rows, composite, weighted, verdict, matched, scoredSmp };

  const lines = s10.split("\n");
  const isHeader = (l: string) => /^\s*\**SMP:/i.test(l);
  // Hard rule: only ever report the score recorded against the actual
  // selected, locked SMP. If Stage 10 never scored that exact line — because
  // the proposition was refined after scoring — no score is returned at all.
  // Falling back to a parent or sibling proposition's block is forbidden.
  // When a proposition has been re-scored (Stage 10 re-score section appended),
  // the LAST matching block is the current, authoritative one.
  const start = key
    ? lines.reduce((acc, l, i) => (isHeader(l) && matchKey(l).includes(key) ? i : acc), -1)
    : -1;
  matched = start >= 0;
  if (start < 0) return { rows, composite, weighted, verdict, matched, scoredSmp };
  scoredSmp =
    clean(lines[start])
      .replace(/^\**SMP:\s*/i, "")
      .replace(/\s*[—-]\s*FIELD:.*$/i, "")
      .replace(/^["“']|["”']$/g, "")
      .trim() || null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (isHeader(lines[i])) {
      end = i;
      break;
    }
  }
  const block = lines.slice(start, end);

  for (const raw of block) {
    const c = clean(raw);
    const m = c.match(/^([A-Z][A-Za-z /-]{3,40}):\s*(\d{1,2})\s*\/\s*10\s*(?:[—-]\s*(.*))?$/);
    if (m) {
      const note = m[3] ? firstSentencesOf(m[3], 1) : null;
      rows.push({ dimension: m[1].trim(), score: `${m[2]}/10`, note });
      continue;
    }
    // Stage 10 writes this as "COMPOSITE:", "CODE COMPOSITE:" or
    // "WEIGHTED COMPOSITE:" depending on prompt vintage.
    const comp = c.match(/^(?:[A-Z]+\s+)?COMPOSITE:\s*([\d.]+\s*\/\s*\d+)/i);
    if (comp) composite = comp[1].replace(/\s+/g, "");
    const verd = c.match(/^(?:CODE\s+)?VERDICT:\s*(PASS|ELIMINATED)\b/i);
    if (verd) verdict = verd[1].toUpperCase();
  }

  // The weighted /110 composite is a deprecated framework. It is deliberately
  // never surfaced in this document, even though the string is still stored.
  weighted = null;
  return { rows, composite, weighted, verdict, matched, scoredSmp };
}

/* ── 10 — Brand World Opportunity ───────────────────────────────── */

export interface BrandWorldResult {
  line: string | null;
  explanation: string | null;
}

export function extractBrandWorldSection(session: ExecSessionRow): BrandWorldResult {
  const s22 = str(session, "stage_22_output");
  let line: string | null = null;
  let personality: string | null = null;
  let recognition: string | null = null;

  const lines = s22.split("\n");
  lines.forEach((raw, i) => {
    const c = clean(raw);
    const r = c.match(/^REFLECTION\s*:\s*(.+)$/i);
    if (r && !line) line = r[1].replace(/\.$/, "").trim();
    const p = c.match(/^PERSONALITY\s*:\s*(.+)$/i);
    if (p && !personality) personality = p[1].trim();
    if (/^THE RECOGNITION TEST\s*:?/i.test(c) && !recognition) {
      const tail = c.replace(/^THE RECOGNITION TEST\s*:?\s*/i, "");
      const body = tail || clean(lines[i + 1] ?? "");
      recognition = firstSentencesOf(body, 1);
    }
  });

  const explanation = recognition ?? (personality ? `${personality}.`.replace(/\.\.$/, ".") : null);
  return { line, explanation };
}

/* ── 11 — Recommendations and channels ──────────────────────────── */

export interface RecommendationsResult {
  nextStep: string | null;
  condition: string | null;
  channels: string[];
}

export function extractRecommendations(session: ExecSessionRow): RecommendationsResult {
  const selected = str(session, "selected_smp");
  const key = matchKey(selected);

  // Condition on activation — the Stage 11 strategic note for the winner.
  // Match the note line itself, not the "SMP VERDICT: VALIDATED WITH
  // STRATEGIC NOTE" headline that precedes it.
  let condition: string | null = null;
  const block = stage11Block(str(session, "stage_11_output"), selected);
  if (block) {
    const note = block.find((l) => /^\s*\**\s*STRATEGIC NOTE\b/i.test(clean(l)));
    if (note) {
      const tail = clean(note)
        .replace(/^\**\s*STRATEGIC NOTE\s*(\([^)]*\))?\s*[:—-]?\s*\**\s*/i, "");
      const trimmed = firstSentencesOf(tail, 3);
      condition = trimmed && trimmed.length > 30 ? trimmed : null;
    }
  }


  if (!condition) {
    const cards = stage12Cards(str(session, "stage_12_output"));
    const hit = cards.find((c) => key && matchKey(c.smp) === key);
    condition = hit?.note ?? null;
  }

  // Next step — the pipeline's own clearance declaration (Stage 15), which is
  // the only stage that states what has to happen before this strategy is
  // deployed. Stage 22's deployment principles are Brand Architecture guidance
  // and are deliberately NOT used here.
  let nextStep: string | null = null;
  const s15 = str(session, "stage_15_output");
  if (s15) {
    const declaration = headingBlock(s15, /Clearance Declaration|Clearance Statement/i)
      .map(clean)
      .filter((l) => l && !/^\**[A-Z][A-Z ,()-]{5,}\**$/.test(l));
    nextStep = firstSentencesOf(declaration.join(" "), 2);
    if (!nextStep) {
      const status = s15
        .split("\n")
        .map(clean)
        .find((l) => /PIPELINE CLEARANCE STATUS/i.test(l));
      if (status) {
        const tail = status.replace(/^.*?PIPELINE CLEARANCE STATUS\s*\**\s*[—:-]?\s*/i, "");
        nextStep = tail.length > 15 ? tail : null;
      }
    }
  }
  if (!nextStep) {
    nextStep = firstSentencesOf(
      headingBlock(str(session, "stage_13_output"), /Verdict|Recommendation/i).join(" "),
      2,
    );
  }


  const channels: string[] = [];
  const raw = session["stage_21_outputs"];
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const k of Object.keys(raw as Record<string, unknown>)) channels.push(k);
  }
  const s20b = str(session, "stage_20b_output");
  if (!channels.length && s20b) {
    for (const l of s20b.split("\n")) {
      if (!/^\s*#{2,4}\s+\S/.test(l)) continue;
      const name = clean(l).replace(/^Channel\s*\d+\s*[—-]\s*/i, "");
      if (name && name.length < 80) channels.push(name);
      if (channels.length >= 6) break;
    }
  }
  return { nextStep, condition, channels };
}

/* ── 01 — Scale of the work (numbers only) ──────────────────────── */

export interface ProcessResult {
  stats: Array<{ value: string; label: string }>;
}

/** Derived from STAGE_MANIFEST; never a count of columns. */
export const PIPELINE_STAGE_COUNT = TOTAL_PIPELINE_STEPS;

export function extractProcess(
  _session: ExecSessionRow,
  counts: { propositions: number; dimensions: number; frameworks: FrameworksResult },
  _intelPresent: boolean,
): ProcessResult {
  const methodologies = PIPELINE_STAGE_COUNT + counts.frameworks.engines.length;
  return {
    stats: [
      { value: String(PIPELINE_STAGE_COUNT), label: "stages completed" },
      { value: String(methodologies), label: "methodologies applied" },
      { value: String(counts.propositions), label: "propositions considered" },
      { value: String(counts.dimensions), label: "dimensions validated" },
    ],
  };
}

/* ── Distinctive asset (Stage 22 — RECOMMENDED ASSETS) ──────────── */

/**
 * Authoritative source is `stage_22_distinctive_assets` under its
 * "RECOMMENDED ASSETS" heading. The Stage 22 `ASSETS:` shorthand line is
 * deliberately NOT used — it is a looser restatement of brand furniture.
 */
export function extractDistinctiveAsset(session: ExecSessionRow): string | null {
  const raw = str(session, "stage_22_distinctive_assets");
  if (!raw) return null;
  const lines = raw.split("\n");
  const start = lines.findIndex((l) => /RECOMMENDED ASSETS/i.test(l));
  if (start < 0) return null;
  for (let i = start + 1; i < lines.length; i++) {
    const c = clean(lines[i]).replace(/^\s*[-*+•]\s*/, "").replace(/^\d+[.)]\s*/, "");
    if (!c) continue;
    if (/^[A-Z][A-Z ’'—-]{6,}:?$/.test(c)) break;
    if (c.length < 4) continue;
    return c.replace(/\s*[—-]\s*$/, "");
  }
  return null;
}

/* ── Proof, at a glance ─────────────────────────────────────────── */

export interface ProofResult {
  strongest: { dimension: string; score: string } | null;
  composite: string | null;
  asset: string | null;
}

/**
 * One real highlight only — strongest scored dimension plus the live
 * composite — never a second copy of the Stage 10 table.
 */
export function extractProof(session: ExecSessionRow, scoring: ScoringResult): ProofResult {
  let strongest: { dimension: string; score: string } | null = null;
  let best = -1;
  for (const r of scoring.rows) {
    const n = parseInt(r.score, 10);
    if (Number.isFinite(n) && n > best) {
      best = n;
      strongest = { dimension: r.dimension, score: r.score };
    }
  }
  return { strongest, composite: scoring.composite, asset: extractDistinctiveAsset(session) };
}

/* ── Minto précis ───────────────────────────────────────────────── */

export interface PrecisResult {
  situation: string | null;
  complication: string | null;
  question: string | null;
  answer: string | null;
}

/**
 * Situation / Complication / Question / Answer, assembled from stored text
 * only. Every line is claimed on the deduper so no section may repeat it.
 */
export function buildPrecis(
  args: {
    businessIssue: string | null;
    findings: string | null;
    smp: string | null;
    brand: string;
  },
  dedupe: Deduper,
): PrecisResult {
  const situation = dedupe.take(args.businessIssue, 2);
  const complication = dedupe.take(args.findings, 2);
  const smp = args.smp ? stripQuotes(clean(args.smp)) : null;
  const question = `What proposition can ${args.brand} own that the category cannot answer?`;
  dedupe.claim(question);
  const answer = smp ? `“${smp}”` : null;
  if (answer) dedupe.claim(`The recommendation is ${answer}.`);
  return { situation, complication, question, answer };
}

/* ── Lead paragraph ─────────────────────────────────────────────── */

function stripQuotes(s: string): string {
  return s.replace(/^["“](.+)["”]$/, "$1").replace(/\.$/, "").trim();
}

/**
 * Plain statement of what actually happened — a concrete, factual sentence
 * carrying a figure, percentage or date, drawn from stored source material.
 * This is what orients a cold reader before any interpretation.
 */
export function extractSituationFact(
  session: ExecSessionRow,
  intel: { executiveSummary?: string | null; tension?: string | null } = {},
): string | null {
  const pools = [
    str(session, "stage_1_output"),
    clean(intel.executiveSummary ?? ""),
    str(session, "brief_text"),
  ];
  const HARD = /%|\bper cent\b|\bmillion\b|\bbillion\b|\$[\d]/i;
  // A measured movement — "fallen from 74% to 39%" — orients a cold reader
  // faster than a scene-setting sentence or a static datapoint.
  const MOVEMENT = /(fallen|fell|collaps|dropped|declined|halved|rose|grew)[^.]{0,80}\d/i;
  const stripTags = (t: string) =>
    t
      .replace(/\[source:[^\]]*\]/gi, "")
      .replace(/\(role:[^)]*\)/gi, "")
      .replace(/(\d)\.(\d)/g, "$1\u2024$2") // protect decimals from sentence splitting
      .replace(/\s{2,}/g, " ")
      .trim();
  const cands: string[] = [];
  for (const pool of pools) {
    if (!pool) continue;
    for (const line of plainText(pool).split("\n")) {
      for (const raw of sentences(stripTags(line))) {
        const t = raw.trim();
        if (t.length < 40 || t.length > 320) continue;
        if (!HARD.test(t)) continue;
        if (/^(section|stage|test)\b/i.test(t)) continue;
        // Objectives and targets describe intent, not the situation.
        if (/\b(recover|target|goal|objective|kpi|aim to|must reach|within \d+ months)\b/i.test(t)) continue;
        cands.push(t.replace(/\u2024/g, "."));
      }
    }
  }
  if (!cands.length) return null;
  const FROM_TO = /from\s+[\d.]+\s*%[^.]{0,40}\bto\b\s+[\d.]+\s*%/i;
  return (
    cands.find((c) => FROM_TO.test(c) && MOVEMENT.test(c)) ??
    cands.find((c) => MOVEMENT.test(c)) ??
    cands[0]
  );
}

/**
 * Opening thesis. Opens on the plain factual situation, then the strategic
 * reading of it. Each sentence used here is claimed on the deduper so no
 * section downstream may repeat it, and any sentence that merely restates the
 * proposition line is dropped rather than smoothed over.
 */
export function buildLeadParagraph(
  args: {
    fact?: string | null;
    businessIssue: string | null;
    smp: string | null;
    reason: string | null;
    verdict: string | null;
  },
  dedupe: Deduper,
): string | null {
  const parts: string[] = [];
  const smp = args.smp ? stripQuotes(clean(args.smp)) : null;
  const smpKey = smp ? matchKey(smp) : "";

  // Plain fact first — orientation before interpretation.
  const fact = args.fact ? sentences(args.fact)[0] : null;
  if (fact && dedupe.fresh(fact)) parts.push(fact);

  const issue = args.businessIssue ? sentences(args.businessIssue)[0] : null;
  if (issue && dedupe.fresh(issue)) parts.push(issue);


  if (smp) {
    parts.push(`The recommendation is “${smp}”.`);
    dedupe.claim(`The recommendation is “${smp}”.`);
  }

  const echoesSmp = (s: string) => !!smpKey && smpKey.length > 8 && matchKey(s).includes(smpKey);

  for (const source of [args.reason, args.verdict]) {
    if (parts.length >= 5) break;
    const first = source ? sentences(source)[0] : null;
    if (!first || echoesSmp(first)) continue;
    if (!dedupe.fresh(first)) continue;
    parts.push(first);
  }

  if (!parts.length) return null;
  return parts.join(" ");
}
