// Document 00A — Strategic Territory Intelligence Report card.
// Displayed at the top of the Deliverables panel. Two states based on
// whether the Intelligence Engine has been run for this brand.
// UI-only: no server functions, no schema changes.

import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { normalizeBrand } from "@/lib/brand-register";

type IntelSummary = {
  status: string | null;
  updatedAt: string | null;
};

async function fetchLatestIntelligence(
  brand: string,
): Promise<IntelSummary | null> {
  const key = normalizeBrand(brand);
  if (!key) return null;
  try {
    // Best-effort — the intelligence_sessions table ships with the
    // Intelligence Engine. If it doesn't exist yet, this returns an
    // error and we treat the brand as having no completed run.
    const res = await supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from("intelligence_sessions" as any)
      .select("brand_name,status,updated_at")
      .order("updated_at", { ascending: false })
      .limit(500);
    if (res.error) return null;
    const rows = (res.data ?? []) as Array<{
      brand_name: string | null;
      status: string | null;
      updated_at: string | null;
    }>;
    const match = rows.find(
      (r) => normalizeBrand(r.brand_name) === key && r.status === "complete",
    );
    if (!match) return null;
    return { status: match.status, updatedAt: match.updated_at };
  } catch {
    return null;
  }
}

export function Document00ACard({ brand }: { brand: string }) {
  const [intel, setIntel] = useState<IntelSummary | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchLatestIntelligence(brand).then((r) => {
      if (cancelled) return;
      setIntel(r);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [brand]);

  const amber = "#D4924A";
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
              background: "#4A7C59",
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
              style={{ color: "#8A8680", fontSize: 12 }}
            >
              Intelligence Engine run complete for {brand}.
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() =>
            toast.info(
              "PDF download available when Intelligence Engine ships.",
            )
          }
          style={{
            height: 32,
            padding: "0 14px",
            borderRadius: 6,
            border: `1px solid ${amber}`,
            background: "transparent",
            color: amber,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          Download ↓
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
            style={{ color: "#5A5652", fontSize: 12 }}
          >
            Intelligence Engine not run for this brand.
          </span>
        </div>
      </div>
      <Link
        to="/intelligence/new"
        search={{ brand }}
        style={{
          color: amber,
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: "0.06em",
          whiteSpace: "nowrap",
        }}
      >
        Run Intelligence Engine →
      </Link>
    </div>
  );
}
