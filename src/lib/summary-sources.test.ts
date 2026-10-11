import { describe, expect, it } from "vitest";

import { extractWinnerScores, normaliseMd } from "./summary-sources";
import { stripDocumentMetadata } from "./strip-document-metadata";

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

  // Regression: the document pipeline runs stripDocumentMetadata BEFORE this
  // parser, which rewrites review markers to "6/10 (revised from 5/10)." —
  // the earlier test fed the raw text and missed it, so Jaguar downloads broke
  // twice. Always test through the real cleaning step.
  it("parses all six dimensions after the real metadata-cleaning step", () => {
    const stage10 = `
SMP: "Stealth. By Design." — FIELD: Stealth. By Design.

**Fame:** 6/10 — Fame rationale.
**Truth Strength:** 6/10 — Truth rationale.
**Competitive Impossibility:** 6/10 — CORRECTED ON REVIEW (was 5/10). Competitive rationale.
**Brand Permission:** 7/10 — RE-RUN UNDER CORRECTED ANCHORS (was 6/10). Permission rationale.
**Clean Air:** 8/10 — RE-RUN UNDER CORRECTED ANCHORS (was 4/10). Clean-air rationale.
**Commercial Precedent:** 7/10 — RE-RUN UNDER CORRECTED ANCHORS (was 5/10). Precedent rationale.
`;
    const rows = extractWinnerScores(normaliseMd(stripDocumentMetadata(stage10)), "Stealth. By Design.");
    expect(rows.map((r) => [r.dimension, r.score])).toEqual([
      ["Fame", "6/10"],
      ["Truth Strength", "6/10"],
      ["Competitive Impossibility", "6/10"],
      ["Brand Permission", "7/10"],
      ["Clean Air", "8/10"],
      ["Commercial Precedent", "7/10"],
    ]);
    expect(rows[2].rationale).toBe("Competitive rationale.");
    expect(rows.every((r) => !r.rationale.startsWith("*"))).toBe(true);
  });

  it("handles bold that closes after the score", () => {
    const stage10 = `SMP: "Line" — FIELD: X\n**Fame: 7/10** — Fame note.\n**Truth Strength: 6/10** — Truth note.\n`;
    expect(extractWinnerScores(stage10, "Line")).toEqual([
      { dimension: "Fame", score: "7/10", rationale: "Fame note." },
      { dimension: "Truth Strength", score: "6/10", rationale: "Truth note." },
    ]);
  });
});