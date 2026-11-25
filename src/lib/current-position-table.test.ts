import { describe, expect, it } from "vitest";
import { positionTableRows, positionTableStages } from "./current-position-table";

const cp = {
  fame: { score: 3 }, truth_strength: { score: 6 }, competitive_impossibility: { score: 2 },
  brand_permission: { score: 7 }, clean_air: { score: 2 }, commercial_precedent: { score: 7 }, composite: 36.5,
  deltas: [{ smp: "Read our fault list before our price list.", fame: 5, truth_strength: 2, competitive_impossibility: 6, brand_permission: 0, clean_air: 7, commercial_precedent: 2, composite: 36 }],
};

describe("current-position table", () => {
  it("baseline first, evidence-supported, raw scores and /90", () => {
    const [b] = positionTableRows(cp);
    expect(b).toEqual({ label: "Current (baseline)", basis: "evidence-supported", cells: ["3", "6", "2", "7", "2", "7", "36.5"] });
  });
  it("each alternative is modelled, own score with movement in brackets", () => {
    const r = positionTableRows(cp)[1]!;
    expect(r.basis).toBe("modelled");
    expect(r.cells).toEqual(["8 (+5)", "8 (+2)", "8 (+6)", "7 (0)", "9 (+7)", "9 (+2)", "72.5 (+36)"]);
  });
  it("is shown only in Stage 10 and the final Headroom summary, never on other stages", () => {
    expect(positionTableStages("headroom")).toEqual(["10", "13"]);
    expect(positionTableStages("turnaround")).toEqual(["10"]);
    expect(positionTableStages(null)).toEqual(["10"]);
    for (const s of ["01", "09", "11", "12"]) expect(positionTableStages("headroom")).not.toContain(s);
  });
});
