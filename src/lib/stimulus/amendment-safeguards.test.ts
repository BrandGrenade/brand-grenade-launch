import { describe, expect, it } from "vitest";
import { exactSentences, missingSentences, preservedFieldLoss, retryReadable, unmentionedSavedFields } from "./amendment-safeguards";
import { gateTwoBlockReason } from "./platform-retry-rules";
describe("copy amendment safeguards", () => {
  it("superseded approvals cannot resolve a new below-6 result", () => {
    const row = { channel_name: "Podcast", gate_two_approved: true, fidelity_status: "below", issue_resolutions: [{ kind: "fidelity", action: "approved_with_issue", superseded_at: "2026-10-29" }] };
    expect(gateTwoBlockReason([row], 1)).toContain("Podcast: below fidelity");
    row.issue_resolutions = [{ kind: "fidelity", action: "approved_with_issue", superseded_at: "" }];
    expect(gateTwoBlockReason([row], 1)).toBeNull();
  });
  it("requires the exact sentence word for word including punctuation", () => {
    const required = exactSentences('include this exact production direction: "Reveal the name only after the evidence of the earlier life."');
    expect(required).toEqual(["Reveal the name only after the evidence of the earlier life."]);
    expect(missingSentences("Reveal the name after the evidence of the earlier life.", required)).toEqual(required);
    expect(missingSentences(required[0], required)).toEqual([]);
  });
  it("names any loss or change to a saved unmentioned field", () => {
    expect(preservedFieldLoss({ field2_placement: "At the close" }, { field2_placement: null })).toEqual(["field2_placement"]);
    expect(preservedFieldLoss({ field2_placement: "At the close" }, { field2_placement: "At the close" })).toEqual([]);
    expect(preservedFieldLoss(unmentionedSavedFields({ initial_prompt:"approved",tool_target:"print",field2_placement:"At the close",run_state:"queued" }),{initial_prompt:"approved",tool_target:null,field2_placement:"At the close"})).toEqual(["tool_target"]);
  });
  it("retries unreadable output then succeeds", async () => {
    let calls = 0;
    const result = await retryReadable(async () => ++calls === 1 ? "broken" : '{"ok":true}', "Outdoor");
    expect(calls).toBe(2); expect(result).toEqual({ ok: true });
  });
  it("stops after two retries with a channel-named error", async () => {
    let calls = 0;
    await expect(retryReadable(async () => { calls++; return "broken"; }, "Outdoor")).rejects.toThrow("Outdoor: unreadable model output after 2 platform retries");
    expect(calls).toBe(3);
  });
});