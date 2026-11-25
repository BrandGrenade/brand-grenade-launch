import { describe, expect, it, vi } from "vitest";
const updates: Record<string, unknown>[] = [];
const filters: string[] = [];
vi.mock("@/integrations/supabase/client.server", () => {
  const chain = { eq: () => chain, or: (f: string) => { filters.push(f); return chain; }, then: (r: (v: unknown) => void) => r({ error: null }) };
  return { supabaseAdmin: { from: () => ({ update: (u: Record<string, unknown>) => { updates.push(u); return chain; } }) } };
});
import { withStreamSafety } from "./stream-stage-safety";

async function* failing(): AsyncGenerator<string> { yield ""; throw new Error("credit balance is too low"); }

describe("withStreamSafety (Stage 11 duplicate-call fix)", () => {
  it("a failed call with no text never clears saved output and never reopens a completed stage", async () => {
    const it = withStreamSafety({ sessionId: "s", stageLabel: "Stage 11", outputColumn: "stage_11_output", errorColumn: "stage_11_error" }, failing());
    await expect((async () => { for await (const _ of it) { /* drain */ } })()).rejects.toThrow("credit");
    const writes = updates.filter((u) => "stage_11_error" in u || u["status"] === "interrupted");
    expect(writes.length).toBeGreaterThan(0);
    for (const u of updates) expect("stage_11_output" in u).toBe(false);
    expect(filters.filter((f) => f.includes('"complete:11"')).length).toBeGreaterThanOrEqual(2);
  });
});
