import { checkCurrentPosition } from "@/lib/structured-output";
import { parseStage22Architecture, parseStage22Assets } from "./stage22-parse";
// BG access point — pure request logic. Read-only: the Db interface exposes
// reads only, so nothing in here can write to BG data. The server adapter
// (access.server.ts) supplies the reads and writes the request log.
import { z } from "zod";

export type Scope = "hub_tools" | "second_brain" | "admin";
export type ErrorCode = "invalid_request" | "unauthorised" | "forbidden_scope" | "not_found" | "unavailable";
export type ContentStatus = "structured" | "text_only" | "partial" | "unavailable" | "not_produced";
import { dealSummary } from "../deal-brief";
/** T1: brief type + deal fields (Strategy Engine runs only; other Rooms have no brief type). */
const briefInfo = (r: RunRec) => (r.table === "sessions" ? dealSummary(r.row) : { brief_type: null, deal: null });

export const REQUESTS = ["list_runs", "run_manifest", "get_output", "list_documents", "document_metadata", "provenance"] as const;
export type RequestName = (typeof REQUESTS)[number];

export const ACCESS_ROUTE = "/api/public/bg-access";
export const KEY_HEADER = "x-bg-access-key";
export const SCHEMA = "bg-access.v1";

export type RunTable =
  | "synthesiser_runs"
  | "intelligence_sessions"
  | "briefing_room_workspaces"
  | "saved_briefs"
  | "sessions"
  | "stimulus_runs";

export const ROOM_OF: Record<RunTable, string> = {
  synthesiser_runs: "room00",
  intelligence_sessions: "room01",
  briefing_room_workspaces: "room02",
  saved_briefs: "room02",
  sessions: "room03",
  stimulus_runs: "room04",
};
const VERSIONED: RunTable[] = ["sessions", "briefing_room_workspaces"];

export type Row = Record<string, unknown>;
export type RunRec = { table: RunTable; id: string; row: Row };
export type VersionRow = { field: string; version_no: number; content: unknown; reason: string; created_at: string };

export interface Db {
  resolveClient(clientRef: string): Promise<string | null>;
  resolveEngagement(bgClientId: string, ref: string): Promise<string | null>;
  listLinkedRuns(bgClientId: string, engagementId: string | null): Promise<RunRec[]>;
  findRun(runId: string): Promise<RunRec | null>;
  versions(table: RunTable, runId: string): Promise<VersionRow[]>;
  claims(synthRunId: string): Promise<Row[]>;
  stimulus(runId: string): Promise<{ directions: Row[]; prompts: Row[]; orchestrations: Row[] }>;
  actorName(uid: string): Promise<string | null>;
}

export type Key = { id: string; scope: Scope };

// ── Allowed outputs ────────────────────────────────────────────────────────
export const STAGE16_FORMATS = ["agency", "consulting", "workshop", "vision", "valuation"] as const;
export const OUTPUTS_BY_TABLE: Record<RunTable, string[]> = {
  synthesiser_runs: ["room00.claims"],
  intelligence_sessions: ["room01.report", "room01.territories", "room01.white_space", "room01.layer04"],
  briefing_room_workspaces: ["room02.steps"],
  saved_briefs: ["room02.saved_brief"],
  sessions: [
    "stage02", "stage04b", "stage09", "stage09_loc", "stage10", "stage10_current_position", "stage11",
    "stage12_propositions", "stage13", ...STAGE16_FORMATS.map((f) => `stage16.${f}`),
    "stage21_channels", "stage22_architecture", "stage22_assets",
  ],
  stimulus_runs: ["room04.lenses", "room04.gates", "room04.final_prompts"],
};
const ALL_OUTPUTS = new Set(Object.values(OUTPUTS_BY_TABLE).flat());
/** Creative and activation outputs — never part of a diagnostic run. */
const NOT_IN_DIAGNOSTIC = (id: string) => id.startsWith("stage16.") || id.startsWith("stage21") || id.startsWith("stage22");

const SECOND_BRAIN = (id: string) =>
  id === "room02.saved_brief" || id.startsWith("stage16.") || id === "room04.final_prompts" || id === "stage22_architecture";

export function scopeAllowsRequest(scope: Scope, req: RequestName): boolean {
  if (scope === "admin") return req === "list_runs" || req === "run_manifest";
  return true;
}
export function scopeAllowsOutput(scope: Scope, outputId: string): boolean {
  if (scope === "hub_tools") return true;
  if (scope === "second_brain") return SECOND_BRAIN(outputId);
  return false;
}

