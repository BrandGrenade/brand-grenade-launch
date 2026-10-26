import { describe, expect, it } from "vitest";
import { STAGE_16_RUNNING, parseStage16Sentinel } from "./stage16.server";
import { STAGE_16_CLAIM_QUIET_MS, STAGE_16_MAX_CLAIMS } from "./stage16-tick.server";

describe("parseStage16Sentinel", () => {
  it("treats null and real errors as not running", () => {
    expect(parseStage16Sentinel(null)).toEqual({ running: false, format: null, claimed: false, attempt: 0 });
    expect(parseStage16Sentinel("section call failed")).toEqual({ running: false, format: null, claimed: false, attempt: 0 });
  });

  it("parses a queued sentinel with its format", () => {
    expect(parseStage16Sentinel(`${STAGE_16_RUNNING}:vision`)).toEqual({ running: true, format: "vision", claimed: false, attempt: 0 });
    expect(parseStage16Sentinel(`${STAGE_16_RUNNING}:consulting`)).toEqual({ running: true, format: "consulting", claimed: false, attempt: 0 });
  });

  it("parses claimed sentinels with format and attempt number", () => {
    expect(parseStage16Sentinel(`${STAGE_16_RUNNING}:agency:claimed:2`)).toEqual({ running: true, format: "agency", claimed: true, attempt: 2 });
  });

  it("flags a queued sentinel with an unknown format so the tick fails it terminally", () => {
    const s = parseStage16Sentinel(`${STAGE_16_RUNNING}:banana`);
    expect(s.running).toBe(true);
    expect(s.format).toBeNull();
    expect(s.claimed).toBe(false);
  });

  it("keeps the retry budget finite", () => {
    expect(STAGE_16_MAX_CLAIMS).toBe(3);
    expect(STAGE_16_CLAIM_QUIET_MS).toBeLessThan(8 * 60 * 1000); // under the client's stale window
  });
});
