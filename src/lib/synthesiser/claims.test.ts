import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ upsert: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: { getUser: async () => ({ data: { user: { id: 'actor' } } }) },
  from: (table: string) => table === 'synthesiser_claims' ? { upsert: mocks.upsert } : {
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { claims_stored: false } }) }) }),
    update: () => ({ eq: async () => ({ error: null }) }),
  },
} }));
vi.mock("@/lib/hub/context", () => ({ hubColumns: () => ({}) }));

import { claimRecords, recordSynthesiserRun } from "./runs";
import type { SynthesisedClaim } from "./types";

const c = (claim: string, categories: SynthesisedClaim["categories"], status: SynthesisedClaim["status"]): SynthesisedClaim => ({
  claim, categories, status, sourceType: "externally_verifiable", sourceDocument: "report.pdf",
});

describe("synthesiser claim records", () => {
  it('stores a known source date without replacing it with the save date', () => {
    const rows = claimRecords('run-1', [{...c('Dated claim', ['input_brand_health'], 'verified'), sourceDate:'2021-09'}]);
    expect(rows[0].source_date).toBe('2021-09');
  });
  it('uses Undated only for an explicitly undated source, leaving unknown dates null', () => {
    const rows=claimRecords('run-1', [{...c('Undated claim', ['input_brand_health'], 'verified'),sourceDate:'Undated'},c('Unknown date', ['input_brand_health'], 'verified')]);
    expect(rows.map(r=>r.source_date)).toEqual(['Undated',null]);
  });
  it('retries idempotently, never replacing an already saved claim', async () => {
    mocks.upsert.mockResolvedValueOnce({ error: { message: 'Transient failure' } }).mockResolvedValueOnce({ error: null });
    await recordSynthesiserRun({ id: 'run-1', brandName: 'JLR', category: 'Cars', status: 'applied', claimCount: 1, claims: [c('A', ['input_primary_consumer', 'input_brand_health'], 'verified')] });
    expect(mocks.upsert).toHaveBeenCalledTimes(2);
    expect(mocks.upsert.mock.calls[0][0]).toHaveLength(1);
    expect(mocks.upsert.mock.calls[1][1]).toEqual({ onConflict: 'synthesiser_run_id,position', ignoreDuplicates: true });
  });
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
