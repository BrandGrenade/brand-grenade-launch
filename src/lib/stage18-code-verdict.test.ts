import { expect, it } from "vitest";
import { applyStage18CodeVerdict, usesStage18CodeVerdict } from "./stage18-verdict";

const names = ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel"];
const card = (title: string, score: number) => `${title}\n\nWHY THIS DETONATION WORKS:\nSaved explanation.\n\nEIGHT DIMENSION STRESS TEST RESULTS\n${names.map(n => `${n}, ${score}.`).join("\n")}\nCOMPOSITE: 1/80\nSTATUS: REVIEW\n`;

it("keeps existing runs on their original verdict behavior", () => {
  expect(usesStage18CodeVerdict("2026-11-25T23:59:59Z")).toBe(false);
  expect(usesStage18CodeVerdict("2026-11-26T01:00:00Z")).toBe(true);
  expect(usesStage18CodeVerdict(null)).toBe(false);
});

it("derives each candidate from its own eight dimensions, never its neighbour", () => {
  const output = applyStage18CodeVerdict(card("FIRST CANDIDATE", 9) + "\n" + card("SECOND CANDIDATE", 7));
  expect(output).toContain("COMPOSITE: 72/80\nSTATUS: PASS");
  expect(output).toContain("COMPOSITE: 56/80\nSTATUS: REVIEW");
});
it("does not borrow missing dimensions from a previous candidate", () => {
  const incomplete = card("SECOND CANDIDATE", 9).replace("Hotel, 9.\n", "");
  expect(applyStage18CodeVerdict(card("FIRST CANDIDATE", 9) + "\n" + incomplete)).toContain(incomplete);
});
it("leaves duplicate and out-of-range dimension sets unchanged", () => {
  const duplicate = card("FIRST CANDIDATE", 9).replace("Hotel, 9.", "Alpha, 9.");
  expect(applyStage18CodeVerdict(duplicate)).toBe(duplicate);
  const invalid = card("FIRST CANDIDATE", 11);
  expect(applyStage18CodeVerdict(invalid)).toBe(invalid);
});