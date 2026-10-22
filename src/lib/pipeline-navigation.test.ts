import { describe, expect, it } from "vitest";
import { nextPipelineStage, PIPELINE_STAGES } from "./pipeline-navigation";

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