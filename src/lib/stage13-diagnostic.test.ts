import { beforeEach, describe, expect, it, vi } from "vitest";
import { diagnosticFixture } from "./diagnostic-valuation.fixture";

const state = vi.hoisted(() => ({ session: {} as Record<string, unknown>, updates: [] as Record<string, unknown>[], calls: [] as Record<string, unknown>[], response: "" }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const chain = { middleware: () => chain, inputValidator: () => chain, handler: (fn: unknown) => fn };
    return chain;
  },
}));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {
  from: () => ({
    select: () => ({ eq: () => ({ single: async () => ({ data: state.session, error: null }) }) }),
    update: (payload: Record<string, unknown>) => { state.updates.push(payload); return { eq: async () => ({ error: null }) }; },
  }),
} }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("./auth-helpers.server", () => ({ assertSessionAccess: vi.fn() }));
vi.mock("./pipeline-integrity", () => ({ assertUpstreamStageOutput: vi.fn() }));
vi.mock("./checkpoint-gate", () => ({ requireConfirmedSelection: vi.fn() }));
vi.mock("./claude.server", () => ({ streamClaude: async function* (args: Record<string, unknown>) { state.calls.push(args); yield state.response; } }));
vi.mock("./output-banned-word-gate", () => ({ findBannedWordHits: () => [], generateWithBannedWordGate: async (args: { generate: (attempt: number) => Promise<string> }) => ({ output: await args.generate(1) }) }));
import { runStage13 } from "./stage13.functions";

// Exercise the actual handler, replacing only external persistence/model/auth boundaries.
const invoke = async () => {
  const handler = runStage13 as unknown as (args: { data: { sessionId: string }; context: { userId: string } }) => AsyncGenerator<unknown>;
  for await (const event of handler({ data: { sessionId: "00000000-0000-4000-8000-000000000001" }, context: { userId: "signed-in-user" } })) void event;
};
beforeEach(() => {
  const fixture = diagnosticFixture();
  state.session = { ...fixture, brief_type: "deal", run_mode: "diagnostic", stage_13_output: null, brand_intelligence: { truth: "Evidence" }, current_proposition: "Existing position", current_proposition_source: "Client brief", current_proposition_date: "2026-10-17" };
  state.response = `Existing Stage 13 written answer\n<<<STRUCTURED_JSON\n${JSON.stringify(fixture.stage_13_structured)}\n>>>`;
  state.updates = []; state.calls = [];
});
describe("B1 Stage 13 completion", () => {
  it("persists diagnostic valuation atomically with Stage 13 before the lock, without continuing", async () => {
    await invoke();
    expect(state.calls).toHaveLength(1);
    expect(state.calls[0].stageNumber).toBe("13");
    expect(state.updates).toHaveLength(2);
    expect(state.updates[1]).toMatchObject({ stage_13_output: "Existing Stage 13 written answer", stage_status: "complete:13" });
    expect(state.updates[1].stage_16_valuation_output).toContain("Diagnostic: current brand position");
    expect(state.updates[1].stage_13_structured).toHaveProperty("current_position.status", "scored");
    expect(Object.keys(state.updates[1]).some((k) => /stage_(13b|14|15|17)/.test(k))).toBe(false);
  });
  it.each(["diagnostic", "full"])("Deal %s scores credibility baseline in the same call", async (mode) => {
    state.session.run_mode = mode;
    await invoke();
    expect(state.calls).toHaveLength(1);
    expect(state.calls[0].userMessage).toContain('CURRENT proposition "Existing position"');
    expect(state.updates[1].stage_13_structured).toHaveProperty("current_position.excluded_from_selection", true);
    if (mode === "full") expect(state.updates[1]).not.toHaveProperty("stage_16_valuation_output");
  });
  it("Campaign does not receive a Stage 13 baseline", async () => {
    state.session.brief_type = "campaign";
    await invoke();
    expect(state.calls[0].userMessage).not.toContain("CURRENT POSITION");
    expect(state.updates[1].stage_13_structured).not.toHaveProperty("current_position");
  });
});