// ── Labels ─────────────────────────────────────────────────────────────────
const LABELS: Record<string, string> = {
  verified: "Verified",
  client_supplied: "Client-supplied",
  unverified: "Unverified",
  contradicted: "Contradicted",
  not_checked: "Not checked",
};
/** Never upgrades: unknown or missing BG labels become "Missing". */
export function mapLabel(bgLabel: unknown): { bg_label: string | null; label: string } {
  if (typeof bgLabel !== "string" || !bgLabel) return { bg_label: null, label: "Missing" };
  return { bg_label: bgLabel, label: LABELS[bgLabel] ?? "Missing" };
}
const DISPLAY_TO_BG: Record<string, string> = Object.fromEntries(Object.entries(LABELS).map(([k, v]) => [v, k]));

// ── Errors ─────────────────────────────────────────────────────────────────
export class AccessError extends Error {
  constructor(public code: ErrorCode, message: string) {
    super(message);
  }
}
const NOT_FOUND = () => new AccessError("not_found", "Not found.");
export const HTTP_STATUS: Record<ErrorCode, number> = {
  invalid_request: 400,
  unauthorised: 401,
  forbidden_scope: 403,
  not_found: 404,
  unavailable: 503,
};

// ── Params ─────────────────────────────────────────────────────────────────
const ref = z.string().trim().min(1).max(200);
const uuid = z.string().uuid();
const ver = z.number().int().min(1).max(100000);
const out = z.string().min(1).max(100);
const PARAMS = {
  list_runs: z.object({ client_ref: ref, engagement: ref.optional() }).strict(),
  run_manifest: z.object({ client_ref: ref, run_id: uuid, version: ver.optional() }).strict(),
  get_output: z.object({ client_ref: ref, run_id: uuid, version: ver, output_id: out }).strict(),
  list_documents: z.object({ client_ref: ref, run_id: uuid, version: ver }).strict(),
  document_metadata: z.object({ client_ref: ref, document_id: z.string().min(1).max(200) }).strict(),
  provenance: z.object({ client_ref: ref, run_id: uuid, version: ver, output_id: out }).strict(),
} as const;

export const BodySchema = z.object({ request: z.string(), params: z.record(z.string(), z.unknown()).default({}) }).strict();

// ── Versions ───────────────────────────────────────────────────────────────
type VersionCtx = { current: number; batches: string[]; rows: VersionRow[] };
function versionCtx(rows: VersionRow[]): VersionCtx {
  const batches = [...new Set(rows.map((r) => r.created_at))].sort();
  return { current: batches.length + 1, batches, rows };
}
/** Field value at version v: the snapshot taken by the first change at or after v, else the current value. */
function fieldAt(run: RunRec, vc: VersionCtx, v: number, field: string): unknown {
  if (v >= vc.current) return run.row[field] ?? null;
  const snap = vc.rows
    .filter((r) => r.field === field && vc.batches.indexOf(r.created_at) + 1 >= v)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
  return snap ? snap.content : (run.row[field] ?? null);
}

// ── Run context ────────────────────────────────────────────────────────────
type Ctx = {
  run: RunRec;
  vc: VersionCtx;
  v: number;
  get: (field: string) => unknown;
  db: Db;
};
const isDiagnostic = (run: RunRec) => run.table === "sessions" && run.row.run_mode === "diagnostic";
const runStatus = (run: RunRec) => (isDiagnostic(run) ? (run.row.diagnostic_status as string | null) : (run.row.status as string | null) ?? null);
const text = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);
const present = (v: unknown) => v !== null && v !== undefined && !(typeof v === "string" && v.trim() === "");

type Built = { content_status: ContentStatus; schema_version: string; content: unknown; evidence: Evidence[]; fields: string[] };
type Evidence = { claim: string; bg_label: string | null; label: string };

