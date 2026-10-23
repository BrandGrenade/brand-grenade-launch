import { describe, expect, it } from "vitest";
import { sweepCreditExhausted, sweepMayAdvance, sweepErrorRetryable, sweepLeaseLive, retrySweepLens, SWEEP_BATCH_SIZE, SWEEP_SLICE_BATCHES } from "./sweep-job-policy";
import { readFileSync } from "node:fs";

describe("sweep job recovery", () => {
  it("stops credit exhaustion even when wrapped as a provider server error", async () => {
    const error = new Error("Claude API 503: Your credit balance is too low to access the Anthropic API.");
    let attempts = 0;
    expect(sweepCreditExhausted(error)).toBe(true);
    expect(sweepErrorRetryable(error)).toBe(false);
    await expect(retrySweepLens(async () => { attempts += 1; throw error; }, async () => { throw new Error("Must not wait or retry"); })).rejects.toBe(error);
    expect(attempts).toBe(1);
  });
  it("does not automatically advance a stopped credit job", () => {
    expect(sweepMayAdvance("failed", "AI credit exhausted — top up and press Resume")).toBe(false);
    expect(sweepMayAdvance("generating", "Your credit balance is too low")).toBe(false);
    expect(sweepMayAdvance("generating", null)).toBe(true);
  });
  it("retains original three-lens batches across a bounded keep-alive slice", () => {
    expect(SWEEP_BATCH_SIZE).toBe(3);
    expect(SWEEP_SLICE_BATCHES).toBe(5);
  });
  it("retries only the throttled lens while siblings finish", async () => {
    let attempts = 0;
    let siblingDone = false;
    const delays: number[] = [];
    const limited = retrySweepLens(async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("Claude API 429: rate limit");
      return "limited lens";
    }, async ms => { delays.push(ms); await Promise.resolve(); expect(siblingDone).toBe(true); });
    const sibling = Promise.resolve().then(() => { siblingDone = true; return "saved sibling"; });
    expect(await Promise.all([limited, sibling])).toEqual(["limited lens", "saved sibling"]);
    expect(attempts).toBe(2);
    expect(delays).toEqual([5000]);
  });
  it("stops a lens after bounded rate retries and never retries a refusal", async () => {
    let attempts = 0;
    await expect(retrySweepLens(async () => { attempts += 1; throw new Error("Claude API 429: rate limit"); }, async () => {})).rejects.toThrow("429");
    expect(attempts).toBe(3);
    attempts = 0;
    await expect(retrySweepLens(async () => { attempts += 1; throw new Error("Claude stop_reason=refusal"); }, async () => {})).rejects.toThrow("refusal");
    expect(attempts).toBe(1);
  });
  it("does not replay output exhaustion, refusal or denied requests", () => {
    for (const error of ["Claude stop_reason=max_tokens", "Claude stop_reason=refusal", "Claude API 402: credits", "Claude API 403: denied", "Claude API 400: context too long"]) {
      expect(sweepErrorRetryable(new Error(error))).toBe(false);
    }
  });
  it("allows bounded recovery for rate limits and server errors", () => {
    expect(sweepErrorRetryable(new Error("Claude API 429: rate limit"))).toBe(true);
    expect(sweepErrorRetryable(new Error("Claude API 503: unavailable"))).toBe(true);
  });
  it("excludes overlapping claims until the lease expires", () => {
    expect(sweepLeaseLive({ status: "running", lease_until: "2026-10-23T03:00:00Z" }, Date.parse("2026-10-23T02:30:00Z"))).toBe(true);
    expect(sweepLeaseLive({ status: "running", lease_until: "2026-10-23T02:00:00Z" }, Date.parse("2026-10-23T02:30:00Z"))).toBe(false);
  });
  it("budgets thinking and answers without changing lens prompts", () => {
    const source = readFileSync(new URL("./big-idea-sweep.server.ts", import.meta.url), "utf8");
    expect([...source.matchAll(/maxTokens:\s*(\d+)/g)].map(m => Number(m[1]))).toEqual([32000, 16000, 16000]);
    expect(source).toContain('.eq("status", "pending")');
  });
});