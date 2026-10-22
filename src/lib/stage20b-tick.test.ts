import { describe, expect, it } from "vitest";
import { parseStage20bSentinel, STAGE_20B_CLAIM_QUIET_MS, STAGE_20B_MAX_CLAIMS } from "./stage20b-tick.server";
import { STAGE_20B_RUNNING } from "./stage20b.server";

describe("parseStage20bSentinel", () => {
  it("treats null and real errors as not running", () => {
    expect(parseStage20bSentinel(null)).toEqual({ running: false, claimed: false, attempt: 0 });
    expect(parseStage20bSentinel("model refused")).toEqual({ running: false, claimed: false, attempt: 0 });
  });

  it("parses the bare sentinel as queued and unclaimed", () => {
    expect(parseStage20bSentinel(STAGE_20B_RUNNING)).toEqual({ running: true, claimed: false, attempt: 0 });
  });

  it("parses claimed sentinels with their attempt number", () => {
    expect(parseStage20bSentinel(`${STAGE_20B_RUNNING}:claimed:1`)).toEqual({ running: true, claimed: true, attempt: 1 });
    expect(parseStage20bSentinel(`${STAGE_20B_RUNNING}:claimed:3`)).toEqual({ running: true, claimed: true, attempt: 3 });
  });

  it("keeps the retry budget finite", () => {
    expect(STAGE_20B_MAX_CLAIMS).toBe(3);
    expect(STAGE_20B_CLAIM_QUIET_MS).toBeLessThan(8 * 60 * 1000); // under the client's stale window
  });
});