function textOutput(field: string, schema: string, c: Ctx): Built {
  const t = text(c.get(field));
  return t
    ? { content_status: "text_only", schema_version: schema, content: { text: t }, evidence: [], fields: [field] }
    : { content_status: "not_produced", schema_version: schema, content: null, evidence: [], fields: [field] };
}
function stage22Output(field: string, id: string, parse: (t: string) => unknown, c: Ctx): Built {
  const t = text(c.get(field));
  if (!t) return { content_status: "not_produced", schema_version: `${id}.v1`, content: null, evidence: [], fields: [field] };
  const rec = parse(t);
  return rec
    ? { content_status: "structured", schema_version: `${id}.v1`, content: { record: rec, text: t }, evidence: [], fields: [field] }
    : { content_status: "text_only", schema_version: `${id}.text.v1`, content: { text: t, reason: "Stored text does not follow the Stage 22 format" }, evidence: [], fields: [field] };
}
function jsonOutput(field: string, schema: string, c: Ctx): Built {
  const v = c.get(field);
  return present(v)
    ? { content_status: "structured", schema_version: schema, content: v, evidence: [], fields: [field] }
    : { content_status: "not_produced", schema_version: schema, content: null, evidence: [], fields: [field] };
}
function parseReport(c: Ctx): Record<string, unknown> | null | "bad" {
  const raw = c.get("final_report");
  if (!present(raw)) return null;
  if (typeof raw === "object") return raw as Record<string, unknown>;
  try {
    const p = JSON.parse(String(raw));
    return p && typeof p === "object" ? p : "bad";
  } catch {
    return "bad";
  }
}

