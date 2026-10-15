import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AccessError, handleAccess, mapLabel, type Db, type Key, type LogEntry, type RunRec, type VersionRow } from "./core";

const C1 = "11111111-1111-4111-8111-111111111111";
const C2 = "22222222-2222-4222-8222-222222222222";
const E1 = "33333333-3333-4333-8333-333333333333";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const RUN = id(1), LEGACY = id(2), UNLINKED = id(3), OTHER = id(4), DIAG = id(5), SYNTH = id(6), SYNTH_NONE = id(7), STIM = id(8), LOCKED = id(9);
const linked = { bg_client_id: C1, engagement_id: E1, link_status: "linked" };

function makeDb(versions: Record<string, VersionRow[]> = {}): Db {
  const runs: RunRec[] = [
    { table: "sessions", id: RUN, row: { ...linked, id: RUN, brand_name: "Marlowe", status: "complete", run_mode: "full", earlier_versions_kept: true,
      stage_2_output: "Stage 2 text", stage_9_output: "Stage 9 text", stage_9_structured: { candidates: [] }, stage_10_output: "Stage 10 text", stage_10_structured: null,
      stage_10_structured_error: "bad", stage_16_agency_output: "# Agency doc", stage_16_valuation_output: "# Valuation", stage_22_brand_architecture: "DOMAIN: X",
      checkpoint_a_confirmed: true, checkpoint_a_confirmed_by: "u1", checkpoint_a_confirmed_at: "2026-10-01", checkpoint_b_confirmed: true, checkpoint_b_confirmed_by: null } },
    { table: "sessions", id: LEGACY, row: { ...linked, link_status: "legacy", id: LEGACY, stage_2_output: "x" } },
    { table: "sessions", id: UNLINKED, row: { ...linked, link_status: "unlinked", id: UNLINKED, stage_2_output: "x" } },
    { table: "sessions", id: OTHER, row: { ...linked, bg_client_id: C2, id: OTHER, stage_2_output: "x" } },
    { table: "sessions", id: DIAG, row: { ...linked, id: DIAG, status: "complete", run_mode: "diagnostic", diagnostic_status: "partial", locked_at: "2026-10-01", earlier_versions_kept: true,
      stage_2_output: "d2", stage_10_output: "t10", stage_10_structured: { current_position: { status: "scored", line: "Built to last", evidence_label: "Client-supplied", composite: 50 } }, stage_16_agency_output: "should not show" } },
    { table: "sessions", id: LOCKED, row: { ...linked, id: LOCKED, status: "complete", locked_at: "2026-10-01", earlier_versions_kept: true, stage_2_output: "v2 text" } },
    { table: "synthesiser_runs", id: SYNTH, row: { ...linked, id: SYNTH, claims_stored: true } },
    { table: "synthesiser_runs", id: SYNTH_NONE, row: { ...linked, id: SYNTH_NONE, claims_stored: false } },
    { table: "stimulus_runs", id: STIM, row: { ...linked, id: STIM, gate_one_confirmed: true, gate_one_confirmed_by: "u1" } },
  ];
  return {
    resolveClient: async (r) => (r === "hub-c1" ? C1 : r === "hub-c2" ? C2 : null),
    resolveEngagement: async (c, r) => (c === C1 && r === "job-1" ? E1 : null),
    listLinkedRuns: async (c) => runs.filter((r) => r.row.bg_client_id === c && r.row.link_status === "linked"),
    findRun: async (i) => runs.find((r) => r.id === i) ?? null,
    versions: async (_t, i) => versions[i] ?? [],
    claims: async () => [
      { position: 1, heading: "H", claim_text: "Sales up", label: "verified", source: "FCAI" },
      { position: 2, heading: "H", claim_text: "Loved", label: "client_supplied" },
      { position: 3, heading: "H", claim_text: "Unknown", label: null },
    ],
    stimulus: async () => ({
      directions: [{ lens_id: "l1", lens_name: "Lens", direction: "D", sort_order: 1, gate_one_approved: true }],
      prompts: [
        { channel_name: "OOH", final_prompt: "FINAL", initial_prompt: "INITIAL-SECRET", working_prompt: "WORKING-SECRET", sort_order: 1 },
        { channel_name: "TV", final_prompt: null, initial_prompt: "INITIAL-2" },
      ],
      orchestrations: [{ gate_two_confirmed: false }],
    }),
    actorName: async (u) => (u === "u1" ? "Adrian Pritchard" : null),
  };
}

