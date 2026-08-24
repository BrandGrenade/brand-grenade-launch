// Regression test for the Stage 18 line contamination bug.
//
// When the Creative Stimulus Engine has locked a campaign line, the superseded Stage 18
// detonation line and statement must NOT appear anywhere in the Stage 21 user
// message. Labelling them "superseded" was not enough — briefs still leaked the
// unvalidated line alongside the validated one.

import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {} }));
vi.mock("./claude.server", () => ({ callClaude: async () => "" }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/auth-helpers.server", () => ({ assertSessionAccess: async () => undefined }));
vi.mock("./strategic-objective.server", () => ({ getObjectiveDirective: async () => "" }));

const { buildStage21UserMessage } = await import("./stage21.functions");

const STAGE_18_LINE = "Nothing to prove. Everything to drive.";
const STAGE_18_STATEMENT = "A full Stage 18 detonation statement that must not leak downstream.";
const LOCKED_LINE = "Never once in a hurry to prove it.";

const base = {
  brand_name: "Jaguar",
  category: "Automotive",
  selected_smp: "The calm that comes from having nothing left to prove.",
  stage_18_selected_detonation: STAGE_18_STATEMENT,
  stage_18_detonation_line: STAGE_18_LINE,
  stage_19_output: "activation",
  stage_20_output: "master brief",
  locked_big_idea: null as string | null,
  locked_campaign_line: null as string | null,
  locked_big_idea_lens: null as string | null,
  stage_20b_output: "channel strategy",
  truth_product: "p",
  truth_consumer: "c",
  truth_cultural: "cu",
  stage_21_outputs: null,
};

describe("Stage 21 user message", () => {
  it("withholds the superseded Stage 18 line and statement when a campaign line is locked", () => {
    const msg = buildStage21UserMessage("Online Video", "Lead", "ctx", {
      ...base,
      locked_big_idea: "The idea that won the sweep.",
      locked_campaign_line: LOCKED_LINE,
      locked_big_idea_lens: "Reversal",
    });

    expect(msg).not.toContain(STAGE_18_LINE);
    expect(msg).not.toContain(STAGE_18_STATEMENT);
    expect(msg).toContain(LOCKED_LINE);
    expect(msg).toContain("SELECTED DETONATION (Stage 18) — WITHHELD.");
  });

  it("still supplies the Stage 18 line when no campaign line is locked", () => {
    const msg = buildStage21UserMessage("Online Video", "Lead", "ctx", base);
    expect(msg).toContain(STAGE_18_LINE);
    expect(msg).toContain(STAGE_18_STATEMENT);
  });

  it("never mentions the retired Stage 20L Lead Creative Expression", () => {
    const msg = buildStage21UserMessage("Online Video", "Lead", "ctx", base);
    expect(msg).not.toContain("LEAD CREATIVE EXPRESSION");
  });
});
