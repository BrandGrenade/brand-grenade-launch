import { beforeEach, expect, it, vi } from "vitest";
import { jlrRationale, jlrSelection } from "./selection-rationale.fixture";
const state = vi.hoisted(() => ({ rpcs: [] as { name: string; args: Record<string, unknown> }[], error: null as { message: string } | null }));
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
  }), rpc: async (name: string, args: Record<string, unknown>) => { state.rpcs.push({ name, args }); return { error: state.error }; } };
  const handler = saveSelectionRationale as unknown as (args: unknown) => Promise<unknown>;
  return handler({ data: { sessionId: "jlr", rationale: jlrRationale }, context: { userId: "actor", supabase: client } });
};
beforeEach(() => { state.rpcs = []; state.error = null; });
it("saves all six answers, filled output, confirmation and its record in one database call", async () => {
  await invoke();
  expect(state.rpcs).toHaveLength(1);
  const saved = state.rpcs[0];
  if (!saved) throw new Error("No confirmation was saved");
  expect(saved.name).toBe("bg_confirm_checkpoint_c");
  expect(saved.args).toMatchObject({ p_session_id: "jlr", p_rationale: { ...jlrRationale, _expected_smp: jlrSelection, _expected_source: "CORE" } });
  for (const answer of Object.values(jlrRationale)) expect(String(saved.args["p_output"])).toContain(answer);
});
it("does not report confirmation success when the write fails", async () => {
  state.error = { message: "write rejected" };
  await expect(invoke()).rejects.toThrow("Failed to save selection rationale: write rejected");
});
