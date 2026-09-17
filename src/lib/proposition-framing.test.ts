import { describe, expect, it } from "vitest";
import {
  assertPropositionFraming,
  findPropositionFramingViolations,
  frameForPropositionCount,
  enforcePropositionFraming,
  repairPropositionFraming,
  REMOVAL_NOTICE,

} from "./proposition-framing";

const ROUND_FOUR = `The propositions differ not just in their creative expression but in their fundamental assumptions about what customers want. This proposition makes Friday permission the organising thought.`;
const ROUND_FOUR_DISTINCTIVENESS = `They are not variations on a theme — they are fundamentally different theories about what the brand should mean. The selected proposition departs from category discount language.`;

describe("proposition-count framing contract", () => {
  it("removes unsupported plural comparison from a one-card Agency section", () => {
    const framed = frameForPropositionCount(ROUND_FOUR, 1);
    expect(framed).not.toContain("The propositions differ");
    expect(framed).toContain("This proposition makes Friday permission");
    expect(findPropositionFramingViolations(framed, 1)).toEqual([]);
  });

  it("leaves the same comparison untouched when several cards are rendered", () => {
    expect(frameForPropositionCount(ROUND_FOUR, 4)).toBe(ROUND_FOUR);
    expect(findPropositionFramingViolations(ROUND_FOUR, 4)).toEqual([]);
  });

  it("hard-fails when the round-four defect is deliberately reintroduced", () => {
    expect(() => assertPropositionFraming(ROUND_FOUR, 1, "Agency Part 01")).toThrow(
      /failed proposition-count framing/,
    );
    expect(() => assertPropositionFraming(ROUND_FOUR_DISTINCTIVENESS, 1, "Agency Part 04"))
      .toThrow(/failed proposition-count framing/);
  });
});
describe("self-correcting enforcement", () => {
  it("removes an offending bullet with no full stop instead of throwing", () => {
    const bad = "- Of the propositions considered, “Friday starts in aisle six.” ranked strongest\n- Kept line about the idea itself.";
    expect(() => assertPropositionFraming(bad, 1, "ctx")).toThrow();
    const out = enforcePropositionFraming(bad, 1, "ctx");
    expect(findPropositionFramingViolations(out, 1)).toHaveLength(0);
    expect(out).not.toMatch(/ranked strongest/);
    expect(out).toContain("Kept line about the idea itself.");
  });

  it("never emits an orphan fragment left by a split inside a quotation", () => {
    const bad = '- These propositions differ: "Friday starts in aisle six." leads the set';
    const out = enforcePropositionFraming(bad, 1, "ctx");
    expect(findPropositionFramingViolations(out, 1)).toHaveLength(0);
    expect(out).not.toMatch(/leads the set/);
  });

  it("leaves a visible notice instead of silently deleting a line", () => {
    const bad = '- These propositions differ: "Friday starts in aisle six." leads the set';
    const out = enforcePropositionFraming(bad, 1, "ctx");
    expect(out).toContain(REMOVAL_NOTICE);
    expect(out.trim()).not.toBe("");
  });

  it("keeps surrounding prose when only one sentence offends", () => {
    const bad =
      "The idea holds because the brand already owns the moment. These propositions differ in how far they push. It still lands on the same truth about Friday nights.";
    const out = enforcePropositionFraming(bad, 1, "ctx");
    expect(out).toContain("The idea holds because the brand already owns the moment.");
    expect(out).toContain("It still lands on the same truth about Friday nights.");
    expect(out).not.toMatch(/These propositions differ/);
    expect(out).not.toContain(REMOVAL_NOTICE);
  });

  it("reports removals and trims", () => {
    const bad = '- These propositions differ: "Friday starts in aisle six." leads the set\n- A clean line that stays exactly as written.';
    const repair = repairPropositionFraming(bad, 1);
    expect(repair.removedLines).toHaveLength(1);
    expect(repair.text).toContain("A clean line that stays exactly as written.");
  });
});

