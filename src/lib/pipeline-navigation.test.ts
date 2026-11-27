import { describe, expect, it } from "vitest";
import { nextPipelineStage, PIPELINE_STAGES, landingPipelineStage, modeEndsAt13, modeStageNote } from "./pipeline-navigation";

describe.each([
  ["Campaign", { run_mode: "full" }],
  ["Deal", { run_mode: "full" }],
  ["Diagnostic", { run_mode: "diagnostic" }],
  ["Validate", { run_mode: "diagnostic", validate_brief: true }],
  ["Headroom", { run_mode: "diagnostic", exploration_brief: { mode: "headroom" } }],
  ["Turnaround", { run_mode: "diagnostic", exploration_brief: { mode: "turnaround" } }],
])("%s landing", (_name, mode) => {
  it("opens Stage 1 at its awaiting-review checkpoint", () => {
    expect(landingPipelineStage({ "01": "checkpoint", "18": "running" }, modeEndsAt13(mode))).toBe("01");
  });
  it("resumes the current lettered stage", () => {
    expect(landingPipelineStage({ "01": "complete", "04B": "running" }, modeEndsAt13(mode))).toBe("04B");
  });
});
it("refresh resumes the current stage while direct saved-stage links remain explicit", () => {
  const statuses = { "01": "complete", "12": "checkpoint" };
  expect(landingPipelineStage(statuses, true, "1", "reload")).toBe("12");
  expect(landingPipelineStage(statuses, true, "1", "navigate")).toBe("01");
});

it.each(["headroom", "turnaround"])("%s never lands beyond Stage 13", mode => {
  const row = { exploration_brief: { mode } };
  expect(landingPipelineStage({ "01": "checkpoint", "14": "error", "15": "complete" }, modeEndsAt13(row), "18")).toBe("01");
  expect(modeStageNote(row)).toBe(`Not part of a ${mode === "headroom" ? "Headroom" : "Turnaround"} run`);
});

describe.each(["campaign", "deal"])("%s navigation", () => {
  it.each(PIPELINE_STAGES.slice(0, -1).map((s, i) => [s.id, PIPELINE_STAGES[i + 1].id]))("%s advances to %s in full runs", (id, next) => {
    expect(nextPipelineStage(id, true, "full")?.id).toBe(next);
  });
  it("skips only unrequired brief enhancement", () => {
    expect(nextPipelineStage("01", false)?.id).toBe("02");
    expect(nextPipelineStage("13", false)?.id).toBe("13B");
  });
  it("full runs finish at Stage 15, not document assembly", () => {
    expect(nextPipelineStage("15", true, "full")).toBeNull();
  });
  it.each(PIPELINE_STAGES.slice(0, 15).map((s, i) => [s.id, PIPELINE_STAGES[i + 1].id]))("%s advances to %s in diagnostic runs", (id, next) => {
    expect(nextPipelineStage(id, true, "diagnostic")?.id).toBe(next);
  });
  it.each(["13", "13B", "14", "14B", "14C", "15"])("diagnostic cannot continue past %s", (id) => {
    expect(nextPipelineStage(id, true, "diagnostic")).toBeNull();
  });
});