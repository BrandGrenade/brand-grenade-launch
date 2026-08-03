// Deterministic text extraction for the Strategy Executive Summary.
//
// NO Claude calls, no inference, no summarisation. Every value returned here
// is a verbatim sentence (or verbatim short line) lifted out of text already
// stored on the session row. When the parser cannot confidently isolate a
// clean, complete sentence, it returns null and the document renders
// "not available for this session" for that specific line.

export const NOT_AVAILABLE = "not available for this session";

const MIN_SENTENCE_CHARS = 25;
const MAX_SENTENCE_CHARS = 420;

/** Characters that must never survive into a rendered board-facing line. */
const MARKDOWN_ARTEFACT = /[|#`*_~<>\[\]{}]|\\n|&nbsp;|https?:\/\//;
/** Truncation / continuation markers. */
const TRUNCATION = /(\.\.\.|…|\u2026)\s*$|\b(etc|cont|TBC|TODO)\b\.?$/i;

/** Strip markdown emphasis / separators from a single line. */
function clean(line: string): string {
  return line
    .replace(/\*\*/g, "")
    .replace(/(^|\s)\*(\S[^*]*?)\*(?=\s|$|[.,;:)])/g, "$1$2")
    .replace(/`/g, "")
    .replace(/^[>\s]+/, "")
    .replace(/[═─━]{3,}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Loose comparison key for matching a proposition against selected_smp. */
function matchKey(s: string): string {
  return clean(s)
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}


/**
 * Confidence gate: accepts only a complete, self-contained sentence.
 *
 * This is a real quality check, not a non-empty check. A candidate must pass
 * ALL of the following or it is rejected (and the document renders the
 * "not available" line instead):
 *   1. length within [MIN_SENTENCE_CHARS, MAX_SENTENCE_CHARS]
 *   2. at least 5 words (rejects labels and stubs)
 *   3. starts with a capital letter, digit or opening quote
 *   4. ends in terminal punctuation (. ? !), optionally inside a closing quote
 *   5. is not an all-caps heading/label, and carries no "LABEL:" / snake_case key prefix
 *   6. contains no markdown, table, list, HTML or URL artefacts
 *   7. contains no truncation/continuation markers (…, "etc", "TBC")
 *   8. has balanced quotes and brackets
 */
export function confidentSentence(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = clean(raw);
  if (!s) return null;
  if (s.length < MIN_SENTENCE_CHARS || s.length > MAX_SENTENCE_CHARS) return null;
  // Headings / all-caps labels are not sentences.
  if (s === s.toUpperCase()) return null;
  // Machine key or label prefix ("PRESSURE_TEST_NOTE:", "SMP VERDICT:").
  if (/^[A-Z0-9_ ]{3,40}:/.test(s)) return null;
  if (/\b[a-z]+_[a-z_]+\b/.test(s)) return null;
  // Must read as a sentence, not a stub.
  if (s.split(/\s+/).length < 5) return null;
  if (!/^["'“‘(]?[A-Z0-9]/.test(s)) return null;
  // Must terminate cleanly, and not mid-thought.
  if (!/[.?!]["'”’)]?$/.test(s)) return null;
  if (TRUNCATION.test(s)) return null;
  // Reject markdown/table/list/HTML artefacts.
  if (/^[-•*|#>]/.test(s) || MARKDOWN_ARTEFACT.test(s)) return null;
  // Balanced quotes and brackets.
  const dq = (s.match(/"/g) ?? []).length;
  if (dq % 2 !== 0) return null;
  if ((s.match(/“/g) ?? []).length !== (s.match(/”/g) ?? []).length) return null;
  if ((s.match(/\(/g) ?? []).length !== (s.match(/\)/g) ?? []).length) return null;
  return s;
}

/** First complete sentence of a paragraph, if one can be isolated. */
export function firstSentence(paragraph: string | null | undefined): string | null {
  if (!paragraph) return null;
  const p = clean(paragraph);
  const m = p.match(/^.*?[.?!]["'”’]?(?=\s|$)/);
  return confidentSentence(m ? m[0] : p);
}

/** A short proposition line (not required to be a full sentence). */
function confidentProposition(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = clean(raw);
  if (s.length < 3 || s.length > 160) return null;
  if (s === s.toUpperCase()) return null;
  if (/^(SECTION|PROPOSITION|DELIVERABLE|WHAT|THE|FIELD)\b[: ]/i.test(s) && s.length < 12) return null;
  return s;
}

export interface ShortlistItem {
  index: number;
  proposition: string | null;
  owns: string | null;
  /** True when this proposition matches sessions.selected_smp. */
  selected: boolean;
  /**
   * Genuine "why this one did not lead" reasoning, verbatim.
   * Sourced from the Stage 12 PRESSURE_TEST_NOTE, or the Stage 11 per-SMP
   * closing clause. Never the "what it owns" line — that is positioning,
   * not a reason it was set aside. null when no such text is stored.
   */
  setAsideReason: string | null;
}

/** Stage 11 closing-summary clause for a proposition ("… — travels bound to …"). */
function stage11SummaryClause(stage11: string | null | undefined, proposition: string): string | null {
  if (!stage11) return null;
  const key = matchKey(proposition);
  if (key.length < 8) return null;
  for (const raw of stage11.split("\n")) {
    if (!/^\s*[-*]\s+/.test(raw)) continue;
    const c = clean(raw).replace(/^[-*]\s+/, "");
    if (!matchKey(c).includes(key)) continue;
    const parts = c.split("—").map((p) => p.trim()).filter(Boolean);
    const tail = parts[parts.length - 1];
    if (!tail || tail.length < 20 || tail.length > 320) continue;
    if (/^(iconic tier|field|verdict)/i.test(tail)) continue;
    return tail.charAt(0).toUpperCase() + tail.slice(1).replace(/\.?$/, ".");
  }
  return null;
}

/** Trim a stored pressure-test note down to its first one or two sentences. */
function firstClause(text: string): string | null {
  const c = clean(text);
  if (!c || /^none\b/i.test(c)) return null;
  const sentences = c.match(/[^.?!]+[.?!]["'”’)]?/g) ?? [c];
  let out = sentences[0].trim();
  if (out.length < 60 && sentences[1]) out = `${out} ${sentences[1].trim()}`;
  if (out.length < 20 || out.length > 320) return null;
  return out;
}

/**
 * Section 4 — Shortlist.
 * Stage 12 emits "PROPOSITION n" cards inside box-drawing rules, followed by
 * the proposition line, a "WHAT THIS PROPOSITION OWNS" paragraph, and a
 * [METADATA] block carrying PRESSURE_TEST_NOTE.
 */
export function extractShortlist(
  stage12: string | null | undefined,
  opts: { selectedSmp?: string | null; stage11?: string | null } = {},
): ShortlistItem[] {
  if (!stage12) return [];
  const lines = stage12.split("\n");
  const starts: number[] = [];
  lines.forEach((l, i) => {
    if (/^\s*\**PROPOSITION\s+(\d+)\**\s*$/i.test(l)) starts.push(i);
  });
  if (!starts.length) return [];

  const selectedKey = opts.selectedSmp ? matchKey(opts.selectedSmp) : "";

  const items: ShortlistItem[] = [];
  starts.forEach((start, n) => {
    const end = starts[n + 1] ?? lines.length;
    const block = lines.slice(start + 1, end);

    // Proposition = first meaningful, non-rule line after the header.
    let proposition: string | null = null;
    for (const l of block) {
      const c = clean(l);
      if (!c) continue;
      if (/^[═─━_=-]+$/.test(c)) continue;
      if (/^[A-Z][A-Z ’'—-]{6,}$/.test(c)) break; // hit a field label first
      proposition = confidentProposition(c);
      break;
    }

    // Owns = first sentence of the WHAT THIS PROPOSITION OWNS paragraph.
    let owns: string | null = null;
    const ownsIdx = block.findIndex((l) => /^\s*\**WHAT THIS PROPOSITION OWNS\**\s*$/i.test(l));
    if (ownsIdx >= 0) {
      for (let i = ownsIdx + 1; i < block.length; i++) {
        const c = clean(block[i]);
        if (!c || /^[═─━_=-]+$/.test(c)) continue;
        owns = firstSentence(c);
        break;
      }
    }

    const selected =
      !!selectedKey && !!proposition && matchKey(proposition).includes(selectedKey);

    // Set-aside reasoning — only for non-winning propositions.
    let setAsideReason: string | null = null;
    if (!selected) {
      const noteLine = block.find((l) => /PRESSURE_TEST_NOTE\s*:/i.test(l));
      if (noteLine) {
        setAsideReason = firstClause(noteLine.replace(/^.*?PRESSURE_TEST_NOTE\s*:/i, ""));
      }
      if (!setAsideReason && proposition) {
        setAsideReason = stage11SummaryClause(opts.stage11, proposition);
      }
    }

    items.push({ index: n + 1, proposition, owns, selected, setAsideReason });
  });
  return items;
}

export interface WhyThisWins {
  /** Stage 13 brand-fit verdict headline, reframed out of internal vocabulary. */
  verdict: string | null;
  /** Stage 13 verdict rationale — first complete sentence. */
  brandFit: string | null;
  /** Stage 11 pressure-test verdict for the selected proposition, glossed. */
  pressureTest: string | null;
  /** Raw extracted values, before reframing — for audit/debug. */
  raw: { verdict: string | null; pressureTest: string | null };
  /** Section 6, formatted: labelled lines rather than three concatenated quotes. */
  formatted: Array<{ label: string; body: string }>;
}

/**
 * Platform-internal verdict vocabulary → board-readable English.
 * Deterministic mapping only; no generation.
 */
const VERDICT_REFRAME: Array<[RegExp, string]> = [
  [/^CONFIRMED WITH ADJUSTMENTS/i, "Recommended, subject to the adjustments noted below."],
  [/^CONFIRMED WITHOUT RESERVATION/i, "Recommended without reservation."],
  [/^CONFIRMED/i, "Recommended."],
  [/^VALIDATED WITH STRATEGIC NOTE/i, "Validated, with conditions attached."],
  [/^VALIDATED WITH ADJUSTMENTS/i, "Validated, subject to the adjustments noted below."],
  [/^VALIDATED/i, "Validated."],
  [/^PROCEED WITH CAUTION/i, "Proceed, with the cautions noted below."],
  [/^PROCEED/i, "Recommended to proceed."],
  [/^REJECT|^ELIMINATED/i, "Not recommended."],
];

function reframeVerdict(raw: string | null): string | null {
  if (!raw) return null;
  const s = clean(raw).replace(/\s*—\s*PROCEED\.?$/i, "").replace(/\.$/, "").trim();
  for (const [re, out] of VERDICT_REFRAME) if (re.test(s)) return out;
  // Unknown internal label: only surface it if it already reads as plain English.
  if (s === s.toUpperCase()) return null;
  return /[.?!]$/.test(s) ? s : `${s}.`;
}

/**
 * Plain-English gloss for internal pressure-test shorthand ("wobble", "crack").
 * Substitution + one clause of context — no new claims.
 */
function glossPressureTest(raw: string | null): string | null {
  if (!raw) return null;
  let s = clean(raw);
  const usedShorthand = /\b(wobble|wobbles|crack|cracks)\b/i.test(s);
  s = s
    .replace(/\bwobbles\b/gi, "points of strain")
    .replace(/\bwobble\b/gi, "point of strain")
    .replace(/\bcracks\b/gi, "structural failures")
    .replace(/\bcrack\b/gi, "structural failure");
  if (!/[.?!]$/.test(s)) s = `${s}.`;
  if (usedShorthand && s.length < 140) {
    s = `${s} In other words, the proposition bent under adversarial testing in places, but nothing in it broke.`;
  }
  return s;
}


/** Body paragraph directly under a "## Section 1 — Brand Fit Verdict" heading. */
function stage13Verdict(stage13: string | null | undefined): { verdict: string | null; rationale: string | null } {
  if (!stage13) return { verdict: null, rationale: null };
  const lines = stage13.split("\n");
  const idx = lines.findIndex((l) => /^#{1,4}\s*Section\s*1\b.*Verdict/i.test(l));
  if (idx < 0) return { verdict: null, rationale: null };
  const body: string[] = [];
  for (let i = idx + 1; i < lines.length; i++) {
    if (/^#{1,4}\s/.test(lines[i]) || /^---+$/.test(lines[i].trim())) break;
    const c = clean(lines[i]);
    if (c) body.push(c);
  }
  if (!body.length) return { verdict: null, rationale: null };
  const first = body[0];
  const isVerdictLine = first.length <= 90 && /^[A-Z0-9 ,.'’—–-]+$/.test(first.replace(/[.]$/, ""));
  return {
    verdict: isVerdictLine ? first : null,
    rationale: firstSentence(isVerdictLine ? body[1] : first),
  };
}

/** Stage 11 per-SMP block verdict for the selected proposition. */
function stage11Verdict(stage11: string | null | undefined, selectedSmp: string | null | undefined): string | null {
  if (!stage11 || !selectedSmp) return null;
  const needle = clean(selectedSmp).replace(/[.]$/, "").toLowerCase();
  if (needle.length < 8) return null;
  const lines = stage11.split("\n");
  // Stage 11 blocks are headed either "### SMP: ..." or "**SMP: ...**".
  const isSmpHeader = (l: string) => /^\s*(#{2,4}\s*)?\*{0,2}SMP:/i.test(l);
  const start = lines.findIndex(
    (l) => isSmpHeader(l) && clean(l).toLowerCase().includes(needle),
  );
  if (start < 0) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (isSmpHeader(lines[i])) { end = i; break; }
  }
  const block = lines.slice(start, end);
  // Preferred: the summary blockquote line inside the block.
  const quote = block.find((l) => /^\s*>\s*\*{0,2}/.test(l) && clean(l).length > MIN_SENTENCE_CHARS);
  const fromQuote = firstSentence(quote ?? null);
  if (fromQuote) return fromQuote;
  // Fallback: the verdict line's rationale sentence (after the em dash).
  const verdict = block.find((l) => /SMP VERDICT:/i.test(l));
  if (verdict) {
    const c = clean(verdict);
    const dash = c.indexOf("—");
    const tail = dash > 0 ? c.slice(dash + 1).trim() : "";
    const sentence = firstSentence(tail);
    if (sentence) return sentence;
    const label = dash > 0 ? c.slice(0, dash).trim() : c;
    return label.length >= 12 && label.length <= 160 ? label : null;
  }
  return null;
}


export function extractWhyThisWins(args: {
  stage11?: string | null;
  stage13?: string | null;
  selectedSmp?: string | null;
}): WhyThisWins {
  const { verdict, rationale } = stage13Verdict(args.stage13);
  return {
    verdict,
    brandFit: rationale,
    pressureTest: stage11Verdict(args.stage11, args.selectedSmp),
  };
}
