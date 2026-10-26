import { describe, it, expect } from "vitest";
import { deriveRunFacts } from "./run-facts";

function jlrLike(): Record<string, unknown> {
  const s: Record<string, unknown> = { run_mode: "full" };
  for (let n = 1; n <= 22; n++) if (n !== 16 && n !== 21) s[`stage_${n}_output`] = "x".repeat(50);
  s.stage_16_vision_output = "v".repeat(2000);
  s.stage_21_outputs = { outdoor: "brief", search: "brief" };
  return s;
}

describe("Deliverables stage count", () => {
  it("counts Stage 16 formats and Stage 21 channel briefs: JLR-like full run is 22 of 22", () => {
    const f = deriveRunFacts(jlrLike());
    expect(f.stagesCompleted).toBe(22);
    expect(f.stagesTotal).toBe(22);
  });

  it("does not count Stage 16 or 21 when nothing is saved", () => {
    const s = jlrLike();
    delete s.stage_16_vision_output;
    s.stage_21_outputs = {};
    expect(deriveRunFacts(s).stagesCompleted).toBe(20);
  });

  it("diagnostic runs count against 13 stages", () => {
    const s: Record<string, unknown> = { run_mode: "diagnostic" };
    for (let n = 1; n <= 13; n++) s[`stage_${n}_output`] = "x";
    const f = deriveRunFacts(s);
    expect(f.stagesCompleted).toBe(13);
    expect(f.stagesTotal).toBe(13);
  });
});
