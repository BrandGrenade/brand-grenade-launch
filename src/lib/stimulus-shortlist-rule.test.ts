import { describe, expect, it } from "vitest";
import { isShortlisted } from "./stimulus-sweep";
import { buildPhase2Document } from "./phase2-document-generator";

describe("Gate One shortlist membership", () => {
  it("includes Keep, Keep in play and Gate One-approved ideas", () => {
    expect(isShortlisted({ status: "keep" })).toBe(true);
    expect(isShortlisted({ status: "keep_in_play" })).toBe(true);
    expect(isShortlisted({ status: "generated", gate_one_approved: true })).toBe(true);
  });
  it("excludes killed and unjudged ideas", () => {
    expect(isShortlisted({ status: "kill" })).toBe(false);
    expect(isShortlisted({ status: "generated", gate_one_approved: false })).toBe(false);
  });
});

describe("Stage 20B Channel Strategy document", () => {
  it("is built from the saved Stage 20B output", () => {
    const html = buildPhase2Document(
      {
        id: "s", brand_name: "JLR", selected_smp: null, stage_17_selected_territory: null,
        stage_17b_output: null, stage_18_selected_detonation: null, stage_19_output: null,
        stage_20_output: null, stage_20b_output: "Outdoor reaches commuters at scale.",
        stage_21_outputs: null, stage_22_brand_architecture: null, stage_22_distinctive_assets: null,
      },
      "channel_strategy",
    );
    expect(html).toContain("Channel Strategy");
    expect(html).toContain("Outdoor reaches commuters at scale.");
  });
});
