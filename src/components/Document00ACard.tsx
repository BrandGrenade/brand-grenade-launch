// Document 00A — Strategic Territory Intelligence Report card.
// Displayed at the top of the Deliverables panel. Two states based on
// whether the Intelligence Engine has been run for this brand.

import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { intelligenceSourceIdFromBrief } from "@/lib/document-source-authority";
import {
  openDocument00AMinto,
  type IntelligenceReport,
} from "@/lib/intelligence/doc-00A-minto";

type IntelSummary = {
  id: string;
  brandName: string;
  category: string;
  briefType: "commercial" | "government";
  completedAt: string | null;
  report: IntelligenceReport;
};

async function fetchLatestIntelligence(
  sourceId: string | null,
): Promise<IntelSummary | null> {
  if (!sourceId) return null;
  try {
    const res = await supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from("intelligence_sessions" as any)
      .select(
        "id,brand_name,category,status,updated_at,completed_at,final_report,report_metadata",
      )
      .eq("id", sourceId)
      .eq("status", "complete")
      .maybeSingle();
    if (res.error) return null;
    const match = res.data as unknown as {
      id: string;
      brand_name: string | null;
      category: string | null;
      status: string | null;
      updated_at: string | null;
      completed_at: string | null;
      final_report: string | null;
      report_metadata: unknown;
    } | null;
    if (!match || !match.final_report) return null;
    let report: IntelligenceReport | null = null;
    try {
      report = JSON.parse(match.final_report) as IntelligenceReport;
    } catch {
      return null;
    }
    const meta = match.report_metadata;
    const briefType =
      meta && typeof meta === "object" && !Array.isArray(meta) &&
      (meta as Record<string, unknown>).brief_type === "government"
        ? "government"
        : "commercial";
    return {
      id: match.id,
      brandName: match.brand_name || "Untitled Brand",
      category: match.category ?? "",
      briefType,
      completedAt: match.completed_at ?? match.updated_at,
      report,
    };
  } catch {
    return null;
  }
}

export function Document00ACard({
  brand,
  briefText,
}: {
  brand: string;
  briefText?: string | null;
}) {
  const [intel, setIntel] = useState<IntelSummary | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const sourceId = intelligenceSourceIdFromBrief(briefText);
    void fetchLatestIntelligence(sourceId).then((r) => {
      if (cancelled) return;
      setIntel(r);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [briefText]);

  const handleDownload = useCallback(async () => {
    if (!intel) return;
    setDownloading(true);
    try {
      openDocument00AMinto({
        sourceRunId: intel.id,
        brandName: intel.brandName,
        category: intel.category,
        briefType: intel.briefType,
        completedAt: intel.completedAt,
        report: intel.report,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "PDF generation failed");
    } finally {
      setDownloading(false);
    }
  }, [intel]);

  const amber = "#C81E1E";
  const complete = intel !== null;

  const wrapperStyle: React.CSSProperties = {
    padding: "16px 20px",
    borderRadius: 8,
    border: `1px solid ${complete ? amber + "55" : "var(--color-border)"}`,
    background: complete ? "var(--color-surface-2)" : "var(--color-surface-3)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 24,
    opacity: !loaded ? 0.6 : 1,
  };

  const label = "Document 00A — Strategic Territory Intelligence Report";

  if (complete) {
    return (
      <div style={wrapperStyle} data-doc="00A" data-state="complete">
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <span
            aria-hidden="true"
            style={{
              display: "inline-block",
              width: 10,
              height: 10,
              borderRadius: 10,
              background: "#C81E1E",
              flex: "none",
            }}
          />
          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <span
              className="text-body"
              style={{ color: "var(--color-text-primary)", fontWeight: 600 }}
            >
              {label}
            </span>
            <span
              className="text-body-sm"
              style={{ color: "#8B8680", fontSize: 13 }}
            >
              Intelligence Lab analysis complete for {brand}.
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          style={{
            height: 32,
            padding: "0 14px",
            borderRadius: 6,
            border: `1px solid ${amber}`,
            background: "transparent",
            color: amber,
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            cursor: downloading ? "wait" : "pointer",
            whiteSpace: "nowrap",
            opacity: downloading ? 0.6 : 1,
          }}
        >
          {downloading ? "Building…" : "Open ↗"}
        </button>
      </div>
    );
  }

  return (
    <div style={wrapperStyle} data-doc="00A" data-state="not_run">
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <span
          aria-hidden="true"
          style={{
            display: "inline-block",
            width: 10,
            height: 10,
            borderRadius: 10,
            border: "1.5px solid var(--color-border-strong)",
            flex: "none",
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <span
            className="text-body"
            style={{ color: "var(--color-text-tertiary)", fontWeight: 600 }}
          >
            {label}
          </span>
          <span
            className="text-body-sm"
            style={{ color: "#8B8680", fontSize: 13 }}
          >
            Intelligence Lab not run for this brand.
          </span>
        </div>
      </div>
      <Link
        to="/intelligence/new"
        search={{ brand }}
        style={{
          color: amber,
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: "0.06em",
          whiteSpace: "nowrap",
        }}
      >
        Start Intelligence Lab →
      </Link>
    </div>
  );
}
