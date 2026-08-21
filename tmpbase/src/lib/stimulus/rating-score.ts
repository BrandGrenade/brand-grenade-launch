// Client-safe helpers for reading a Gate One rating snapshot.
// The composite score exists ONLY to decide whether directions are scoring too
// closely to call (the tie-breaker trigger). It is never shown as "the score"
// and never replaces the eight independent dimensions.

import type { DirectionRatings, ScaleRating } from "./rating-prompts";

const SCALE: Record<ScaleRating, number> = { High: 3, Medium: 2, Low: 1 };
const COMPLIANCE: Record<string, number> = { Direct: 3, Supporting: 2, Tangential: 1 };

export function scaleValue(v: string | undefined): number {
  return SCALE[(v ?? "") as ScaleRating] ?? 0;
}

/** 0–1 closeness index across the seven quality dimensions. Producibility excluded. */
export function compositeIndex(r: DirectionRatings): number {
  const crab =
    (scaleValue(r.crab?.clear) +
      scaleValue(r.crab?.relevant) +
      scaleValue(r.crab?.appealing) +
      scaleValue(r.crab?.believable)) /
    4;
  const parts = [
    COMPLIANCE[r.strategic_compliance?.rating ?? ""] ?? 0,
    scaleValue(r.brand_glue?.rating),
    crab,
    scaleValue(r.fame?.rating),
    scaleValue(r.creative_uniqueness?.rating),
    scaleValue(r.creative_ambition?.rating),
  ];
  const sum = parts.reduce((a, b) => a + b, 0);
  return sum / (parts.length * 3);
}

export const TIEBREAKER_SPREAD = 0.06;
export const TIEBREAKER_MIN_CANDIDATES = 2;

/**
 * Tie-breaker is a TRIGGER, not a default step. It fires only when the top
 * scorers sit inside TIEBREAKER_SPREAD of each other — i.e. no clear favourite.
 */
export function tiebreakerCandidates<T extends { ratings: DirectionRatings }>(
  rated: T[],
): { fires: boolean; reason: string; candidates: T[] } {
  const scored = rated
    .map((d) => ({ d, s: compositeIndex(d.ratings) }))
    .sort((a, b) => b.s - a.s);
  if (scored.length < TIEBREAKER_MIN_CANDIDATES)
    return { fires: false, reason: "Fewer than two rated directions — nothing to tie-break.", candidates: [] };

  const top = scored[0]!.s;
  const close = scored.filter((x) => top - x.s <= TIEBREAKER_SPREAD);
  if (close.length < TIEBREAKER_MIN_CANDIDATES) {
    const gap = (top - scored[1]!.s).toFixed(3);
    return {
      fires: false,
      reason: `Clear favourite: the leader sits ${gap} above the next direction (threshold ${TIEBREAKER_SPREAD}). No tie-breaker needed.`,
      candidates: [],
    };
  }
  return {
    fires: true,
    reason: `${close.length} directions are within ${TIEBREAKER_SPREAD} of the top score (${top.toFixed(3)}) — no clear favourite.`,
    candidates: close.slice(0, 5).map((x) => x.d),
  };
}

export function ratingSummaryLine(r: DirectionRatings): string {
  return [
    `Strategic ${r.strategic_compliance?.rating ?? "—"}`,
    `Brand Glue ${r.brand_glue?.rating ?? "—"}`,
    `CRAB C/${r.crab?.clear ?? "—"} R/${r.crab?.relevant ?? "—"} A/${r.crab?.appealing ?? "—"} B/${r.crab?.believable ?? "—"}`,
    `Fame ${r.fame?.rating ?? "—"}`,
    `Uniqueness ${r.creative_uniqueness?.rating ?? "—"}`,
    `Ambition ${r.creative_ambition?.rating ?? "—"}`,
    `Producibility ${r.producibility?.pass ? "PASS" : "FAIL"}`,
  ].join(" · ");
}
