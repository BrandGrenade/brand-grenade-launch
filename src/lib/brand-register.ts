// Brand Register — client-side aggregation over sessions,
// briefing_room_workspaces, saved_briefs, and (best-effort)
// intelligence_sessions, keyed by normalised brand name.
//
// No new tables, no migration. Pure browser hook. Realtime-subscribed
// to sessions and briefing_room_workspaces.

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// ─── Types ─────────────────────────────────────────────────────────

export type SystemKey =
  | "intelligence"
  | "briefing_room"
  | "pipeline"
  | "phase_2"
  | "creative";

export type SystemState = "not_started" | "in_progress" | "complete" | "interrupted";

export type SystemStatus = {
  state: SystemState;
  /** Short label shown in the collapsed row (e.g. "Stage 8 of 27"). */
  label: string | null;
  /** ISO completion timestamp when state === "complete". */
  timestamp: string | null;
  /** Route for the "View" link on complete rows. */
  href: string | null;
  /** Route search param for the View link. */
  hrefSearch: Record<string, string> | null;
  /** True count of historical runs for this system for this brand. */
  runCount: number;
};

export type BrandRunStatus = "complete" | "in_progress" | "error";

export type BrandRun = {
  id: string;
  system: SystemKey;
  date: string; // ISO
  status: BrandRunStatus;
  label: string;
  /** Optional in-app route for a "View" action. */
  href: string | null;
  hrefSearch: Record<string, string> | null;
  /** Optional download href (Document 00A etc). Stub until wired. */
  downloadHref: string | null;
};

export type BrandRow = {
  /** Normalised grouping key. */
  key: string;
  /** Best display name observed (first non-empty, preferring most recent). */
  displayName: string;
  /** Best category observed across all systems. */
  category: string | null;
  intelligence: SystemStatus;
  briefingRoom: SystemStatus;
  pipeline: SystemStatus;
  phase2: SystemStatus;
  /** Creative Stimulus Engine (Tissue → Gate One → Orchestration → Gate Two). */
  creative: SystemStatus;
  /** ISO — most recent activity across all systems. */
  lastUpdated: string;
  /** All historical runs, newest first. */
  runs: BrandRun[];
  /** Sessions belonging to this brand (used by "Delete brand"). */
  sessionIds: string[];
  /** Briefing Room workspace IDs for this brand. */
  workspaceIds: string[];
  /** Saved brief IDs for this brand. */
  savedBriefIds: string[];
  /** Intelligence session IDs for this brand. */
  intelligenceIds: string[];
};

// ─── Normalisation ─────────────────────────────────────────────────

export function normalizeBrand(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .trim()
    .toLowerCase()
    .replace(/[\u2018\u2019\u201C\u201D]/g, "'")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, "-");
}

const EMPTY_STATUS: SystemStatus = {
  state: "not_started",
  label: null,
  timestamp: null,
  href: null,
  hrefSearch: null,
  runCount: 0,
};

// ─── Raw row types (subset of columns we query) ────────────────────

// Sourced from the brand_register_* summary views: presence flags instead of
// full report text, so the register loads without pulling megabytes of output.
type SessionRow = {
  id: string;
  brand_name: string | null;
  category: string | null;
  status: string | null;
  current_stage: number | null;
  created_at: string;
  updated_at: string;
  has_stage_16_consulting: boolean | null;
  phase_2_status: string | null;
  has_stage_17: boolean | null;
  has_stage_22: boolean | null;
  stage_status: string | null;
  interrupted_stage: number | null;
  last_heartbeat_at: string | null;
};

type WorkspaceRow = {
  id: string;
  brand_name: string | null;
  category: string | null;
  status: string | null;
  updated_at: string;
  created_at: string;
  has_diagnosis: boolean | null;
  has_truths: boolean | null;
  has_relevance: boolean | null;
  has_tensions: boolean | null;
  selected_tension_index: number | null;
};

type SavedBriefRow = {
  brief_id: string;
  brand_name: string | null;
  created_at: string;
};

type IntelligenceRow = {
  id: string;
  brand_name: string | null;
  category: string | null;
  status: string | null;
  created_at: string;
  updated_at: string;
};

/** Creative Stimulus Engine run (Phase 1–2: generation, tissue, Gate One). */
type StimulusRunRow = {
  id: string;
  session_id: string;
  status: string | null;
  gate_one_confirmed: boolean | null;
  updated_at: string;
};

