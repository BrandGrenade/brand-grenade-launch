import { describe, it, expect } from "vitest";
import { JLR_CHANNEL_INSTRUCTIONS, JLR_ORCHESTRATION_ID, RECOVERY_ATTEMPTS, recoveryReady } from "./jlr-mandate-recovery";
describe("JLR selective mandate recovery", () => {
  it("targets only the four failed channels on this run", () => {
    expect(JLR_ORCHESTRATION_ID).toBe("06a8debc-cbf4-40de-a81c-992efc382b2d");
    expect(Object.keys(JLR_CHANNEL_INSTRUCTIONS)).toEqual(["Large-format Roadside and Commuter Outdoor", "Retail Floor, Standing-room Occasions and Handover", "Earned Media and Independent Long-term Motoring Review", "Instagram and YouTube Creator-led Short Form and Examination"]);
  });
  it("permits initial generation and at most two retries", () => expect(RECOVERY_ATTEMPTS).toBe(3));
  it("requires all nine present and CD pass", () => {
    const checks = Array.from({ length: 9 }, () => ({ verdict: "present" }));
    expect(recoveryReady(checks, "pass")).toBe(true);
    expect(recoveryReady(checks.slice(1), "pass")).toBe(false);
    expect(recoveryReady([...checks.slice(1), { verdict: "absent" }], "pass")).toBe(false);
    expect(recoveryReady([...checks.slice(1), { verdict: "weak" }], "pass")).toBe(false);
    expect(recoveryReady(checks, "fail")).toBe(false);
  });
});