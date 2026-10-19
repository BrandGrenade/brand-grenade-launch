import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ admin: true, reads: [] as string[] }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  const chain = { middleware: () => chain, inputValidator: () => chain, handler: (fn: unknown) => fn }; return chain;
} }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {
  from: (table: string) => { state.reads.push(table); return { select: () => ({ eq: (column: string, id: string) => {
    state.reads.push(`${column}:${id}`); return { maybeSingle: async () => ({ data: { bg_client_id: null }, error: null }) };
  } }) }; },
} }));
import { getProjectClient } from "../bg-clients.functions";
const invoke = (table: string) => (getProjectClient as unknown as (args: unknown) => Promise<unknown>)({
  data: { table, runId: "exact-project-id" },
  context: { userId: "user", supabase: { rpc: async () => ({ data: state.admin, error: null }) } },
});
beforeEach(() => { state.admin = true; state.reads = []; });
describe("project client admin access", () => {
  it("rejects partners before any privileged project read", async () => {
    state.admin = false; await expect(invoke("sessions")).rejects.toThrow("Unauthorized");
    expect(state.reads).toEqual([]);
  });
  it.each(["sessions", "saved_briefs"])("admin reads only the exact %s project client", async (table) => {
    expect(await invoke(table)).toEqual({ clientId: null });
    expect(state.reads).toEqual([table, `${table === "saved_briefs" ? "brief_id" : "id"}:exact-project-id`]);
  });
});