/** Creative Stimulus Engine orchestration (Phase 3–4: W/AD/CD, Gate Two). */
type StimulusOrchRow = {
  id: string;
  session_id: string;
  status: string | null;
  gate_two_confirmed: boolean | null;
  updated_at: string;
};


// ─── Per-system derivation ─────────────────────────────────────────

/** Matches STALE_MS in session-heartbeat.functions.ts. */
const STALE_HEARTBEAT_MS = 2 * 60 * 1000;


function derivePipeline(sessions: SessionRow[]): SystemStatus {
  if (sessions.length === 0) return { ...EMPTY_STATUS };
  const latest = sessions[0]!;
  const complete =
    latest.status === "complete" || latest.has_stage_22 === true;
  if (complete) {
    return {
      state: "complete",
      label: null,
      timestamp: latest.updated_at,
      href: "/pipeline",
      hrefSearch: { session: latest.id },
      runCount: sessions.length,
    };
  }
  const stage = latest.current_stage ?? 1;

  // Interrupted = the session says so, or a stage claims to be running but
  // its heartbeat has gone quiet. Either way the user needs a resume, not a
  // "still working" label that never resolves.
  const stalled =
    (latest.stage_status ?? "").startsWith("running:") &&
    Date.now() - new Date(latest.last_heartbeat_at ?? latest.updated_at).getTime() >
      STALE_HEARTBEAT_MS;
  if (latest.status === "interrupted" || stalled) {
    const at = latest.interrupted_stage ?? stage;
    return {
      state: "interrupted",
      label: `Interrupted at Stage ${at} — resume`,
      timestamp: latest.updated_at,
      href: "/pipeline",
      hrefSearch: { session: latest.id },
      runCount: sessions.length,
    };
  }

  return {
    state: "in_progress",
    label: `Stage ${stage} of 27`,
    timestamp: null,
    href: "/pipeline",
    hrefSearch: { session: latest.id },
    runCount: sessions.length,
  };
}


function derivePhase2(sessions: SessionRow[]): SystemStatus {
  if (sessions.length === 0) return { ...EMPTY_STATUS };
  const withPhase2 = sessions.filter(
    (s) =>
      s.has_stage_22 === true ||
      s.has_stage_17 === true ||
      s.phase_2_status === "in_progress" ||
      s.phase_2_status === "complete",
  );
  const runCount = withPhase2.length;
  const latest = sessions[0]!;
  if (latest.has_stage_22 === true || latest.phase_2_status === "complete") {
    return {
      state: "complete",
      label: null,
      timestamp: latest.updated_at,
      href: "/detonation",
      hrefSearch: { session: latest.id },
      runCount: Math.max(runCount, 1),
    };
  }
  if (latest.has_stage_17 === true || latest.phase_2_status === "in_progress") {
    return {
      state: "in_progress",
      label: "Running",
      timestamp: null,
      href: "/detonation",
      hrefSearch: { session: latest.id },
      runCount: Math.max(runCount, 1),
    };
  }
  return { ...EMPTY_STATUS, runCount };
}

/**
 * Creative Stimulus Engine status for a brand. Progress reads across the four
 * phases the engine actually persists:
 *   run exists                 → "Tissue check"
 *   run.gate_one_confirmed     → "Gate One passed"
 *   orchestration in flight    → "Orchestration"
 *   orchestration complete     → "Gate Two pending"
 *   gate_two_confirmed         → complete
 * The engine lives inside Stage 21, so every link lands on /detonation for
 * the owning session.
 */
