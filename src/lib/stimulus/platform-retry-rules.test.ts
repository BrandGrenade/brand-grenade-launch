import { describe, expect, it } from "vitest";
import {
  amendmentStatus,
  canRetry,
  fidelityBelow,
  gateTwoBlockReason,
  linesCheck,
  rewriteFailureMessage,
} from "./platform-retry-rules";

describe("Creative Engine platform retries", () => {
  it("allows exactly two automatic retries after the first attempt", () => {
    expect(canRetry(0)).toBe(true);
    expect(canRetry(1)).toBe(true);
    expect(canRetry(2)).toBe(false);
  });

  it("names a failed rewrite as a platform error and says the idea is unchanged", () => {
    expect(rewriteFailureMessage("timeout")).toBe(
      "Rewrite failed (platform error): timeout. Your idea is unchanged.",
    );
  });

  it("treats fidelity below 6 as below floor, 6 as passing", () => {
    expect(fidelityBelow(5)).toBe(true);
    expect(fidelityBelow(6)).toBe(false);
  });

  it("maps amendment verdicts to applied / partly / not applied", () => {
    expect(amendmentStatus("present")).toBe("applied");
    expect(amendmentStatus("weak")).toBe("partly");
    expect(amendmentStatus("absent")).toBe("not_applied");
  });

  it("requires Field 1 verbatim in every channel prompt", () => {
    expect(linesCheck("Opens on: Copy nothing.", "Copy nothing.", null)).toBeNull();
    expect(linesCheck("Opens on something else.", "Copy nothing.", null)).not.toBeNull();
  });

  it("blocks Gate Two on a below-fidelity channel until a noted issue is recorded", () => {
    const row = { channel_name: "Outdoor", gate_two_approved: true, fidelity_status: "below" };
    expect(gateTwoBlockReason([row], 1)).toContain("Outdoor: below fidelity after 2 platform retries");
    const noted = {
      ...row,
      issue_resolutions: [{ kind: "fidelity", action: "approved_with_issue", note: "ok", by: "u", at: "t" }],
    };
    expect(gateTwoBlockReason([noted], 1)).toBeNull();
  });

  it("never forces rejection: an absent mandate is resolvable by a noted approval", () => {
    const row = { channel_name: "Retail", gate_two_approved: true, mandate_compliance: "absent" };
    expect(gateTwoBlockReason([row], 1)).toContain("adapt for the channel, or approve with a noted issue");
  });
});
