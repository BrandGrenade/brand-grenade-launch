import { describe, expect, it } from "vitest";
import { sweepErrorRetryable, sweepLeaseLive } from "./sweep-job-policy";
import { readFileSync } from "node:fs";

describe("sweep job recovery", () => {
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