import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/hub/context", () => ({ hubColumns: () => ({}) }));

import { claimRecords } from "./runs";
import type { SynthesisedClaim } from "./types";

const c = (claim: string, categories: SynthesisedClaim["categories"], status: SynthesisedClaim["status"]): SynthesisedClaim => ({
  claim, categories, status, sourceType: "externally_verifiable", sourceDocument: "report.pdf",
});

describe("synthesiser claim records", () => {
  it("writes each claim once while retaining all headings, labels and sources", () => {
    const rows = claimRecords("run-1", [
      c("A", ["input_brand_health"], "verified"),
      c("B", ["input_primary_consumer", "input_brand_health"], "contradicted"),
    ]);
    expect(rows.map((r) => [r.heading, r.claim_text, r.label, r.position])).toEqual([
      ["Brand Health Tracking Data", "A", "verified", 1],
      ["Primary Consumer Research; Brand Health Tracking Data", "B", "contradicted", 2],
    ]);
    expect(rows.every((r) => r.source === "report.pdf" && r.source_date === null && r.synthesiser_run_id === "run-1")).toBe(true);
  });
});