function deriveCreative(
  sessions: SessionRow[],
  runsBySession: Map<string, StimulusRunRow[]>,
  orchBySession: Map<string, StimulusOrchRow[]>,
): SystemStatus {
  let latestSessionId: string | null = null;
  let latestAt = "";
  let runCount = 0;
  let bestRank = -1;
  let bestLabel: string | null = null;
  let bestState: SystemState = "not_started";
  let bestTimestamp: string | null = null;

  for (const s of sessions) {
    const runs = runsBySession.get(s.id) ?? [];
    const orchs = orchBySession.get(s.id) ?? [];
    if (runs.length === 0 && orchs.length === 0) continue;
    runCount += runs.length;

    const orch = orchs[0];
    const run = runs[0];
    const at = orch?.updated_at ?? run?.updated_at ?? s.updated_at;

    let rank = 0;
    let label: string | null = "Tissue check";
    let state: SystemState = "in_progress";
    if (run?.gate_one_confirmed === true) {
      rank = 1;
      label = "Gate One passed";
    }
    if (orch) {
      if (orch.gate_two_confirmed === true) {
        rank = 4;
        label = null;
        state = "complete";
      } else if (orch.status === "complete") {
        rank = 3;
        label = "Gate Two pending";
      } else if (orch.status === "error") {
        rank = 2;
        label = "Orchestration failed";
        state = "interrupted";
      } else {
        rank = 2;
        label = "Orchestration running";
      }
    }

    if (rank > bestRank || (rank === bestRank && at > latestAt)) {
      bestRank = rank;
      bestLabel = label;
      bestState = state;
      bestTimestamp = state === "complete" ? at : null;
      latestSessionId = s.id;
      latestAt = at;
    }
  }

  if (!latestSessionId) return { ...EMPTY_STATUS };
  return {
    state: bestState,
    label: bestLabel,
    timestamp: bestTimestamp,
    href: "/detonation",
    hrefSearch: { session: latestSessionId },
    runCount: Math.max(runCount, 1),
  };
}



function briefingStep(w: WorkspaceRow): number {
  if (w.selected_tension_index != null) return 4;
  if (w.has_tensions === true) return 4;
  if (w.has_relevance === true) return 3;
  if (w.has_truths === true) return 2;
  if (w.has_diagnosis === true) return 1;
  return 0;
}

function deriveBriefing(
  workspaces: WorkspaceRow[],
  brandSavedBriefCount: number,
): SystemStatus {
  if (workspaces.length === 0) return { ...EMPTY_STATUS };
  const latest = workspaces[0]!;
  // Clarification 02: Complete = Step 4 approved AND handoff written.
  // Handoff proxy = a saved_briefs row exists for this brand AND at least
  // one workspace has selected_tension_index set.
  const anyApproved = workspaces.some((w) => w.selected_tension_index != null);
  if (anyApproved && brandSavedBriefCount > 0) {
    // Prefer the most recent approved workspace for the deep link.
    const approved =
      workspaces.find((w) => w.selected_tension_index != null) ?? latest;
    return {
      state: "complete",
      label: null,
      timestamp: latest.updated_at,
      href: `/briefing-room/${approved.id}`,
      hrefSearch: null,
      runCount: workspaces.length,
    };
  }
  const step = briefingStep(latest);
  return {
    state: "in_progress",
    label: `Step ${Math.max(step, 1)} of 4`,
    timestamp: null,
    href: `/briefing-room/${latest.id}`,
    hrefSearch: null,
    runCount: workspaces.length,
  };
}

function deriveIntelligence(rows: IntelligenceRow[]): SystemStatus {
  if (rows.length === 0) return { ...EMPTY_STATUS };
  const latest = rows[0]!;
  if (latest.status === "complete") {
    return {
      state: "complete",
      label: null,
      timestamp: latest.updated_at,
      href: `/intelligence/${latest.id}`,
      hrefSearch: null,
      runCount: rows.length,
    };
  }
  return {
    state: "in_progress",
    label: "Open",
    timestamp: null,
    href: `/intelligence/${latest.id}`,
    hrefSearch: null,
    runCount: rows.length,
  };
}


// ─── Assemble ──────────────────────────────────────────────────────

type Aggregated = {
  sessions: SessionRow[];
  workspaces: WorkspaceRow[];
  savedBriefs: SavedBriefRow[];
  intelligence: IntelligenceRow[];
  stimulusRuns: StimulusRunRow[];
  stimulusOrchs: StimulusOrchRow[];
};

