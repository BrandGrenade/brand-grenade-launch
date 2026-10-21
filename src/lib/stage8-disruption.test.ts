import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ calls: [] as Record<string, unknown>[], bold: false }));
vi.mock("./claude.server", () => ({ callClaude: async (args: Record<string, unknown>) => {
  state.calls.push(args);
  return state.bold ? "**PROPOSITION:** Own the road on your terms\n**Anchor:** A unique real capability evidenced in the product range.\n**Earlier draft:** A road of your own\n**Cut:** Removed explanation" : "PROPOSITION: Own the road on your terms\nAnchor: A unique real capability evidenced in the product range.\nEarlier draft: A road of your own\nCut: Removed explanation";
} }));
vi.mock("./proposition-anchor.server", () => ({ enforcePropositionAnchor: async () => ({ anchored: true, anchor: "A unique product capability", reason: "" }), renderAnchorFailure: () => "failed" }));
import { runStage8DisruptionEngines } from "./stage8-disruption.server";
beforeEach(() => { state.calls = []; state.bold = false; });
it("B BREACH, C FUSE and D FLASHPOINT each reserve 16000 tokens and one incomplete-answer retry", async () => {
  const results = await runStage8DisruptionEngines({ sessionId: "test", brandName: "JLR", category: "Automotive", stage2Output: "Evidence", territories: [{ name: "Territory", markdown: "## Territory\n> Own the journey in your way" }] });
  expect(state.calls).toHaveLength(3);
  for (const call of state.calls) expect(call).toMatchObject({ maxTokens: 16000, retryIncompleteResponse: true, skipUniversalWrapper: true, stageNumber: "8" });
  expect(results.get("Territory")?.map(candidate => candidate.engine)).toEqual(["breach", "fuse", "flashpoint"]);
  expect(results.get("Territory")?.every(candidate => Boolean(candidate.proposition))).toBe(true);
});
it("parses the bold field labels seen in real end_turn responses", async () => {
  state.bold = true;
  const results = await runStage8DisruptionEngines({ sessionId: "test", brandName: "JLR", category: "Automotive", stage2Output: "Evidence", territories: [{ name: "Territory", markdown: "## Territory\n> Own the journey in your way" }] });
  for (const candidate of results.get("Territory") ?? []) {
    expect(candidate.proposition).toBe("Own the road on your terms");
    expect(candidate.earlierDraft).toBe("A road of your own");
    expect(candidate.error).toBeUndefined();
  }
});