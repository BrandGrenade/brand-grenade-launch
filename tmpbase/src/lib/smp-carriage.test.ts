import { describe, it, expect } from "vitest";
import { assertSmpVerbatimCarriage, checkSmpCarriage } from "@/lib/smp-carriage";
const smp = "Your largest spend is your least defended decision.";
const good = (l:string)=>`# ${l}\nSMP (VERBATIM):\n${smp}\n\nbody...`;
describe("smp carriage", () => {
  it("passes when all three carry verbatim", () => {
    const d = assertSmpVerbatimCarriage(smp, [
      {label:"Stage 20",output:good("20")},{label:"Stage 20B",output:good("20B")},{label:"Stage 21 (all channel briefs)",output:good("21")},
    ]);
    expect(d).toContain("carried verbatim");
  });
  it("tolerates smart quotes and whitespace", () => {
    const o = `SMP (VERBATIM):\nYour largest spend is your   least defended decision.`;
    expect(checkSmpCarriage(smp,[{label:"x",output:o}]).results[0].present).toBe(true);
  });
  it("fails on a channel paraphrase", () => {
    const para = "Section five: your biggest spend is the decision you defend least.";
    expect(() => assertSmpVerbatimCarriage(smp, [
      {label:"Stage 20",output:good("20")},{label:"Stage 21",output:para},
    ])).toThrow(/carry-through broken/);
  });
  it("fails when present but heading missing", () => {
    expect(() => assertSmpVerbatimCarriage(smp,[{label:"Stage 20B",output:`blah ${smp} blah`}])).toThrow(/carriage heading is missing/);
  });
});
