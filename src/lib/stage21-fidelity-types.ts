// Shared, browser-safe types for the Stage 21 channel fidelity check.
// The checker itself lives in stage21-fidelity.server.ts and must never be
// imported by client code.

export type FidelityVerdict = "pass" | "drift" | "break";

export interface ChannelFidelityResult {
  channel: string;
  verdict: FidelityVerdict;
  /** 0–10. How faithfully the brief adapts the lead expression's meaning. */
  score: number;
  /** Plain-language statement of what drifted, or why it holds. */
  reasoning: string;
  /** Which of the five non-negotiables are missing from this brief. */
  missing: string[];
  /** Evidence the brief has slid into the named misreading. */
  misreadingEvidence: string;
  checkedAt: string;
}

export interface FidelityReport {
  checkedAt: string;
  leadExpressionPresent: boolean;
  results: ChannelFidelityResult[];
}
