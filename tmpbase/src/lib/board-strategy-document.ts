// BRAND GRENADE — BOARD STRATEGY RECOMMENDATION
// ============================================================================
// Thin document definition over the canonical Minto template (`minto.ts`) and
// the shared derivation (`minto-content.ts`). This file owns nothing but the
// cover, the appendix depth, and the footer — the ten-section structure and
// all extraction logic are shared with the other primary deliverables.

import { buildMintoDocument } from "./minto";
import { DOCUMENT_SPECS } from "./document-spec";
import { deriveMintoContent, type MintoSession } from "./minto-content";

export type BoardStrategySession = MintoSession;

export { parseScoredCandidates, type ScoredCandidate } from "./minto-content";

export interface BoardStrategyOptions {
  /** false when rendering headlessly for PDF (no toolbar, no page shadow). */
  screen?: boolean;
  /**
   * "condensed" (default) — the appendix carries an evidence extract per stage.
   * "full" reproduces every stage output verbatim for archival/audit use.
   */
  appendix?: "condensed" | "full";
}

export function buildBoardStrategyDocument(
  session: BoardStrategySession,
  opts: BoardStrategyOptions = {},
): string {
  const derived = deriveMintoContent(session, {
    appendix: { mode: opts.appendix === "full" ? "full" : "condensed" },
  });

  return buildMintoDocument({
    canonical: DOCUMENT_SPECS.board_strategy,
    title: `Board Strategy Recommendation — ${derived.brand}`,
    screen: opts.screen,
    cover: {
      brand: "BRAND GRENADE",
      label: "Board Strategy Recommendation",
      title: `${derived.brand} — Board Strategy Recommendation`,
      subtitle: derived.category || undefined,
      confidential: true,
    },
    headlineStats: derived.headlineStats,
    content: derived.content,
    footerHtml:
      `Brand Grenade Strategy Intelligence System — Confidential. ` +
      `Assembled from session data for ${derived.brand}. ` +
      `Review before commercial deployment.`,
  });
}
