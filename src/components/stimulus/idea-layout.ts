// CREATIVE STIMULUS ENGINE — shared idea-card layout.
//
// One standard for every surface that displays the 37 directions: Tissue
// Check, Gate One, and anything added later. Ideas are judged one at a time,
// so they are laid out as a single reading column of wide, well-spaced cards
// rather than a dense multi-column grid.

import type { CSSProperties } from "react";

export const IDEA_COLUMN_WIDTH = 980;

/** Vertical list wrapper — real air between every idea. */
export const ideaListStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  gap: 40,
  maxWidth: IDEA_COLUMN_WIDTH,
  margin: "0 auto",
  width: "100%",
};

/** A single idea card. `accent` colours the border for approved/kept states. */
export function ideaCardStyle(opts: {
  accent?: string | null;
  dimmed?: boolean;
  background?: string;
}): CSSProperties {
  return {
    backgroundColor: opts.background ?? "#0A0908",
    border: `1px solid ${opts.accent ?? "#1C1A18"}`,
    borderRadius: 14,
    padding: "32px 34px 28px",
    boxShadow: "0 1px 0 rgba(255,255,255,0.02), 0 18px 40px -32px rgba(0,0,0,0.9)",
    opacity: opts.dimmed ? 0.42 : 1,
    transition: "opacity 0.15s ease, border-color 0.15s ease",
  };
}
