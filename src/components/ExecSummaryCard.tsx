// Strategy Executive Summary card — Deliverables page.
// On-demand synthesis of already-stored session data. No pipeline run.

import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
  openExecSummaryDocument,
  type ExecSummarySession,
} from "@/lib/exec-summary-document";
import { fetchExecSummaryIntel } from "@/lib/exec-summary-intel";

export function ExecSummaryCard({ session }: { session: ExecSummarySession }) {
  const [busy, setBusy] = useState(false);
  const amber = "#C81E1E";
  const brand = session.brand_name ?? "Untitled Brand";
  const ready = Boolean(session.selected_smp && session.selected_smp.trim());

  const handleGenerate = useCallback(async () => {
    setBusy(true);
    try {
      const intel = await fetchExecSummaryIntel(brand);
      openExecSummaryDocument(session, intel);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not build the summary");
    } finally {
      setBusy(false);
    }
  }, [brand, session]);

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
          Strategy Executive Summary
        </span>
        <span className="text-body-sm" style={{ color: "#8B8680", fontSize: 13 }}>
          {ready
            ? "Nine-section board summary, assembled from this session's stored data."
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
        {busy ? "Building…" : "Generate Executive Summary"}
      </button>
    </div>
  );
}
