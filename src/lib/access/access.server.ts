// Run reads are unchanged. Client synchronization uses two narrowly scoped
// database functions; ensure_client cannot read or change runs.
import { AccessError, HTTP_STATUS, handleAccess, type Db, type Key, type LogEntry, type RunRec, type RunTable, type Scope, type VersionRow } from "./core";

const TABLES: { table: RunTable; idCol: string }[] = [
  { table: "synthesiser_runs", idCol: "id" },
  { table: "intelligence_sessions", idCol: "id" },
  { table: "briefing_room_workspaces", idCol: "id" },
  { table: "saved_briefs", idCol: "brief_id" },
  { table: "sessions", idCol: "id" },
  { table: "stimulus_runs", idCol: "id" },
];
// Retired Intelligence Lab layer fields are never selected.
const INTEL_COLS =
  "id, brand_name, status, final_report, created_at, updated_at, completed_at, hub_job, bg_client_id, engagement_id, link_status";
const BASE_LIST = "brand_name, status, created_at, bg_client_id, engagement_id, link_status";
export const LIST_COLS: Record<RunTable, string> = {
  synthesiser_runs: `id, ${BASE_LIST}`,
  intelligence_sessions: `id, ${BASE_LIST}`,
  briefing_room_workspaces: `id, ${BASE_LIST}, locked_at, earlier_versions_kept`,
  saved_briefs: "brief_id, brand_name, created_at, bg_client_id, engagement_id, link_status",
  sessions: `id, ${BASE_LIST}, locked_at, earlier_versions_kept, run_mode, diagnostic_status, brief_type, current_proposition, current_proposition_source, current_proposition_date, deal_transaction_type, deal_target_brands, deal_decision_questions, deal_competitors, deal_decision_date, deal_depth`,
  stimulus_runs: "id, status, created_at, run_mode, locked_at, bg_client_id, engagement_id, link_status",
};

/** One retry on a failed/transient read, then a named error the Hub can show. */
async function retryRead<T extends { error: unknown; data?: any }>(fn: () => PromiseLike<T>, name: string): Promise<T> {
  let last: T | null = null;
  for (let i = 0; i < 2; i++) {
    last = await fn();
    if (!last.error) return last;
    if (i === 0) await new Promise((r) => setTimeout(r, 250));
  }
  console.error("bg-access", name, (last?.error as { message?: string })?.message ?? "error");
  throw new AccessError("unavailable", `Temporarily unavailable (${name}). Retry shortly.`);
}

