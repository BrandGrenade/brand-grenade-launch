// Automated access-point integration against a disposable localhost database only.
// Run: bun scripts/test-shared-client-access.ts postgresql://user@localhost:port/database
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { handleAccessRequest } from "../src/lib/access/access.server";

const url = process.argv[2];
if (!url || !["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw new Error("An isolated localhost database is required");
const sql = postgres(url, { max: 12 });
const key = randomUUID();
const hubId = `automated-${randomUUID()}`;
const logs: unknown[] = [];
const sb = {
  rpc: async (name: string, args?: Record<string, string>) => {
    if (name === "bg_ensure_client" && args) return { data: await sql`SELECT * FROM public.bg_ensure_client(${args._hub_client_id},${args._name})`, error: null };
    if (name === "bg_shared_clients") return { data: await sql`SELECT * FROM public.bg_shared_clients()`, error: null };
    throw new Error("Client requests must not call run RPCs");
  },
  from: (table: string) => {
    if (table === "bg_access_log") return { insert: async (row: unknown) => { logs.push(row); return { error: null }; } };
    if (table === "bg_access_keys") return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "automated-key", scope: "hub_tools", revoked_at: null }, error: null }) }) }) };
    throw new Error("Client requests must not access run tables");
  },
};
const request = async (name: string, params: Record<string, string>) => {
  const response = await handleAccessRequest(new Request("http://localhost/api/public/bg-access", {
    method: "POST", headers: { "content-type": "application/json", "x-bg-access-key": key }, body: JSON.stringify({ request: name, params }),
  }), sb);
  if (response.status !== 200) throw new Error(`Access request failed: ${response.status}`);
  return response.json();
};
try {
  const responses = await Promise.all(Array.from({ length: 10 }, () => request("ensure_client", { hub_client_id: hubId, name: "Marlowe Motor Company" })));
  const ids = new Set(responses.map((r) => r.content.client.bg_client_id));
  if (ids.size !== 1 || responses.some((r) => r.content_status !== "structured")) throw new Error("Concurrent ensure was not idempotent");
  const original = responses[0].content.client;
  const repeated = await request("ensure_client", { hub_client_id: hubId, name: "Must never rename" });
  if (repeated.content.client.name !== "Marlowe Motor Company") throw new Error("Ensure renamed a client");
  const list = await request("list_clients", {});
  if (!list.content.clients.some((c: Record<string, unknown>) => c.bg_client_id === original.bg_client_id && c.hub_client_id === hubId)) throw new Error("List missed ensured client");
  const count = await sql`SELECT count(*)::int AS n FROM public.bg_external_ids WHERE external_id=${hubId}`;
  if (count[0].n !== 1 || logs.length !== 12) throw new Error("Mapping or access log count is wrong");
  console.log("PASS: access-point request → SQL ensure/list → structured response; 10 concurrent ensures create one client; no rename; all 12 requests logged; no run access.");
} finally { await sql.end(); }