import { describe, it, expect } from "vitest";
import {
  validateStructured, structuredInstruction,
  checkStageCurrentPosition, resolveCurrentProposition,
} from "./structured-output";
import { sessionFieldsFromMeta } from "./deal-brief";

const t = (result = "HOLDS") => ({ result, rationale: "r" });
const block = (smp: string) => ({
  smp, field_name: "F", iconic_tier: false,
  tests: {
    T1: t(), T2: t(), T3: t(), T4: t(),
    T5: { ...t(), counter_line: "c", classification: "UNCERTAIN" },
    T6: t(), T7: { ...t(), misreading: "m", guard_rail: "g" }, T8: { result: "N/A", rationale: null },
  },
  verdict: "VALIDATED", fatal: [], flags: [], exposure_note: null, strategic_note: null, rewrite: null, iconic_final: "N/A",
});
const s11 = (cp: unknown) => ({ blocks: [block("Line A")], ...(cp === undefined ? {} : { current_position: cp }), surviving_set: ["Line A"], exposed_count: 0, divergence_preserved: true });
const cred = (n: number) => Object.fromEntries(["product_truth_alignment", "audience_permission", "tonal_compatibility", "behavioural_capacity", "cultural_authority", "historical_consistency"].map((k) => [k, { score: n, justification: "j" }]));
const s13 = (cp: unknown) => ({
  verdict: "CONFIRMED — PROCEED", verdict_reason: "r", credibility: cred(8), most_vulnerable: "behavioural_capacity", forcing_test: null,
  ownership: { own: "o", behave: "b", sustain: "s" }, adjustments: [], section5: { mode: "GUARDRAILS", items: [] }, commitments: ["c"],
  ...(cp === undefined ? {} : { current_position: cp }),
});
const wrap = (o: unknown) => JSON.stringify(o);
const client = resolveCurrentProposition({ current_proposition: "Built to last", current_proposition_source: "Brief", current_proposition_date: "2026-10-01" });
const stored = resolveCurrentProposition({ brand_positioning: "Drive the future" });
const none = resolveCurrentProposition({});

describe("T1 Stage 11 / 13 current position", () => {
  it("Campaign (no ctx.current): no current_position key, instruction unchanged", () => {
    const v = validateStructured("11", wrap(s11(block("Built to last"))), {});
    expect(v.error).toBeNull();
    expect(v.structured).not.toHaveProperty("current_position");
    const v13 = validateStructured("13", wrap(s13({ credibility: cred(6), most_vulnerable: "audience_permission" })), {});
    expect(v13.structured).not.toHaveProperty("current_position");
    expect(structuredInstruction("11")).not.toContain("CURRENT POSITION");
    expect(structuredInstruction("13")).not.toContain("CURRENT POSITION");
  });

  it("Deal Stage 11: scored T1–T8 block marked current, excluded, Client-supplied", () => {
    const v = validateStructured("11", wrap(s11(block("Built to last"))), { current: client });
    const cp = (v.structured as any).current_position;
    expect(cp).toMatchObject({ status: "scored", line: "Built to last", is_current: true, excluded_from_selection: true, evidence_label: "Client-supplied", source: "Brief", source_date: "2026-10-01" });
    expect(Object.keys(cp.tests)).toEqual(["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8"]);
    expect((v.structured as any).blocks).toHaveLength(1);
    expect(checkStageCurrentPosition("11", cp).ok).toBe(true);
    expect(structuredInstruction("11", client)).toContain("all eight tests (T1–T8)");
  });

  it("Deal Stage 11: current proposition in surviving_set is rejected", () => {
    const o = s11(block("Built to last")); o.surviving_set.push("Built to last");
    expect(validateStructured("11", wrap(o), { current: client }).error).toMatch(/excluded from selection/);
  });

  it("Deal Stage 13: six credibility dimensions, Unverified for stored positioning", () => {
    const v = validateStructured("13", wrap(s13({ credibility: cred(4), most_vulnerable: "cultural_authority" })), { current: stored });
    expect(v.error).toBeNull();
    const cp = (v.structured as any).current_position;
    expect(cp).toMatchObject({ status: "scored", evidence_label: "Unverified", is_current: true, excluded_from_selection: true, source_date: null });
    expect(Object.keys(cp.credibility)).toHaveLength(6);
    expect((v.structured as any).verdict).toBe("CONFIRMED — PROCEED");
    expect(checkStageCurrentPosition("13", cp).ok).toBe(true);
  });

  it("no current proposition / model omitted it: not scored with reason", () => {
    for (const stage of ["11", "13"] as const) {
      const none1 = validateStructured(stage, wrap(stage === "11" ? s11(null) : s13(null)), { current: none });
      expect((none1.structured as any).current_position).toMatchObject({ status: "not_scored", is_current: true });
      expect((none1.structured as any).current_position.reason).toMatch(/not scored/);
      const miss = validateStructured(stage, wrap(stage === "11" ? s11(undefined) : s13(undefined)), { current: client });
      expect((miss.structured as any).current_position).toMatchObject({ status: "not_scored", line: "Built to last" });
    }
    expect(checkStageCurrentPosition("13", { status: "scored", line: "x" }).ok).toBe(false);
  });
});

describe("T1 saved brief meta", () => {
  const deal = { transactionType: "exit", targetBrands: ["A"], decisionQuestions: ["Q?"], competitors: ["B"], decisionDate: "2026-12-01", depth: "outside-in" };
  it("Deal meta round-trips into createSession fields", () => {
    const r = sessionFieldsFromMeta({ briefType: "deal", deal, currentProposition: { line: "L", source: "S", date: "2026-10-01" } });
    expect(r.ok).toBe(true);
    expect(r.fields).toMatchObject({ briefType: "deal", runMode: "diagnostic", deal, currentProposition: "L", currentPropositionSource: "S", currentPropositionDate: "2026-10-01" });
  });
  it("incomplete Deal meta is not auto-run; absent meta is Campaign", () => {
    expect(sessionFieldsFromMeta({ briefType: "deal", deal: { ...deal, decisionQuestions: [] } }).ok).toBe(false);
    expect(sessionFieldsFromMeta(undefined)).toEqual({ ok: true, fields: { briefType: "campaign", runMode: undefined } });
  });
});
