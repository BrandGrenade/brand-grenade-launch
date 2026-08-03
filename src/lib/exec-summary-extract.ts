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
    .replace(/^[>\s]+/, "")
    .replace(/[═─━]{3,}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Confidence gate: accepts only a complete, self-contained sentence.
 * Rejects truncated fragments, headings, bullets, and over-long run-ons.
 */
export function confidentSentence(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = clean(raw);
  if (!s) return null;
  if (s.length < MIN_SENTENCE_CHARS || s.length > MAX_SENTENCE_CHARS) return null;
  // Headings / all-caps labels are not sentences.
  if (s === s.toUpperCase()) return null;
  // Must terminate cleanly.
  if (!/[.?!]["'”’]?$/.test(s)) return null;
  // Reject obvious markdown/table/list artefacts.
  if (/^[-•*|#]/.test(s) || s.includes("|")) return null;
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
}

/**
 * Section 4 — Shortlist.
 * Stage 12 emits "PROPOSITION n" cards inside box-drawing rules, followed by
 * the proposition line and a "WHAT THIS PROPOSITION OWNS" paragraph.
 */
export function extractShortlist(stage12: string | null | undefined): ShortlistItem[] {
  if (!stage12) return [];
  const lines = stage12.split("\n");
  const starts: number[] = [];
  lines.forEach((l, i) => {
    if (/^\s*\**PROPOSITION\s+(\d+)\**\s*$/i.test(l)) starts.push(i);
  });
  if (!starts.length) return [];

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

    items.push({ index: n + 1, proposition, owns });
  });
  return items;
}

export interface WhyThisWins {
  /** Stage 13 brand-fit verdict headline (e.g. "CONFIRMED WITH ADJUSTMENTS — PROCEED.") */
  verdict: string | null;
  /** Stage 13 verdict rationale — first complete sentence. */
  brandFit: string | null;
  /** Stage 11 pressure-test verdict for the selected proposition. */
  pressureTest: string | null;
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
