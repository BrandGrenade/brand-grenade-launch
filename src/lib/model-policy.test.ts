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
    expect(effortConfig(OPUS_5_5, "19")).toEqual({});
    expect(effortConfig("claude-haiku-4-5", "19")).toEqual({});
  });

  it("keeps unmigrated stages on Opus 5 and honours explicit overrides", () => {
    expect(resolveModel("10")).toBe(OPUS_5);
    expect(resolveModel("1b")).toBe(OPUS_5_5);
    expect(resolveModel("1B")).toBe(OPUS_5_5);
    expect(resolveModel("4b")).toBe(OPUS_5_5);
    expect(resolveModel("10", "claude-haiku-4-5")).toBe("claude-haiku-4-5");
  });
});

import { __policyInternals as P } from "./model-policy";
import { test as t2, expect as e2 } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";

// Scans the real source rather than a hand-kept list, so a new model call
// cannot slip through unclassified.
function sourceFiles(d: string): string[] {
  return readdirSync(d).flatMap((f) => {
    const p = `${d}/${f}`;
    if (statSync(p).isDirectory()) return sourceFiles(p);
    return /\.tsx?$/.test(f) && !/\.test\./.test(f) ? [p] : [];
  });
}
const files = sourceFiles("src").map((f) => ({ f, s: readFileSync(f, "utf8") }));

t2("every callClaude/streamClaude call carries a stage id classified for effort", () => {
  const problems: string[] = [];
  for (const { f, s } of files) {
    const re = /\b(callClaude|streamClaude)\(\s*\{/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s))) {
      const chunk = s.slice(m.index, m.index + 2500);
      const end = chunk.indexOf("});");
      const body = end > 0 ? chunk.slice(0, end) : chunk;
      const line = s.slice(0, m.index).split("\n").length;
      const sn = body.match(/stageNumber:\s*["'`]([^"'`]+)["'`]/);
      if (!sn) { problems.push(`${f}:${line} has no literal stageNumber`); continue; }
      const id = sn[1]!.toLowerCase();
      const hi = P.HIGH_EFFORT_STAGES.has(id), df = P.DEFAULT_EFFORT_STAGES.has(id);
      if (!hi && !df) problems.push(`${f}:${line} stage "${id}" is unclassified`);
      if (hi && df) problems.push(`${f}:${line} stage "${id}" is on both lists`);
    }
  }
  e2(problems).toEqual([]);
});

// Direct API calls bypass the policy entirely. Each is pinned to a model that
// is not being migrated; a new one must be reviewed and added here.
const DIRECT_API_ALLOWED = [
  "src/lib/claude.server.ts",              // the policy-enforcing caller itself
  "src/lib/document.functions.ts",         // sonnet-4-5
  "src/lib/fact-verify.server.ts",         // sonnet-4-5, tools, free choice
  "src/lib/stimulus/orchestrate.server.ts",// sonnet-4-5-20250929
  "src/lib/stimulus/rate.server.ts",       // sonnet-4-5, tools, free choice
  "src/lib/synthesiser/synthesise.server.ts",
  "src/lib/threeTruth.functions.ts",
];
t2("no unreviewed direct Anthropic API call sites", () => {
  const found = files.filter(({ s }) => s.includes("api.anthropic.com")).map(({ f }) => f).sort();
  e2(found).toEqual([...DIRECT_API_ALLOWED].sort());
});
