import { describe, expect, it } from "vitest";
import { fillSelectionDeliverable, selectionRationaleSchema, selectionRationaleText } from "./selection-rationale";
import { jlrRationale, jlrSelection } from "./selection-rationale.fixture";

describe("Checkpoint C human rationale", () => {
  it("preserves all six supplied answers exactly without replacing upstream output", () => {
    const prefix = "Core cards remain unchanged\n\n";
    const tail = "\n==== SELF-AUDIT ====\nOriginal audit";
    const filled = fillSelectionDeliverable(`${prefix}==== DELIVERABLE 3 — SELECTION RATIONALE STUB ====\n[SELECTION_RATIONALE_STUB]\nTO BE COMPLETED\n[/SELECTION_RATIONALE_STUB]${tail}`, jlrSelection, jlrRationale);
    expect(filled.startsWith(prefix)).toBe(true);
    expect(filled.endsWith(tail)).toBe(true);
    for (const value of Object.values(jlrRationale)) expect(filled).toContain(value);
    expect(filled).toContain(jlrSelection);
  });
  it("does not permit confirmation without the required rationale answers", () => {
    expect(selectionRationaleSchema.safeParse({}).success).toBe(false);
    expect(selectionRationaleSchema.safeParse({ ...jlrRationale, f1: " " }).success).toBe(false);
    expect(selectionRationaleSchema.parse(jlrRationale)).toEqual(jlrRationale);
  });
  it("carries the cars-not-people guard-rail verbatim in the downstream context", () => {
    expect(selectionRationaleText(jlrSelection, jlrRationale)).toContain("The name is earned by the cars, never withheld from people.");
  });
});