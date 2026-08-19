import { describe, it, expect } from "vitest";
import { cleanProposition } from "./clean-proposition";
import { namedSlotInNotes } from "./stimulus/revise-target";

describe("Issue 4 — proposition truncation", () => {
  // Constructed specifically to trigger the old bug: a legitimate second
  // sentence beginning "This lands".
  const trap =
    "The only bank that shows up before you ask. This lands hardest in the moments customers never plan for, and it is the whole point of the proposition.";

  it("keeps a legitimate second sentence starting with 'This lands'", () => {
    expect(cleanProposition(trap)).toBe(trap);
  });

  it("keeps the exact reported failing case verbatim", () => {
    const input = "It moves before you hear it. This plays across every touchpoint.";
    expect(cleanProposition(input)).toBe(input);
  });



  it("keeps 'This speaks', 'This works', 'This nods' second sentences", () => {
    for (const v of ["speaks", "works", "refers", "nods", "plays", "lands"]) {
      const s = `Own the last mile. This ${v} to the customer's real problem, not ours.`;
      expect(cleanProposition(s)).toBe(s);
    }
  });

  it("still strips a dash-attached editorial aside", () => {
    expect(
      cleanProposition("Own the last mile — this speaks to the delivery obsession in the brief."),
    ).toBe("Own the last mile");
  });

  it("still strips a parenthesised editorial aside", () => {
    expect(cleanProposition("Own the last mile (this works because it is provable)")).toBe(
      "Own the last mile",
    );
  });

  it("still resolves the 'Replace X with - Y' editing instruction", () => {
    expect(cleanProposition("Replace the old line with - Own the last mile.")).toBe(
      "Own the last mile.",
    );
  });
});

describe("Issue 3 — wrong-slot guard on rewrite notes", () => {
  it("does not treat a comparative reference as the rewrite target", () => {
    expect(namedSlotInNotes("make this more like idea #3")).toBeNull();
    expect(namedSlotInNotes("closer in tone to #9 please")).toBeNull();
    expect(namedSlotInNotes("borrow the device from idea #12")).toBeNull();
  });

  it("still catches an instruction that names its own target slot", () => {
    expect(namedSlotInNotes("Rewrite idea #17, 'The Cultural Signal'")).toBe(17);
    expect(namedSlotInNotes("redo #4 with a harder line")).toBe(4);
  });

  it("takes the imperative target when both forms appear", () => {
    expect(namedSlotInNotes("Rewrite idea #5 to be more like idea #3")).toBe(5);
  });
});
