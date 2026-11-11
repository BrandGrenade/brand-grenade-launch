import { describe, expect, it } from "vitest";
import saved from "./fixtures/jlr-v97-phase2-saved.json";
import { stage17Scores, stage18Scores, stage20Scores, PARSED } from "./phase2-scores";

const s = saved as Record<string, any>;
const inText = (v: any, field: string) => {
  expect(v.status).toBe("produced");
  expect(s[field]).toContain(v.source.text);
  expect(v.source.text.endsWith(v.value) || v.source.text.includes(`, ${v.value}.`)).toBe(true);
};

describe("JLR v97 Phase 2 scores are copied verbatim from saved text", () => {
  it("Stage 17: selected territory Creative Share of Voice labels", () => {
    const r = stage17Scores(s.stage_17_output, s.stage_17_selected_territory)!;
    expect(r.selected_territory).toMatchObject({ status: "produced", value: "THE SPECIES TAKES FORM" });
    for (const [label, v] of Object.entries(r.selected_creative_share_of_voice) as [string, any][]) {
      inText(v, "stage_17_output");
      expect(v.source.text).toBe(`${label}: HIGH`);
      expect(v.source_flag).toBe(PARSED);
    }
    expect(r.territories).toHaveLength(3);
  });
  it("Stage 18: eight dimensions, 73/90, PASS, detonation and line from saved fields", () => {
    const r = stage18Scores(s.stage_18_output, s.stage_18_selected_detonation, s.stage_18_detonation_line)!;
    expect(Array.isArray(r.dimensions) && r.dimensions.length).toBe(8);
    for (const d of r.dimensions as any[]) inText(d, "stage_18_output");
    expect((r.dimensions as any[]).map((d) => d.value)).toEqual(["9", "10", "9", "10", "8", "9", "9", "9"]);
    expect(r.composite).toMatchObject({ value: "73/90", source: { text: "COMPOSITE: 73/90" } });
    expect(r.status).toMatchObject({ value: "PASS" });
    expect(r.selected_detonation).toMatchObject({ value: s.stage_18_selected_detonation, source_flag: "saved field" });
    expect(r.detonation_line).toMatchObject({ value: "The name comes last." });
  });
  it("Stage 20: five dimensions, 44/50, PASS", () => {
    const r = stage20Scores(s.stage_20_output, s.stage_20_approved)!;
    const vals = Object.fromEntries(Object.entries(r.dimensions).map(([k, v]: any) => { inText(v, "stage_20_output"); return [k, v.value]; }));
    expect(vals).toEqual({ "Emotional Clarity": "9/10", "Fame Invitation": "9/10", "Distinctive Asset Integration": "8/10", "Psychological Leverage": "9/10", "Creative SoV Ambition": "9/10" });
    expect(r.composite).toMatchObject({ value: "44/50" });
    expect(r.status).toMatchObject({ value: "PASS" });
    expect(r.approved).toBe(true);
  });
});

describe("missing or ambiguous text returns not_produced with a reason", () => {
  it("empty stage text → null (output not_produced)", () => {
    expect(stage17Scores(null, null)).toBeNull();
    expect(stage18Scores("", null, null)).toBeNull();
    expect(stage20Scores(undefined, null)).toBeNull();
  });
  it("duplicated composite is ambiguous", () => {
    const r = stage20Scores(s.stage_20_output + "\nCOMPOSITE: 30/50", true)!;
    expect(r.composite).toMatchObject({ status: "not_produced", reason: expect.stringContaining("ambiguous") });
  });
  it("missing label and non-standard value are not_produced, never guessed", () => {
    const r = stage20Scores("Emotional Clarity: nine\nCOMPOSITE: 44", true)!;
    expect(r.dimensions["Emotional Clarity"]).toMatchObject({ status: "not_produced" });
    expect(r.dimensions["Fame Invitation"]).toMatchObject({ status: "not_produced", reason: expect.stringContaining("not found") });
    expect(r.composite).toMatchObject({ status: "not_produced" });
    const t = stage17Scores("A\nWHY THIS TERRITORY SERVES THE SMP:\nEmotional Weight: Very high\n", "## A")!;
    expect(t.selected_creative_share_of_voice["Emotional Weight"]).toMatchObject({ status: "not_produced" });
  });
  it("unmatched selected territory makes its labels not_produced", () => {
    const t = stage17Scores(s.stage_17_output, "## SOMETHING ELSE")!;
    expect(t.selected_territory.status).toBe("not_produced");
    expect(Object.values(t.selected_creative_share_of_voice).every((v: any) => v.status === "not_produced")).toBe(true);
  });
  it("seven dimension lines are not_produced", () => {
    const cut = s.stage_18_output.replace(/^Cultural participation, 8\..*$/m, "");
    expect(stage18Scores(cut, "x", "y")!.dimensions).toMatchObject({ status: "not_produced" });
  });
});
