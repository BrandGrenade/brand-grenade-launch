// CREATIVE ENGINE — the room. Full-page environment for the Creative Stimulus
// Engine, structurally equal to Intelligence Lab / Briefing Room / Pipeline.
// Reads a session's SMP and Channel Briefs as background input only.

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TopNav } from "@/components/TopNav";
import { CreativeStimulus } from "@/components/CreativeStimulus";
import { supabase } from "@/integrations/supabase/client";
import { LENS_COUNT } from "@/lib/stimulus/lenses";

const AMBER = "#E8A33D";
const MUTED = "#8A8680";

export const Route = createFileRoute("/creative/$sessionId")({
  component: CreativeRoom,
  head: () => ({
    meta: [
      { title: "Creative Engine Room — Brand Grenade" },
      {
        name: "description",
        content:
          "37 creative lenses, Tissue Check, Gate One rating, orchestration and Gate Two sign-off in one dedicated room.",
      },
      { property: "og:title", content: "Creative Engine Room — Brand Grenade" },
      {
        property: "og:description",
        content: "Raw creative stimulus, judged one idea at a time.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type SessionRow = {
  id: string;
  brand_name: string | null;
  selected_smp: string | null;
  stage_21_outputs: Record<string, string> | null;
};

function CreativeRoom() {
  const { sessionId } = Route.useParams();
  const [session, setSession] = useState<SessionRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [briefsOpen, setBriefsOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("sessions")
        .select("id, brand_name, selected_smp, stage_21_outputs")
        .eq("id", sessionId)
        .maybeSingle();
      if (cancelled) return;
      setSession((data as SessionRow | null) ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const channels = Object.keys(session?.stage_21_outputs ?? {});

  return (
    <>
      <TopNav />
      <main style={{ padding: "36px 24px 120px", backgroundColor: "#0B0B0B", minHeight: "100vh" }}>
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
          <Link
            to="/creative"
            className="text-mono"
            style={{ color: MUTED, fontSize: 11, textDecoration: "none", letterSpacing: "0.12em" }}
          >
            ← All sessions
          </Link>

          <div
            className="text-mono"
            style={{
              color: AMBER,
              fontSize: 11,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              marginTop: 22,
            }}
          >
            Creative Engine
          </div>
          <h1
            style={{
              color: "#F2EFE9",
              fontSize: 34,
              lineHeight: 1.15,
              margin: "10px 0 12px",
              fontWeight: 600,
            }}
          >
            {loading ? "Loading…" : session?.brand_name || "Untitled session"}
          </h1>
          <p className="text-body-sm" style={{ color: MUTED, maxWidth: 760, lineHeight: 1.7 }}>
            One channel brief, swept through all {LENS_COUNT} creative lenses, then handed to a human
            Tissue Check, Gate One rating, orchestration and Gate Two sign-off. Raw stimulus, not
            finished work.
          </p>

          {/* Background input — the session's strategy, collapsed by default. */}
          {!loading && session && (
            <div
              style={{
                marginTop: 26,
                border: "1px solid #232323",
                borderRadius: 12,
                backgroundColor: "#101010",
                padding: "18px 22px",
              }}
            >
              <div
                className="text-mono"
                style={{ color: MUTED, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase" }}
              >
                Background input
              </div>
              <div className="text-body-sm" style={{ color: "#E8E4DE", marginTop: 10, lineHeight: 1.7 }}>
                <strong style={{ color: AMBER }}>SMP:</strong>{" "}
                {session.selected_smp?.trim() || "— not selected"}
              </div>
              <button
                type="button"
                onClick={() => setBriefsOpen((v) => !v)}
                className="text-mono"
                style={{
                  marginTop: 12,
                  background: "none",
                  border: "1px solid #2A2A2A",
                  color: MUTED,
                  borderRadius: 6,
                  padding: "6px 12px",
                  fontSize: 10,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                }}
              >
                {channels.length} channel brief{channels.length === 1 ? "" : "s"} ·{" "}
                {briefsOpen ? "hide" : "view"}
              </button>
              {briefsOpen && (
                <div style={{ marginTop: 14, display: "grid", gap: 14 }}>
                  {channels.map((c) => (
                    <div key={c} style={{ borderTop: "1px solid #232323", paddingTop: 12 }}>
                      <div
                        className="text-mono"
                        style={{ color: AMBER, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}
                      >
                        {c}
                      </div>
                      <div
                        className="text-body-sm"
                        style={{ color: MUTED, marginTop: 8, whiteSpace: "pre-wrap", lineHeight: 1.7 }}
                      >
                        {session.stage_21_outputs?.[c]}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!loading && !session && (
            <div className="text-body-sm" style={{ color: "#E86A3D", marginTop: 24 }}>
              Session not found, or you don&apos;t have access to it.
            </div>
          )}
          {!loading && session && channels.length === 0 && (
            <div className="text-body-sm" style={{ color: "#E86A3D", marginTop: 24 }}>
              This session has no completed Channel Briefs yet — finish Stage 21 in the Strategy
              Pipeline before running the creative sweep.
            </div>
          )}
        </div>

        {!loading && session && channels.length > 0 && (
          <div style={{ maxWidth: 1180, margin: "36px auto 0" }}>
            <CreativeStimulus
              variant="page"
              sessionId={session.id}
              channels={channels}
              brandName={session.brand_name ?? ""}
            />
          </div>
        )}
      </main>
    </>
  );
}
