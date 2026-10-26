import { describe, expect, it } from "vitest";
import { parseStage22Sentinel, STAGE_22_RUNNING } from "./stage22.functions";
import { STAGE_22_CLAIM_QUIET_MS, STAGE_22_MAX_CLAIMS } from "./stage22-tick.server";

describe("parseStage22Sentinel", () => {
  it("treats null and real errors as not running", () => {
    expect(parseStage22Sentinel(null)).toEqual({ running: false, claimed: false, attempt: 0 });
    expect(parseStage22Sentinel("model refused")).toEqual({ running: false, claimed: false, attempt: 0 });
  });

  it("parses the bare sentinel as queued and unclaimed", () => {
    expect(parseStage22Sentinel(STAGE_22_RUNNING)).toEqual({ running: true, claimed: false, attempt: 0 });
  });

  it("parses claimed sentinels with their attempt number", () => {
    expect(parseStage22Sentinel(`${STAGE_22_RUNNING}:claimed:1`)).toEqual({ running: true, claimed: true, attempt: 1 });
    expect(parseStage22Sentinel(`${STAGE_22_RUNNING}:claimed:3`)).toEqual({ running: true, claimed: true, attempt: 3 });
  });

  it("keeps the retry budget finite", () => {
    expect(STAGE_22_MAX_CLAIMS).toBe(3);
    expect(STAGE_22_CLAIM_QUIET_MS).toBeLessThan(8 * 60 * 1000); // under the client's stale window
  });
});