async function buildOutput(outputId: string, c: Ctx): Promise<Built> {
  const { run } = c;
  if (!OUTPUTS_BY_TABLE[run.table].includes(outputId)) throw NOT_FOUND();
  if (isDiagnostic(run) && NOT_IN_DIAGNOSTIC(outputId)) {
    return { content_status: "not_produced", schema_version: `${outputId}.v1`, content: { note: "not included in a diagnostic run" }, evidence: [], fields: [] };
  }
  const m = /^stage(09|10|11|13)$/.exec(outputId);
  if (m) {
    const n = String(Number(m[1]));
    const tf = `stage_${n}_output`, sf = `stage_${n}_structured`;
    const t = text(c.get(tf));
    const s = c.get(sf);
    if (t && present(s)) return { content_status: "structured", schema_version: `stage${m[1]}.structured.v1`, content: { record: s, text: t }, evidence: [], fields: [tf, sf] };
    if (t) return { content_status: "text_only", schema_version: `stage${m[1]}.text.v1`, content: { text: t }, evidence: [], fields: [tf] };
    return { content_status: "not_produced", schema_version: `stage${m[1]}.text.v1`, content: null, evidence: [], fields: [tf] };
  }
  if (outputId.startsWith("stage16.")) {
    const f = outputId.slice(8);
    return textOutput(`stage_16_${f}_output`, "stage16.document.v1", c);
  }
  switch (outputId) {
    case "stage02": return textOutput("stage_2_output", "stage02.text.v1", c);
    case "stage04b": return textOutput("stage_4b_output", "stage04b.text.v1", c);
    case "stage22_architecture": return stage22Output("stage_22_brand_architecture", "stage22_architecture", parseStage22Architecture, c);
    case "stage22_assets": return stage22Output("stage_22_distinctive_assets", "stage22_assets", parseStage22Assets, c);
    case "stage12_propositions": return jsonOutput("stage_12_smps", "stage12_propositions.v1", c);
    case "stage21_channels": return jsonOutput("stage_21_outputs", "stage21_channels.v1", c);
    case "stage09_loc": {
      const fields = ["loc_engine_outputs", "loc_validation", "loc_decision_packages"];
      const eng = c.get("loc_engine_outputs");
      if (!present(eng)) return { content_status: "not_produced", schema_version: "stage09_loc.v1", content: null, evidence: [], fields };
      return {
        content_status: "structured",
        schema_version: "stage09_loc.v1",
        content: {
          task_type: run.row.loc_task_type ?? null,
          engine_outputs: eng,
          validation: c.get("loc_validation"),
          decision_packages: c.get("loc_decision_packages"),
          selected_expression: run.row.selected_loc_expression ?? null,
        },
        evidence: [],
        fields,
      };
    }
    case "stage10_current_position": {
      const s = c.get("stage_10_structured") as Record<string, unknown> | null;
      const cp = s?.current_position as Record<string, unknown> | undefined;
      const fields = ["stage_10_structured"];
      if (!cp) return { content_status: "not_produced", schema_version: "stage10_current_position.v1", content: null, evidence: [], fields };
      if (cp.status !== "scored") {
        return { content_status: "not_produced", schema_version: "stage10_current_position.v1", content: { status: cp.status ?? null, reason: cp.reason ?? null }, evidence: [], fields };
      }
      const chk = checkCurrentPosition(cp);
      if (!chk.ok) {
        return { content_status: "partial", schema_version: "stage10_current_position.v1", content: { reason: `Failed F1d current-position schema: ${chk.reason}`, record: cp }, evidence: [], fields };
      }
      const disp = typeof cp.evidence_label === "string" ? cp.evidence_label : null;
      const lab = disp && DISPLAY_TO_BG[disp] ? mapLabel(DISPLAY_TO_BG[disp]) : { bg_label: disp, label: "Missing" };
      return {
        content_status: "structured",
        schema_version: "stage10_current_position.v1",
        content: cp,
        evidence: [{ claim: String(cp.line ?? ""), ...lab }],
        fields,
      };
    }
    case "room00.claims": {
      const fields = ["synthesiser_claims"];
      if (!run.row.claims_stored) return { content_status: "not_produced", schema_version: "room00.claims.v1", content: null, evidence: [], fields };
      const rows = await c.db.claims(run.id);
      const claims = rows.map((r) => ({ position: r.position, heading: r.heading, claim: r.claim_text, source: r.source ?? null, source_date: r.source_date ?? null, ...mapLabel(r.label) }));
      return {
        content_status: "structured",
        schema_version: "room00.claims.v1",
        content: { claims },
        evidence: claims.map((x) => ({ claim: String(x.claim), bg_label: x.bg_label, label: x.label })),
        fields,
      };
    }
    case "room01.report":
    case "room01.territories":
    case "room01.white_space": {
      const rep = parseReport(c);
      const schema = `${outputId}.v1`;
      const fields = ["final_report"];
      if (rep === null) return { content_status: "not_produced", schema_version: schema, content: null, evidence: [], fields };
      if (rep === "bad") {
        return outputId === "room01.report"
          ? { content_status: "text_only", schema_version: "room01.report.text.v1", content: { text: String(c.get("final_report")) }, evidence: [], fields }
          : { content_status: "unavailable", schema_version: schema, content: null, evidence: [], fields };
      }
      if (outputId === "room01.report") return { content_status: "structured", schema_version: schema, content: rep, evidence: [], fields };
      const terr = Array.isArray(rep.territories) ? (rep.territories as Row[]) : [];
      if (outputId === "room01.territories") return { content_status: terr.length ? "structured" : "not_produced", schema_version: schema, content: terr.length ? { territories: terr } : null, evidence: [], fields };
      const ws = terr.filter((t) => present(t.white_space)).map((t) => ({ territory_id: t.id ?? null, territory_name: t.name ?? null, white_space: t.white_space }));
      if (!ws.length) return { content_status: "not_produced", schema_version: schema, content: null, evidence: [], fields };
      return { content_status: ws.length === terr.length ? "structured" : "partial", schema_version: schema, content: { white_space: ws }, evidence: [], fields };
    }
    case "room01.layer04":
      // Layer 04 text is held only in the retired layer fields, which are never served.
      return { content_status: "unavailable", schema_version: "room01.layer04.text.v1", content: null, evidence: [], fields: [] };
    case "room02.saved_brief": {
      const t = text(run.row.brief_text);
      const f = run.row.brief_fields;
      if (!t && !present(f)) return { content_status: "not_produced", schema_version: "room02.saved_brief.v1", content: null, evidence: [], fields: ["brief_text", "brief_fields"] };
      return { content_status: "structured", schema_version: "room02.saved_brief.v1", content: { brand_name: run.row.brand_name ?? null, category: run.row.category ?? null, fields: f ?? null, text: t }, evidence: [], fields: ["brief_text", "brief_fields"] };
    }
    case "room02.steps": {
      const keys = ["diagnosis", "truths", "relevance", "tensions"];
      const steps = Object.fromEntries(keys.map((k) => [k, c.get(k) ?? null]));
      const n = keys.filter((k) => present(steps[k])).length;
      if (!n) return { content_status: "not_produced", schema_version: "room02.steps.v1", content: null, evidence: [], fields: keys };
      return {
        content_status: n === keys.length ? "structured" : "partial",
        schema_version: "room02.steps.v1",
        content: { ...steps, selected_frame: run.row.selected_frame ?? null, selected_tension_index: run.row.selected_tension_index ?? null },
        evidence: [],
        fields: keys,
      };
    }
    case "room04.lenses":
    case "room04.gates":
    case "room04.final_prompts": {
      const st = await c.db.stimulus(run.id);
      const schema = `${outputId}.v1`;
      if (outputId === "room04.lenses") {
        const lenses = st.directions
          .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))
          .map((d) => ({ lens_id: d.lens_id, lens_name: d.lens_name, direction: d.direction ?? null, campaign_line: d.campaign_line ?? null, rationale: d.rationale ?? null, status: d.status ?? null, ratings: d.ratings ?? null }));
        return { content_status: lenses.length ? "structured" : "not_produced", schema_version: schema, content: lenses.length ? { lenses } : null, evidence: [], fields: ["stimulus_directions"] };
      }
      if (outputId === "room04.final_prompts") {
        // Final prompts only — initial and working prompts are never read out.
        const prompts = st.prompts
          .filter((p) => text(p.final_prompt))
          .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))
          .map((p) => ({ channel_name: p.channel_name ?? null, lens_name: p.lens_name ?? null, tool_target: p.tool_target ?? null, final_prompt: p.final_prompt, status: p.status ?? null }));
        return { content_status: prompts.length ? "structured" : "not_produced", schema_version: schema, content: prompts.length ? { prompts } : null, evidence: [], fields: ["stimulus_prompts.final_prompt"] };
      }
      const gates = {
        gate_one: { passed: !!run.row.gate_one_confirmed, at: run.row.gate_one_confirmed_at ?? null },
        gate_one_directions: st.directions.map((d) => ({ lens_id: d.lens_id, approved: !!d.gate_one_approved, at: d.gate_one_approved_at ?? null })),
        gate_two: st.orchestrations.map((o) => ({ passed: !!o.gate_two_confirmed, at: o.gate_two_confirmed_at ?? null })),
      };
      return { content_status: "structured", schema_version: schema, content: gates, evidence: [], fields: ["gate_one_confirmed", "gate_two_confirmed"] };
    }
  }
  throw NOT_FOUND();
}

