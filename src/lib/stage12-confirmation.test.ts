import { beforeEach, expect, it, vi } from "vitest";
import { jlrRationale, jlrSelection } from "./selection-rationale.fixture";
const state = vi.hoisted(() => ({ updates: [] as Record<string, unknown>[], error: null as { message: string } | null }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  const chain = { middleware: () => chain, inputValidator: () => chain, handler: (fn: unknown) => fn }; return chain;
} }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {} }));
vi.mock("./claude.server", () => ({ streamClaude: vi.fn() }));
vi.mock("./auth-helpers.server", () => ({ assertSessionAccess: vi.fn() }));
vi.mock("./pipeline-integrity", () => ({ assertUpstreamStageOutput: vi.fn() }));
import { saveSelectionRationale } from "./stage12.functions";
const invoke = async () => {
  const client = { from: () => ({
    select: () => ({ eq: () => ({ single: async () => ({ data: { selected_smp: jlrSelection, selection_source: "CORE", stage_12_output: "Core\n==== DELIVERABLE 3 — SELECTION RATIONALE STUB ====\nUnfilled" }, error: null }) }) }),
    update: (value: Record<string, unknown>) => { state.updates.push(value); return { eq: async () => ({ error: state.error }) }; },
  }) };
  const handler = saveSelectionRationale as unknown as (args: unknown) => Promise<unknown>;
  return handler({ data: { sessionId: "jlr", rationale: jlrRationale }, context: { userId: "actor", supabase: client } });
};
beforeEach(() => { state.updates = []; state.error = null; });
it("saves all six answers and filled output in the same write as confirmation, without later-stage writes", async () => {
  await invoke();
  expect(state.updates).toHaveLength(1);
  expect(state.updates[0]).toMatchObject({ selection_rationale: jlrRationale, checkpoint_c_confirmed: true, version_actor: "actor" });
  for (const answer of Object.values(jlrRationale)) expect(state.updates[0].stage_12_output).toContain(answer);
  expect(Object.keys(state.updates[0]).some((key) => /stage_(13|14|15|16)/.test(key))).toBe(false);
});
it("does not report confirmation success when the answer write fails", async () => {
  state.error = { message: "write rejected" };
  await expect(invoke()).rejects.toThrow("Failed to save selection rationale: write rejected");
});