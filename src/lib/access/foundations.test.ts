import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AccessError, handleAccess, type Db, type Key, type LogEntry, type RunRec, type VersionRow } from "./core";
import { briefSubjectBrand, type Attempt, type BrandSources } from "./foundations";

const JLR = "3470f1ad-b322-4230-8e3d-bf0072e95b7a";
const C1 = "be88d27c-cf6c-45ee-b851-b8c7aa8f6abb";
const C2 = "22222222-2222-4222-8222-222222222222";
const S10 = readFileSync(join(__dirname, "fixtures/jlr-v97-stage10-output.txt"), "utf8");
const HUB: Key = { id: "k1", scope: "hub_tools" };
const SB: Key = { id: "k2", scope: "second_brain" };
const log = (): LogEntry => ({ scope: null, key_id: null, client_ref: null, run_id: null, request: null, output_id: null });

// Stored JLR record values as read from the database (24 Nov 2026, read only).
const STORED = { selected_smp: "The jaguar doesn't share its name lightly.", field: "The Name As Threshold", confirmed_at: "2026-10-21T11:20:56.396+00:00",
  scores: { fame: 8, truth_strength: 7, competitive_impossibility: 9, brand_permission: 7, clean_air: 8, commercial_precedent: 8 }, composite: 70.5, verdict: "PASS" };

const meta: VersionRow[] = Array.from({ length: 96 }, (_, i) => ({ field: "stage_2_output", version_no: 1, content: null, reason: "x", created_at: `2026-10-21T00:${String(Math.floor(i / 60)).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}Z` }));
const jlr: RunRec = { table: "sessions", id: JLR, row: { id: JLR, bg_client_id: C1, link_status: "linked", brand_name: "JLR", status: "complete", created_at: "2026-10-20T10:49:01.203816+00:00",
  stage_10_output: S10, stage_10_structured: null, selected_smp: STORED.selected_smp, selected_smp_field_name: STORED.field, selection_rationale: { a_human_choice: "Chosen by the team." },
  checkpoint_c_confirmed: true, checkpoint_c_confirmed_at: STORED.confirmed_at, stage_2_output: "Stage 2", locked_at: "2026-10-26" } };

const infinitiBaseline = { status: "scored", line: "Japanese precision and thoughtful hospitality.", evidence_label: "Unverified", composite: 39, code_verdict: "PASS",
  fame: { score: 3, justification: "low salience" }, truth_strength: { score: 6, justification: "t" }, competitive_impossibility: { score: 6, justification: "c" },
  brand_permission: { score: 7, justification: "b" }, clean_air: { score: 4, justification: "a" }, commercial_precedent: { score: 5, justification: "p" } };

function makeDb(over: Partial<BrandSources> = {}) {
  const src: BrandSources = {
    sessions: [{ id: JLR, brand_name: "JLR", version: 97, locked_at: "2026-10-26", created_at: "2026-10-20T10:49:01Z", validate_brief: null }],
    briefs: [{ brand_name: "JLR", f1_brand: "JLR's Jaguar, relaunching as a single luxury house" }],
    addonJobs: [{ id: "job1", session_id: JLR, subject_brand: "Infiniti", published_version: 97, proposition: "Japanese precision", results: { "10": infinitiBaseline }, completed_at: "2026-10-27T10:45:56Z" }],
    validates: [{ session_id: JLR, run_version: 97, assessment_revision: 3, subject_brand: "Infiniti", outputs: { "validate.verdict": { data: { verdict: "INSUFFICIENT EVIDENCE" }, confidence: { key_facts: "k" } } }, created_at: "2026-11-01T18:13:46Z" }],
    ...over,
  };
  const batches: { id: string; bg_client_id: string; brands: string[]; analyses: string[]; market: string | null }[] = [];
  const attempts: (Attempt & { batch_id: string })[] = [];
  let calls = 0;
  const db: Db & { src: BrandSources; attempts: typeof attempts; batches: typeof batches; builds: () => number } = {
    src, attempts, batches, builds: () => calls,
    listClients: async () => [], ensureClient: async () => { throw new Error(); }, attachClient: async () => { throw new Error(); },
    resolveClient: async (r) => (r === "hub-jlr" ? C1 : r === "hub-other" ? C2 : null), resolveEngagement: async () => null,
    listLinkedRuns: async () => [jlr], findRun: async (i) => (i === JLR ? jlr : null),
    versions: async () => meta, versionMeta: async () => meta, claims: async () => [], stimulus: async () => ({ directions: [], prompts: [], orchestrations: [] }), actorName: async () => null,
    brandSources: async (c) => { calls++; return c === C1 ? db.src : { sessions: [], briefs: [], addonJobs: [], validates: [] }; },
    batchCreate: async (b) => { const id = `00000000-0000-4000-8000-${String(batches.length + 1).padStart(12, "0")}`; batches.push({ id, ...b }); return id; },
    batchGet: async (id) => batches.find((b) => b.id === id) ?? null,
    batchAttempts: async (id) => attempts.filter((a) => a.batch_id === id),
    batchInsertAttempt: async (batch_id, a) => {
      if (attempts.some((x) => x.batch_id === batch_id && x.brand_id === a.brand_id && x.attempt_no === a.attempt_no)) return false;
      attempts.push({ ...a, batch_id, created_at: `t${attempts.length}` }); return true;
    },
  };
  return db;
}
const call = (db: Db, request: string, params: Record<string, unknown>, key = HUB) => handleAccess(db, key, { request, params }, log(), () => "2026-11-24T00:00:00Z") as Promise<any>;

