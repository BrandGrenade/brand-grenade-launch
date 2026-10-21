import { expect, it, vi } from "vitest";
const call = vi.hoisted(() => vi.fn(async () => '{"anchored":false,"reason":"No evidence","anchor":"","capability":""}'));
vi.mock("../claude.server", () => ({ callClaude: call }));
import { enforcePropositionAnchor } from "../proposition-anchor.server";
it("LOC post-generation checks reserve 8000 tokens and retry incomplete output once", async () => {
  await enforcePropositionAnchor({ sessionId: "test", proposition: "A house", label: "LOC inversion", postGenerationOnly: true });
  expect(call).toHaveBeenCalledWith(expect.objectContaining({ maxTokens: 8000, retryIncompleteResponse: true, skipUniversalWrapper: true }));
});