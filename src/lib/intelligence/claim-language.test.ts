import { describe, expect, it } from "vitest";
import {
  ABSENCE_QUALIFIER,
  classifyEvidenceBasis,
  labelModelledTimeframe,
  looksLikeAbsenceClaim,
  qualifyAbsenceClaim,
} from "./claim-language";

describe("absence findings", () => {
  it("detects flat vacancy assertions", () => {
    expect(looksLikeAbsenceClaim("No brand in the category owns durability.")).toBe(true);
    expect(looksLikeAbsenceClaim("The emotional territory is unoccupied.")).toBe(true);
    expect(looksLikeAbsenceClaim("Nobody claims the everyday-use position.")).toBe(true);
  });

  it("leaves measured statements alone", () => {
    const t = "Toyota ran 14 national campaigns on capability in 2025 (VFACTS/Nielsen).";
    expect(looksLikeAbsenceClaim(t)).toBe(false);
    expect(qualifyAbsenceClaim(t)).toBe(t);
  });

  it("qualifies an absence claim once", () => {
    const out = qualifyAbsenceClaim("No competitor owns the reliability claim.");
    expect(out).toContain(ABSENCE_QUALIFIER);
    expect(qualifyAbsenceClaim(out)).toBe(out);
  });

  it("does not re-qualify prose already written as evidence of absence", () => {
    const t = "No evidence was found in the inputs supplied of a competitor claiming reliability.";
    expect(qualifyAbsenceClaim(t)).toBe(t);
  });

  it("classifies basis from the cell", () => {
    expect(classifyEvidenceBasis({ evidence_basis: "observed" })).toBe("observed");
    expect(
      classifyEvidenceBasis({ assessment: "No brand owns this space.", evidence: "" }),
    ).toBe("absence_of_evidence");
    expect(classifyEvidenceBasis({ assessment: "Trust is rising.", evidence: "" })).toBe(
      "inferred",
    );
    expect(
      classifyEvidenceBasis({ assessment: "Trust is rising.", evidence: "Brand tracker Q3 2025." }),
    ).toBe("observed");
  });
});

describe("modelled timeframes", () => {
  it("labels a bare horizon", () => {
    expect(labelModelledTimeframe("18-24 months")).toBe(
      "18-24 months — modelled estimate, not measured.",
    );
    expect(labelModelledTimeframe("Roughly two years before saturation")).toContain(
      "modelled estimate, not measured",
    );
  });

  it("does not double-label", () => {
    const t = "18–24 months — modelled estimate, not measured.";
    expect(labelModelledTimeframe(t)).toBe(t);
    expect(labelModelledTimeframe("12 months (estimated)")).toBe("12 months (estimated)");
  });

  it("ignores text with no horizon", () => {
    expect(labelModelledTimeframe("Scale independent")).toBe("Scale independent");
  });
});
