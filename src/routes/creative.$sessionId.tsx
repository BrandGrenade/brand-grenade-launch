// CREATIVE ENGINE — the room. Full-page environment for the Creative Stimulus
// Engine, structurally equal to Intelligence Lab / Briefing Room / Pipeline.
// Reads a session's SMP and Channel Briefs as background input only.

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TopNav } from "@/components/TopNav";
import { CreativeStimulus } from "@/components/CreativeStimulus";
import { BigIdeaSweep } from "@/components/BigIdeaSweep";
import { supabase } from "@/integrations/supabase/client";
import { LENS_COUNT } from "@/lib/stimulus/lenses";

const AMBER = "#C81E1E";
const MUTED = "#8B8680";

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
  locked_big_idea: string | null;
  locked_campaign_line: string | null;
  locked_big_idea_lens: string | null;
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
        .select("id, brand_name, selected_smp, stage_21_outputs, locked_big_idea, locked_campaign_line, locked_big_idea_lens")
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
      <main style={{ padding: "36px 24px 120px", backgroundColor: "#0A0908", minHeight: "100vh" }}>
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
              color: "#EDE8E0",
              fontSize: 34,
              lineHeight: 1.15,
              margin: "10px 0 12px",
              fontWeight: 600,
            }}
          >
            {loading ? "Loading…" : session?.brand_name || "Untitled session"}
          </h1>
          <p className="text-body-sm" style={{ color: MUTED, maxWidth: 760, lineHeight: 1.7 }}>
            One sweep of all {LENS_COUNT} creative lenses against the proposition itself — before any
            channel brief exists — then Tissue Check, Gate One rating, and one winning idea and line
            locked. Channel work adapts that locked idea; it never reinterprets the proposition.
          </p>

          {/* Background input — the session's strategy, collapsed by default. */}
          {!loading && session && (
            <div
              style={{
                marginTop: 26,
                border: "1px solid #1C1A18",
                borderRadius: 12,
                backgroundColor: "#0A0908",
                padding: "18px 22px",
              }}
            >
              <div
                className="text-mono"
                style={{ color: MUTED, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase" }}
              >
                Background input
              </div>
              <div className="text-body-sm" style={{ color: "#EDE8E0", marginTop: 10, lineHeight: 1.7 }}>
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
                  border: "1px solid #1C1A18",
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
                    <div key={c} style={{ borderTop: "1px solid #1C1A18", paddingTop: 12 }}>
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
            <div className="text-body-sm" style={{ color: "#C81E1E", marginTop: 24 }}>
              Session not found, or you don&apos;t have access to it.
            </div>
          )}

        </div>

        {!loading && session && (
          <div style={{ maxWidth: 1180, margin: "36px auto 0" }}>
            <BigIdeaSweep sessionId={session.id} />
          </div>
        )}

        {!loading && session && (
          <div style={{ maxWidth: 1180, margin: "56px auto 0" }}>
            <div style={{ maxWidth: 980, margin: "0 auto" }}>
              <div
                className="text-mono"
                style={{ color: AMBER, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase" }}
              >
                Step 2 · Channel cascade
              </div>
              <p className="text-body-sm" style={{ color: MUTED, marginTop: 8, lineHeight: 1.7 }}>
                {session.locked_big_idea
                  ? `Channel briefs now adapt the locked idea (${session.locked_big_idea_lens ?? "—"}) and line "${session.locked_campaign_line ?? ""}". Regenerate Stage 21 in the Strategy Pipeline to cascade it.`
                  : "Lock a winning idea and line above before generating channel briefs — a channel brief written first is exactly how the proposition gets reinterpreted."}
              </p>
              {channels.length === 0 && (
                <div className="text-body-sm" style={{ color: "#C81E1E", marginTop: 14 }}>
                  No Channel Briefs generated yet — run Stage 21 in the Strategy Pipeline once the idea
                  is locked.
                </div>
              )}
            </div>
            {channels.length > 0 && (
              <CreativeStimulus
                variant="page"
                sessionId={session.id}
                channels={channels}
                brandName={session.brand_name ?? ""}
              />
            )}
          </div>
        )}
      </main>
    </>
  );
}
