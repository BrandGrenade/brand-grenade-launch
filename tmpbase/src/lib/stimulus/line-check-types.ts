// Browser-safe types for the independent on-strategy check applied to every
// campaign line. The checker itself lives in line-check.server.ts.

export type LineVerdict = "on_strategy" | "drift" | "generic";

export interface LineCheck {
  verdict: LineVerdict;
  /** What the line actually says, in plain words. */
  says: string;
  /** Why that does or does not carry the SMP's specific meaning. */
  reasoning: string;
  /** Could this line sit on another brand's brief unchanged? */
  swap_test: string;
  checkedAt: string;
}
