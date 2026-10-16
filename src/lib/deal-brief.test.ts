import { describe, it, expect } from "vitest";
import { buildDealContext, DealFieldsSchema, isDealFramedStage, linesToList, dealSummary } from "./deal-brief";

const deal = { brief_type: "deal", deal_transaction_type: "buy-side", deal_target_brands: ["Acme"], deal_decision_questions: ["Can the brand stretch into EV?", "Is the premium defensible?"] };

describe("deal brief", () => {
  it("frames only Stages 1–13", () => {
    for (const s of ["1", "1B", "2", "4b", "9", "10", "13"]) expect(isDealFramedStage(s)).toBe(true);
    for (const s of ["13B", "14", "16", "22", "IE", "BR1", "cs-bigidea", undefined]) expect(isDealFramedStage(s)).toBe(false);
  });
  it("campaign runs get no context block", () => {
    expect(buildDealContext({ brief_type: "campaign" })).toBeNull();
    expect(buildDealContext(null)).toBeNull();
  });
  it("deal context carries transaction type and every decision question", () => {
    const b = buildDealContext(deal)!;
    expect(b).toContain("Transaction type: buy-side");
    expect(b).toContain("1. Can the brand stretch into EV?");
    expect(b).toContain("2. Is the premium defensible?");
    expect(b).toMatch(/Do not change the format/);
  });
  it("requires every deal field", () => {
    const ok = { transactionType: "exit", targetBrands: ["A"], decisionQuestions: ["Q"], competitors: ["C"], decisionDate: "2026-12-01", depth: "outside-in" };
    expect(DealFieldsSchema.safeParse(ok).success).toBe(true);
    for (const k of Object.keys(ok)) expect(DealFieldsSchema.safeParse({ ...ok, [k]: undefined }).success).toBe(false);
    expect(DealFieldsSchema.safeParse({ ...ok, transactionType: "merger" }).success).toBe(false);
    expect(DealFieldsSchema.safeParse({ ...ok, decisionQuestions: [] }).success).toBe(false);
  });
  it("parses one-per-line lists", () => {
    expect(linesToList("- A\n\n2. B \n• C")).toEqual(["A", "B", "C"]);
  });
  it("access summary", () => {
    expect(dealSummary({ brief_type: "campaign" })).toEqual({ brief_type: "campaign", deal: null });
    expect(dealSummary({})).toEqual({ brief_type: "campaign", deal: null });
    expect(dealSummary({ ...deal, deal_depth: "data-room" }).deal?.depth).toBe("data-room");
  });
});