// ── Checkpoints, documents, provenance ─────────────────────────────────────
type Checkpoint = { checkpoint: string; passed: boolean; approved_by: string | null; approved_at: string | null };
async function checkpoints(c: Ctx): Promise<Checkpoint[]> {
  const { run, db } = c;
  const who = async (passed: boolean, uid: unknown) =>
    !passed ? null : typeof uid === "string" && uid ? ((await db.actorName(uid)) ?? "recorded") : "not recorded";
  if (run.table === "sessions") {
    return Promise.all(
      ["a", "b", "c", "d", "e", "f"].map(async (k) => {
        const passed = !!run.row[`checkpoint_${k}_confirmed`];
        return { checkpoint: `checkpoint_${k}`, passed, approved_by: await who(passed, run.row[`checkpoint_${k}_confirmed_by`]), approved_at: passed ? ((run.row[`checkpoint_${k}_confirmed_at`] as string) ?? null) : null };
      }),
    );
  }
  if (run.table === "stimulus_runs") {
    const st = await db.stimulus(run.id);
    const passed = !!run.row.gate_one_confirmed;
    const out: Checkpoint[] = [{ checkpoint: "gate_one", passed, approved_by: await who(passed, run.row.gate_one_confirmed_by), approved_at: passed ? ((run.row.gate_one_confirmed_at as string) ?? null) : null }];
    for (const o of st.orchestrations) {
      const p = !!o.gate_two_confirmed;
      out.push({ checkpoint: "gate_two", passed: p, approved_by: await who(p, o.gate_two_confirmed_by), approved_at: p ? ((o.gate_two_confirmed_at as string) ?? null) : null });
    }
    return out;
  }
  return [];
}