function assemble({
  sessions,
  workspaces,
  savedBriefs,
  intelligence,
  stimulusRuns,
  stimulusOrchs,
}: Aggregated): BrandRow[] {
  const runsBySession = new Map<string, StimulusRunRow[]>();
  for (const r of stimulusRuns) {
    const list = runsBySession.get(r.session_id) ?? [];
    list.push(r);
    runsBySession.set(r.session_id, list);
  }
  const orchBySession = new Map<string, StimulusOrchRow[]>();
  for (const o of stimulusOrchs) {
    const list = orchBySession.get(o.session_id) ?? [];
    list.push(o);
    orchBySession.set(o.session_id, list);
  }

  const groups = new Map<
    string,
    {
      displayName: string;
      displayAt: number;
      category: string | null;
      sessions: SessionRow[];
      workspaces: WorkspaceRow[];
      savedBriefs: SavedBriefRow[];
      intelligence: IntelligenceRow[];
    }
  >();

  const touch = (
    rawName: string | null,
    category: string | null,
    at: string,
  ): string | null => {
    const key = normalizeBrand(rawName);
    if (!key) return null;
    const existing = groups.get(key);
    const atMs = Date.parse(at) || 0;
    if (!existing) {
      groups.set(key, {
        displayName: (rawName ?? "").trim() || key,
        displayAt: atMs,
        category: category ?? null,
        sessions: [],
        workspaces: [],
        savedBriefs: [],
        intelligence: [],
      });
    } else {
      // Prefer most recent non-empty displayName.
      if (rawName && atMs >= existing.displayAt) {
        existing.displayName = rawName.trim();
        existing.displayAt = atMs;
      }
      if (!existing.category && category) existing.category = category;
    }
    return key;
  };

  for (const s of sessions) {
    const key = touch(s.brand_name, s.category, s.updated_at);
    if (key) groups.get(key)!.sessions.push(s);
  }
  for (const w of workspaces) {
    const key = touch(w.brand_name, w.category, w.updated_at);
    if (key) groups.get(key)!.workspaces.push(w);
  }
  for (const b of savedBriefs) {
    const key = touch(b.brand_name, null, b.created_at);
    if (key) groups.get(key)!.savedBriefs.push(b);
  }
  for (const i of intelligence) {
    const key = touch(i.brand_name, i.category, i.updated_at);
    if (key) groups.get(key)!.intelligence.push(i);
  }

  const rows: BrandRow[] = [];
  for (const [key, g] of groups) {
    // Sort each system newest first.
    g.sessions.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    g.workspaces.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    g.savedBriefs.sort((a, b) => b.created_at.localeCompare(a.created_at));
    g.intelligence.sort((a, b) => b.updated_at.localeCompare(a.updated_at));

    const intelligence = deriveIntelligence(g.intelligence);
    const briefingRoom = deriveBriefing(g.workspaces, g.savedBriefs.length);
    const pipeline = derivePipeline(g.sessions);
    const phase2 = derivePhase2(g.sessions);

    const runs: BrandRun[] = [];
    for (const i of g.intelligence) {
      runs.push({
        id: `intel:${i.id}`,
        system: "intelligence",
        date: i.updated_at,
        status: i.status === "complete" ? "complete" : "in_progress",
        label: i.status === "complete" ? "Analysis complete" : "Analysing",
        href: `/intelligence/${i.id}`,
        hrefSearch: null,
        downloadHref: null,
      });
    }

    for (const w of g.workspaces) {
      const step = briefingStep(w);
      const isComplete =
        w.selected_tension_index != null &&
        g.savedBriefs.some(
          (b) => Date.parse(b.created_at) >= Date.parse(w.updated_at) - 24 * 3600_000,
        );
      runs.push({
        id: `brief:${w.id}`,
        system: "briefing_room",
        date: w.updated_at,
        status: isComplete ? "complete" : "in_progress",
        label: isComplete ? "Handoff written" : `Step ${Math.max(step, 1)} of 4`,
        href: "/briefing-room/$id",
        hrefSearch: null,
        downloadHref: null,
      });
    }
    for (const s of g.sessions) {
      const pipelineComplete =
        s.has_stage_22 === true || s.has_stage_16_consulting === true;
      runs.push({
        id: `pipe:${s.id}`,
        system: "pipeline",
        date: s.updated_at,
        status: pipelineComplete
          ? "complete"
          : s.status === "error"
            ? "error"
            : "in_progress",
        label: pipelineComplete
          ? "Pipeline complete"
          : `Stage ${s.current_stage ?? 1} of 27`,
        href: "/pipeline",
        hrefSearch: { session: s.id },
        downloadHref: null,
      });
      if (
        s.has_stage_22 === true ||
        s.has_stage_17 === true ||
        s.phase_2_status === "in_progress" ||
        s.phase_2_status === "complete"
      ) {
        const p2Complete =
          s.has_stage_22 === true || s.phase_2_status === "complete";
        runs.push({
          id: `phase2:${s.id}`,
          system: "phase_2",
          date: s.updated_at,
          status: p2Complete ? "complete" : "in_progress",
          label: p2Complete ? "Phase 2 complete" : "Phase 2 running",
          href: "/detonation",
          hrefSearch: { session: s.id },
          downloadHref: null,
        });
      }
    }
    runs.sort((a, b) => b.date.localeCompare(a.date));

    const lastUpdated =
      runs[0]?.date ??
      g.sessions[0]?.updated_at ??
      g.workspaces[0]?.updated_at ??
      new Date(0).toISOString();

    rows.push({
      key,
      displayName: g.displayName,
      category: g.category,
      intelligence,
      briefingRoom,
      pipeline,
      phase2,
      lastUpdated,
      runs,
      sessionIds: g.sessions.map((s) => s.id),
      workspaceIds: g.workspaces.map((w) => w.id),
      savedBriefIds: g.savedBriefs.map((b) => b.brief_id),
      intelligenceIds: g.intelligence.map((i) => i.id),
    });
  }

  rows.sort((a, b) => b.lastUpdated.localeCompare(a.lastUpdated));
  return rows;
}

