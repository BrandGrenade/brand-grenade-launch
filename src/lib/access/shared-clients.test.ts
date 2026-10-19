import { describe, expect, it, vi } from "vitest";
import { handleAccess, type Db, type LogEntry, type Scope, type SharedClient } from "./core";
import { supabaseDb } from "./access.server";

const call = (db: Db, request: string, params = {}, scope: Scope = "hub_tools") => {
  const log: LogEntry = { scope, key_id: "existing-key", client_ref: null, run_id: null, request: null, output_id: null };
  return handleAccess(db, { id: "existing-key", scope }, { request, params }, log);
};
const fixture = () => {
  const clients: SharedClient[] = [{ bg_client_id: "bg-created", hub_client_id: null, name: "JLR", created_at: "2026-10-19" }];
  const runRead = vi.fn(() => { throw new Error("Client requests must not touch runs"); });
  const db: Db = {
    listClients: vi.fn(async () => clients),
    ensureClient: vi.fn(async (hub_client_id, name) => {
      const existing = clients.find((c) => c.hub_client_id === hub_client_id);
      if (existing) return existing;
      const c = { bg_client_id: `bg-${clients.length}`, hub_client_id, name, created_at: "2026-10-19" };
      clients.push(c); return c;
    }),
    attachClient: vi.fn(async (bg_client_id, hub_client_id) => {
      const c = clients.find((x) => x.bg_client_id === bg_client_id);
      if (!c) throw new AccessError("not_found", "Not found.");
      const byHub = clients.find((x) => x.hub_client_id === hub_client_id);
      if (byHub && byHub.bg_client_id !== bg_client_id) throw new AccessError("invalid_request", "Already attached to a different client.");
      if (c.hub_client_id && c.hub_client_id !== hub_client_id) throw new AccessError("invalid_request", "Already attached to a different client.");
      c.hub_client_id = hub_client_id;
      return c;
    }),
    resolveClient: runRead, resolveEngagement: runRead, listLinkedRuns: runRead, findRun: runRead,
    versions: runRead, claims: runRead, stimulus: runRead, actorName: runRead,
  };
  return { db, clients, runRead };
};
describe("shared clients access requests", () => {
  it("ensure_client creates once and never renames or merges by name", async () => {
    const { db, clients, runRead } = fixture();
    const a = await call(db, "ensure_client", { hub_client_id: "hub-jlr", name: "JLR" });
    const b = await call(db, "ensure_client", { hub_client_id: "hub-jlr", name: "Different name" });
    expect(a.content).toEqual(b.content);
    expect(clients).toHaveLength(2);
    expect(clients[1]).toMatchObject({ name: "JLR", hub_client_id: "hub-jlr" });
    expect(runRead).not.toHaveBeenCalled();
  });
  it("list_clients includes BG-created unmapped clients and cannot read runs", async () => {
    const { db, runRead } = fixture();
    const r = await call(db, "list_clients");
    expect(r.content).toEqual({ clients: [{ bg_client_id: "bg-created", hub_client_id: null, name: "JLR", created_at: "2026-10-19" }] });
    expect(r.content_status).toBe("structured");
    expect(r.run_id).toBeNull();
    expect(runRead).not.toHaveBeenCalled();
  });
  it.each(["second_brain", "admin"] as const)("%s cannot list or create clients", async (scope) => {
    const { db } = fixture();
    await expect(call(db, "list_clients", {}, scope)).rejects.toMatchObject({ code: "forbidden_scope" });
    await expect(call(db, "ensure_client", { hub_client_id: "h", name: "JLR" }, scope)).rejects.toMatchObject({ code: "forbidden_scope" });
    expect(db.listClients).not.toHaveBeenCalled(); expect(db.ensureClient).not.toHaveBeenCalled();
  });
  it("rejects run fields, blank IDs and extra instructions", async () => {
    const { db } = fixture();
    for (const params of [{ hub_client_id: "", name: "JLR" }, { hub_client_id: "h", name: "JLR", run_id: "forged" }])
      await expect(call(db, "ensure_client", params)).rejects.toMatchObject({ code: "invalid_request" });
    await expect(call(db, "list_clients", { client_ref: "h" })).rejects.toMatchObject({ code: "invalid_request" });
    expect(db.ensureClient).not.toHaveBeenCalled();
  });
  it("server adapter uses client-only RPCs, not run queries", async () => {
    const rpc = vi.fn(async (name: string) => ({ data: name === "bg_shared_clients" ? [] : [{ bg_client_id: "one", hub_client_id: "h", name: "JLR", created_at: "2026-10-19" }], error: null }));
    const from = vi.fn(() => { throw new Error("Unexpected table access"); });
    const db = supabaseDb({ rpc, from });
    await db.listClients(); await db.ensureClient("h", "JLR");
    expect(rpc.mock.calls).toEqual([["bg_shared_clients"], ["bg_ensure_client", { _hub_client_id: "h", _name: "JLR" }]]);
    expect(from).not.toHaveBeenCalled();
  });
});