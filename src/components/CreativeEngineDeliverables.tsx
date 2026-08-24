// CREATIVE ENGINE (ROOM 04) — deliverables entries.
//
// The Deliverables page is the single compilation of everything a session
// produces. Room 04's outputs — the 37-lens sweep, the Gate One shortlist and
// the Gate Two-approved, tool-specific paste-ready prompt set produced by the
// Orchestration Engine — are surfaced here, not only inside the Creative
// Engine screens. Every export resolves its source records at click time.

import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  getFullFinishedExport,
  getRawIdeaExportBatch,
} from "@/lib/stimulus-gate-two.functions";
import {
  buildFullFinishedExport,
  buildRawIdeaBatchExport,
  download,
  openPrintable,
  type RawIdeaBatchExport,
} from "@/lib/stimulus-export";
import { Spinner } from "@/components/ui/busy";

const AMBER = "#C81E1E";

type State = {
  orchestrationId: string | null;
  orchestrationLabel: string;
  sweepIds: string[];
  shortlistIds: string[];
};

export function CreativeEngineDeliverables({
  sessionId,
  subhead,
}: {
  sessionId: string;
  subhead: (label: string) => React.ReactNode;
}) {
  const [state, setState] = useState<State>({
    orchestrationId: null,
    orchestrationLabel: "",
    sweepIds: [],
    shortlistIds: [],
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const fullExport = useServerFn(getFullFinishedExport);
  const batchExport = useServerFn(getRawIdeaExportBatch);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Orchestration: prefer the Gate Two-confirmed run, else the newest
      // complete one. Never a run that is still generating.
      const { data: orchs } = await supabase
        .from("stimulus_orchestrations")
        .select("id, status, gate_two_confirmed, gate_two_confirmed_at, updated_at, registry_version")
        .eq("session_id", sessionId)
        .order("updated_at", { ascending: false });
      const rows = orchs ?? [];
      const chosen =
        rows.find((r) => r.gate_two_confirmed) ??
        rows.find((r) => r.status === "complete") ??
        null;

      // Sweep + shortlist directions for the big-idea runs of this session.
      const { data: runs } = await supabase
        .from("stimulus_runs")
        .select("id, run_mode, created_at")
        .eq("session_id", sessionId)
        .eq("run_mode", "big_idea")
        .order("created_at", { ascending: false });
      const runIds = (runs ?? []).map((r) => r.id);
      let sweepIds: string[] = [];
      let shortlistIds: string[] = [];
      if (runIds.length) {
        const { data: dirs } = await supabase
          .from("stimulus_directions")
          .select("id, sort_order, gate_one_approved, direction")
          .in("run_id", runIds)
          .order("sort_order", { ascending: true });
        const all = (dirs ?? []).filter((d) => (d.direction ?? "").trim().length > 0);
        sweepIds = all.slice(0, 40).map((d) => d.id);
        shortlistIds = all
          .filter((d) => d.gate_one_approved)
          .slice(0, 40)
          .map((d) => d.id);
      }

      if (cancelled) return;
      setState({
        orchestrationId: chosen?.id ?? null,
        orchestrationLabel: chosen
          ? chosen.gate_two_confirmed
            ? `Gate Two confirmed${chosen.gate_two_confirmed_at ? ` ${new Date(chosen.gate_two_confirmed_at).toLocaleString("en-AU")}` : ""} · registry v${chosen.registry_version}`
            : `Complete run · registry v${chosen.registry_version}`
          : "",
        sweepIds,
        shortlistIds,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const nothing =
    !state.orchestrationId && state.sweepIds.length === 0 && state.shortlistIds.length === 0;
  if (nothing) return null;

  const runOrchestration = async (mode: "download" | "print") => {
    if (!state.orchestrationId) return;
    setBusy(`orch-${mode}`);
    setErr(null);
    try {
      const data = await fullExport({ data: { orchestrationId: state.orchestrationId } });
      const { filename, html } = buildFullFinishedExport(data);
      if (mode === "download") download(filename, html);
      else openPrintable(html);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Orchestration export failed");
    } finally {
      setBusy(null);
    }
  };

  const runBatch = async (key: string, ids: string[]) => {
    if (ids.length === 0) return;
    setBusy(key);
    setErr(null);
    try {
      const data = (await batchExport({
        data: { directionIds: ids },
      })) as unknown as RawIdeaBatchExport;
      const { filename, html } = buildRawIdeaBatchExport(data);
      download(filename, html);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(null);
    }
  };

  const Card = ({
    title,
    note,
    onClick,
    busyKey,
    action = "Download ↓",
  }: {
    title: string;
    note: string;
    onClick: () => void;
    busyKey: string;
    action?: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={busy !== null}
      style={{
        textAlign: "left",
        padding: "14px 16px",
        borderRadius: 8,
        background: "var(--color-surface-2)",
        border: `1px solid ${AMBER}33`,
        color: "var(--color-text-primary)",
        cursor: busy ? "progress" : "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <span className="text-body" style={{ fontWeight: 600 }}>
        {title}
      </span>
      <span className="text-body-sm" style={{ color: "#8B8680" }}>
        {note}
      </span>
      <span
        className="text-mono"
        style={{
          marginTop: 6,
          color: AMBER,
          fontSize: 9,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
        }}
      >
        {busy === busyKey ? (
          <>
            <Spinner /> Building…
          </>
        ) : (
          action
        )}
      </span>
    </button>
  );

  return (
    <div id="creative-engine">
      {subhead("Creative Stimulus Engine — Room 04")}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: 12,
        }}
      >
        {state.orchestrationId && (
          <>
            <Card
              title="Orchestration Prompt Set"
              note={`Tool-specific, paste-ready MarTech prompts, Gate Two decision record, signature registry and cross-references. ${state.orchestrationLabel}`}
              busyKey="orch-download"
              onClick={() => void runOrchestration("download")}
            />
            <Card
              title="Orchestration Prompt Set — present"
              note="Same prompt set opened for screen presentation or print to PDF"
              busyKey="orch-print"
              action="Open / print ↗"
              onClick={() => void runOrchestration("print")}
            />
          </>
        )}
        {state.sweepIds.length > 0 && (
          <Card
            title="37-Lens Sweep — raw ideas"
            note={`Every generated lens direction with its rating snapshot (${state.sweepIds.length} lenses)`}
            busyKey="sweep"
            onClick={() => void runBatch("sweep", state.sweepIds)}
          />
        )}
        {state.shortlistIds.length > 0 && (
          <Card
            title="Shortlist — Gate One approved"
            note={`The ideas taken through Gate One, with ratings and approval notes (${state.shortlistIds.length})`}
            busyKey="shortlist"
            onClick={() => void runBatch("shortlist", state.shortlistIds)}
          />
        )}
      </div>
      {err && <div style={{ marginTop: 8, fontSize: 13, color: "#E5484D" }}>{err}</div>}
    </div>
  );
}