// ─── Hook ──────────────────────────────────────────────────────────

export type UseBrandRegisterResult = {
  rows: BrandRow[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export function useBrandRegister(): UseBrandRegisterResult {
  const [rows, setRows] = useState<BrandRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const [sessionsRes, workspacesRes, briefsRes, intelRes] = await Promise.all([
      supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from("brand_register_sessions" as any)
        .select(
          "id,brand_name,category,status,current_stage,created_at,updated_at,has_stage_16_consulting,phase_2_status,has_stage_17,has_stage_22,stage_status,interrupted_stage,last_heartbeat_at",
        )
        .eq("is_preflight_test", false)
        .order("updated_at", { ascending: false })
        .limit(500),
      supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from("brand_register_briefings" as any)
        .select(
          "id,brand_name,category,status,updated_at,created_at,has_diagnosis,has_truths,has_relevance,has_tensions,selected_tension_index",
        )
        .order("updated_at", { ascending: false })
        .limit(500),
      supabase
        .from("saved_briefs")
        .select("brief_id,brand_name,created_at")
        .order("created_at", { ascending: false })
        .limit(500),
      // Best-effort: intelligence_sessions ships with the Intelligence Engine.
      // If the table is absent we treat the system as not-started for every brand.
      (async () => {
        try {
          const res = await supabase
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .from("intelligence_sessions" as any)
            .select(
              "id,brand_name,category,status,created_at,updated_at",
            )

            .order("updated_at", { ascending: false })
            .limit(500);
          return res as { data: IntelligenceRow[] | null; error: unknown };
        } catch {
          return { data: [] as IntelligenceRow[], error: null };
        }
      })(),
    ]);

    if (sessionsRes.error) {
      setError(sessionsRes.error.message);
    }

    const sessions = (sessionsRes.data ?? []) as unknown as SessionRow[];
    const workspaces = (workspacesRes.data ?? []) as unknown as WorkspaceRow[];
    const savedBriefs = (briefsRes.data ?? []) as SavedBriefRow[];
    const intelligence = ((intelRes as { data: IntelligenceRow[] | null }).data ??
      []) as IntelligenceRow[];

    setRows(assemble({ sessions, workspaces, savedBriefs, intelligence }));
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    void load().catch((e) => {
      if (!active) return;
      setError(e instanceof Error ? e.message : String(e));
      setLoading(false);
    });

    const channel = supabase
      .channel("brand-register")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sessions" },
        () => {
          if (active) void load();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "briefing_room_workspaces" },
        () => {
          if (active) void load();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "saved_briefs" },
        () => {
          if (active) void load();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "intelligence_sessions" },
        () => {
          if (active) void load();
        },
      )
      .subscribe();


    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [load]);

  return useMemo(
    () => ({ rows, loading, error, refresh: load }),
    [rows, loading, error, load],
  );
}

// ─── Small formatting helpers reused by the UI ─────────────────────

export function formatRelative(iso: string): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then) || then <= 0) return "—";
  const diff = Date.now() - then;
  const sec = Math.round(diff / 1000);
  if (sec < 45) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day} day${day === 1 ? "" : "s"} ago`;
  const mo = Math.round(day / 30);
  if (mo < 12) return `${mo} month${mo === 1 ? "" : "s"} ago`;
  const yr = Math.round(mo / 12);
  return `${yr} year${yr === 1 ? "" : "s"} ago`;
}

export function formatAbsolute(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t) || t <= 0) return "";
  return new Date(t).toLocaleString();
}
