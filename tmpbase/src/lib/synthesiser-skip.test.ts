import { describe, it, expect } from "vitest";
import {
  assertSkipLeavesLabUnchanged,
  assertSkipSourceInvariants,
} from "@/lib/synthesiser-skip";

const BASELINE = JSON.stringify({ brand: "", fields: {} });

describe("Room 00 skip path", () => {
  it("leaves the Lab byte-identical and writes nothing", () => {
    const detail = assertSkipLeavesLabUnchanged({
      snapshot: BASELINE,
      afterSkip: (h) =>
        JSON.stringify({ brand: h?.brand ?? "", fields: h?.fields ?? {} }),
    });
    expect(detail).toContain("byte-identical");
  });

  it("fails when the Lab would be prefilled after a skip", () => {
    expect(() =>
      assertSkipLeavesLabUnchanged({
        snapshot: BASELINE,
        afterSkip: () => JSON.stringify({ brand: "Leaked", fields: {} }),
      }),
    ).toThrow(/byte-identical/);
  });

  it("catches an unguarded handoff write in the Room 00 source", () => {
    expect(() =>
      assertSkipSourceInvariants({
        synthesiserRoom:
          "Skip to Intelligence Lab Skip to Intelligence Lab writeSynthesiserHandoff({})",
        intelligenceNew: "useState(() => consumeSynthesiserHandoff())",
      }),
    ).toThrow(/skip-path invariants broken/);
  });
});
