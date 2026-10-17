import { describe, expect, it } from "vitest";
import { buildDiagnosticValuation } from "./diagnostic-valuation";
import { validateStructured } from "./structured-output";
import { VALUATION_DURABILITY_PROMPT } from "./stage16-sections";

const dim = (score: number) => ({ score, justification: `Evidence for ${score}` });
const row = (smp: string, score: number) => ({
  smp, field_name: "F", fame: dim(score), truth_strength: dim(score),
  competitive_impossibility: { ...dim(score), competitor: "Rival", competitor_claim: "Claim" },
  brand_permission: { ...dim(score), evidence: "Recorded behaviour" },
  clean_air: { ...dim(score), occupier: "Rival", occupying_claim: "Claim" },
  commercial_precedent: { ...dim(score), precedents: [] },
});
const t = { result: "HOLDS", rationale: "Supported" };
const block = (smp: string, iconic_tier = false) => ({
  smp, field_name: "F", iconic_tier, tests: {
    T1: t, T2: t, T3: t, T4: t, T5: { ...t, counter_line: "Counter", classification: "COMPETES-FOR-TERRITORY" },
    T6: t, T7: { ...t, misreading: "Misreading", guard_rail: "Guard" },
    T8: { result: iconic_tier ? "CRACKS" : "N/A", rationale: iconic_tier ? "Only two truths" : null },
  }, verdict: "VALIDATED", fatal: [], flags: [], exposure_note: null, strategic_note: null, rewrite: null,
  iconic_final: iconic_tier ? "DOWNGRADED" : "N/A",
});
const credibility = Object.fromEntries(["product_truth_alignment", "audience_permission", "tonal_compatibility", "behavioural_capacity", "cultural_authority", "historical_consistency"].map((k) => [k, dim(8)]));
export function diagnosticFixture(iconic = false) {
  const current = { kind: "client" as const, line: "Existing position", source: "Client brief", date: "2026-10-17" };
  return {
    brand_name: "Marlowe Motor Company", category: "Cars", selected_smp: "Candidate position",
    stage_9_structured: { propositions: [{ id: "P1", smp: "Candidate position", field_name: "F", foundation: { territory: "New territory", truth: "Recorded truth", reinterpretation: "New view" }, impossibility: [{ competitor: "Rival", why_they_cannot: "Missing capability" }], creative_territory: "Territory", creative_function: { class: "PLATFORM", rationale: "Reason" } }], ranking: [{ id: "P1", rank: 1, rationale: "Reason" }], recommended: ["P1"] },
    stage_10_structured: validateStructured("10", JSON.stringify({ smps_scored: 1, selection_rule: "Human", scores: [row("Candidate position", 9)], current_position: row("Existing position", 4) }), { current }).structured,
    stage_11_structured: validateStructured("11", JSON.stringify({ blocks: [block("Candidate position", iconic)], current_position: block("Existing position", iconic), surviving_set: ["Candidate position"], exposed_count: 0, divergence_preserved: true }), { current }).structured,
    stage_13_structured: validateStructured("13", JSON.stringify({ verdict: "CONFIRMED — PROCEED", verdict_reason: "Fits", credibility, most_vulnerable: "cultural_authority", forcing_test: null, ownership: { own: "Own", behave: "Behave", sustain: "Sustain" }, adjustments: [], section5: { mode: "GUARDRAILS", items: [{ text: "Maintain evidence", dimension: null, horizon: null }] }, commitments: ["Commit"], current_position: { credibility, most_vulnerable: "cultural_authority" } }), { current }).structured,
  };
}
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