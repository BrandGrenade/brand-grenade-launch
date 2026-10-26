import { describe, expect, it } from "vitest";
import { furthestStageLabel, laterStageStatuses } from "./run-stage-progress";

describe("Stage 16 (Document Assembly) in later-stage navigation", () => {
  it("is listed on every run, after every Phase 2 stage", () => {
    const stages = laterStageStatuses({ has_stage_15: true });
    expect(stages.map((s) => s.id)).toEqual(["17", "17B", "18", "19", "20", "20B", "21", "22", "16"]);
  });

  it("is not run when Phase 1 is done but no document exists", () => {
    const s16 = laterStageStatuses({ has_stage_15: true }).find((s) => s.id === "16");
    expect(s16?.status).toBe("ready");
  });

  it("is pending before Phase 1 finishes", () => {
    const s16 = laterStageStatuses({ current_stage: 3 }).find((s) => s.id === "16");
    expect(s16?.status).toBe("pending");
  });

  it("is running while the background runner holds it", () => {
    const s16 = laterStageStatuses({ has_stage_15: true, stage_16_running: true }).find((s) => s.id === "16");
    expect(s16?.status).toBe("running");
  });

  it("is complete once any Stage 16 document exists, even if a rerun is queued", () => {
    const s16 = laterStageStatuses({ has_stage_15: true, has_stage_16: true, stage_16_running: true }).find((s) => s.id === "16");
    expect(s16?.status).toBe("complete");
  });

  it("never counts as the furthest pipeline stage", () => {
    expect(furthestStageLabel({ has_stage_15: true, has_stage_16: true, has_stage_17: true })).toBe("17B");
    expect(furthestStageLabel({ has_stage_15: true, has_stage_16: true, current_stage: 15 })).toBe("15");
  });
});
