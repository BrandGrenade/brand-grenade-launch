// Buyer-gain carriage.
//
// Stage 8 now requires every proposition block to state "What the buyer gains"
// — either the concrete gain in the buyer's own terms, or the explicit
// "No functional gain — truth claim only." This module extracts that field for
// the SMP a human selected, so downstream stages (Stage 14 onward) receive the
// stated gain rather than re-inventing one.

import { normaliseForCarriage } from "./smp-carriage";

export const NO_FUNCTIONAL_GAIN = "No functional gain — truth claim only.";

const FIELD_RE = /what\s+the\s+buyer\s+gains\s*:?\s*/i;

function stripMarkdown(text: string): string {
  return text.replace(/\*\*/g, "").replace(/^>\s?/gm, "");
}

/** All "What the buyer gains" values present in a Stage 8 output, in order. */
export function extractAllBuyerGains(stage8Output: string | null | undefined): string[] {
  const text = stripMarkdown(stage8Output ?? "");
  const out: string[] = [];
  const re = new RegExp(FIELD_RE.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const rest = text.slice(m.index + m[0].length);
    // The field ends at the next blank line or the next labelled field.
    const end = rest.search(/\n\s*\n|\n\s*(?:Earlier draft|Cut|Anchor|##|---)/i);
    const value = (end >= 0 ? rest.slice(0, end) : rest).trim();
    if (value) out.push(value.replace(/\s+/g, " "));
  }
  return out;
}

/**
 * The buyer gain stated for the selected SMP. Matching is done on the
 * proposition line inside each Stage 8 block; when the selected line cannot be
 * located (older sessions, rewritten SMPs), returns null so callers can decide
 * whether to fall back rather than silently attach the wrong gain.
 */
export function extractBuyerGainForSmp(
  stage8Output: string | null | undefined,
  selectedSmp: string | null | undefined,
): string | null {
  const text = stripMarkdown(stage8Output ?? "");
  const smp = normaliseForCarriage(selectedSmp ?? "").toLowerCase();
  if (!text || !smp) return null;

  const blocks = text.split(/\n(?=##\s)/);
  for (const block of blocks) {
    if (!normaliseForCarriage(block).toLowerCase().includes(smp)) continue;
    const gains = extractAllBuyerGains(block);
    if (gains.length > 0) return gains[0];
  }
  return null;
}