describe("stage10_selected (JLR v97)", () => {
  it("matches the stored record value for value", async () => {
    const r = await call(makeDb(), "stage10_selected", { client_ref: "hub-jlr", run_id: JLR, version: 97 });
    const v = r.content.stage10_selected;
    expect(v.proposition_text).toBe(STORED.selected_smp);
    expect(v.proposition_id).toBe(`${JLR}:v97:stage10:2`);
    expect(v.field_name).toBe(STORED.field);
    for (const [k, s] of Object.entries(STORED.scores)) expect(v.dimensions[k].score).toBe(s);
    expect(Object.fromEntries(Object.entries(v.dimensions).map(([k, d]: any) => [k, d.weight]))).toEqual({ fame: 30, truth_strength: 20, competitive_impossibility: 15, brand_permission: 10, clean_air: 10, commercial_precedent: 5 });
    expect(v.composite).toBe(70.5);
    expect(v.verdict).toBe("PASS");
    expect(v.hard_floors).toEqual([{ dimension: "truth_strength", floor: 5, score: 7, passed: true }, { dimension: "competitive_impossibility", floor: 6, score: 9, passed: true }]);
    expect(v.selection_timestamp).toBe(STORED.confirmed_at);
    expect(r.metadata.contract_version).toBe("1.0");
    expect(r.content.stage18.max).toBe(80);
  });
  it("returns null before a confirmation exists, even if Checkpoint C is set", async () => {
    const db = makeDb();
    const saved = jlr.row.selection_rationale;
    jlr.row.selection_rationale = null;
    try {
      const r = await call(db, "stage10_selected", { client_ref: "hub-jlr", run_id: JLR });
      expect(r.content.stage10_selected).toBeNull();
      expect(r.content.reason).toBe("No confirmed selection");
      expect(r.content.confirmation.discrepancy).toMatch(/checkpoint_c_confirmed is true/);
    } finally { jlr.row.selection_rationale = saved; }
  });
});

describe("metadata on get_output", () => {
  it("adds only a metadata object, after every pre-existing field", async () => {
    const r = await call(makeDb(), "get_output", { client_ref: "hub-jlr", run_id: JLR, version: 97, output_id: "stage02" });
    const keys = Object.keys(r);
    expect(keys[keys.length - 1]).toBe("metadata");
    expect(keys.slice(0, -1)).toEqual(["scope", "client_ref", "bg_client_id", "engagement_id", "run_id", "room", "run_mode", "run_status", "run_classification", "is_test", "eligible_for_default", "version", "locked", "output_id", "schema_version", "content_status", "content", "evidence", "checkpoints", "documents", "provenance", "legacy", "earlier_versions_kept", "generated_at"]);
    expect(r.content).toEqual({ text: "Stage 2" });
    expect(r.metadata).toMatchObject({ brand_id: "jlr", market: "global", analysis_type: "stage02", run_id: JLR, run_version: 97, status: "complete", missing_inputs: [], contract_version: "1.0" });
    for (const k of ["requested_market", "strategy_version", "method_version", "produced_at", "confidence", "evidence_refs"]) expect(k in r.metadata).toBe(true);
  });
  it("run_manifest and list_runs are unchanged (no metadata key)", async () => {
    const r = await call(makeDb(), "list_runs", { client_ref: "hub-jlr" });
    expect("metadata" in r).toBe(false);
  });
});

describe("brand × market", () => {
  it("finds Jaguar from the saved brief brand field", () => {
    expect(briefSubjectBrand("JLR", "JLR's Jaguar, relaunching")).toBe("Jaguar");
    expect(briefSubjectBrand("JLR", "Jaguar relaunching")).toBeNull();
  });
  it("Jaguar in UK falls back to global and names the missing input", async () => {
    const r = await call(makeDb(), "brand_analysis", { client_ref: "hub-jlr", brand_id: "Jaguar", market: "UK", analysis: "profile" });
    expect(r.metadata).toMatchObject({ brand_id: "jaguar", requested_market: "UK", market: "global", contract_version: "1.0" });
    expect(r.metadata.missing_inputs).toContain("market-specific analysis");
  });
  it("Validate verdict for Infiniti is served with metadata", async () => {
    const r = await call(makeDb(), "brand_analysis", { client_ref: "hub-jlr", brand_id: "infiniti", analysis: "validate_verdict" });
    expect(r.content.data.verdict).toBe("INSUFFICIENT EVIDENCE");
    expect(r.metadata).toMatchObject({ run_id: JLR, run_version: 97, market: "global", status: "complete" });
  });
  it("another client's brand is refused (fail closed)", async () => {
    await expect(call(makeDb(), "brand_analysis", { client_ref: "hub-other", brand_id: "jaguar", analysis: "profile" })).rejects.toMatchObject({ code: "not_found" });
  });
  it("other scopes cannot use Hub foundation requests", async () => {
    await expect(call(makeDb(), "brand_analysis", { client_ref: "hub-jlr", brand_id: "jaguar", analysis: "profile" }, SB)).rejects.toBeInstanceOf(AccessError);
  });
});

