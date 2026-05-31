import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { TopNav } from "@/components/TopNav";
import { BrandGrenadeIcon } from "@/components/BrandGrenadeIcon";
import { SMPAnchor } from "@/components/SMPAnchor";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { PHASE_2_STAGES, PHASE_2_AMBER } from "@/lib/phase2-stages";

const detonationSearchSchema = z.object({
  session: z.string().uuid().optional(),
});

export const Route = createFileRoute("/detonation")({
  validateSearch: detonationSearchSchema,
  component: DetonationPage,
  head: () => ({
    meta: [
      { title: "Brand Detonation — Brand Grenade" },
      {
        name: "description",
        content:
          "Phase 2 of the Brand Grenade pipeline. Turn your validated brand strategy into a Master Detonation Brief.",
      },
    ],
  }),
});

type SessionRow = {
  id: string;
  brand_name: string | null;
  selected_smp: string | null;
  user_id: string | null;
  phase_2_status: string | null;
  phase_2_current_stage: number | null;
  doc_consulting_url: string | null;
  doc_agency_url: string | null;
  doc_workshop_url: string | null;
  checkpoint_a_confirmed: boolean | null;
  checkpoint_b_confirmed: boolean | null;
  checkpoint_c_confirmed: boolean | null;
};

function DetonationPage() {
  const { session: sessionId } = Route.useSearch();
  const { user, isAuthReady } = useAuth();
  const [session, setSession] = useState<SessionRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    supabase
      .from("sessions")
      .select(
        "id, brand_name, selected_smp, user_id, phase_2_status, phase_2_current_stage, doc_consulting_url, doc_agency_url, doc_workshop_url, checkpoint_a_confirmed, checkpoint_b_confirmed, checkpoint_c_confirmed",
      )
      .eq("id", sessionId)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) setError(err.message);
        setSession((data as SessionRow) ?? null);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  // Flip status to in_progress on first owner visit, once Phase 1 docs are ready.
  useEffect(() => {
    if (!isAuthReady || !user || !session) return;
    if (session.user_id !== user.id) return;
    const docsReady = Boolean(
      session.doc_consulting_url &&
        session.doc_agency_url &&
        session.doc_workshop_url,
    );
    if (!docsReady) return;
    if (session.phase_2_status === "not_started" || session.phase_2_status == null) {
      supabase
        .from("sessions")
        .update({ phase_2_status: "in_progress" })
        .eq("id", session.id)
        .then(({ error: upErr }) => {
          if (upErr) console.error("Failed to start Phase 2", upErr);
          else
            setSession((prev) =>
              prev ? { ...prev, phase_2_status: "in_progress" } : prev,
            );
        });
    }
  }, [isAuthReady, user, session]);

  const brand = session?.brand_name ?? "Untitled Brand";
  const smp = session?.selected_smp ?? "";
  const isOwner = Boolean(user && session?.user_id && user.id === session.user_id);
  const docsReady = Boolean(
    session?.doc_consulting_url &&
      session?.doc_agency_url &&
      session?.doc_workshop_url,
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopNav session={{ brand, currentStage: 0, totalStages: 22, isRunning: false }} />
      <div className="flex items-center border-b border-border bg-background px-5 py-3 sm:px-8">
        <nav
          className="text-body-sm flex items-center gap-1.5 truncate"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          <Link to="/dashboard" className="transition-colors hover:text-text-secondary">
            Sessions
          </Link>
          <span>→</span>
          <span className="text-text-secondary truncate">{brand}</span>
          <span>→</span>
          <span>Brand Detonation</span>
        </nav>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Left panel — permanent SMP anchor + stage list area */}
        <aside
          className="hidden md:flex w-[280px] shrink-0 flex-col border-r border-border bg-background"
          style={{ position: "sticky", top: 0, alignSelf: "flex-start", maxHeight: "100vh" }}
        >
          {/* SMP anchor — pinned, never scrolls, cannot collapse */}
          <div style={{ flexShrink: 0 }}>
            <SMPAnchor
              smp={session?.selected_smp ?? ""}
              truths={[
                Boolean(session?.checkpoint_a_confirmed),
                Boolean(session?.checkpoint_b_confirmed),
                Boolean(session?.checkpoint_c_confirmed),
              ]}
            />
          </div>
          {/* Stage list */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 12px" }}>
            <div
              className="text-label"
              style={{
                color: PHASE_2_AMBER,
                letterSpacing: "0.18em",
                fontFamily: "'DM Mono', monospace",
                fontSize: 7,
                textTransform: "uppercase",
                padding: "0 8px 12px",
              }}
            >
              STAGES
            </div>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 2 }}>
              {PHASE_2_STAGES.map((stage) => {
                const current = session?.phase_2_current_stage ?? 0;
                const stageNum = parseInt(stage.number, 10);
                const isActive = current === stageNum || (stage.number === "17B" && current === 17);
                return (
                  <li key={stage.id}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px 10px",
                        borderRadius: 6,
                        backgroundColor: isActive ? "rgba(212,146,74,0.08)" : "transparent",
                        borderLeft: `2px solid ${isActive ? PHASE_2_AMBER : "transparent"}`,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "'DM Mono', monospace",
                          fontSize: 10,
                          color: PHASE_2_AMBER,
                          minWidth: 28,
                          letterSpacing: "0.06em",
                        }}
                      >
                        {stage.number}
                      </span>
                      <span
                        style={{
                          fontFamily: "'DM Sans', sans-serif",
                          fontSize: 12,
                          color: "var(--color-text-secondary)",
                        }}
                      >
                        {stage.label}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>

        <main className="mx-auto w-full max-w-[800px] px-5 sm:px-8" style={{ paddingTop: 64, paddingBottom: 96 }}>
        {!sessionId && (
          <p className="text-body" style={{ color: "#5A5652", textAlign: "center" }}>
            No session specified.
          </p>
        )}
        {sessionId && loading && (
          <p className="text-body" style={{ color: "#5A5652", textAlign: "center" }}>
            Loading session…
          </p>
        )}
        {error && (
          <p className="text-body" style={{ color: "#7C3A3A", textAlign: "center" }}>
            {error}
          </p>
        )}
        {sessionId && !loading && session && (
          <>
            <section style={{ textAlign: "center", paddingBottom: 48 }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
                <BrandGrenadeIcon size={40} />
              </div>
              <span
                className="text-label"
                style={{ color: "#C8873A", letterSpacing: "0.12em" }}
              >
                PHASE 2 — BRAND DETONATION
              </span>
              <h1
                className="text-display text-text-primary"
                style={{ margin: "16px 0", fontWeight: 700 }}
              >
                {brand}
              </h1>
              {smp && (
                <p
                  style={{
                    color: "#C8873A",
                    fontSize: 24,
                    lineHeight: 1.3,
                    fontWeight: 600,
                    margin: "16px auto 0",
                    maxWidth: 640,
                  }}
                >
                  {smp}
                </p>
              )}
            </section>

            {!docsReady && (
              <p
                className="text-body"
                style={{ color: "#7C3A3A", textAlign: "center" }}
              >
                All Phase 1 documents must be generated before Brand Detonation can begin.
              </p>
            )}

            {docsReady && !isOwner && (
              <p
                className="text-body"
                style={{ color: "#7C3A3A", textAlign: "center" }}
              >
                Only the session owner can run Brand Detonation.
              </p>
            )}

            {docsReady && isOwner && (
              <div
                style={{
                  backgroundColor: "var(--color-surface-3)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 12,
                  padding: 32,
                  textAlign: "center",
                }}
              >
                <p
                  className="text-label"
                  style={{ color: "#C8873A", letterSpacing: "0.12em" }}
                >
                  STATUS
                </p>
                <h2
                  className="text-h2 text-text-primary"
                  style={{ margin: "12px 0 16px", fontWeight: 700 }}
                >
                  {session.phase_2_status === "complete"
                    ? "Complete"
                    : "In Progress"}
                </h2>
                <p
                  className="text-body"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  Phase 2 stages will appear here as they are added to the pipeline.
                  The Master Detonation Brief is the final output of Stage 22.
                </p>
              </div>
            )}
          </>
        )}
        </main>
      </div>
    </div>
  );
}
