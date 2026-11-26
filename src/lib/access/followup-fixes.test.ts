import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { STAGE_18_THE_DETONATION_PROMPT } from "../stage18-the-detonation-prompt";
import { STAGE_18_MAX, STAGE_18_PASS_MARK } from "../stage18-scale";
import { STAGE18_MAX, confirmationEvent } from "./foundations";
import { memoReads, type Db } from "./core";

describe("Stage 18 maximum", () => {
  it("is 80 with pass mark 72, and the prompt says /80", () => {
    expect(STAGE_18_MAX).toBe(80);
    expect(STAGE_18_PASS_MARK).toBe(72);
    expect(STAGE18_MAX.max).toBe(80);
    expect(STAGE_18_THE_DETONATION_PROMPT).toContain("COMPOSITE: [n]/80");
    expect(STAGE_18_THE_DETONATION_PROMPT).toContain("72 or above out of 80");
    expect(STAGE_18_THE_DETONATION_PROMPT).not.toMatch(/\/90|out of 90/);
  });
});

describe("Checkpoint C record", () => {
  const base = { selected_smp: "Line", selection_rationale: { a: "why" }, checkpoint_c_confirmed: true, checkpoint_c_confirmed_at: null, rationale_version_at: "2026-10-01T00:00:00Z" };
  it("uses the recorded person and time when a record exists", () => {
    const r = confirmationEvent({ ...base, record: { confirmed_by: "u1", confirmed_at: "2026-11-25T01:00:00Z" } });
    expect(r).toMatchObject({ at: "2026-11-25T01:00:00Z", at_source: "checkpoint_confirmations", confirmed_by: "u1" });
  });
  it("keeps the old fallback for runs without a record", () => {
    const r = confirmationEvent(base);
    expect(r.at).toBe("2026-10-01T00:00:00Z");
    expect(r.confirmed_by).toBeUndefined();
  });
  it("the confirmation form uses the atomic call and the generic button cannot bypass it", () => {
    expect(readFileSync("src/lib/stage12.functions.ts", "utf8")).toContain('rpc("bg_confirm_checkpoint_c"');
    expect(readFileSync("src/routes/pipeline.tsx", "utf8")).not.toMatch(/from\("checkpoint_confirmations"\)\.insert/);
  });
});

describe("run summary reads", () => {
  it("reads repeated validate outputs once per request", async () => {
    const validateOutputs = vi.fn(async () => ({ x: 1 }));
    const db = memoReads({ validateOutputs } as unknown as Db);
    await Promise.all([db.validateOutputs!("r", 1), db.validateOutputs!("r", 1), db.validateOutputs!("r", 2)]);
    expect(validateOutputs).toHaveBeenCalledTimes(2);
  });
});
