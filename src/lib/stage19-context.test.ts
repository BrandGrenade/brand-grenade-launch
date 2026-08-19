import { describe, expect, it } from "vitest";
import { buildStage19UserMessage } from "./stage19.server";

describe("Stage 19 selected Detonation context", () => {
  it("includes only the human-selected candidate and excludes higher-scored alternatives", () => {
    const message = buildStage19UserMessage({
      brand_name: "Brand Grenade",
      category: "Strategy",
      selected_smp: "The machine builds it. The human pulls the pin.",
      stage_18_detonation_line: "The Last Human Act.",
      stage_18_selected_detonation: "The selected statement.",
      stage_18_output: [
        "## Detonation Candidate One — Who Decided This",
        "DETONATION LINE:\nWho Decided This.",
        "DETONATION STATEMENT:\nThe top-ranked statement.",
        "COMPOUNDING ASSESSMENT:\nPLATFORM — top-ranked assessment.",
        "## Detonation Candidate Two — The Last Human Act",
        "DETONATION LINE:\nThe Last Human Act.",
        "DETONATION STATEMENT:\nThe selected statement.",
        "COMPOUNDING ASSESSMENT:\nPLATFORM — selected assessment.",
      ].join("\n\n"),
      stage_14b_output: "Channel context",
      truth_product: "Product truth",
      truth_consumer: "Consumer truth",
      truth_cultural: "Cultural truth",
    });

    expect(message).toContain("The Last Human Act.");
    expect(message).toContain("PLATFORM — selected assessment.");
    expect(message).not.toContain("Who Decided This.");
    expect(message).not.toContain("top-ranked assessment");
  });
});