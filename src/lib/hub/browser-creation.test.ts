import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ hub: null as null | { client: string; job: null; ctx: null }, known: true, rows: [] as { table: string; row: Record<string, unknown> }[], calls: [] as string[] }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: { getUser: async () => ({ data: { user: { id: "signed-in-user" } } }) },
  rpc: async (name: string) => { state.calls.push(name); return { data: state.known ? [{ client_id: "jlr", client_name: "JLR" }] : [], error: null }; },
  from: (table: string) => ({ insert: (row: Record<string, unknown>) => {
    state.rows.push({ table, row }); return { select: () => ({ single: async () => ({ data: { id: "run-id", brief_id: "brief-id" }, error: null }) }) };
  } }),
} }));
vi.mock("./context", () => ({ readHubContext: () => state.hub, hubColumns: () => state.hub ? { hub_client: state.hub.client, hub_job: null, hub_ctx: null } : {}, HUB_SYNC_MESSAGE: "This client is still syncing from the Hub — try again in a moment" }));
vi.mock("@/components/ProjectClient", () => ({ ProjectClient: () => null }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
import { saveBrief } from "@/components/SavedBriefsLibrary";
import { recordSynthesiserRun } from "../synthesiser/runs";

beforeEach(() => { state.hub = { client: "hub-jlr", job: null, ctx: null }; state.known = true; state.rows = []; state.calls = []; });
describe("browser-created Rooms", () => {
  const cases = [
    ["Saved brief", () => saveBrief({ brandName: "Unrelated name", category: "Automotive", briefText: "Real brief" }), "saved_briefs"],
    ["Synthesiser", () => recordSynthesiserRun({ brandName: "Unrelated name", category: "Automotive", status: "in_progress", claimCount: 3 }), "synthesiser_runs"],
  ] as const;
  it.each(cases)("%s inserts client-only Hub context, no direct client IDs", async (_name, create, table) => {
    await create(); expect(state.rows).toHaveLength(1);
    expect(state.rows[0]).toMatchObject({ table, row: { hub_client: "hub-jlr", hub_job: null, user_id: "signed-in-user" } });
    expect(state.rows[0].row).not.toHaveProperty("bg_client_id");
    expect(state.calls).toEqual(["bg_lookup_hub_client"]);
  });
  it.each(cases)("%s does not create an unknown-client run", async (_name, create) => {
    state.known = false; expect(await create()).toBeNull(); expect(state.rows).toEqual([]);
    expect(state.calls).toEqual(["bg_lookup_hub_client"]);
  });
  it.each(cases)("%s starts without Hub context remain unchanged", async (_name, create) => {
    state.hub = null; await create(); expect(state.rows).toHaveLength(1);
    expect(state.rows[0].row).not.toHaveProperty("hub_client"); expect(state.calls).toEqual([]);
  });
});