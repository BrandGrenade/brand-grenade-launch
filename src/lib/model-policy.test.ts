import { describe, it, expect, vi, afterEach } from "vitest";
import {
  effortConfig,
  resolveModel,
  modelSupportsEffort,
  OPUS_5,
  OPUS_5_5,
} from "./model-policy";

afterEach(() => vi.restoreAllMocks());

describe("model capability guard for output_config.effort", () => {
  it("accepts effort only on models verified to support it", () => {
    for (const m of ["claude-opus-5", "claude-opus-5-5", "claude-sonnet-5", "claude-sonnet-4-6"]) {
      expect(modelSupportsEffort(m)).toBe(true);
    }
    for (const m of ["claude-haiku-4-5", "claude-sonnet-4-5", "claude-3-5-haiku"]) {
      expect(modelSupportsEffort(m)).toBe(false);
    }
  });

  it("strips explicit effort on Haiku and warns loudly", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(effortConfig("claude-haiku-4-5", "preflight", "high")).toEqual({});
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]![0]).toContain("claude-haiku-4-5");
  });

  it("strips stage-policy effort on an unsupported model and warns", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    // Stage 10 is a HIGH_EFFORT stage; on Haiku the field must not be sent.
    expect(effortConfig("claude-haiku-4-5", "10")).toEqual({});
    expect(warn).toHaveBeenCalledOnce();
  });

  it("sends high effort for reasoning-critical stages on supported models", () => {
    expect(effortConfig(OPUS_5_5, "10")).toEqual({ output_config: { effort: "high" } });
    expect(effortConfig(OPUS_5, "br2")).toEqual({ output_config: { effort: "high" } });
  });

  it("omits output_config entirely when no effort applies", () => {
    expect(effortConfig(OPUS_5_5, "17")).toEqual({});
    expect(effortConfig("claude-haiku-4-5", "17")).toEqual({});
  });

  it("keeps unmigrated stages on Opus 5 and honours explicit overrides", () => {
    expect(resolveModel("10")).toBe(OPUS_5);
    expect(resolveModel("1b")).toBe(OPUS_5_5);
    expect(resolveModel("1B")).toBe(OPUS_5_5);
    expect(resolveModel("10", "claude-haiku-4-5")).toBe("claude-haiku-4-5");
  });
});
