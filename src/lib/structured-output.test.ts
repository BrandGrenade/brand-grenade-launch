import { describe, expect, it } from "vitest";
import {
  STRUCTURED_CLOSE, STRUCTURED_OPEN, filterStructuredStream, resolveCurrentProposition,
  splitStructured, structuredInstruction, validateStructured,
} from "./structured-output";

const d = (score: number) => ({ score, justification: "j" });
const row = (smp: string, s: number) => ({
  smp, field_name: "F", fame: d(s), truth_strength: d(s),
  competitive_impossibility: { ...d(s), competitor: "Rival", competitor_claim: "c" },
  brand_permission: { ...d(s), evidence: "e" },
  clean_air: { ...d(s), occupier: "Rival", occupying_claim: "c" },
  commercial_precedent: { ...d(s), precedents: [{ brand: "B", campaign: "C", year: 2004 }] },
});
const s10 = (n: number, current: unknown = null) =>
  JSON.stringify({ smps_scored: n, selection_rule: "r", scores: Array.from({ length: n }, (_, i) => row(`SMP ${i + 1}`, 7 + (i % 3))), current_position: current });

describe("split / stream filter", () => {
  const text = "## Header\nBody text.";
  const raw = `${text}\n\n${STRUCTURED_OPEN}\n{"a":1}\n${STRUCTURED_CLOSE}`;
  it("saved text is identical to the text before the block", () => {
    expect(splitStructured(raw)).toEqual({ text, block: '{"a":1}' });
    expect(splitStructured(text)).toEqual({ text, block: null });
  });
  it("stream never shows the block, even when the marker is split across deltas", async () => {
    async function* src() { for (let i = 0; i < raw.length; i += 3) yield raw.slice(i, i + 3); }
    const sink = { raw: "" };
    let shown = "";
    for await (const x of filterStructuredStream(src(), sink)) shown += x;
    expect(shown).toBe(text);
    expect(sink.raw).toBe(raw);
  });
  it("stream without a block passes through unchanged", async () => {
    async function* src() { yield "abc <<"; yield "< not a marker\n"; }
    let shown = "";
    for await (const x of filterStructuredStream(src(), { raw: "" })) shown += x;
    expect(shown).toBe("abc <<< not a marker\n");
  });
});

describe("validation failures are recorded, never thrown", () => {
  it("missing / invalid block", () => {
    expect(validateStructured("10", null).error).toMatch(/No structured/);
    expect(validateStructured("10", "{bad").error).toMatch(/not valid JSON/);
  });
  it("Stage 10 count mismatch", () => {
    expect(validateStructured("10", s10(3), { expectedCount: 4 }).error).toMatch(/expected 4/);
  });
  it("Stage 10 adds code composite and verdict", () => {
    const v = validateStructured("10", s10(2), { expectedCount: 2 });
    const scores = (v.structured as any).scores;
    expect(scores[0].composite).toBe(63);
    expect(scores[0].code_verdict).toBe("PASS");
  });
});

describe("current position", () => {
  it("brief entry is Client-supplied with source and date, and deltas per dimension", () => {
    const cur = resolveCurrentProposition({ current_proposition: "Old line", current_proposition_source: "TV ad", current_proposition_date: "2025-03-01" });
    const v = validateStructured("10", s10(3, row("Old line", 5)), { expectedCount: 3, current: cur });
    const cp = (v.structured as any).current_position;
    expect(cp).toMatchObject({ status: "scored", evidence_label: "Client-supplied", source: "TV ad", source_date: "2025-03-01", excluded_from_selection: true });
    expect(cp.deltas[0].fame).toBe(9 - 5);
    expect((v.structured as any).scores).toHaveLength(3); // never added to the candidate set
  });
  it("stored positioning is Unverified with the source named", () => {
    const cur = resolveCurrentProposition({ brand_positioning: "Stored line" });
    expect(cur).toMatchObject({ kind: "stored" });
    const cp = (validateStructured("10", s10(1, row("Stored line", 6)), { current: cur }).structured as any).current_position;
    expect(cp.evidence_label).toBe("Unverified");
    expect(cp.source).toMatch(/Stored brand positioning/);
  });
  it("neither: not scored and the slot says so; prompt asks for null", () => {
    const cur = resolveCurrentProposition({});
    expect(cur.kind).toBe("none");
    const cp = (validateStructured("10", s10(1), { current: cur }).structured as any).current_position;
    expect(cp.status).toBe("not_scored");
    expect(cp.reason).toMatch(/not scored/);
    expect(structuredInstruction("10", cur)).toMatch(/"current_position" to null/);
    expect(structuredInstruction("10", resolveCurrentProposition({ current_proposition: "X" }))).toMatch(/Do NOT mention/);
  });
});

describe("Stage 11 and 13 checks", () => {
  const t = { result: "HOLDS", rationale: "r" };
  const block = (verdict: string, fatal: string[] = []) => ({
    smp: "SMP 1", field_name: "F", iconic_tier: false,
    tests: { T1: t, T2: t, T3: t, T4: t, T5: { ...t, counter_line: "", classification: "UNCERTAIN" }, T6: t, T7: { ...t, misreading: "", guard_rail: "" }, T8: { result: "N/A", rationale: null } },
    verdict, fatal, flags: [], exposure_note: null, strategic_note: null, rewrite: null, iconic_final: "N/A",
  });
  const s11 = (b: unknown) => JSON.stringify({ blocks: [b], surviving_set: [], exposed_count: 0, divergence_preserved: true });
  it("Stage 10 eliminated ⇒ ELIMINATED with STAGE10-FLOOR", () => {
    expect(validateStructured("11", s11(block("VALIDATED")), { expectedCount: 1, stage10Eliminated: ["SMP 1"] }).error).toMatch(/STAGE10-FLOOR/);
    expect(validateStructured("11", s11(block("ELIMINATED", ["STAGE10-FLOOR"])), { expectedCount: 1, stage10Eliminated: ["SMP 1"] }).error).toBeNull();
  });
  it("Stage 13 forcing test present exactly when a trigger dimension ≤5", () => {
    const cred = (low: number) => Object.fromEntries(["product_truth_alignment", "audience_permission", "tonal_compatibility", "behavioural_capacity", "cultural_authority", "historical_consistency"].map((k) => [k, d(k === "behavioural_capacity" ? low : 8)]));
    const base = (low: number, forcing: unknown, mode: string) => JSON.stringify({
      verdict: "CONFIRMED — PROCEED", verdict_reason: "r", credibility: cred(low), most_vulnerable: "behavioural_capacity",
      forcing_test: forcing, ownership: { own: "a", behave: "b", sustain: "c" }, adjustments: [],
      section5: { mode, items: [{ text: "x", dimension: null, horizon: null }] }, commitments: ["c"],
    });
    expect(validateStructured("13", base(8, null, "GUARDRAILS")).error).toBeNull();
    expect(validateStructured("13", base(4, null, "GUARDRAILS")).error).toMatch(/forcing_test is missing/);
    expect(validateStructured("13", base(4, { triggered: true, verdict: "FORCING PROPOSITION", path_or_reason: "p" }, "OPERATIONAL_REQUIREMENTS")).error).toBeNull();
  });
});
