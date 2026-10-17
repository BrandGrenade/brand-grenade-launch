import { beforeEach, describe, expect, it, vi } from "vitest";
import { diagnosticFixture } from "./diagnostic-valuation.fixture";
const state = vi.hoisted(() => ({ session: {} as Record<string, unknown>, updates: [] as Record<string, unknown>[], calls: [] as Record<string, unknown>[], response: "" }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  const chain = { middleware: () => chain, inputValidator: () => chain, handler: (fn: unknown) => fn }; return chain;
} }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: () => ({
  select: () => ({ eq: () => ({ single: async () => ({ data: state.session, error: null }) }) }),
  update: (payload: Record<string, unknown>) => { state.updates.push(payload); return { eq: async () => ({ error: null }) }; },
}) } }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("./auth-helpers.server", () => ({ assertSessionAccess: vi.fn() }));
vi.mock("./pipeline-integrity", () => ({ assertUpstreamStageOutput: vi.fn() }));
vi.mock("./count-helpers", () => ({ countPropositions: () => 1 }));
vi.mock("./stream-stage-safety", () => ({ withStreamSafety: (_args: unknown, stream: AsyncIterable<string>) => stream }));
vi.mock("./claude.server", () => ({ streamClaude: async function* (args: Record<string, unknown>) { state.calls.push(args); yield state.response; } }));
import { runStage11 } from "./stage11.functions";
beforeEach(() => {
  const fixture = diagnosticFixture();
  state.session = { ...fixture, brief_type: "deal", stage_10_output: "Candidate score", stage_11_output: null, current_proposition: "Existing position", current_proposition_source: "Client brief", current_proposition_date: "2026-10-17" };
  state.response = `Existing Stage 11 answer\n<<<STRUCTURED_JSON\n${JSON.stringify(fixture.stage_11_structured)}\n>>>`;
  state.updates = []; state.calls = [];
});
const invoke = async () => {
  const handler = runStage11 as unknown as (args: { data: { sessionId: string }; context: { userId: string } }) => AsyncGenerator<unknown>;
  for await (const event of handler({ data: { sessionId: "00000000-0000-4000-8000-000000000001" }, context: { userId: "signed-in-user" } })) void event;
};
describe("B1 Stage 11 baseline", () => {
  it.each(["diagnostic", "full"])("Deal %s produces T1–T8 baseline in the same call with unchanged written answer", async (mode) => {
    state.session.run_mode = mode;
    await invoke();
    expect(state.calls).toHaveLength(1);
    expect(state.calls[0].userMessage).toContain('CURRENT proposition "Existing position"');
    expect(state.updates[1].stage_11_output).toBe("Existing Stage 11 answer");
    expect(state.updates[1].stage_11_structured).toHaveProperty("current_position.status", "scored");
    expect(state.updates[1].stage_11_structured).toHaveProperty("current_position.excluded_from_selection", true);
    const record = state.updates[1].stage_11_structured as { current_position: { tests: object } };
    expect(Object.keys(record.current_position.tests)).toEqual(["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8"]);
  });
  it("Campaign remains without a baseline", async () => {
    state.session.brief_type = "campaign";
    await invoke();
    expect(state.calls[0].userMessage).not.toContain("CURRENT POSITION");
    expect(state.updates[1].stage_11_structured).not.toHaveProperty("current_position");
  });
});