import { describe, expect, it } from "vitest";
import { intelligenceProgress } from "./intelligence-progress";

const base = { status: "running", stage_status: "running:0", current_layer: 0, updated_at: "2026-10-19T10:34:02Z" };

describe("Intelligence Lab progress accuracy", () => {
  it("does not claim a waiting run has completed any of its ten layers", () => {
    expect(intelligenceProgress(base, Date.parse("2026-10-19T10:36:02Z"))).toMatchObject({ confirmed: 0, marker: 0, quietSeconds: 120 });
  });
  it("does not treat estimated streaming markers as completed stages", () => {
    expect(intelligenceProgress({ ...base, current_layer: 8 }, 0)).toMatchObject({ confirmed: 0, marker: 8 });
  });
  it("reports all ten confirmed only when the run completes", () => {
    expect(intelligenceProgress({ ...base, status: "complete" }, 0)).toMatchObject({ confirmed: 10, marker: 10 });
  });
  it("clears the estimated marker when a restart returns to zero", () => {
    expect(intelligenceProgress({ ...base, stage_status: "queued" }, 0)).toMatchObject({ confirmed: 0, marker: 0, queued: true });
  });
  it("does not invent a last activity time when it is missing", () => {
    expect(intelligenceProgress({ ...base, updated_at: null }, 0).quietSeconds).toBeNull();
  });
});