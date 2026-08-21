import { describe, expect, it } from "vitest";

import { extractWinnerScores } from "./summary-sources";

describe("extractWinnerScores", () => {
  it("keeps all six dimensions when review-marker removal leaves period separators", () => {
    const stage10 = `
SMP: "Stealth. By Design." — FIELD: Stealth. By Design.

**Fame:** 6/10 — Fame rationale.
**Truth Strength:** 6/10 — Truth rationale.
**Competitive Impossibility:** 6/10 — CORRECTED ON REVIEW (was 5/10). Competitive rationale.
**Brand Permission:** 7/10 — RE-RUN UNDER CORRECTED ANCHORS (was 6/10). Permission rationale.
**Clean Air:** 8/10 — RE-RUN UNDER CORRECTED ANCHORS (was 4/10). Clean-air rationale.
**Commercial Precedent:** 7/10 — RE-RUN UNDER CORRECTED ANCHORS (was 5/10). Precedent rationale.

CODE VERDICT: PASS
`;

    expect(extractWinnerScores(stage10, "Stealth. By Design.")).toEqual([
      { dimension: "Fame", score: "6/10", rationale: "Fame rationale." },
      { dimension: "Truth Strength", score: "6/10", rationale: "Truth rationale." },
      {
        dimension: "Competitive Impossibility",
        score: "6/10",
        rationale: "Competitive rationale.",
      },
      { dimension: "Brand Permission", score: "7/10", rationale: "Permission rationale." },
      { dimension: "Clean Air", score: "8/10", rationale: "Clean-air rationale." },
      {
        dimension: "Commercial Precedent",
        score: "7/10",
        rationale: "Precedent rationale.",
      },
    ]);
  });
});