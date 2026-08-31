import { describe, expect, it } from "vitest";
import {
  humaniseBanners,
  injectStage10Scores,
  parseStage10Scores,
  relabelScoreScale,
  resolveSelfNegatingFindings,
} from "./appendix-humanise";
import { expandAcronymsFirstUse } from "./acronyms";

const STAGE10 = `## Stage 10
SMP: "One." — FIELD: X
Fame: 8/10 — a
Truth Strength: 7/10 — a
Competitive Impossibility: 9/10 — a
Brand Permission: 7/10 — a
Clean Air: 8/10 — a
Commercial Precedent: 6/10 — a
CODE COMPOSITE: 69.5/100 weighted

SMP: "Two." — FIELD: X
Fame: 8/10 — a
Truth Strength: 8/10 — a
Competitive Impossibility: 9/10 — a
Brand Permission: 7/10 — a
Clean Air: 7/10 — a
Commercial Precedent: 6/10 — a
CODE COMPOSITE: 70.5/100 weighted
`;

describe("appendix humanisation", () => {
  it("parses per-proposition Stage 10 scores", () => {
    const s = parseStage10Scores(STAGE10);
    expect(s.map((x) => [x.proposition, x.composite])).toEqual([
      ["One.", 69.5],
      ["Two.", 70.5],
    ]);
  });

  it("replaces a templated Stage 12 score block per card", () => {
    const s12 = `"One."\nFame: 8/10 (30%) | Truth Strength: 8/10 (20%) | Competitive Impossibility: 9/10 (15%)\nBrand Permission: 7/10 (10%) | Clean Air: 7/10 (10%) | Commercial Precedent: 6/10 (5%)\nWeighted Composite: 70.5/100\n\n"Two."\nFame: 8/10 (30%) | Truth Strength: 8/10 (20%) | Competitive Impossibility: 9/10 (15%)\nBrand Permission: 7/10 (10%) | Clean Air: 7/10 (10%) | Commercial Precedent: 6/10 (5%)\nWeighted Composite: 70.5/100`;
    const out = injectStage10Scores(s12, STAGE10);
    expect(out).toContain("Truth Strength: 7/10 (20%)");
    expect(out).toContain("Weighted Composite: 69.5/90");
    expect(out).toContain("Weighted Composite: 70.5/90");
  });

  it("rewrites machine banners as prose", () => {
    const out = humaniseBanners(
      "==== CODE-COMPUTED STAGE 10 SUMMARY (V6 — AUTHORITATIVE; OVERRIDES ANY LLM VERDICT) ====\n==== LEFT-OF-CENTRE CANDIDATES — STAGE 9 DISTINCTIVENESS PASS ====",
    );
    expect(out).not.toContain("====");
    expect(out).toContain("Stage 10 summary");
    expect(out).toContain("Left-of-Centre candidates");
  });

  it("labels the weighted scale at its true 90-point ceiling", () => {
    expect(relabelScoreScale("Weighted Composite: 70.5/100")).toBe(
      "Weighted Composite: 70.5/90",
    );
    expect(relabelScoreScale("CODE COMPOSITE: 57.5/100 weighted")).toContain("57.5/90 weighted");
  });

  it("collapses a self-negating audit bullet to its confirmed finding", () => {
    const out = resolveSelfNegatingFindings(
      '- **MINOR — Stage 14C.** ... no true banned instance found here. The only genuine second instance was checked and NOT found. The confirmed second flag is Stage 14 Dimension 5, where X recurs. **Correction:** fix it.',
    );
    expect(out).not.toContain("no true banned instance found here");
    expect(out).toContain("Confirmed finding: Stage 14 Dimension 5");
    expect(out).toContain("**MINOR — Stage 14C.**");
  });

  it("never expands an acronym inside an identifier token", () => {
    expect(expandAcronymsFirstUse("candidates (LOC-1–LOC-12) assessed", new Set())).toBe(
      "candidates (LOC-1–LOC-12) assessed",
    );
    expect(expandAcronymsFirstUse("the LOC engine", new Set())).toContain(
      "LOC (Left-of-Centre) engine",
    );
  });
});
