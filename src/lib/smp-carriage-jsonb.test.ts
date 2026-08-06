import { describe, it, expect } from "vitest";
import { assertSmpVerbatimCarriage, flattenStrings } from "@/lib/smp-carriage";
const smp = "Your largest spend is your least defended decision.";
const good = (l:string)=>`# ${l}\nSMP (VERBATIM):\n${smp}\n\nbody`;
describe("stage21 jsonb", () => {
  it("passes with jsonb channel briefs", () => {
    const j = { tv: good("tv"), ooh: good("ooh") };
    expect(() => assertSmpVerbatimCarriage(smp, [
      {label:"Stage 20",output:good("20")},
      {label:"Stage 21",output:flattenStrings(j)},
    ])).not.toThrow();
    expect(() => assertSmpVerbatimCarriage(smp, [
      {label:"Stage 21",output:JSON.stringify(j)},
    ])).toThrow();
  });
});