export function documentId(runId: string, format: string, v: number) {
  return `${runId}~stage16.${format}~v${v}`;
}
function parseDocumentId(id: string): { runId: string; format: string; v: number } | null {
  const m = /^([0-9a-f-]{36})~stage16\.([a-z]+)~v(\d+)$/.exec(id);
  if (!m || !(STAGE16_FORMATS as readonly string[]).includes(m[2])) return null;
  return { runId: m[1], format: m[2], v: Number(m[3]) };
}
function fetchRoute(clientRef: string, runId: string, v: number, outputId: string) {
  return { method: "POST", path: ACCESS_ROUTE, body: { request: "get_output", params: { client_ref: clientRef, run_id: runId, version: v, output_id: outputId } } };
}
function documents(c: Ctx, clientRef: string) {
  if (c.run.table !== "sessions" || isDiagnostic(c.run)) return [];
  return STAGE16_FORMATS.filter((f) => text(c.get(`stage_16_${f}_output`))).map((f) => ({
    document_id: documentId(c.run.id, f, c.v),
    output_id: `stage16.${f}`,
    format: f,
    version: c.v,
    mime: "text/markdown",
    fetch: fetchRoute(clientRef, c.run.id, c.v, `stage16.${f}`),
  }));
}
function provenance(c: Ctx, fields: string[]) {
  const hist = c.vc.rows
    .filter((r) => fields.includes(r.field))
    .map((r) => ({ field: r.field, version: c.vc.batches.indexOf(r.created_at) + 1, reason: r.reason, recorded_at: r.created_at }));
  return {
    room: ROOM_OF[c.run.table],
    source_fields: fields,
    version: c.v,
    current_version: c.vc.current,
    reconstructed_from_history: c.v < c.vc.current,
    history: hist,
    run_created_at: c.run.row.created_at ?? null,
    run_updated_at: c.run.row.updated_at ?? null,
    source_run_id: (c.run.row.bg_source_id ?? c.run.row.session_id ?? null) as string | null,
    hub_job_ref: (c.run.row.hub_job ?? null) as string | null,
  };
}

// ── Handler ────────────────────────────────────────────────────────────────
export type Success = Record<string, unknown>;
export type LogEntry = { scope: Scope | null; key_id: string | null; client_ref: string | null; run_id: string | null; request: string | null; output_id: string | null };

async function scopedRun(db: Db, bgClientId: string, runId: string): Promise<RunRec> {
  const run = await db.findRun(runId);
  // Deny by default: identical not_found for missing, other client, legacy and unlinked.
  if (!run || run.row.link_status !== "linked" || run.row.bg_client_id !== bgClientId) throw NOT_FOUND();
  return run;
}
async function ctxFor(db: Db, run: RunRec, v: number | undefined): Promise<Ctx> {
  const vc = versionCtx(VERSIONED.includes(run.table) ? await db.versions(run.table, run.id) : []);
  const ver = v ?? vc.current;
  if (ver < 1 || ver > vc.current) throw NOT_FOUND();
  return { run, vc, v: ver, db, get: (f) => fieldAt(run, vc, ver, f) };
}

