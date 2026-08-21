import { describe, it, expect } from "vitest";
import { parseBigIdeaResponse, buildBigIdeaUserMessage } from "@/lib/stimulus/big-idea-prompt";
import { STIMULUS_LENSES } from "@/lib/stimulus/lenses";

describe("two-field parse", () => {
  it("parses both fields", () => {
    const raw = `### LENS: a1\nTHE BIG IDEA\nIdea text.\n\nCANDIDATE MASTER LINE\nStealth. By Design.\n\nEXPRESSION UNDER MASTER\nStealth. By Design. The quiet mile.\n\nWHY IT WINS\nBecause.`;
    const p = parseBigIdeaResponse(raw).a1;
    expect(p.line).toBe("Stealth. By Design.");
    expect(p.expressionUnderMaster).toBe("Stealth. By Design. The quiet mile.");
    expect(p.rationale).toBe("Because.");
  });
  it("legacy CAMPAIGN LINE still parses, expression empty", () => {
    const raw = `### LENS: a1\nTHE BIG IDEA\nIdea.\n\nCAMPAIGN LINE\nOld line here\n\nWHY IT WINS\nY.`;
    const p = parseBigIdeaResponse(raw).a1;
    expect(p.line).toBe("Old line here");
    expect(p.expressionUnderMaster).toBe("");
  });
  it("user message flips instruction on master line presence", () => {
    const base = { brandName: "B", category: "C", smp: "S", truths: "", strategicEvidence: "", lenses: [STIMULUS_LENSES[0]] };
    expect(buildBigIdeaUserMessage({ ...base, detonationLine: "" })).toContain("NO MASTER LINE IS LOCKED");
    const withLine = buildBigIdeaUserMessage({ ...base, detonationLine: "Stealth. By Design." });
    expect(withLine).toContain("LOCKED MASTER LINE — FIXED AND MANDATORY");
    expect(withLine).not.toContain("CONTEXT ONLY");
  });
});
