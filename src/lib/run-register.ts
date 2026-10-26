import { furthestStageLabel } from "./run-stage-progress";
import { NUMBERED_STAGE_COUNT } from "./stage-manifest";
// Run register: every run grouped Client → Job → Runs.
// Grouping uses only database-controlled client/engagement links; runs are
// never matched to a client by brand name. Archived runs are hidden here and
// remain stored (and restorable by an admin).

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { roomLabel } from "@/lib/rooms";

export type RunTable =
  | "sessions"
  | "briefing_room_workspaces"
  | "intelligence_sessions"
  | "synthesiser_runs"
  | "stimulus_runs";

export type RegisterRun = {
  table: RunTable;
  id: string;
  room: string;
  brand: string;
  clientId: string | null;
  engagementId: string | null;
  briefType: string | null;
  runType: string | null;
  date: string;
  status: string;
  openHref: string;
  /** This run's documents only; null when the run has none yet. */
  documentsHref: string | null;
};

export type GroupName = {
  client_id: string;
  client_name: string;
  engagement_id: string | null;
  engagement_name: string | null;
};

export type JobGroup = { key: string; engagementId: string | null; name: string; runs: RegisterRun[] };
export type ClientGroup = {
  key: string;
  clientId: string | null;
  name: string;
  jobs: JobGroup[];
  runCount: number;
  latest: string;
};

export const NO_JOB = "No job";
export const NO_CLIENT = "Not linked to a client";

/** Pure grouping: Client → Job → Runs, newest first at every level. */
export function groupRuns(runs: RegisterRun[], names: GroupName[]): ClientGroup[] {
  const clientNames = new Map<string, string>();
  const jobNames = new Map<string, string>();
  for (const n of names) {
    if (n.client_name) clientNames.set(n.client_id, n.client_name);
    if (n.engagement_id && n.engagement_name) jobNames.set(n.engagement_id, n.engagement_name);
  }
  const clients = new Map<string, ClientGroup>();
  for (const r of runs) {
    const cKey = r.clientId ?? "__none__";
    let c = clients.get(cKey);
    if (!c) {
      c = {
        key: cKey,
        clientId: r.clientId,
        name: r.clientId ? (clientNames.get(r.clientId) ?? "Client") : NO_CLIENT,
        jobs: [],
        runCount: 0,
        latest: "",
      };
      clients.set(cKey, c);
    }
    // Unlinked runs are listed under the brand name each run was created with.
    const jKey = !r.clientId ? `brand:${r.brand.trim().toLowerCase() || "—"}` : r.engagementId ? r.engagementId : "__nojob__";
    let j = c.jobs.find((x) => x.key === jKey);
    if (!j) {
      j = {
        key: jKey,
        engagementId: jKey === "__nojob__" ? null : r.engagementId,
        name: !r.clientId ? (r.brand.trim() || "No brand") : jKey === "__nojob__" ? NO_JOB : (jobNames.get(jKey) ?? "Job"),
        runs: [],
      };
      c.jobs.push(j);
    }
    j.runs.push(r);
    c.runCount += 1;
    if (r.date > c.latest) c.latest = r.date;
  }
  const out = [...clients.values()];
  for (const c of out) {
    for (const j of c.jobs) j.runs.sort((a, b) => b.date.localeCompare(a.date));
    // Newest run first, including runs without a job.
    c.jobs.sort((a, b) => (b.runs[0]?.date ?? "").localeCompare(a.runs[0]?.date ?? ""));
  }
  // Linked clients first, newest activity first; the unlinked bucket last.
  out.sort((a, b) => (a.clientId === null ? 1 : b.clientId === null ? -1 : b.latest.localeCompare(a.latest)));
  return out;
}

