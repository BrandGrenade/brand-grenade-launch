// CREATIVE ENGINE — room index. Picks the session whose completed SMP and
// Channel Briefs the Creative Stimulus Engine will read as background input.

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TopNav } from "@/components/TopNav";
import { supabase } from "@/integrations/supabase/client";

const AMBER = "#C81E1E";
const MUTED = "#8B8680";

export const Route = createFileRoute("/creative/")({
  component: CreativeIndex,
  head: () => ({
    meta: [
      { title: "Creative Engine — Brand Grenade" },
      {
        name: "description",
        content:
          "Sweep a channel brief through 37 creative lenses, then run Tissue Check, Gate One, orchestration and Gate Two.",
      },
      { property: "og:title", content: "Creative Engine — Brand Grenade" },
      {
        property: "og:description",
        content: "Raw creative stimulus, judged one idea at a time.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Row = {
  id: string;
  brand_name: string | null;
  updated_at: string | null;
  channels: number;
  hasCreative: boolean;
};

function CreativeIndex() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Same rule as the dashboard's Creative Engine column: every session
      // the user can reach has a creative room, whether or not Stage 21 has
      // produced channel briefs yet. Filtering on stage_21_outputs here made
      // brands linked from the dashboard disappear from "All sessions".
      const [{ data: sessions }, { data: runs }] = await Promise.all([
        supabase
          .from("sessions")
          .select("id, brand_name, updated_at, stage_21_outputs")
          .order("updated_at", { ascending: false })
          .limit(100),
        supabase.from("stimulus_runs").select("session_id"),
      ]);

      if (cancelled) return;
      const withRuns = new Set((runs ?? []).map((r) => r.session_id));
      setRows(
        (sessions ?? []).map((s) => ({
          id: s.id,
          brand_name: s.brand_name,
          updated_at: s.updated_at,
          channels: Object.keys(
            (s.stage_21_outputs as Record<string, string> | null) ?? {},
          ).length,
          hasCreative: withRuns.has(s.id),
        })),
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <TopNav />
      <main style={{ maxWidth: 980, margin: "0 auto", padding: "40px 24px 96px" }}>
        <div
          className="text-mono"
          style={{ color: AMBER, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase" }}
        >
          Creative Engine
        </div>
        <h1
          style={{
            color: "#EDE8E0",
            fontSize: 34,
            lineHeight: 1.15,
            margin: "12px 0 10px",
            fontWeight: 600,
          }}
        >
          The room where raw stimulus gets made and judged
        </h1>
        <p className="text-body-sm" style={{ color: MUTED, maxWidth: 720, lineHeight: 1.7 }}>
          Pick the strategy run this creative work answers to. The engine reads that session&apos;s
          validated proposition and channel briefs as background input — everything after that
          happens here.
        </p>

        <div style={{ marginTop: 32, display: "grid", gap: 16 }}>
          {loading && (
            <div className="text-body-sm" style={{ color: MUTED }}>
              Loading sessions…
            </div>
          )}
          {!loading && rows.length === 0 && (
            <div className="text-body-sm" style={{ color: MUTED }}>
              No session has completed Channel Briefs yet. Finish Stage 21 in the Strategy Pipeline
              first.
            </div>
          )}
          {rows.map((r) => (
            <Link
              key={r.id}
              to="/creative/$sessionId"
              params={{ sessionId: r.id }}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 20,
                textDecoration: "none",
                backgroundColor: "#0A0908",
                border: `1px solid ${r.hasCreative ? AMBER + "55" : "#1C1A18"}`,
                borderRadius: 12,
                padding: "22px 26px",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ color: "#EDE8E0", fontSize: 18, fontWeight: 600 }}>
                  {r.brand_name || "Untitled session"}
                </div>
                <div className="text-mono" style={{ color: MUTED, fontSize: 11, marginTop: 6 }}>
                  {r.channels} channel brief{r.channels === 1 ? "" : "s"} ·{" "}
                  {r.hasCreative ? "creative work in progress" : "not started"}
                  {r.updated_at ? ` · ${new Date(r.updated_at).toLocaleDateString()}` : ""}
                </div>
              </div>
              <span className="text-mono" style={{ color: AMBER, fontSize: 11, whiteSpace: "nowrap" }}>
                {r.hasCreative ? "Open →" : "Start →"}
              </span>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}
