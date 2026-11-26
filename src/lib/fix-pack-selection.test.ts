import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { reselectAvailability, retryAllowed, lockedNote, stage13ReturnsToStage12, LOC_SCORE_LABEL, pickSingle } from "./reselection";
import { landingPipelineStage } from "./pipeline-navigation";
import { stage18Verdict, applyStage18CodeVerdict } from "./stage18-verdict";
import { PHASE2_FIELD_SCHEMA } from "./access/phase2-scores";

const base = { checkpoint_c_confirmed: true, selected_smp: "Pay for the engineering.", stage_12_output: "set", stage_status: "complete:13" };

describe("1. reselection before the final checkpoint", () => {
  it("allowed after Stage 13 while unlocked and not signed off", () => expect(reselectAvailability(base).allowed).toBe(true));
  it("refused once locked", () => expect(reselectAvailability({ ...base, locked_at: "2026-11-25" }).allowed).toBe(false));
  it("refused after final sign-off", () => expect(reselectAvailability({ ...base, strategy_signoff_confirmed: true }).allowed).toBe(false));
  it("refused on Validate runs", () => expect(reselectAvailability({ ...base, validate_brief: {} }).allowed).toBe(false));
  it("database keeps every earlier selection and locks diagnostic runs only at sign-off", () => {
    const sql = readFileSync("drizzle/migrations/0056_final_checkpoint_lock_and_reselection.sql", "utf8");
    expect(sql).toContain("INSERT INTO public.selection_versions");
    expect(sql).toContain("Selection history is append-only.");
    expect(sql).toMatch(/ELSIF coalesce\(\(n->>'strategy_signoff_confirmed'\)::boolean, false\) THEN[\s\S]*'locked_at', now\(\)/);
  });
  it("Stage 13 'Return to Stage 12' verdict is recognised", () => {
    expect(stage13ReturnsToStage12("VERDICT: RETURN TO STAGE 12")).toBe(true);
    expect(stage13ReturnsToStage12("VERDICT: CONFIRMED")).toBe(false);
  });
});

describe("2. retry with notes", () => {
  it("offered on unlocked runs, hidden on locked runs with a plain note", () => {
    expect(retryAllowed({ locked_at: null })).toBe(true);
    expect(retryAllowed({ locked_at: "x" })).toBe(false);
    expect(lockedNote("Run completed")).toBe("This run is locked (Run completed). Its stages can't be retried or changed.");
  });
});

describe("3/4. selection screen", () => {
  it("only one proposition can be chosen", () => {
    expect(pickSingle(null, 2)).toBe(2);
    expect(pickSingle(2, 2)).toBeNull();
    expect(readFileSync("src/components/SMPSelection.tsx", "utf8")).not.toMatch(/to combine|Both travel downstream/);
  });
  it("left-of-centre score label", () => expect(LOC_SCORE_LABEL).toBe("Scored on future potential; not yet integrity-tested"));
});

describe("5. landing", () => {
  it("a stale completed-stage link yields to the stage waiting for the user", () => {
    expect(landingPipelineStage({ "01": "complete", "12": "checkpoint" }, true, "1")).toBe("12");
  });
  it("without a link it opens the current stage", () => {
    expect(landingPipelineStage({ "01": "complete", "12": "complete", "13": "complete" }, true)).toBe("13");
  });
});

describe("6. held items", () => {
  it("Stage 18 verdict: 72 of 80 passes, 71 does not", () => {
    expect(stage18Verdict(72)).toBe("PASS");
    expect(stage18Verdict(71)).toBe("REVIEW");
  });
  it("rewrites COMPOSITE/STATUS from eight scores", () => {
    const dims = ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel"].map((d) => `${d}, 9.`).join("\n");
    const out = applyStage18CodeVerdict(`EIGHT DIMENSION STRESS TEST RESULTS\n${dims}\nCOMPOSITE: 70/80\nSTATUS: REVIEW\n`);
    expect(out).toContain("COMPOSITE: 72/80");
    expect(out).toContain("STATUS: PASS");
  });
  it("leaves candidates without eight scores unchanged", () => {
    const t = "EIGHT DIMENSION STRESS TEST RESULTS\nAlpha, 9.\nCOMPOSITE: 70/90\nSTATUS: PASS\n";
    expect(applyStage18CodeVerdict(t)).toBe(t);
  });
  it("Hub field description reads /80", () => expect(PHASE2_FIELD_SCHEMA.stage18.composite).toContain("n/80"));
  it("Checkpoint C confirmation and record saved by one database function", () => {
    expect(readFileSync("src/lib/stage12.functions.ts", "utf8")).toContain('rpc("bg_confirm_checkpoint_c"');
  });
});
