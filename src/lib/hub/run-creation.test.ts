import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ known: true, inserted: [] as { table: string; row: Record<string, unknown> }[], rpc: [] as string[] }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  const chain = { middleware: () => chain, inputValidator: () => chain, handler: (fn: unknown) => fn }; return chain;
} }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/claude.server", () => ({ streamClaude: vi.fn(), callClaude: vi.fn() }));
vi.mock("@/lib/auth-helpers.server", () => ({ assertSessionAccess: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {
  from: (table: string) => ({ insert: (row: Record<string, unknown>) => {
    state.inserted.push({ table, row });
    return { select: () => ({ single: async () => ({ data: { id: "run-id" }, error: null }) }) };
  } }),
} }));
import { createSession } from "../stage1.functions";
import { createIntelligenceSession } from "../intelligence.functions";
import { createBriefingWorkspace } from "../briefing-room.functions";

const hub = { client: "hub-jlr", job: null, ctx: "opaque" };
const sb = {
  rpc: async (name: string) => { state.rpc.push(name); return { data: state.known ? [{ client_id: "jlr", client_name: "JLR" }] : [], error: null }; },
  from: (table: string) => ({ insert: (row: Record<string, unknown>) => {
    state.inserted.push({ table, row });
    return { select: () => ({ single: async () => ({ data: { id: "run-id" }, error: null }) }) };
  } }),
};
const invoke = (fn: unknown, data: Record<string, unknown>) => (fn as (arg: unknown) => Promise<unknown>)({ data, context: { supabase: sb, userId: "signed-in-user" } });
beforeEach(() => { state.known = true; state.inserted = []; state.rpc = []; });
describe("actual Room creation handlers", () => {
  const cases = [
    ["Strategy", createSession, { brandName: "Not a client match", category: "Automotive", briefText: "A real brief with enough text", runMode: "full", briefType: "campaign" }, "sessions"],
    ["Intelligence", createIntelligenceSession, { brand_name: "Not a client match", category: "Automotive", brief_type: "commercial" }, "intelligence_sessions"],
    ["Briefing", createBriefingWorkspace, { brandName: "Not a client match", category: "Automotive" }, "briefing_room_workspaces"],
  ] as const;
  it.each(cases)("%s inserts known Hub client tags atomically, no job or direct link IDs", async (_name, fn, data, table) => {
    await invoke(fn, { ...data, hub });
    expect(state.inserted).toHaveLength(1);
    expect(state.inserted[0]).toMatchObject({ table, row: { hub_client: "hub-jlr", hub_job: null, hub_ctx: "opaque", user_id: "signed-in-user" } });
    expect(state.inserted[0].row).not.toHaveProperty("bg_client_id");
    expect(state.inserted[0].row).not.toHaveProperty("engagement_id");
    expect(state.rpc).toEqual(["bg_lookup_hub_client"]);
  });
  it.each(cases)("%s rejects unknown clients before inserting", async (_name, fn, data) => {
    state.known = false;
    await expect(invoke(fn, { ...data, hub })).rejects.toThrow("This client is still syncing from the Hub — try again");
    expect(state.inserted).toHaveLength(0);
    expect(state.rpc).toEqual(["bg_lookup_hub_client"]);
  });
  it.each(cases)("%s starts without Hub context retain prior behavior", async (_name, fn, data) => {
    await invoke(fn, data);
    expect(state.inserted).toHaveLength(1);
    expect(state.inserted[0].row).not.toHaveProperty("hub_client");
    expect(state.rpc).toEqual([]);
  });
});