describe("portfolio batch", () => {
  it("resumes without rerunning, and a repeated call never duplicates", async () => {
    const db = makeDb();
    const a = await call(db, "portfolio_batch", { client_ref: "hub-jlr", brands: ["jaguar", "jlr", "infiniti"], limit: 1 });
    expect(a.content.counts).toEqual({ done: 1, failed: 0, not_started: 2 });
    const first = JSON.stringify(a.content.brands[0]);
    const b = await call(db, "portfolio_batch", { client_ref: "hub-jlr", batch_id: a.content.batch_id });
    expect(b.content.counts).toEqual({ done: 3, failed: 0, not_started: 0 });
    expect(JSON.stringify(b.content.brands[0])).toBe(first);
    await call(db, "portfolio_batch", { client_ref: "hub-jlr", batch_id: a.content.batch_id });
    expect(db.attempts).toHaveLength(3);
    expect(db.batches).toHaveLength(1);
    for (const x of b.content.brands) for (const r of Object.values(x.result) as any[]) expect(r.metadata.contract_version).toBe("1.0");
  });
  it("refuses a brand outside the client and creates nothing", async () => {
    const db = makeDb();
    await expect(call(db, "portfolio_batch", { client_ref: "hub-jlr", brands: ["jaguar", "marlowe"] })).rejects.toMatchObject({ code: "not_found" });
    expect(db.batches).toHaveLength(0);
  });
  it("another client cannot read the batch", async () => {
    const db = makeDb();
    const a = await call(db, "portfolio_batch", { client_ref: "hub-jlr", brands: ["jaguar"] });
    await expect(call(db, "portfolio_batch", { client_ref: "hub-other", batch_id: a.content.batch_id })).rejects.toMatchObject({ code: "not_found" });
  });
  it("retries a failed brand only on request, keeping the original failure", async () => {
    const db = makeDb();
    const keep = db.src.validates;
    const a0 = await call(db, "portfolio_batch", { client_ref: "hub-jlr", brands: ["jaguar", "infiniti"], limit: 1 });
    db.src.validates = [];
    db.src.addonJobs = [];
    const a = await call(db, "portfolio_batch", { client_ref: "hub-jlr", batch_id: a0.content.batch_id });
    expect(a.content.brands.map((x: any) => x.status)).toEqual(["done", "failed"]);
    const jag = JSON.stringify(a.content.brands[0]);
    const resumed = await call(db, "portfolio_batch", { client_ref: "hub-jlr", batch_id: a.content.batch_id });
    expect(resumed.content.brands[1].status).toBe("failed");
    db.src.validates = keep;
    db.src.addonJobs = makeDb().src.addonJobs;
    const r = await call(db, "portfolio_batch", { client_ref: "hub-jlr", batch_id: a.content.batch_id, retry_brand: "infiniti" });
    expect(r.content.brands[1].status).toBe("done");
    expect(r.content.brands[1].attempts.map((x: any) => [x.kind, x.status])).toEqual([["initial", "failed"], ["retry", "done"]]);
    expect(JSON.stringify(r.content.brands[0])).toBe(jag);
    await expect(call(db, "portfolio_batch", { client_ref: "hub-jlr", batch_id: a.content.batch_id, retry_brand: "jaguar" })).rejects.toMatchObject({ code: "invalid_request" });
  });
});

describe("change assessment", () => {
  it("Jaguar global has no current position: named null", async () => {
    const r = await call(makeDb(), "change_assessment", { client_ref: "hub-jlr", brand_id: "Jaguar", market: "global", change_type: "rename", change_description: "rename QX60 into the Jaguar '-Type' convention" });
    expect(r.content.baseline).toBeNull();
    expect(r.content.reason).toBe("No current position for brand × market");
  });
  it("Infiniti returns stored baselines, null projections with a reason, and never an approved position", async () => {
    const db = makeDb();
    const before = JSON.stringify(db.src);
    const r = await call(db, "change_assessment", { client_ref: "hub-jlr", brand_id: "Infiniti", change_type: "rename", change_description: "rename QX60 into the Jaguar '-Type' convention" });
    expect(r.content.dimensions.fame).toMatchObject({ baseline: 3, projected: null, movement: null });
    expect(r.content.dimensions.fame.null_reason).toMatch(/no rule that projects/);
    expect(r.content.is_approved_position).toBe(false);
    expect(JSON.stringify(db.src)).toBe(before);
  });
});
