import { describe, expect, it } from "vitest";
import { renderRatingTable } from "./creative-shortlist";

const full = {
  crab: { clear: "High", relevant: "High", relevant_human_truth: "A truth." },
  fame: { rating: "Medium", rationale: "Some fame." },
  brand_glue: { rating: "High", rationale: "Glue.", reusable_asset: "An asset." },
  producibility: { pass: true, note: "Fine.", concerns: [] },
  brand_integrity: { third_party_ip: "A song", flag_note: "Clear it.", concerns: [] },
  creative_ambition: { rating: "Medium", judgement: "Judged." },
  creative_uniqueness: {
    rating: "Medium",
    verdict: "Verdict.",
    searches_run: ["secret query"],
    web_search_performed: true,
    prior_executions: [{ brand: "B", campaign: "C", year: "2024", how_similar: "S", source_url: "https://x" }],
  },
  strategic_compliance: { rating: "Supporting", rationale: "R.", smp_element: "E", dramatizes_tension: true },
};

describe("renderRatingTable", () => {
  it("renders formatted markup with no JSON or telemetry", () => {
    const html = renderRatingTable(full);
    expect(html).toContain('table class="ratings"');
    expect(html).not.toMatch(/[{}]/);
    expect(html).not.toMatch(/searches_run|web_search_performed|dramatizes_tension|secret query/);
    expect(html).toContain("ip-callout");
    expect(html).toContain("Reusable asset");
    expect(html).toContain("B — C (2024)");
  });

  it("names a missing dimension instead of dumping the object", () => {
    const { fame, ...rest } = full;
    const html = renderRatingTable(rest);
    expect(html).toContain("Incomplete score data — field missing: Fame");
    expect(html).not.toMatch(/[{}]/);
  });

  it("leaves unrated directions alone", () => {
    expect(renderRatingTable(null)).toContain("not rated");
  });

  it("omits the callout when the caller renders its own", () => {
    expect(renderRatingTable(full, { ipCallout: false })).not.toContain("ip-callout");
  });
});