const label = (s: string | null | undefined) => (s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ") : "—");

type AnyRow = Record<string, any>;

/** A Pipeline run has deliverables once any document-bearing stage exists. */
export function sessionHasDeliverables(s: AnyRow): boolean {
  return (
    s.has_stage_15 === true ||
    s.has_stage_16 === true ||
    s.has_stage_16_consulting === true ||
    s.has_stage_17 === true ||
    s.has_stage_17b === true ||
    s.has_stage_18 === true ||
    s.has_stage_19 === true ||
    s.has_stage_20 === true ||
    s.has_stage_20b === true ||
    s.has_stage_21 === true ||
    s.has_stage_22 === true
  );
}

/** Converts stored rows to register runs. Archived rows are dropped. */
export function toRegisterRuns(
  rows: {
    sessions: AnyRow[];
    workspaces: AnyRow[];
    intelligence: AnyRow[];
    synthesiser: AnyRow[];
    stimulus: AnyRow[];
  },
  /** Creative Stimulus run ids that have at least one saved direction. */
  stimulusWithDocs?: Set<string>,
): RegisterRun[] {
  const live = (r: AnyRow) => !r.archived_at;
  const out: RegisterRun[] = [];
  const sessionBrand = new Map<string, string>();
  for (const s of rows.sessions) sessionBrand.set(s.id, s.brand_name ?? "");
  for (const s of rows.sessions.filter(live)) {
    const docs = sessionHasDeliverables(s);
    out.push({
      table: "sessions", id: s.id, room: roomLabel("pipeline"), brand: s.brand_name ?? "",
      clientId: s.bg_client_id ?? null, engagementId: s.engagement_id ?? null,
      briefType: label(s.brief_type ?? "campaign"), runType: label(s.run_mode ?? "full"),
      date: s.created_at, status: s.status === "complete" || s.has_stage_22 ? label(s.status) : `${label(s.status)} · Stage ${furthestStageLabel(s)} of ${NUMBERED_STAGE_COUNT}`,
      openHref: `/pipeline?session=${encodeURIComponent(s.id)}`,
      documentsHref: docs ? `/complete?session=${encodeURIComponent(s.id)}` : null,
    });
  }
  for (const w of rows.workspaces.filter(live)) {
    out.push({
      table: "briefing_room_workspaces", id: w.id, room: roomLabel("briefing_room"), brand: w.brand_name ?? "",
      clientId: w.bg_client_id ?? null, engagementId: w.engagement_id ?? null,
      briefType: null, runType: null, date: w.created_at, status: label(w.status),
      openHref: `/briefing-room/${w.id}`, documentsHref: null,
    });
  }
  for (const i of rows.intelligence.filter(live)) {
    out.push({
      table: "intelligence_sessions", id: i.id, room: roomLabel("intelligence"), brand: i.brand_name ?? "",
      clientId: i.bg_client_id ?? null, engagementId: i.engagement_id ?? null,
      briefType: i.report_metadata?.brief_type ? label(i.report_metadata.brief_type) : null, runType: null,
      date: i.created_at, status: label(i.status),
      openHref: `/intelligence/${i.id}`,
      documentsHref: i.status === "complete" ? `/intelligence/${i.id}` : null,
    });
  }
  for (const r of rows.synthesiser.filter(live)) {
    out.push({
      table: "synthesiser_runs", id: r.id, room: roomLabel("synthesiser"), brand: r.brand_name ?? "",
      clientId: r.bg_client_id ?? null, engagementId: r.engagement_id ?? null,
      briefType: null, runType: null, date: r.created_at, status: label(r.status),
      openHref: `/synthesiser?brand=${encodeURIComponent(r.brand_name ?? "")}`, documentsHref: null,
    });
  }
  for (const r of rows.stimulus.filter(live)) {
    // A Creative Stimulus run has deliverables once it holds any saved
    // direction; its documents live on the parent session's Deliverables page.
    const docs = stimulusWithDocs?.has(r.id) === true;
    out.push({
      table: "stimulus_runs", id: r.id, room: roomLabel("creative"), brand: sessionBrand.get(r.session_id) ?? "",
      clientId: r.bg_client_id ?? null, engagementId: r.engagement_id ?? null,
      briefType: null, runType: label(r.run_mode), date: r.created_at, status: label(r.status),
      openHref: `/creative/${r.session_id}`,
      documentsHref: docs ? `/complete?session=${encodeURIComponent(r.session_id)}` : null,
    });
  }
  return out;
}

export function useRunRegister() {
  const [runs, setRuns] = useState<RegisterRun[]>([]);
  const [names, setNames] = useState<GroupName[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const sb = supabase as any;
    const [s, w, i, y, c, n] = await Promise.all([
      sb.from("brand_register_sessions")
        .select("id,brand_name,status,created_at,current_stage,has_stage_16_consulting,has_stage_15,has_stage_16,has_stage_17,has_stage_17b,has_stage_18,has_stage_19,has_stage_20,stage_20_approved,has_stage_20b,has_stage_21,has_stage_22,bg_client_id,engagement_id,brief_type,run_mode,archived_at")
        .eq("is_preflight_test", false).is("archived_at", null).order("created_at", { ascending: false }).limit(1000),
      sb.from("brand_register_briefings").select("id,brand_name,status,created_at,bg_client_id,engagement_id,archived_at")
        .is("archived_at", null).order("created_at", { ascending: false }).limit(1000),
      sb.from("intelligence_sessions").select("id,brand_name,status,created_at,brief_type:report_metadata->>brief_type,bg_client_id,engagement_id,archived_at")
        .is("archived_at", null).order("created_at", { ascending: false }).limit(1000),
      sb.from("synthesiser_runs").select("id,brand_name,status,created_at,bg_client_id,engagement_id,archived_at")
        .is("archived_at", null).order("created_at", { ascending: false }).limit(1000),
      sb.from("stimulus_runs").select("id,session_id,status,run_mode,created_at,bg_client_id,engagement_id,archived_at")
        .is("archived_at", null).order("created_at", { ascending: false }).limit(1000),
      sb.rpc("bg_run_group_names"),
    ]);
    const err = s.error ?? w.error ?? i.error ?? y.error ?? c.error;
    setError(err ? err.message : null);
    const intel = (i.data ?? []).map((r: AnyRow) => ({ ...r, report_metadata: { brief_type: r.brief_type } }));
    setRuns(toRegisterRuns({ sessions: s.data ?? [], workspaces: w.data ?? [], intelligence: intel, synthesiser: y.data ?? [], stimulus: c.data ?? [] }));
    setNames((n.data ?? []) as GroupName[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load().catch((e) => { setError(e instanceof Error ? e.message : String(e)); setLoading(false); });
  }, [load]);

  const groups = useMemo(() => groupRuns(runs, names), [runs, names]);
  return { groups, runs, loading, error, refresh: load };
}
