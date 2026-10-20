import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ admin: true, rpc: [] as Array<{ name: string; args: unknown }> }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  const chain = { middleware: () => chain, inputValidator: () => chain, handler: (fn: unknown) => fn }; return chain;
} }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {} }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/claude.server", () => ({ streamClaude: vi.fn(), callClaude: vi.fn() }));
vi.mock("@/lib/auth-helpers.server", () => ({ assertSessionAccess: vi.fn() }));

import { groupRuns, toRegisterRuns, NO_JOB, type RegisterRun } from "./run-register";
import { keepOriginalBriefVersion } from "./stage1b.functions";
import { appendInputVersion } from "./intelligence.functions";
import { removeClient, restoreRun } from "./bg-clients.functions";

const run = (p: Partial<RegisterRun>): RegisterRun => ({
  table: "sessions", id: "r", room: "Strategy Pipeline", brand: "JLR", clientId: "c1", engagementId: null,
  briefType: "Campaign", runType: "Full", date: "2026-10-01T00:00:00Z", status: "Running",
  openHref: "/pipeline", documentsHref: null, ...p,
});
const names = [
  { client_id: "c1", client_name: "JLR", engagement_id: "j1", engagement_name: "Defender launch" },
  { client_id: "c1", client_name: "JLR", engagement_id: "j2", engagement_name: "Range Rover exit" },
];

describe("Client → Job → Runs", () => {
  it("a second job for the same client keeps its own runs", () => {
    const g = groupRuns([run({ id: "a", engagementId: "j1" }), run({ id: "b", engagementId: "j2" }), run({ id: "c", engagementId: "j1" })], names);
    expect(g).toHaveLength(1);
    expect(g[0].name).toBe("JLR");
    const byJob = Object.fromEntries(g[0].jobs.map((j) => [j.name, j.runs.map((r) => r.id).sort()]));
    expect(byJob).toEqual({ "Defender launch": ["a", "c"], "Range Rover exit": ["b"] });
  });
  it("runs without a job show 'No job'; runs are never grouped by brand name", () => {
    const g = groupRuns([run({ id: "a" }), run({ id: "b", clientId: null, brand: "JLR" })], names);
    expect(g[0].jobs[0].name).toBe(NO_JOB);
    expect(g.find((x) => x.clientId === null)!.jobs[0].runs.map((r) => r.id)).toEqual(["b"]);
  });
  it("each run row carries job, room, brief type, run type, date and status", () => {
    const [r] = toRegisterRuns({ sessions: [{ id: "s1", brand_name: "JLR", status: "complete", created_at: "2026-10-01", brief_type: "deal", run_mode: "diagnostic", bg_client_id: "c1", engagement_id: "j1", has_stage_22: true }], workspaces: [], intelligence: [], synthesiser: [], stimulus: [] });
    expect(r).toMatchObject({ briefType: "Deal", runType: "Diagnostic", status: "Complete", date: "2026-10-01", engagementId: "j1", documentsHref: "/complete?session=s1" });
  });
  it("archiving hides only that run", () => {
    const rows = toRegisterRuns({ sessions: [{ id: "s1", archived_at: "2026-10-20" }, { id: "s2", archived_at: null }], workspaces: [], intelligence: [], synthesiser: [], stimulus: [] });
    expect(rows.map((r) => r.id)).toEqual(["s2"]);
  });
});

describe("No overwriting", () => {
  it("editing a pipeline brief with no history keeps the original as version 1", () => {
    expect(keepOriginalBriefVersion([], "Original brief", "2026-10-01")).toEqual([{ version: 1, brief_text: "Original brief", submitted_at: "2026-10-01", original: true }]);
    const prior = [{ version: 1 }, { version: 2 }];
    expect(keepOriginalBriefVersion(prior, "x", null)).toBe(prior);
  });
  it("editing Intelligence Lab inputs keeps every earlier version", () => {
    const v1 = appendInputVersion(undefined, { brand_name: "JLR", input_brand_health: "old", updated_at: "t1" });
    const v2 = appendInputVersion(v1, { brand_name: "JLR", input_brand_health: "newer", updated_at: "t2" });
    expect(v2.map((v) => [v.version, v.input_brand_health])).toEqual([[1, "old"], [2, "newer"]]);
  });
  it("starting work never updates an existing run: create handlers only insert", () => {
    for (const f of ["src/lib/stage1.functions.ts", "src/lib/briefing-room.functions.ts", "src/lib/synthesiser.functions.ts"]) {
      let src = ""; try { src = readFileSync(f, "utf8"); } catch { continue; }
      const create = src.match(/export const create\w+ = createServerFn[\s\S]*?\n {2}\}\);/)?.[0] ?? "";
      if (create) expect(create).not.toMatch(/\.update\(|\.upsert\(/);
    }
  });
});

describe("Run buttons and client removal", () => {
  it("run rows offer Open, Download this run's documents and Archive run — no delete", () => {
    const src = readFileSync("src/components/ClientRunRegister.tsx", "utf8");
    const row = src.match(/export function RunRowActions[\s\S]*?\n\}/)![0];
    for (const l of ["Open", "Download this run's documents", "Archive run"]) expect(row).toContain(l);
    expect(row).not.toMatch(/Delete (brand|run)|\.delete\(|deleteBrand/i);
    expect(src).toContain("View all runs (${scope})");
    expect(src).toContain("Download all documents ({scope})");
  });
  it("no 'Delete brand' anywhere on the dashboard", () => {
    expect(readFileSync("src/routes/dashboard.tsx", "utf8")).not.toMatch(/Delete brand|deleteBrandPermanently/);
  });

  const sb = { rpc: async (name: string, args: unknown) => {
    state.rpc.push({ name, args });
    if (name === "bg_is_admin") return { data: state.admin, error: null };
    return { data: "archived", error: null };
  } };
  const call = (fn: unknown, data: unknown) => (fn as (a: unknown) => Promise<unknown>)({ data, context: { supabase: sb, userId: "u" } });
  beforeEach(() => { state.admin = true; state.rpc = []; });

  it("client removal is admin-only", async () => {
    state.admin = false;
    await expect(call(removeClient, { clientId: "c", confirmName: "JLR", mode: "archive" })).rejects.toThrow("Unauthorized");
    expect(state.rpc.map((r) => r.name)).toEqual(["bg_is_admin"]);
  });
  it("client removal passes the typed name for the database to check", async () => {
    await call(removeClient, { clientId: "c", confirmName: "JLR", mode: "delete" });
    expect(state.rpc[1]).toEqual({ name: "bg_admin_remove_client", args: { _client: "c", _confirm_name: "JLR", _mode: "delete" } });
  });
  it("restoring a run is admin-only and restores exactly that run", async () => {
    state.admin = false;
    await expect(call(restoreRun, { table: "sessions", runId: "r1" })).rejects.toThrow("Unauthorized");
    state.admin = true; state.rpc = [];
    await call(restoreRun, { table: "sessions", runId: "r1" });
    expect(state.rpc[1]).toEqual({ name: "bg_set_run_archived", args: { _table: "sessions", _run_id: "r1", _archived: false } });
  });
  it("the confirmation names the client and shows its jobs and runs", () => {
    const src = readFileSync("src/components/admin/ClientRemoval.tsx", "utf8");
    expect(src).toContain("client “{clientName}”");
    expect(src).toMatch(/info\?\.jobs[\s\S]*info\?\.runs/);
    expect(src).toContain("typed !== clientName");
  });
});