const HUB: Key = { id: "k1", scope: "hub_tools" };
const SB: Key = { id: "k2", scope: "second_brain" };
const ADM: Key = { id: "k3", scope: "admin" };
const log = (): LogEntry => ({ scope: null, key_id: null, client_ref: null, run_id: null, request: null, output_id: null });
const call = (db: Db, key: Key, request: string, params: Record<string, unknown>) => handleAccess(db, key, { request, params }, log(), () => "2026-10-15T00:00:00.000Z");
const err = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return e as AccessError;
  }
  throw new Error("expected error");
};
const STD_KEYS = ["scope", "client_ref", "bg_client_id", "engagement_id", "run_id", "room", "run_mode", "run_status", "version", "locked", "output_id", "schema_version",
  "content_status", "content", "evidence", "checkpoints", "documents", "provenance", "legacy", "earlier_versions_kept", "generated_at"];

describe("BG access point", () => {
  const db = makeDb();
  const g = (run_id: string, output_id: string, key: Key = HUB, version = 1) => call(db, key, "get_output", { client_ref: "hub-c1", run_id, version, output_id });

  it("every named request returns the standard response", async () => {
    const docs = await call(db, HUB, "list_documents", { client_ref: "hub-c1", run_id: RUN, version: 1 });
    const responses = [
      await call(db, HUB, "list_runs", { client_ref: "hub-c1" }),
      await call(db, HUB, "run_manifest", { client_ref: "hub-c1", run_id: RUN }),
      await g(RUN, "stage09"),
      docs,
      await call(db, HUB, "document_metadata", { client_ref: "hub-c1", document_id: (docs.documents as any[])[0].document_id }),
      await call(db, HUB, "provenance", { client_ref: "hub-c1", run_id: RUN, version: 1, output_id: "stage09" }),
    ];
    for (const r of responses) for (const k of STD_KEYS) expect(r).toHaveProperty(k);
    expect((responses[0].content as any).runs.map((r: any) => r.run_id).sort()).toEqual([RUN, DIAG, LOCKED, SYNTH, SYNTH_NONE, STIM].sort());
  });

  it("content_status: structured, text_only and not_produced", async () => {
    expect((await g(RUN, "stage09")).content_status).toBe("structured");
    expect((await g(RUN, "stage10")).content_status).toBe("text_only"); // invalid F1d record
    expect((await g(RUN, "stage02")).content).toEqual({ text: "Stage 2 text" });
    expect((await g(RUN, "stage11")).content_status).toBe("not_produced");
    expect((await g(SYNTH_NONE, "room00.claims")).content_status).toBe("not_produced");
    expect((await g(RUN, "stage22_architecture")).content).toEqual({ text: "DOMAIN: X" });
  });

  it("labels map without upgrading and missing labels show Missing", async () => {
    const r = await g(SYNTH, "room00.claims");
    expect(r.evidence).toEqual([
      { claim: "Sales up", bg_label: "verified", label: "Verified" },
      { claim: "Loved", bg_label: "client_supplied", label: "Client-supplied" },
      { claim: "Unknown", bg_label: null, label: "Missing" },
    ]);
    expect(mapLabel("not_checked").label).toBe("Not checked");
    expect(mapLabel("contradicted").label).toBe("Contradicted");
    expect(mapLabel("something_else")).toEqual({ bg_label: "something_else", label: "Missing" });
  });

  it("checkpoints record approver names and 'not recorded' for legacy approvals", async () => {
    const r = await g(RUN, "stage02");
    const cps = r.checkpoints as any[];
    expect(cps[0]).toMatchObject({ checkpoint: "checkpoint_a", passed: true, approved_by: "Adrian Pritchard" });
    expect(cps[1]).toMatchObject({ checkpoint: "checkpoint_b", passed: true, approved_by: "not recorded" });
    expect(cps[2]).toMatchObject({ passed: false, approved_by: null });
  });

  it("another client's, legacy, unlinked and non-listed outputs are identical not_found", async () => {
    const errs = [
      await err(g(OTHER, "stage02")),
      await err(g(LEGACY, "stage02")),
      await err(g(UNLINKED, "stage02")),
      await err(g(id(999), "stage02")),
      await err(g(RUN, "layer_1_output")),
      await err(g(RUN, "room04.initial_prompts")),
      await err(g(SYNTH, "stage02")), // listed output on the wrong Room
      await err(call(db, HUB, "list_runs", { client_ref: "hub-unknown" })),
    ];
    for (const e of errs) {
      expect(e.code).toBe("not_found");
      expect(e.message).toBe("Not found.");
    }
    // Other client's run via its own ref still cannot be read through client 1.
    expect((await call(db, HUB, "get_output", { client_ref: "hub-c2", run_id: OTHER, version: 1, output_id: "stage02" })).content).toEqual({ text: "x" });
  });

  it("scopes: Second Brain and Admin limits hold", async () => {
    expect((await g(RUN, "stage16.agency", SB)).content_status).toBe("text_only");
    expect((await g(RUN, "stage22_architecture", SB)).content_status).toBe("text_only");
    expect((await g(STIM, "room04.final_prompts", SB)).content_status).toBe("structured");
    expect((await err(g(RUN, "stage09", SB))).code).toBe("forbidden_scope");
    expect((await err(g(RUN, "stage22_assets", SB))).code).toBe("forbidden_scope");
    expect((await err(g(RUN, "stage02", ADM))).code).toBe("forbidden_scope");
    expect((await err(call(db, ADM, "list_documents", { client_ref: "hub-c1", run_id: RUN, version: 1 }))).code).toBe("forbidden_scope");
    const man = await call(db, ADM, "run_manifest", { client_ref: "hub-c1", run_id: RUN });
    expect(JSON.stringify(man)).not.toContain("Stage 2 text");
    const sbMan = await call(db, SB, "run_manifest", { client_ref: "hub-c1", run_id: RUN });
    expect((sbMan.content as any).outputs.every((o: any) => o.output_id.startsWith("stage16.") || o.output_id === "stage22_architecture")).toBe(true);
  });

  it("final prompts only — never initial or working prompts", async () => {
    const r = await g(STIM, "room04.final_prompts");
    expect(JSON.stringify(r)).not.toMatch(/INITIAL|WORKING/);
    expect((r.content as any).prompts).toHaveLength(1);
  });

  it("documents fetch through the access point, never a storage link", async () => {
    const r = await call(db, HUB, "list_documents", { client_ref: "hub-c1", run_id: RUN, version: 1 });
    const d = (r.documents as any[]).map((x) => x.format);
    expect(d).toEqual(["agency", "valuation"]);
    const s = JSON.stringify(r);
    expect(s).toContain("/api/public/bg-access");
    expect(s).not.toMatch(/https?:|storage|signedUrl/i);
  });

  it("locked version returns identical content on repeat calls", async () => {
    const a = await g(LOCKED, "stage02");
    const b = await g(LOCKED, "stage02");
    expect(a.locked).toBe(true);
    expect({ ...a, generated_at: 0 }).toEqual({ ...b, generated_at: 0 });
  });

  it("a rerun appears as a new version and the earlier version still reads back", async () => {
    const vdb = makeDb({ [LOCKED]: [{ field: "stage_2_output", version_no: 1, content: "v1 text", reason: "retry", created_at: "2026-10-02T00:00:00Z" }] });
    const man = await call(vdb, HUB, "run_manifest", { client_ref: "hub-c1", run_id: LOCKED });
    expect((man.content as any).current_version).toBe(2);
    const v1 = await call(vdb, HUB, "get_output", { client_ref: "hub-c1", run_id: LOCKED, version: 1, output_id: "stage02" });
    const v2 = await call(vdb, HUB, "get_output", { client_ref: "hub-c1", run_id: LOCKED, version: 2, output_id: "stage02" });
    expect(v1.content).toEqual({ text: "v1 text" });
    expect(v2.content).toEqual({ text: "v2 text" });
    expect((await err(call(vdb, HUB, "get_output", { client_ref: "hub-c1", run_id: LOCKED, version: 3, output_id: "stage02" }))).code).toBe("not_found");
  });

  it("partial diagnostic run reports partial and marks creative stages not included", async () => {
    const man = await call(db, HUB, "run_manifest", { client_ref: "hub-c1", run_id: DIAG });
    expect(man.run_status).toBe("partial");
    expect(man.run_mode).toBe("diagnostic");
    const outs = (man.content as any).outputs;
    expect(outs.find((o: any) => o.output_id === "stage16.agency").included).toBe("not included");
    expect(outs.find((o: any) => o.output_id === "room04.*").included).toBe("not included");
    expect(JSON.stringify(man)).not.toContain("should not show");
    const cp = await g(DIAG, "stage10_current_position");
    expect(cp.content_status).toBe("structured");
    expect(cp.evidence).toEqual([{ claim: "Built to last", bg_label: "client_supplied", label: "Client-supplied" }]);
  });

  it("invalid requests", async () => {
    expect((await err(call(db, HUB, "delete_run", { client_ref: "hub-c1" }))).code).toBe("invalid_request");
    expect((await err(call(db, HUB, "get_output", { client_ref: "hub-c1", run_id: RUN }))).code).toBe("invalid_request");
    expect((await err(handleAccess(db, HUB, "nope", log()))).code).toBe("invalid_request");
  });

  it("access point code never selects retired layer fields, initial/working prompts or writes BG data", () => {
    const src = readFileSync(join(process.cwd(), "src/lib/access/access.server.ts"), "utf8");
    expect(src).not.toMatch(/layer_\d+_output/);
    expect(src).not.toMatch(/initial_prompt|working_prompt/);
    const writes = [...src.matchAll(/\.(insert|update|upsert|delete)\(/g)];
    expect(writes).toHaveLength(1); // the request log insert only
    expect(src).toContain('from("bg_access_log").insert');
  });
});