export async function handleAccess(
  db: Db,
  key: Key,
  body: unknown,
  log: LogEntry,
  now: () => string = () => new Date().toISOString(),
): Promise<Success> {
  const b = BodySchema.safeParse(body);
  if (!b.success) throw new AccessError("invalid_request", "Body must be {request, params}.");
  const req = b.data.request;
  log.request = req.slice(0, 50);
  if (!(REQUESTS as readonly string[]).includes(req)) throw new AccessError("invalid_request", "Unknown request.");
  const name = req as RequestName;
  const p = PARAMS[name].safeParse(b.data.params);
  if (!p.success) throw new AccessError("invalid_request", `Invalid params: ${p.error.issues.map((i) => i.path.join(".") || i.message).join(", ")}`.slice(0, 300));
  const params = p.data as Record<string, unknown>;
  const clientRef = String(params.client_ref);
  log.client_ref = clientRef;
  if (typeof params.run_id === "string") log.run_id = params.run_id;
  if (typeof params.output_id === "string") log.output_id = params.output_id;
  if (!scopeAllowsRequest(key.scope, name)) throw new AccessError("forbidden_scope", "This key's scope does not allow that request.");

  const bgClientId = await db.resolveClient(clientRef);
  if (!bgClientId) throw NOT_FOUND();

  const base = (c: Ctx | null, extra: Record<string, unknown>) => ({
    scope: key.scope,
    client_ref: clientRef,
    bg_client_id: bgClientId,
    engagement_id: (c?.run.row.engagement_id as string | null) ?? null,
    run_id: c?.run.id ?? null,
    room: c ? ROOM_OF[c.run.table] : null,
    run_mode: c ? (c.run.table === "sessions" ? (c.run.row.run_mode as string) ?? "full" : "full") : null,
    run_status: c ? runStatus(c.run) : null,
    version: c?.v ?? null,
    locked: c ? !!c.run.row.locked_at : null,
    output_id: null as string | null,
    schema_version: SCHEMA,
    content_status: "structured" as ContentStatus,
    content: null as unknown,
    evidence: [] as Evidence[],
    checkpoints: [] as Checkpoint[],
    documents: [] as unknown[],
    provenance: null as unknown,
    legacy: c ? c.run.row.earlier_versions_kept === false : null,
    earlier_versions_kept: c ? (VERSIONED.includes(c.run.table) ? c.run.row.earlier_versions_kept === true : false) : null,
    generated_at: now(),
    ...extra,
  });

  if (name === "list_runs") {
    let eng: string | null = null;
    if (params.engagement) {
      eng = await db.resolveEngagement(bgClientId, String(params.engagement));
      if (!eng) throw NOT_FOUND();
    }
    const runs = await db.listLinkedRuns(bgClientId, eng);
    const items = [];
    for (const r of runs) {
      if (r.row.link_status !== "linked" || r.row.bg_client_id !== bgClientId) continue;
      const vc = versionCtx(VERSIONED.includes(r.table) ? await db.versions(r.table, r.id) : []);
      items.push({
        run_id: r.id,
        room: ROOM_OF[r.table],
        engagement_id: r.row.engagement_id ?? null,
        brand_name: r.row.brand_name ?? null,
        run_mode: r.table === "sessions" ? r.row.run_mode ?? "full" : "full",
        ...briefInfo(r),
        run_status: runStatus(r),
        version: vc.current,
        locked: !!r.row.locked_at,
        created_at: r.row.created_at ?? null,
      });
    }
    return base(null, { engagement_id: eng, schema_version: "list_runs.v1", content: { runs: items } });
  }

  if (name === "document_metadata") {
    const d = parseDocumentId(String(params.document_id));
    if (!d) throw NOT_FOUND();
    log.run_id = d.runId;
    log.output_id = `stage16.${d.format}`;
    const c = await ctxFor(db, await scopedRun(db, bgClientId, d.runId), d.v);
    const doc = documents(c, clientRef).find((x) => x.format === d.format);
    if (!doc) throw NOT_FOUND();
    return base(c, {
      output_id: doc.output_id,
      schema_version: "document_metadata.v1",
      content: doc,
      documents: [doc],
      checkpoints: await checkpoints(c),
      provenance: provenance(c, [`stage_16_${d.format}_output`]),
    });
  }

  const run = await scopedRun(db, bgClientId, String(params.run_id));
  const c = await ctxFor(db, run, params.version as number | undefined);

  if (name === "run_manifest") {
    const outputs = [];
    for (const id of OUTPUTS_BY_TABLE[run.table]) {
      if (key.scope === "second_brain" && !scopeAllowsOutput("second_brain", id)) continue;
      if (isDiagnostic(run) && NOT_IN_DIAGNOSTIC(id)) {
        outputs.push({ output_id: id, included: "not included", content_status: "not_produced" });
        continue;
      }
      const b2 = await buildOutput(id, c);
      outputs.push({ output_id: id, included: "included", content_status: b2.content_status, schema_version: b2.schema_version });
    }
    if (isDiagnostic(run)) {
      outputs.push({ output_id: "room04.*", included: "not included", content_status: "not_produced" });
    }
    return base(c, {
      schema_version: "run_manifest.v1",
      content: { ...briefInfo(run), outputs, current_version: c.vc.current, versions: Array.from({ length: c.vc.current }, (_, i) => i + 1) },
      checkpoints: await checkpoints(c),
      documents: key.scope === "admin" ? [] : documents(c, clientRef),
    });
  }

  if (name === "list_documents") {
    return base(c, { schema_version: "list_documents.v1", content: { documents: documents(c, clientRef) }, documents: documents(c, clientRef) });
  }

  // get_output / provenance
  const outputId = String(params.output_id);
  if (!ALL_OUTPUTS.has(outputId)) throw NOT_FOUND();
  if (!scopeAllowsOutput(key.scope, outputId)) throw new AccessError("forbidden_scope", "This key's scope does not allow that output.");
  const built = await buildOutput(outputId, c);
  const prov = provenance(c, built.fields);
  if (name === "provenance") {
    return base(c, { output_id: outputId, schema_version: "provenance.v1", content: prov, content_status: "structured", provenance: prov });
  }
  return base(c, {
    output_id: outputId,
    schema_version: built.schema_version,
    content_status: built.content_status,
    content: built.content,
    evidence: built.evidence,
    checkpoints: await checkpoints(c),
    documents: documents(c, clientRef),
    provenance: prov,
  });
}