export async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export function supabaseDb(sb: any): Db {
  const cols = (t: RunTable) => (t === "intelligence_sessions" ? INTEL_COLS : "*");
  const rec = (t: { table: RunTable; idCol: string }, row: Record<string, unknown>): RunRec => ({ table: t.table, id: String(row[t.idCol]), row });
  return {
    async listClients() {
      const { data, error } = await sb.rpc("bg_shared_clients");
      if (error) throw new AccessError("unavailable", "Temporarily unavailable.");
      return data ?? [];
    },
    async ensureClient(hubClientId, name) {
      const { data, error } = await sb.rpc("bg_ensure_client", { _hub_client_id: hubClientId, _name: name });
      if (error || !data?.[0]) throw new AccessError("unavailable", "Temporarily unavailable.");
      return data[0];
    },
    async attachClient(bgClientId, hubClientId) {
      const { data, error } = await sb.rpc("bg_attach_client", { _bg_client_id: bgClientId, _hub_client_id: hubClientId });
      if (error) {
        const msg = String(error.message ?? "");
        if (msg.includes("not_found")) throw new AccessError("not_found", "Not found.");
        if (msg.includes("hub_id_attached") || msg.includes("bg_client_attached")) throw new AccessError("invalid_request", "Already attached to a different client.");
        throw new AccessError("unavailable", "Temporarily unavailable.");
      }
      if (!data?.[0]) throw new AccessError("unavailable", "Temporarily unavailable.");
      return data[0];
    },
    async resolveClient(ref) {
      const { data } = await sb.from("bg_external_ids").select("bg_client_id").eq("system", "hub_client").eq("external_id", ref).maybeSingle();
      return data?.bg_client_id ?? null;
    },
    async resolveEngagement(clientId, ref) {
      const { data } = await sb.from("bg_external_ids").select("engagement_id").eq("system", "hub_job").eq("bg_client_id", clientId).eq("external_id", ref).maybeSingle();
      return data?.engagement_id ?? null;
    },
    // list_runs reads summary columns only, all Rooms in parallel; full rows
    // (megabytes of stage outputs) are read only for a single-run request.
    async listLinkedRuns(clientId, eng) {
      const per = await Promise.all(
        TABLES.map(async (t) => {
          const { data } = await retryRead(() => {
            let q = sb.from(t.table).select(LIST_COLS[t.table]).eq("bg_client_id", clientId).eq("link_status", "linked");
            if (eng) q = q.eq("engagement_id", eng);
            return q.order("created_at", { ascending: false }).limit(500);
          }, "list_runs_read_failed");
          return (data ?? []).map((r: Record<string, unknown>) => rec(t, r));
        }),
      );
      return per.flat();
    },
    async versionMeta(table, id) {
      const { data } = await retryRead(
        () => sb.from("run_output_versions").select("field, version_no, reason, created_at").eq("run_table", table).eq("run_id", id).limit(100000),
        "version_history_read_failed",
      );
      return ((data ?? []) as Omit<VersionRow, "content">[]).map((r) => ({ ...r, content: null }));
    },
    async versionCounts(table, ids) {
      const counts = new Map<string, number>();
      if (!ids.length) return counts;
      const { data } = await retryRead(
        () => sb.from("run_output_versions").select("run_id, created_at").eq("run_table", table).in("run_id", ids).limit(100000),
        "list_runs_versions_failed",
      );
      const sets = new Map<string, Set<string>>();
      for (const r of data ?? []) {
        const s = sets.get(String(r.run_id)) ?? new Set<string>();
        s.add(String(r.created_at));
        sets.set(String(r.run_id), s);
      }
      for (const id of ids) counts.set(id, (sets.get(id)?.size ?? 0) + 1);
      return counts;
    },
    // Locate the run's Room with id-only lookups in parallel, then read one full row.
    async findRun(id) {
      if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
      const hits = await Promise.all(
        TABLES.map(async (t) => {
          const { data } = await retryRead(() => sb.from(t.table).select(t.idCol).eq(t.idCol, id).maybeSingle(), "run_lookup_failed");
          return data ? t : null;
        }),
      );
      const t = hits.find(Boolean);
      if (!t) return null;
      const { data } = await retryRead(() => sb.from(t.table).select(cols(t.table)).eq(t.idCol, id).maybeSingle(), "run_read_failed");
      return data ? rec(t, data) : null;
    },
    async versions(table, id) {
      const { data, error } = await sb.from("run_output_versions").select("field, version_no, content, reason, created_at").eq("run_table", table).eq("run_id", id);
      if (error) throw new AccessError("unavailable", "Temporarily unavailable.");
      return (data ?? []) as VersionRow[];
    },
    async claims(id) {
      const { data } = await sb.from("synthesiser_claims").select("heading, claim_text, label, source, source_date, position").eq("synthesiser_run_id", id).order("position");
      return data ?? [];
    },
    async stimulus(runId) {
      const [d, p] = await Promise.all([
        sb.from("stimulus_directions").select("lens_id, lens_name, sort_order, direction, campaign_line, rationale, status, ratings, gate_one_approved, gate_one_approved_at").eq("run_id", runId),
        // Only the final prompt column is selected; earlier prompt drafts are never read.
        sb.from("stimulus_prompts").select("orchestration_id, channel_name, lens_name, tool_target, sort_order, final_prompt, status").eq("run_id", runId),
      ]);
      const orchIds = [...new Set((p.data ?? []).map((x: any) => x.orchestration_id).filter(Boolean))];
      const o = orchIds.length
        ? await sb.from("stimulus_orchestrations").select("id, gate_two_confirmed, gate_two_confirmed_at, gate_two_confirmed_by").in("id", orchIds)
        : { data: [] };
      return { directions: d.data ?? [], prompts: p.data ?? [], orchestrations: o.data ?? [] };
    },
    async actorName(uid) {
      const { data } = await sb.rpc("hub_actor", { _uid: uid });
      return typeof data === "string" && data ? data : null;
    },
    async baselineJobs(id) {
      const {data,error}=await sb.from('current_position_addon_jobs').select('id,status,published_version,results,source_manifest,error_code,error_message').eq('session_id',id).eq('status','complete');
      if(error)throw new AccessError('unavailable','Baseline evidence temporarily unavailable.');
      return data ?? [];
    },
  };
}

export const ACCESS_DEADLINE_MS = 20_000;

function errorBody(requestId: string, code: AccessError["code"], message: string) {
  return { request_id: requestId, error_code: code, message };
}

export async function handleAccessRequest(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  const log: LogEntry = { scope: null, key_id: null, client_ref: null, run_id: null, request: null, output_id: null };
  const sb = await admin();
  let res: Response;
  let code: AccessError["code"] | null = null;
  try {
    const raw = request.headers.get("x-bg-access-key") ?? "";
    if (!raw || raw.length > 200) throw new AccessError("unauthorised", "Missing or invalid key.");
    const { data: k } = await sb.from("bg_access_keys").select("id, scope, revoked_at").eq("key_hash", await sha256Hex(raw)).maybeSingle();
    if (!k || k.revoked_at) throw new AccessError("unauthorised", "Missing or invalid key.");
    const key: Key = { id: k.id, scope: k.scope as Scope };
    log.scope = key.scope;
    log.key_id = key.id;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AccessError("invalid_request", "Body must be JSON.");
    }
    // Hard deadline: answer with a named error well before the Hub's timeout,
    // instead of hanging with no answer.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, rej) => {
      timer = setTimeout(() => rej(new AccessError("unavailable", "access_timeout: the request took too long. Retry shortly.")), ACCESS_DEADLINE_MS);
    });
    const out = await Promise.race([handleAccess(supabaseDb(sb), key, body, log), deadline]).finally(() => clearTimeout(timer));
    res = Response.json({ request_id: requestId, ...out }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    const err = e instanceof AccessError ? e : new AccessError("unavailable", "Temporarily unavailable.");
    if (!(e instanceof AccessError)) console.error("bg-access", e instanceof Error ? e.message : "error");
    code = err.code;
    res = Response.json(errorBody(requestId, err.code, err.message), { status: HTTP_STATUS[err.code], headers: { "cache-control": "no-store" } });
  }
  await sb.from("bg_access_log").insert({
    request_id: requestId,
    scope: log.scope,
    key_id: log.key_id,
    client_ref: log.client_ref,
    run_id: log.run_id && /^[0-9a-f-]{36}$/.test(log.run_id) ? log.run_id : null,
    request: log.request,
    output_id: log.output_id?.slice(0, 100) ?? null,
    outcome: code ? "error" : "success",
    error_code: code,
  });
  return res;
}
