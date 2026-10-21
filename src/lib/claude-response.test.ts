import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {} }));
import { callClaude } from "./claude.server";

function response(stopReason: string, text = "", error?: string) {
  const encoder = new TextEncoder();
  const events = [
    { type: "message_start", message: { content: [] } },
    { type: "ping" },
    { type: "content_block_delta", delta: { type: "thinking_delta", thinking: "" } },
    ...(text ? [{ type: "content_block_delta", delta: { type: "text_delta", text } }] : []),
    ...(error ? [{ type: "error", error: { type: "permission_error", message: error } }] : []),
    { type: "message_delta", delta: { stop_reason: stopReason } },
    { type: "message_stop" },
  ];
  const chunks = events.flatMap((event) => {
    const line = `data: ${JSON.stringify(event)}\n\n`;
    const midpoint = Math.floor(line.length / 2);
    return [line.slice(0, midpoint), line.slice(midpoint)];
  });
  return new Response(new ReadableStream({ pull(controller) {
    const chunk = chunks.shift();
    if (chunk === undefined) controller.close(); else controller.enqueue(encoder.encode(chunk));
  } }));
}
const args = { systemPrompt: "test", userMessage: "test", maxTokens: 16000, model: "claude-opus-5", stageNumber: "8", retryIncompleteResponse: true };
beforeEach(() => { vi.useFakeTimers(); vi.stubEnv("ANTHROPIC_API_KEY", "test-only"); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
async function settle<T>(promise: Promise<T>) {
  const guarded = promise.then(value => ({ value }), error => ({ error }));
  await vi.runAllTimersAsync();
  const result = await guarded;
  if ("error" in result) throw result.error;
  return result.value;
}
describe("Stage 8 buffered incomplete-answer recovery", () => {
  it("retries max_tokens once after delay and discards truncated text", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response("max_tokens", "discard me")).mockResolvedValueOnce(response("end_turn", "PROPOSITION: A complete new answer"));
    vi.stubGlobal("fetch", fetcher);
    expect(await settle(callClaude(args))).toBe("PROPOSITION: A complete new answer");
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetcher.mock.calls[0]?.[1]?.body)).toMatchObject({ model: "claude-opus-5", max_tokens: 16000, output_config: { effort: "high" }, stream: true });
  });
  it("retries a completed empty answer only once and retains actual stop reason", async () => {
    const fetcher = vi.fn().mockImplementation(async () => response("end_turn"));
    vi.stubGlobal("fetch", fetcher);
    await expect(settle(callClaude(args))).rejects.toThrow("stop_reason=end_turn");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("does not retry a refusal even with empty text", async () => {
    const fetcher = vi.fn().mockImplementation(async () => response("refusal"));
    vi.stubGlobal("fetch", fetcher);
    await expect(settle(callClaude(args))).rejects.toThrow("stop_reason=refusal");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("preserves streamed permission errors without retrying", async () => {
    const fetcher = vi.fn().mockImplementation(async () => response("end_turn", "", "Access denied"));
    vi.stubGlobal("fetch", fetcher);
    await expect(settle(callClaude(args))).rejects.toThrow("permission_error: Access denied");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("does not retry incomplete answers on unrelated callers", async () => {
    const fetcher = vi.fn().mockImplementation(async () => response("max_tokens", "partial"));
    vi.stubGlobal("fetch", fetcher);
    await expect(settle(callClaude({ ...args, retryIncompleteResponse: false }))).rejects.toThrow("stop_reason=max_tokens");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});