// CREATIVE ENGINE — the room shell. Three explicit steps, one per route:
//   /creative/$sessionId            → Step 1 · the 37-lens sweep
//   /creative/$sessionId/shortlist  → Step 2 · shortlist and lock the winner
//   /creative/$sessionId/channels   → Step 3 · channel briefs and export
// This file owns only the header, the background input, and the step nav.

import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TopNav } from "@/components/TopNav";
import { supabase } from "@/integrations/supabase/client";
import { LENS_COUNT } from "@/lib/stimulus/lenses";

const AMBER = "#F2665F";
const MUTED = "#A8A29A";
const PAPER = "#EDE8E0";

export const Route = createFileRoute("/creative/$sessionId")({
  component: CreativeRoom,
  head: () => ({
    meta: [
      { title: "Creative Engine Room — Brand Grenade" },
      {
        name: "description",
        content:
          "Three steps: run the 37-lens sweep, shortlist and lock one winning idea and line, then generate channel briefs and exports.",
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

export type CreativeSession = {
  id: string;
  brand_name: string | null;
  selected_smp: string | null;
  stage_21_outputs: Record<string, string> | null;
  locked_big_idea: string | null;
  locked_campaign_line: string | null;
  locked_big_idea_lens: string | null;
};

/** Every leaf step loads the session itself — one small read, no shared state. */
export function useCreativeSession(sessionId: string) {
  const [session, setSession] = useState<CreativeSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("sessions")
        .select(
          "id, brand_name, selected_smp, stage_21_outputs, locked_big_idea, locked_campaign_line, locked_big_idea_lens",
        )
        .eq("id", sessionId)
        .maybeSingle();
      if (cancelled) return;
      setSession((data as CreativeSession | null) ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return { session, loading };
}

function StepLink({
  to,
  sessionId,
  n,
  label,
  active,
}: {
  to: string;
  sessionId: string;
  n: number;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      to={to as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      params={{ sessionId } as any}
      className="text-mono"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        border: `1px solid ${active ? AMBER : "#2A2724"}`,
        backgroundColor: active ? `${AMBER}18` : "transparent",
        color: active ? AMBER : PAPER,
        borderRadius: 8,
        padding: "10px 16px",
        fontSize: 11,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        textDecoration: "none",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ fontSize: 15, opacity: active ? 1 : 0.7 }}>{n}</span>
      {label}
    </Link>
  );
}

function CreativeRoom() {
  const { sessionId } = Route.useParams();
  const { session, loading } = useCreativeSession(sessionId);
  const [briefsOpen, setBriefsOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const channels = Object.keys(session?.stage_21_outputs ?? {});
  const onShortlist = pathname.endsWith("/shortlist");
  const onChannels = pathname.endsWith("/channels");
  const onSweep = !onShortlist && !onChannels;

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
          <h1 style={{ color: PAPER, fontSize: 34, lineHeight: 1.15, margin: "10px 0 12px", fontWeight: 600 }}>
            {loading ? "Loading…" : session?.brand_name || "Untitled session"}
          </h1>
          <p className="text-body-sm" style={{ color: MUTED, maxWidth: 760, lineHeight: 1.7 }}>
            Three steps, in order. Sweep all {LENS_COUNT} lenses against the proposition, shortlist what
            survives and lock one winning idea and line, then generate the channel briefs from it.
          </p>

          {/* STEP NAV — always visible, on every step. */}
          <nav style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 24 }}>
            <StepLink to="/creative/$sessionId" sessionId={sessionId} n={1} label="Sweep" active={onSweep} />
            <StepLink
              to="/creative/$sessionId/shortlist"
              sessionId={sessionId}
              n={2}
              label="Shortlist & lock"
              active={onShortlist}
            />
            <StepLink
              to="/creative/$sessionId/channels"
              sessionId={sessionId}
              n={3}
              label="Channels & export"
              active={onChannels}
            />
          </nav>

          {/* Background input — the session's strategy, collapsed by default. */}
          {!loading && session && (
            <div
              style={{
                marginTop: 26,
                border: "1px solid #2A2724",
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
              <div className="text-body-sm" style={{ color: PAPER, marginTop: 10, lineHeight: 1.7 }}>
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
                  border: "1px solid #2A2724",
                  color: PAPER,
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
                    <div key={c} style={{ borderTop: "1px solid #2A2724", paddingTop: 12 }}>
                      <div
                        className="text-mono"
                        style={{ color: AMBER, fontSize: 13, textTransform: "uppercase", letterSpacing: "0.06em" }}
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
            <div className="text-body-sm" style={{ color: "#FF8F87", marginTop: 24 }}>
              Session not found, or you don&apos;t have access to it.
            </div>
          )}
        </div>

        <div style={{ maxWidth: 1180, margin: "40px auto 0" }}>
          <Outlet />
        </div>
      </main>
    </>
  );
}
