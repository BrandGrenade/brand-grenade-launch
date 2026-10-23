import { describe, expect, it } from "vitest";
import { furthestStageLabel, laterStageStatuses } from "./run-stage-progress";

const jlr = {
  current_stage: 15, has_stage_15: true, has_stage_17: true, has_stage_17b: true, has_stage_18: true,
  has_stage_19: true, has_stage_20: true, stage_20_approved: true, has_stage_20b: true,
  has_stage_21: false, has_stage_22: false, has_stage_16: false,
};

describe("run stage progress from saved outputs", () => {
  it("shows 17–20B complete and 21 ready despite current_stage 15", () => {
    const s = Object.fromEntries(laterStageStatuses(jlr).map((x) => [x.id, x.status]));
    expect(s).toMatchObject({ "17": "complete", "17B": "complete", "18": "complete", "19": "complete", "20": "complete", "20B": "complete", "21": "ready", "22": "pending" });
  });
  it("dashboard label is Stage 21, not 15", () => {
    expect(furthestStageLabel(jlr)).toBe("21");
  });
  it("unapproved Stage 20 is not complete", () => {
    expect(furthestStageLabel({ ...jlr, stage_20_approved: false, has_stage_20b: false })).toBe("20");
  });
  it("falls back to current_stage before Phase 2", () => {
    expect(furthestStageLabel({ current_stage: 9 })).toBe("9");
  });
});
