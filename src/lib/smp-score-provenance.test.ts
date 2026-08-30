import { describe, expect, it } from "vitest";
import { smpScoreProvenance } from "./minto-content";

const STAGE_10 = `SMP: "A jaguar never announces itself."
Fame: 7/10
Truth Strength: 7/10
CODE COMPOSITE: 70.5/100
CODE VERDICT: PASS

SMP: "We went quiet. Now watch."
CODE COMPOSITE: 69.5/100
CODE VERDICT: PASS

==== STAGE 10 RE-SCORE — LOCKED PROPOSITION ====
SMP: "Stealth. By Design." — FIELD: Jaguar / Automotive
Fame: 6/10
CODE COMPOSITE: 57.5/100
CODE VERDICT: PASS`;

describe("smpScoreProvenance", () => {
  it("flags a locked line that was scored only after the competitive pass", () => {
    const p = smpScoreProvenance(STAGE_10, "Stealth. By Design.");
    expect(p.postSelection).toBe(true);
    expect(p.competitive).toHaveLength(2);
    expect(p.topCompetitive?.name).toBe("A jaguar never announces itself.");
    expect(p.topCompetitive?.composite).toBe(70.5);
    expect(p.html).toContain("human judgement gate");
    expect(p.sentence).toContain("not a competitive rank");
  });

  it("stays clean for a proposition that was in the competitive field", () => {
    const p = smpScoreProvenance(STAGE_10, "A jaguar never announces itself.");
    expect(p.postSelection).toBe(false);
    expect(p.html).toBe("");
  });

  it("stays clean when there is no re-score block at all", () => {
    const plain = STAGE_10.split("==== STAGE 10 RE-SCORE")[0];
    expect(smpScoreProvenance(plain, "We went quiet. Now watch.").postSelection).toBe(false);
  });
});
