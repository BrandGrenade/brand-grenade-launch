import { describe, expect, it } from "vitest";
import { locRetryPlan, LOC_ENGINE_MAX_TOKENS, LOC_ENGINE_RETRY_INCOMPLETE } from "./retry-policy";
import { LOC_ENGINES, type EngineName } from "./task-types";

describe("LOC selective regeneration", () => {
  it("runs ticked 05/08/10/13 and keeps unticked 02/07/09 verbatim", () => {
    const prior = Object.fromEntries(LOC_ENGINES.map(e => [e, { ok: true, output: { proposition: e } }]));
    const plan = locRetryPlan(prior, ["worst_case", "enemy_first", "the_unsayable", "invented_authority"]);
    expect(plan.enginesToRun).toEqual(["worst_case", "enemy_first", "the_unsayable", "invented_authority"]);
    for (const e of ["constraint", "time_displacement", "subtract"]) expect(plan.preserved[e]).toBe(prior[e]);
  });
  it("protects the five locked lines even on regenerate-all", () => {
    const locked: EngineName[] = ["constraint", "time_displacement", "subtract", "the_moment", "one_word_ownership"];
    const prior = Object.fromEntries(locked.map(e => [e, { ok: true, locked: true, output: { proposition: e } }]));
    expect(locRetryPlan(prior).enginesToRun).toEqual(["inversion", "wrong_room", "delete_customer", "worst_case", "random_connection", "enemy_first", "the_unsayable", "invented_authority"]);
    for (const e of locked) expect(locRetryPlan(prior).preserved[e]).toBe(prior[e]);
  });
  it("an explicit empty selection regenerates nothing", () => {
    expect(locRetryPlan({}, []).enginesToRun).toEqual([]);
  });
  it("honors a kept Enemy First and preserves failed unticked records", () => {
    const prior = { enemy_first: { ok: true, output: { proposition: "keep" } }, subtract: { ok: false, error: "stop_reason=max_tokens" } };
    const plan = locRetryPlan(prior, ["inversion"]);
    expect(plan.preserved).toEqual(prior);
    expect(plan.enginesToRun).toEqual(["inversion"]);
  });
  it("allocates 16000 tokens including reasoning and opts into one incomplete retry", () => {
    expect(LOC_ENGINE_MAX_TOKENS).toBe(16000);
    expect(LOC_ENGINE_RETRY_INCOMPLETE).toBe(true);
  });
});