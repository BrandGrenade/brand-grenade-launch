// Research provenance — surfaces the Research Synthesiser run behind a session's
// intelligence on the Deliverables page. Before this existed, Deliverables gave
// no signal that Room 00 had run at all, so an applied run (e.g. Jaguar,
// 584d3f8c, 166 claims) read as "never happened".
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

type RunRow = {
  id: string;
  status: string | null;
  claim_count: number | null;
  brand_name: string | null;
  applied_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

const normalise = (v: string | null | undefined) =>
  (v ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

export function ResearchProvenanceCard({ brand }: { brand: string }) {
  const [state, setState] = useState<"loading" | "ready">("loading");
  const [run, setRun] = useState<RunRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("synthesiser_runs")
        .select("id,status,claim_count,brand_name,applied_at,created_at,updated_at")
        .order("updated_at", { ascending: false })
        .limit(50);
      if (cancelled) return;
      const rows = (data ?? []) as RunRow[];
      const target = normalise(brand);
      const matched =
        rows.find((r) => normalise(r.brand_name) === target) ??
        rows.find(
          (r) =>
            target.length > 2 &&
            (normalise(r.brand_name).includes(target) ||
              target.includes(normalise(r.brand_name))),
        ) ??
        null;
      setRun(matched);
      setState("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, [brand]);

  if (state === "loading") return null;

  const applied = run?.status === "applied";
  const when = run?.applied_at ?? run?.updated_at ?? run?.created_at ?? null;

  return (
    <div
      style={{
        border: "1px solid var(--color-border, rgba(237,232,224,0.12))",
        borderRadius: 8,
        padding: "20px 24px",
        marginBottom: 24,
        background: "var(--color-surface-raised, #1C1A18)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <span className="text-label text-text-secondary">RESEARCH PROVENANCE</span>
        <span
          className="text-body-sm"
          style={{ color: applied ? "var(--color-text-primary)" : "#8B8680" }}
        >
          {run
            ? applied
              ? `Synthesiser applied${run.claim_count ? ` · ${run.claim_count} claims` : ""}`
              : `Synthesiser ${run.status ?? "in progress"}`
            : "Synthesiser not used for this brand"}
        </span>
      </div>

      <p className="text-body" style={{ color: "var(--color-text-secondary)", margin: "12px 0 0" }}>
        {run
          ? applied
            ? `Uploaded research for ${run.brand_name ?? brand} was classified, verified and applied to the Intelligence Lab${
                when ? ` on ${new Date(when).toLocaleDateString()}` : ""
              }. Every claim carries its source document and verification status.`
            : `A Research Synthesiser run exists for ${run.brand_name ?? brand} but has not been applied to the Intelligence Lab. Open Room 00 to review it.`
          : "This session's intelligence was entered directly in the Intelligence Lab rather than through the Research Synthesiser."}
      </p>

      {run && (
        <p className="text-body-sm" style={{ color: "#8B8680", margin: "8px 0 0" }}>
          Run {run.id.slice(0, 8)}
        </p>
      )}

      <div style={{ marginTop: 16 }}>
        <Link
          to="/synthesiser"
          search={{ brand: run?.brand_name ?? brand }}
          className="text-body-sm"
          style={{ color: "var(--color-accent, #C81E1E)", textDecoration: "none" }}
        >
          {run ? "View Research Synthesiser →" : "Open Research Synthesiser →"}
        </Link>
      </div>
    </div>
  );
}
