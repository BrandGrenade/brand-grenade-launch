// Strategy Executive Summary card — Deliverables page.
// On-demand synthesis of already-stored session data. No pipeline run.

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { ExecSummarySession } from "@/lib/exec-summary-sections";
import { Spinner } from "@/components/ui/busy";
import { resolveLiveDocumentSession } from "@/lib/document-live-source";
import { buildSummaryDocument } from "@/lib/summary-document";
import { fetchSummaryExtras } from "@/lib/summary-data";

/** Columns the summary needs that the Deliverables page does not already load. */
const EXTRA_COLUMNS =
  "brief_text, stage_2_output, stage_3_output, stage_4_output, loc_engine_outputs, loc_status, loc_decision_packages, stage_22_output, stage_22_brand_architecture, stage_22_distinctive_assets, locked_big_idea_run_id, locked_big_idea, locked_campaign_line, locked_big_idea_lens, locked_big_idea_at, selection_rationale, updated_at";

export function ExecSummaryCard({ session }: { session: ExecSummarySession }) {
  const [busy, setBusy] = useState(false);
  const amber = "#C81E1E";
  const ready = Boolean(session.selected_smp && session.selected_smp.trim());

  const handleGenerate = useCallback(async () => {
    setBusy(true);
    try {
      const extra = await (async () => {
          const id = (session as { id?: string }).id;
          if (!id) return {};
          const res = await supabase
            .from("sessions")
            .select(EXTRA_COLUMNS)
            .eq("id", id)
            .maybeSingle();
          return (res.data as Record<string, unknown> | null) ?? {};
        })();
      const live = await resolveLiveDocumentSession({ ...session, ...extra });
      // One builder, one 21-section spec, every session.
      const extras = await fetchSummaryExtras(live);
      const html = buildSummaryDocument(live, extras);
      const win = window.open("", "_blank");
      if (!win) throw new Error("Please allow popups to open the summary");
      win.document.open("text/html");
      win.document.write(html);
      win.document.close();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not build the summary");
    } finally {
      setBusy(false);
    }
  }, [session]);


  return (
    <div
      data-doc="exec-summary"
      style={{
        padding: "16px 20px",
        borderRadius: 8,
        border: `1px solid ${ready ? amber + "55" : "var(--color-border)"}`,
        background: ready ? "var(--color-surface-2)" : "var(--color-surface-3)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        marginBottom: 24,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <span
          className="text-body"
          style={{
            color: ready
              ? "var(--color-text-primary)"
              : "var(--color-text-tertiary)",
            fontWeight: 600,
          }}
        >
          Brand Strategy and Creative Intelligence Summary
        </span>
        <span className="text-body-sm" style={{ color: "#8B8680", fontSize: 13 }}>
          {ready
            ? session.id === JAGUAR_REBUILD_SESSION_ID
              ? "Rebuilt 21-section Jaguar summary, assembled live from this session's stored data."
              : "Ten-section quick-scan companion to Consulting Delivery, assembled from this session's stored data."
            : "Available once a proposition has been selected for this session."}
        </span>
      </div>
      <button
        type="button"
        onClick={handleGenerate}
        disabled={busy || !ready}
        style={{
          height: 32,
          padding: "0 14px",
          borderRadius: 6,
          border: `1px solid ${ready ? amber : "var(--color-border-strong)"}`,
          background: "transparent",
          color: ready ? amber : "var(--color-text-tertiary)",
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          cursor: !ready ? "not-allowed" : busy ? "wait" : "pointer",
          whiteSpace: "nowrap",
          opacity: busy ? 0.6 : 1,
        }}
      >
        {busy ? <><Spinner /> Building…</> : "Generate Summary"}
      </button>
    </div>
  );
}
