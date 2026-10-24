import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ call: vi.fn(), writes: [] as Array<{ table: string; values: Record<string, unknown> }> }));
vi.mock("@/lib/claude.server", () => ({ callClaude: mocks.call }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {
  from(table: string) {
    const query = {
      select() { return query; }, eq() { return query; }, order() { return query; }, limit() { return query; },
      insert(values: Record<string, unknown>) { mocks.writes.push({ table, values }); return query; },
      update(values: Record<string, unknown>) { mocks.writes.push({ table, values }); return query; },
      async single() {
        if (table === "sessions") return { data: { brand_name: "Test", category: "Cars", stage_18_detonation_line: "The name comes last." }, error: null };
        if (table === "stimulus_runs") return { data: { creative_guidance: "Product earns the name." }, error: null };
        return { data: { id: "attempt-2", attempt_no: 2 }, error: null };
      },
      async maybeSingle() { return { data: { id: "attempt-1", attempt_no: 1 }, error: null }; },
      then(resolve: (value: unknown) => unknown) { return Promise.resolve({ data: table === "stimulus_direction_attempts" ? [{ direction: "Old idea", attempt_no: 1 }] : null, error: null }).then(resolve); },
    };
    return query;
  },
} }));

import { regenerateDirection } from "./regenerate.server";
const options = {
  direction: { id: "direction", run_id: "run", lens_id: "silent_proof", direction: "Old idea", revise_count: 1 },
  run: { id: "run", session_id: "session", channel_name: "", channel_brief: "", smp: "Cars earn the name", run_mode: "big_idea" },
  mode: "revise" as const,
  notes: 'Use the end line "Every car earns its name."',
};
const response = `### LENS: silent_proof
THE BIG IDEA
New idea.
ROOT TENSION
New contradiction.
IDEA COLLISION CHECK
CLEAR
CANDIDATE MASTER LINE
Earned on the road.
EXPRESSION UNDER MASTER
An unwanted substitute.
GUIDANCE ALIGNMENT
ALIGNED — The product proves the name.
WHY IT WINS
A new rationale, not the old one.`;

describe("guided rewrite persistence", () => {
  beforeEach(() => { mocks.writes.length = 0; mocks.call.mockReset(); });
  it("saves new description, lines, root tension, alignment and rationale in the same update", async () => {
    mocks.call.mockResolvedValue(response);
    await regenerateDirection(options);
    const saved = mocks.writes.find(w => w.table === "stimulus_directions")?.values;
    expect(saved).toMatchObject({ direction: "New idea.", campaign_line: "Earned on the road.", expression_under_master: "Every car earns its name.", root_tension: "New contradiction.", guidance_alignment: "aligned", guidance_alignment_note: "The product proves the name.", rationale: "A new rationale, not the old one." });
    expect(mocks.writes.find(w => w.table === "stimulus_direction_attempts")?.values.expression_under_master).toBe("Every car earns its name.");
    expect(mocks.call.mock.calls[0][0].userMessage).toContain("Product earns the name.");
  });
  it("does not save an incomplete rewrite over the existing idea", async () => {
    mocks.call.mockResolvedValue(response.replace("ROOT TENSION\nNew contradiction.\n", ""));
    await expect(regenerateDirection(options)).rejects.toThrow("previous idea has been kept unchanged");
    expect(mocks.writes).toHaveLength(0);
  });
});