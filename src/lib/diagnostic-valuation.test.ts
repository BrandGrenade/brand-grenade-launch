import { describe, expect, it } from "vitest";
import { buildDiagnosticValuation } from "./diagnostic-valuation";
import { VALUATION_DURABILITY_PROMPT } from "./stage16-sections";

import { diagnosticFixture } from "./diagnostic-valuation.fixture";

describe("B1 diagnostic valuation", () => {
  it("uses the current position, never the candidate, for the main strength section", () => {
    const doc = buildDiagnosticValuation(diagnosticFixture());
    const strength = doc.split("# SECTION ONE")[1].split("# SECTION TWO")[0];
    expect(strength).toContain("Existing position");
    expect(strength).toContain("Fame: 4/10");
    expect(strength).toContain("Composite: 36/90");
    expect(strength).not.toContain("Candidate position");
    expect(doc).toContain("proposition under test — not current brand strength");
    expect(doc.match(/^# SECTION /gm)).toHaveLength(6);
  });
  it("reports missing and not-scored baselines without falling back to candidate or text scores", () => {
    const fixture = diagnosticFixture();
    const doc = buildDiagnosticValuation({ ...fixture, stage_10_structured: { ...fixture.stage_10_structured, current_position: { status: "not_scored", reason: "No current proposition supplied" } }, stage_11_structured: null, stage_13_structured: null });
    const strength = doc.split("# SECTION ONE")[1].split("# SECTION TWO")[0];
    expect(strength).toContain("No current proposition supplied");
    expect(strength).not.toContain("9/10");
    expect(doc).toContain("Current position: not scored / missing");
  });
  it("covers all seven ordinary tests and conditional T8 with separate proposition verdict", () => {
    const ordinary = buildDiagnosticValuation(diagnosticFixture());
    for (let n = 1; n <= 7; n++) expect(ordinary).toContain(`T${n} —`);
    expect(ordinary).not.toContain("T8 —");
    const iconic = buildDiagnosticValuation(diagnosticFixture(true));
    expect(iconic).toContain("T8 — Iconic Tier Sustainability: CRACKS");
    expect(iconic).toContain("Proposition verdict (separate): VALIDATED");
    expect(iconic).toContain("Iconic final status: DOWNGRADED");
    expect(VALUATION_DURABILITY_PROMPT).toContain("T1–T7");
    expect(VALUATION_DURABILITY_PROMPT).toContain("T8 where applicable");
  });
});