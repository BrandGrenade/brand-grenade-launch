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
  | "phase_2";

export type SystemState = "not_started" | "in_progress" | "complete";

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
  /** ISO — most recent activity across all systems. */
  lastUpdated: string;
  /** All historical runs, newest first. */
  runs: BrandRun[];
  /** Sessions belonging to this brand (used by "Delete brand"). */
  sessionIds: string[];
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

type SessionRow = {
  id: string;
  brand_name: string | null;
  category: string | null;
  status: string | null;
  current_stage: number | null;
  created_at: string;
  updated_at: string;
  stage_1_output: string | null;
  stage_16_consulting_output: string | null;
  phase_2_status: string | null;
  stage_17_output: string | null;
  stage_22_output: string | null;
};

type WorkspaceRow = {
  id: string;
  brand_name: string | null;
  category: string | null;
  status: string | null;
  updated_at: string;
  created_at: string;
  diagnosis: unknown | null;
  truths: unknown | null;
  relevance: unknown | null;
  tensions: unknown | null;
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


// ─── Per-system derivation ─────────────────────────────────────────

function derivePipeline(sessions: SessionRow[]): SystemStatus {
  if (sessions.length === 0) return { ...EMPTY_STATUS };
  const latest = sessions[0]!;
  const complete =
    latest.status === "complete" || latest.stage_22_output != null;
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
      s.stage_22_output != null ||
      s.stage_17_output != null ||
      s.phase_2_status === "in_progress" ||
      s.phase_2_status === "complete",
  );
  const runCount = withPhase2.length;
  const latest = sessions[0]!;
  if (latest.stage_22_output != null || latest.phase_2_status === "complete") {
    return {
      state: "complete",
      label: null,
      timestamp: latest.updated_at,
      href: "/complete",
      hrefSearch: { session: latest.id },
      runCount: Math.max(runCount, 1),
    };
  }
  if (latest.stage_17_output != null || latest.phase_2_status === "in_progress") {
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

function briefingStep(w: WorkspaceRow): number {
  if (w.selected_tension_index != null) return 4;
  if (w.tensions != null) return 4;
  if (w.relevance != null) return 3;
  if (w.truths != null) return 2;
  if (w.diagnosis != null) return 1;
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
    return {
      state: "complete",
      label: null,
      timestamp: latest.updated_at,
      href: "/briefing-room/$id",
      hrefSearch: null,
      runCount: workspaces.length,
    };
  }
  const step = briefingStep(latest);
  return {
    state: "in_progress",
    label: `Step ${Math.max(step, 1)} of 4`,
    timestamp: null,
    href: "/briefing-room/$id",
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
    state: latest.status === "failed" ? "not_started" : "in_progress",
    label: latest.status === "failed" ? null : "Analysing",
    timestamp: null,
    href: null,
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
};

function assemble({
  sessions,
  workspaces,
  savedBriefs,
  intelligence,
}: Aggregated): BrandRow[] {
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
        s.stage_22_output != null || s.stage_16_consulting_output != null;
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
        href: pipelineComplete ? "/complete" : "/pipeline",
        hrefSearch: { session: s.id },
        downloadHref: null,
      });
      if (
        s.stage_22_output != null ||
        s.stage_17_output != null ||
        s.phase_2_status === "in_progress" ||
        s.phase_2_status === "complete"
      ) {
        const p2Complete =
          s.stage_22_output != null || s.phase_2_status === "complete";
        runs.push({
          id: `phase2:${s.id}`,
          system: "phase_2",
          date: s.updated_at,
          status: p2Complete ? "complete" : "in_progress",
          label: p2Complete ? "Phase 2 complete" : "Phase 2 running",
          href: p2Complete ? "/complete" : "/detonation",
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
        .from("sessions")
        .select(
          "id,brand_name,category,status,current_stage,created_at,updated_at,stage_1_output,stage_16_consulting_output,phase_2_status,stage_17_output,stage_22_output",
        )
        .eq("is_preflight_test", false)
        .order("updated_at", { ascending: false })
        .limit(500),
      supabase
        .from("briefing_room_workspaces")
        .select(
          "id,brand_name,category,status,updated_at,created_at,diagnosis,truths,relevance,tensions,selected_tension_index",
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

    const sessions = (sessionsRes.data ?? []) as SessionRow[];
    const workspaces = (workspacesRes.data ?? []) as WorkspaceRow[];
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
