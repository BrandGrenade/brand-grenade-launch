import { describe, expect, it } from "vitest";
import { specifiedRevisionLine, supportingExpression } from "./idea-lines";
import { parseBigIdeaResponse } from "./big-idea-prompt";

describe("uncapped idea lines", () => {
  it("keeps a full sentence longer than twelve words", () => {
    const line = "Every car earns the name through the unmistakable character you see and feel every day.";
    const parsed = parseBigIdeaResponse(`### LENS: silent_proof\nTHE BIG IDEA\nIdea\nCANDIDATE MASTER LINE\n${line}\nEXPRESSION UNDER MASTER\n${line}\nWHY IT WINS\nWhy`).silent_proof;
    expect(parsed.line).toBe(line);
    expect(parsed.expressionUnderMaster).toBe(line);
  });
  it("never discards a wrapped line's remaining words", () => {
    const line = "Every car earns the name\nthrough character, not a badge.";
    const parsed = parseBigIdeaResponse(`### LENS: silent_proof\nTHE BIG IDEA\nIdea\nCANDIDATE MASTER LINE\n${line}\nEXPRESSION UNDER MASTER\n${line}\nWHY IT WINS\nWhy`).silent_proof;
    expect(parsed.line).toBe(line);
    expect(parsed.expressionUnderMaster).toBe(line);
  });
  it("shows one master for historical pairings and supporting-only output", () => {
    const master = "The name comes last.";
    expect(supportingExpression(`${master} ${master} Every car earns it.`, master)).toBe("Every car earns it.");
    expect(supportingExpression(`${master} Every car earns it.`, master)).toBe("Every car earns it.");
    expect(supportingExpression("Every car earns it.", master)).toBe("Every car earns it.");
    expect(supportingExpression("The name comes lastingly.", master)).toBe("The name comes lastingly.");
  });
  it("keeps explicitly specified quoted end lines exactly", () => {
    expect(specifiedRevisionLine('Use the end line "Every car earns its name."', true)).toEqual({ field: "expressionUnderMaster", text: "Every car earns its name." });
    expect(specifiedRevisionLine('Field 1: “Two words.”', true)).toEqual({ field: "line", text: "Two words." });
    expect(specifiedRevisionLine('End with "A longer line that must be kept exactly as written, without replacing any words."', false)?.text).toBe("A longer line that must be kept exactly as written, without replacing any words.");
    expect(specifiedRevisionLine('Avoid the territory "status before product"', true)).toBeNull();
  });
});