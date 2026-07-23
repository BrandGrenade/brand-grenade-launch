import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { TopNav } from "@/components/TopNav";
import { BrandGrenadeIcon } from "@/components/BrandGrenadeIcon";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { generateStrategicPlatformPdf } from "@/lib/pdf-generator";
import { runStage16 } from "@/lib/stage16.functions";
import {
  buildPhase2Document,
  buildAllPhase2,
  type Phase2DocType,
} from "@/lib/phase2-document-generator";
import { buildPhase1Document, openPhase1Document, openStage16VisionDocument, PHASE_1_SESSION_COLUMNS, type Phase1Format } from "@/lib/phase1-document-builder";
import { openFullRunDocument, FULL_RUN_SESSION_COLUMNS, resolveFullRunStages } from "@/lib/full-run-document";
import { Document00ACard } from "@/components/Document00ACard";



const completeSearchSchema = z.object({
  session: z.string().uuid().optional(),
});

// P7 cross-session guard: re-key CompletePage on sessionId so every session
// change forces a fresh mount. Without this, stale session state from the
// previous deliverables view leaks into the new session (e.g. another
// session's Stage 16 document being assembled into the current download).
function CompleteRoute() {
  const { session: sessionId } = Route.useSearch();
  return <CompletePage key={sessionId ?? "__no_session__"} />;
}

export const Route = createFileRoute("/complete")({
  validateSearch: completeSearchSchema,
  component: CompleteRoute,
  head: () => ({
    meta: [
      { title: "Deliverables — Brand Grenade" },
      {
        name: "description",
        content:
          "Strategic platform document ready. Select an output format and download.",
      },
    ],
  }),
});

const STAGES = [
  "Brief Analysis",
  "Category Intelligence",
  "Strategic Frameworks",
  "Strategic Universes",
  "Insight Generation",
  "Insight Validation",
  "Territory Synthesis",
  "Proposition Generation",
  "Distinctiveness Check",
  "Proposition Scoring",
  "Integrity Testing",
  "Proposition Selection",
  "Brand Fit Validation",
  "Territory Mapping",
  "Coherence Audit",
  "Document Assembly",
];

type Format = "vision" | "agency" | "consulting" | "workshop";

type SessionRow = {
  id: string;
  brand_name: string | null;
  category: string | null;
  selected_smp: string | null;
  selected_smp_field_name: string | null;
  user_id: string | null;
  doc_consulting_url: string | null;
  doc_agency_url: string | null;
  doc_workshop_url: string | null;
  phase_2_status: string | null;
  updated_at: string | null;
  created_at: string | null;
  stage_16_vision_output: string | null;
  stage_1_output: string | null;
  stage_2_output: string | null;
  stage_3_output: string | null;
  stage_4_output: string | null;
  stage_5_output: string | null;
  stage_6_output: string | null;
  stage_7_output: string | null;
  stage_8_output: string | null;
  stage_9_output: string | null;
  stage_9_leftofcentre_output: string | null;
  stage_10_output: string | null;
  stage_11_output: string | null;
  stage_12_output: string | null;
  stage_13_output: string | null;
  stage_14_output: string | null;
  stage_15_output: string | null;

  // Sub-stage outputs (for Complete Strategy Pipeline deliverable)
  stage_1b_output: string | null;
  stage_4b_output: string | null;
  stage_13b_output: string | null;
  stage_14b_output: string | null;
  stage_14c_output: string | null;
  stage_16_consulting_output: string | null;
  stage_16_agency_output: string | null;
  stage_16_workshop_output: string | null;
  stage_17_output: string | null;
  stage_18_output: string | null;
  stage_20b_output: string | null;

  // Phase 2 deliverables source
  stage_17_selected_territory: string | null;
  stage_17b_output: string | null;
  stage_18_selected_detonation: string | null;
  stage_19_output: string | null;
  stage_20_output: string | null;
  stage_21_outputs: Record<string, string> | null;
  stage_22_output: string | null;
  stage_22_brand_architecture: string | null;
  stage_22_distinctive_assets: string | null;
};


async function openDocument(url: string) {
  const response = await fetch(url);
  const html = await response.text();
  const win = window.open("", "_blank");
  if (!win) {
    alert("Please allow popups");
    return;
  }
  win.document.open("text/html");
  win.document.write(html);
  win.document.close();
}

function CompletePage() {
  const { session: sessionId } = Route.useSearch();
  const runStage16Fn = useServerFn(runStage16);
  const { user } = useAuth();
  // edge fn invoked directly via supabase.functions.invoke
  const [format, setFormat] = useState<Format>("vision");
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [done, setDone] = useState(false);
  const [stagesOpen, setStagesOpen] = useState(false);
  const [modalStage, setModalStage] = useState<string | null>(null);
  const [session, setSession] = useState<SessionRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastOutput, setLastOutput] = useState<string>("");
  const regenerateRef = useRef<((id: Format) => void) | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    supabase
      .from("sessions")
      .select(
        `id, brand_name, category, selected_smp, selected_smp_field_name, user_id, doc_consulting_url, doc_agency_url, doc_workshop_url, phase_2_status, updated_at, created_at, stage_17_selected_territory, stage_18_selected_detonation, stage_22_brand_architecture, stage_22_distinctive_assets, ${FULL_RUN_SESSION_COLUMNS}`,
      )
      .eq("id", sessionId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error("Failed to load session", error);
        setSession((data as unknown as SessionRow) ?? null);
        setLoading(false);
        const urlParams =
          typeof window !== "undefined"
            ? new URLSearchParams(window.location.search)
            : new URLSearchParams();
        // eslint-disable-next-line no-console
        console.log("Final Output loading session:", {
          sessionIdFromUrl: urlParams.get("session"),
          sessionIdFromDb: (data as unknown as SessionRow | null)?.id,
          brandName: (data as unknown as SessionRow | null)?.brand_name,
          selectedSmp: (data as unknown as SessionRow | null)?.selected_smp,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const brand = session?.brand_name ?? "Untitled Brand";
  const smp = session?.selected_smp ?? "";
  const field = session?.category ?? session?.selected_smp_field_name ?? "";
  const brandRole = "";
  const hasSmp = Boolean(smp && smp.trim().length > 0);

  useEffect(() => {
    document.title = `${brand} Deliverables — Brand Grenade`;
  }, [brand]);

  const smpPreview = hasSmp
    ? smp.split(" ").slice(0, 5).join(" ") + "…"
    : "—";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopNav session={{ brand, currentStage: session?.stage_22_brand_architecture ? 23 : 16, totalStages: 23, isRunning: false }} />
      {/* Breadcrumb */}
      <div className="flex items-center border-b border-border bg-background px-5 py-3 sm:px-8">
        <nav
          className="text-body-sm flex items-center gap-1.5 truncate"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          <Link
            to="/dashboard"
            className="transition-colors hover:text-text-secondary"
          >
            Sessions
          </Link>
          <span>→</span>
          <span className="text-text-secondary truncate">{brand}</span>
          <span>→</span>
          <span>Deliverables</span>
        </nav>
      </div>

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
        {sessionId && !loading && !session && (
          <p className="text-body" style={{ color: "#5A5652", textAlign: "center" }}>
            Session not found.
          </p>
        )}
        {sessionId && !loading && session && (
          <>
        {/* Hero */}
        <section style={{ textAlign: "center", paddingBottom: 48 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: 24,
            }}
          >
            <BrandGrenadeIcon size={40} />
          </div>
          <div>
            <span
              className="text-label"
              style={{ color: "var(--color-primary)", letterSpacing: "0.12em" }}
            >
              BRAND GRENADE
            </span>
          </div>
          <h1
            className="text-display text-text-primary"
            style={{ margin: "16px 0", fontWeight: 700 }}
          >
            {brand} — Strategic Platform
          </h1>
          <p
            className="text-body-lg"
            style={{ color: "var(--color-text-secondary)" }}
          >
            20 stages. 3 human reviews. One complete brand strategy.
          </p>

          <hr
            className="border-0 bg-border"
            style={{
              height: 1,
              maxWidth: 200,
              margin: "32px auto",
            }}
          />
        </section>

        {/* Pipeline summary card */}
        <div
          style={{
            backgroundColor: "var(--color-surface-3)",
            border: "1px solid var(--color-border)",
            borderRadius: 12,
            padding: 32,
            marginBottom: 32,
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 24,
          }}
        >
          <Stat value="20" label="STAGES COMPLETED" tone="success" />
          <Stat value="3" label="CHECKPOINTS CONFIRMED" tone="success" />
          <Stat value={smpPreview} label="STRATEGIC PROPOSITION" tone="primary" />
        </div>

        {/* Selected proposition */}
        <div
          style={{
            backgroundColor: "var(--color-surface-2)",
            border: "1px solid var(--color-primary)",
            borderRadius: 12,
            padding: 32,
            marginBottom: 32,
          }}
        >
          <span className="text-label text-primary">
            THE PROPOSITION
          </span>
          {hasSmp ? (
            <>
              <h2
                className="text-h1 text-text-primary"
                style={{ margin: "16px 0 24px", lineHeight: 1.3, fontWeight: 700 }}
              >
                {smp}
              </h2>
              {field && (
                <p
                  className="text-body-sm"
                  style={{ color: "var(--color-text-tertiary)" }}
                >
                  {field}{brandRole ? ` — ${brandRole}` : ""}
                </p>
              )}
            </>
          ) : (
            <p
              className="text-body"
              style={{ color: "#5A5652", margin: "16px 0 0" }}
            >
              Proposition not yet selected
            </p>
          )}
        </div>

        {/* Document 00A — Strategic Territory Intelligence Report */}
        <Document00ACard brand={brand} />

        {/* Format selection */}
        <div style={{ marginBottom: 16 }}>
          <span className="text-label text-primary">
            SELECT HOW YOU WANT TO PRESENT THIS STRATEGY
          </span>
        </div>
        <p
          className="text-body"
          style={{ color: "var(--color-text-secondary)", marginBottom: 24 }}
        >
          Same intelligence, tailored for different audiences and uses.
          All outputs open as HTML and save as PDF.
        </p>

        {(() => {
          const phase2Ready = Boolean(
            session.stage_22_output &&
              session.stage_17_selected_territory &&
              session.stage_18_selected_detonation,
          );
          return !phase2Ready ? (
            <div
              role="alert"
              style={{
                marginBottom: 24,
                padding: 16,
                borderRadius: 8,
                border: "1px solid var(--color-border)",
                background: "var(--color-surface-2)",
                color: "var(--color-text-secondary)",
                fontSize: 14,
                lineHeight: 1.55,
              }}
            >
              <strong style={{ color: "var(--color-text-primary)" }}>
                Documents are locked until the full pipeline is complete.
              </strong>{" "}
              Finish Brand Detonation (Stages 17–22), confirm Checkpoint D
              (Creative Territory) and Checkpoint E (Detonation) on the{" "}
              <Link to="/detonation" search={{ session: session.id }} style={{ color: "var(--color-primary)" }}>
                Detonation page
              </Link>
              , then return here. This prevents any document — and the Strategy
              and Creative Vision in particular — from fabricating a Detonation
              section before the real one exists.
            </div>
          ) : null;
        })()}

        {(() => {
          const phase2Ready = Boolean(
            session.stage_22_output &&
              session.stage_17_selected_territory &&
              session.stage_18_selected_detonation,
          );
          const lockDownload = !hasSmp || generating || !phase2Ready;
          return (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: 16,
              }}
            >
              <FormatCard
                id="vision"
                selected={format === "vision"}
                onSelect={setFormat}
                onRegenerate={(id) => regenerateRef.current?.(id)}
                icon={<DocsIcon />}
                title="Strategy and Creative Vision"
                description="CMO socialisation document. Strategy and creative direction unified for the room that signs off the work."
                tag="primary"
                disabled={lockDownload}
              />
              <FormatCard
                id="agency"
                selected={format === "agency"}
                onSelect={setFormat}
                onRegenerate={(id) => regenerateRef.current?.(id)}
                icon={<DeckIcon />}
                title="Agency Pitch"
                description="Proposition-led. Creative territory first. Built for the teams who will make the work."
                tag="25+ pages"
                disabled={lockDownload}
              />
              <FormatCard
                id="consulting"
                selected={format === "consulting"}
                onSelect={setFormat}
                onRegenerate={(id) => regenerateRef.current?.(id)}
                icon={<DocsIcon />}
                title="Consulting Delivery"
                description="Evidence-led. Methodology visible. Built for the room where decisions are made."
                tag="~25 pages"
                disabled={lockDownload}
              />
              <FormatCard
                id="workshop"
                selected={format === "workshop"}
                onSelect={setFormat}
                onRegenerate={(id) => regenerateRef.current?.(id)}
                icon={<PeopleIcon />}
                title="Brand Workshop"
                description="Session-ready. Built for the internal conversation that turns strategy into action."
                tag="~20 pages + session guide"
                disabled={lockDownload}
              />
            </div>
          );
        })()}

        {/* Download section */}
        <div style={{ marginTop: 32 }}>
          {(() => {
            const runGenerate = async (force = false) => {
              if (!hasSmp || !session) return;
              setLastError(null);
              if (format === "vision") {
                // Stage 16 vision is generated on demand via the server fn.
                // Returns cached output if already populated (no extra Claude
                // call); otherwise streams generation and persists.
                // When `force` is true, the server bypasses the cache and the
                // client clears the local copy so a fresh stream is consumed.
                const existing = session.stage_16_vision_output;
                if (!force && existing && existing.trim().length > 1000) {
                  try {
                    openStage16VisionDocument(brand, smp, existing);
                  } catch (e) {
                    console.error("Vision doc open failed", e);
                    setLastError(e instanceof Error ? e.message : "Document open failed");
                  }
                  return;
                }
                setGenerating(true);
                setDone(false);
                setProgress(10);
                setProgressLabel(
                  force
                    ? "Regenerating Strategy and Creative Vision…"
                    : "Generating Strategy and Creative Vision…",
                );
                try {
                  const stream = await runStage16Fn({
                    data: { sessionId: session.id, format: "vision", force },
                  });
                  let finalOutput = "";
                  for await (const chunk of stream as AsyncIterable<{
                    delta?: string;
                    done?: boolean;
                    output?: string;
                  }>) {
                    if (chunk.delta) {
                      finalOutput += chunk.delta;
                      setProgress((p) => Math.min(90, p + 2));
                    }
                    if (chunk.done && chunk.output) {
                      finalOutput = chunk.output;
                    }
                  }
                  setProgress(100);
                  setDone(true);
                  setProgressLabel("Strategy and Creative Vision ready");
                  setSession({ ...session, stage_16_vision_output: finalOutput });
                  setLastOutput(finalOutput);
                  openStage16VisionDocument(brand, smp, finalOutput);
                } catch (e) {
                  console.error("Vision generation failed", e);
                  setLastError(e instanceof Error ? e.message : "Vision generation failed");
                } finally {
                  setGenerating(false);
                }
                return;
              }
              try {
                // Phase 1 documents (agency/consulting/workshop) are built
                // deterministically from the live session payload on every
                // open, so "Regenerate" is functionally the same as Download
                // — a fresh build every click using the current prompts and
                // pipeline outputs.
                openPhase1Document(session, format as Phase1Format);
              } catch (e) {
                console.error("Document open failed", e);
                setLastError(
                  e instanceof Error ? e.message : "Document open failed",
                );
              }
            };
            const handleRegenerate = (id: Format) => {
              setFormat(id);
              // Defer one tick so the format state update lands before run.
              setTimeout(() => runGenerate(true), 0);
            };
            // Expose handler to the cards rendered above via a ref.
            regenerateRef.current = handleRegenerate;
            const buttonLabel =
              format === "vision"
                ? `Download ${brand} Strategy and Creative Vision ↓`
                : `Download ${brand} Strategic Platform ↓`;
            return (
              <>
                <button
                  type="button"
                  onClick={() => runGenerate(false)}
                  disabled={!hasSmp || generating}
                  style={{
                    width: "100%",
                    height: 56,
                    borderRadius: 8,
                    border: "none",
                    backgroundColor: "var(--color-primary)",
                    color: "var(--color-background)",
                    fontWeight: 600,
                    fontSize: 16,
                    cursor: hasSmp && !generating ? "pointer" : "not-allowed",
                    opacity: hasSmp && !generating ? 1 : 0.5,
                  }}
                >
                  {generating ? "Generating…" : buttonLabel}
                </button>
                <p
                  className="text-body-sm"
                  style={{
                    marginTop: 10,
                    textAlign: "center",
                    color: "#5A5652",
                  }}
                >
                  Opens in a new tab — save as PDF from the print dialog.
                </p>
              </>
            );
          })()}



          {generating && (
            <div style={{ marginTop: 16 }} className="animate-fade-in">
              <div
                style={{
                  height: 4,
                  width: "100%",
                  backgroundColor: "var(--color-surface-3)",
                  borderRadius: 999,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${progress}%`,
                    backgroundColor: done ? "var(--color-success)" : "var(--color-primary)",
                    transition: "width 300ms ease-out, background-color 200ms",
                  }}
                />
              </div>
              <p
                className="text-body-sm"
                style={{
                  color: done ? "var(--color-success)" : "var(--color-text-tertiary)",
                  textAlign: "center",
                  marginTop: 10,
                }}
              >
                {done ? "✓ " : ""}
                {progressLabel}
              </p>
            </div>
          )}

          {lastError && !generating && (
            <div
              style={{
                marginTop: 16,
                padding: "16px 20px",
                background: "#7C3A3A15",
                border: "1px solid #7C3A3A",
                borderRadius: 8,
              }}
            >
              <p className="text-body-sm" style={{ color: "#8A8680", margin: 0 }}>
                PDF generation failed. Try downloading as a text document instead.
              </p>
              <button
                type="button"
                onClick={() => {
                  const safe = brand.replace(/[^a-zA-Z0-9]/g, "_");
                  const date = new Date().toISOString().split("T")[0];
                  const suffix = {
                    vision: "StrategyAndCreativeVision",
                    consulting: "BoardStrategyRecommendation",
                    agency: "AgencyStrategyPlatform",
                    workshop: "BrandStrategyWorkshopGuide",
                  }[format];
                  const blob = new Blob([lastOutput || "(no content available)"], {
                    type: "text/plain;charset=utf-8",
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `BrandGrenade_${safe}_${suffix}_${date}.txt`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}
                className="text-body-sm transition-colors hover:text-text-primary"
                style={{
                  marginTop: 8,
                  background: "none",
                  border: "none",
                  padding: 0,
                  color: "#8A8680",
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                Download as Text
              </button>
            </div>
          )}

          <div
            style={{
              marginTop: 16,
              display: "flex",
              justifyContent: "center",
              gap: 24,
              flexWrap: "wrap",
            }}
          >
            <TextLink color="primary">Read in browser</TextLink>
            <TextLink>Share this strategy</TextLink>
            <Link
              to="/brief"
              className="text-body-sm transition-colors hover:text-text-primary"
              style={{ color: "var(--color-text-secondary)" }}
            >
              New brief →
            </Link>
          </div>
        </div>

        {/* ─── Complete Strategy Pipeline (deliverable) ───────────────── */}
        {session && (() => {
          const amber = "#D4924A";
          const stages = resolveFullRunStages(session as unknown as Record<string, unknown>);
          const count = stages.length;
          return (
            <section style={{ marginTop: 48 }}>
              <div
                style={{
                  border: `1px solid ${amber}`,
                  borderRadius: 8,
                  padding: 24,
                  background: "rgba(212, 146, 74, 0.04)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 24, flexWrap: "wrap" }}>
                  <div style={{ flex: "1 1 320px" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: amber, textTransform: "uppercase", marginBottom: 6 }}>
                      Complete Strategy Pipeline
                    </div>
                    <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, marginBottom: 8, color: "var(--color-text-primary)" }}>
                      {brand} — Full Run
                    </h3>
                    <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
                      Every stage of the run, cover page to Brand Architecture — the full canonical record.
                      {count > 0 && ` ${count} stage${count === 1 ? "" : "s"} available.`}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={count === 0}
                    onClick={() => {
                      if (!session) return;
                      openFullRunDocument(session as unknown as Record<string, unknown>);
                    }}
                    style={{
                      background: count === 0 ? "#555" : amber,
                      color: "#000",
                      border: "none",
                      padding: "12px 24px",
                      borderRadius: 6,
                      fontWeight: 700,
                      fontSize: 14,
                      cursor: count === 0 ? "not-allowed" : "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Download Full Run ↓
                  </button>
                </div>
              </div>
            </section>
          );
        })()}


        {/* ─── Phase 2: Brand Detonation ───────────────────────────────── */}
        {(() => {
          // Phase 1 documents are now generated client-side on demand
          // (openPhase1Document), so Phase 2 unlocks as soon as an SMP
          // is selected — no signed-URL readiness check required.
          if (!hasSmp) return null;
          if (session.phase_2_status === "complete" || session.stage_22_output) return null;
          // TODO: reinstate owner check
          // before commercial deployment
          const isOwner = true;
          const amber = "#D4924A";
          return (
            <section style={{ marginTop: 64 }}>
              <hr
                style={{
                  border: 0,
                  borderTop: `1px solid ${amber}`,
                  margin: "0 0 40px",
                }}
              />
              <div style={{ textAlign: "center" }}>
                <p
                  className="text-label"
                  style={{ color: amber, letterSpacing: "0.12em" }}
                >
                  YOUR BRAND STRATEGY IS COMPLETE. NOW GIVE IT LIFE.
                </p>
                {hasSmp && (
                  <h2
                    style={{
                      color: amber,
                      fontSize: 36,
                      lineHeight: 1.25,
                      fontWeight: 700,
                      margin: "24px auto 32px",
                      maxWidth: 720,
                    }}
                  >
                    {smp}
                  </h2>
                )}
                <Link
                  to="/detonation/canvas"
                  search={{ session: session.id }}
                  style={{
                    display: "inline-flex",
                    height: 56,
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0 32px",
                    borderRadius: 8,
                    border: "none",
                    backgroundColor: "var(--color-primary)",
                    color: "var(--color-background)",
                    fontWeight: 600,
                    fontSize: 16,
                    textDecoration: "none",
                    cursor: "pointer",
                    opacity: 1,
                    pointerEvents: "auto",
                  }}
                >
                  Begin Brand Detonation →
                </Link>
              </div>
            </section>
          );
        })()}

        {/* ─── Phase 2: Brand Detonation Deliverables ───────────────── */}
        {(session.stage_17_selected_territory ||
          session.stage_18_selected_detonation ||
          session.stage_19_output ||
          session.stage_20_output ||
          session.stage_21_outputs ||
          session.stage_22_brand_architecture) && (
          <Phase2Deliverables session={session} />
        )}

        {/* Pipeline stages collapsible */}

        <div style={{ marginTop: 48 }}>
          <button
            type="button"
            onClick={() => setStagesOpen((v) => !v)}
            className="text-label flex w-full items-center justify-between border-t border-border py-4 text-left transition-colors"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            <span>OPEN STRATEGY ROOM</span>
            <span
              style={{
                transition: "transform 200ms",
                transform: stagesOpen ? "rotate(90deg)" : "rotate(0deg)",
                display: "inline-block",
              }}
            >
              ›
            </span>
          </button>
          {stagesOpen && (
            <ul style={{ borderTop: "1px solid var(--color-border)" }}>
              {STAGES.map((name, i) => (
                <li
                  key={i}
                  style={{
                    borderBottom: "1px solid var(--color-border)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "14px 4px",
                  }}
                >
                  <span
                    className="text-body"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    <span
                      className="text-mono"
                      style={{
                        color: "var(--color-text-tertiary)",
                        marginRight: 12,
                      }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {name}
                  </span>
                  <button
                    type="button"
                    onClick={() => setModalStage(name)}
                    className="text-body-sm font-medium text-primary transition-colors hover:text-primary-hover"
                  >
                    Open in Strategy Room
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Brand Grenade signature */}
        <div>
          <hr
            style={{
              border: 0,
              borderTop: "1px solid #2A2A2A",
              width: "100%",
              margin: "48px 0 32px",
            }}
          />
          <div style={{ textAlign: "center" }}>
            <div
              className="text-label"
              style={{ color: "#5A5652", letterSpacing: "0.12em" }}
            >
              BRAND GRENADE
            </div>
            <div
              className="text-body-sm"
              style={{ color: "#3A3A3A", marginTop: 6 }}
            >
              Strategy Intelligence System
            </div>
          </div>
        </div>
          </>
        )}
      </main>

      {modalStage && (
        <StageModal
          stage={modalStage}
          onClose={() => setModalStage(null)}
        />
      )}
    </div>
  );
}

function Stat({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone: "success" | "primary";
}) {
  const color =
    tone === "success" ? "var(--color-success)" : "var(--color-primary)";
  return (
    <div>
      <div
        className="text-h2 text-text-primary"
        style={{ display: "flex", alignItems: "center", gap: 8 }}
      >
        <span style={{ fontSize: tone === "primary" ? 16 : undefined }}>
          {value}
        </span>
        {tone === "success" && (
          <span style={{ color }}>
            <CheckIcon color={color} />
          </span>
        )}
      </div>
      <p
        className="text-label"
        style={{ color: "var(--color-text-tertiary)", marginTop: 8 }}
      >
        {label}
      </p>
    </div>
  );
}

function FormatCard({
  id,
  selected,
  onSelect,
  onRegenerate,
  icon,
  title,
  description,
  tag,
  disabled,
}: {
  id: Format;
  selected: boolean;
  onSelect: (id: Format) => void;
  onRegenerate?: (id: Format) => void;
  icon: React.ReactNode;
  title: string;
  description: string;
  tag: string;
  disabled?: boolean;
}) {
  return (
    <div
      onClick={() => onSelect(id)}
      style={{
        textAlign: "left",
        border: `1px solid ${
          selected ? "var(--color-primary)" : "var(--color-border)"
        }`,
        backgroundColor: selected
          ? "oklch(0.65 0.12 60 / 0.05)"
          : "transparent",
        borderRadius: 12,
        padding: 24,
        cursor: "pointer",
        transition: "all 150ms",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <span style={{ color: "var(--color-primary)" }}>{icon}</span>
      <p
        className="text-body"
        style={{
          fontWeight: 600,
          color: "var(--color-text-primary)",
          marginTop: 12,
        }}
      >
        {title}
      </p>
      <p
        className="text-body-sm"
        style={{ color: "var(--color-text-secondary)", marginTop: 8, flex: 1 }}
      >
        {description}
      </p>
      <div
        style={{
          marginTop: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <p
          className="text-label"
          style={{ color: "var(--color-text-tertiary)", margin: 0 }}
        >
          {tag}
        </p>
        {onRegenerate && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (disabled) return;
              onRegenerate(id);
            }}
            disabled={disabled}
            title="Clear the cached output for this document and run a fresh generation using the current prompt."
            style={{
              border: "1px solid var(--color-border)",
              background: "transparent",
              color: "var(--color-text-secondary)",
              borderRadius: 6,
              padding: "6px 10px",
              fontSize: 12,
              fontWeight: 500,
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.5 : 1,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            ↻ Regenerate
          </button>
        )}
      </div>
    </div>
  );
}

function TextLink({
  children,
  color,
}: {
  children: React.ReactNode;
  color?: "primary";
}) {
  return (
    <a
      href="#"
      onClick={(e) => e.preventDefault()}
      className="text-body-sm transition-colors hover:text-text-primary"
      style={{
        color:
          color === "primary"
            ? "var(--color-primary)"
            : "var(--color-text-secondary)",
      }}
    >
      {children}
    </a>
  );
}

function StageModal({
  stage,
  onClose,
}: {
  stage: string;
  onClose: () => void;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        zIndex: 50,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 720,
          maxHeight: "85vh",
          overflowY: "auto",
          backgroundColor: "var(--color-surface-3)",
          border: "1px solid var(--color-border)",
          borderRadius: 12,
          padding: 32,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <span className="text-label text-primary">STAGE OUTPUT</span>
          <button
            type="button"
            onClick={onClose}
            className="text-body-sm"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Close ✕
          </button>
        </div>
        <h2 className="text-h2 text-text-primary" style={{ marginBottom: 16 }}>
          {stage}
        </h2>
        <p
          className="text-body"
          style={{ color: "var(--color-text-secondary)", lineHeight: 1.7 }}
        >
          Full output for this stage would render here, including all
          generated content, scores, and audit notes captured during the
          pipeline run.
        </p>
      </div>
    </div>
  );
}

// ─── Icons ─────────────────────────────────────────────────────────────

function CheckIcon({ color = "currentColor" }: { color?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 12 12" fill="none">
      <path
        d="M2.5 6.2L4.8 8.5L9.5 3.5"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DeckIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="5" width="18" height="2" rx="1" fill="currentColor" />
      <rect x="3" y="11" width="18" height="2" rx="1" fill="currentColor" />
      <rect x="3" y="17" width="12" height="2" rx="1" fill="currentColor" />
    </svg>
  );
}

function DocsIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect
        x="4"
        y="3"
        width="13"
        height="16"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect
        x="7"
        y="6"
        width="13"
        height="16"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="var(--color-background)"
      />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="8" cy="9" r="3" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="16" cy="9" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M3 19c0-2.8 2.2-5 5-5s5 2.2 5 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M13 19c0-2.8 2.2-5 5-5s3 1 3 1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ─── Phase 2 Deliverables ─────────────────────────────────────────────
const PHASE_2_AMBER_DELIV = "#D4924A";

function openHtmlInNewTab(html: string) {
  const win = window.open("", "_blank");
  if (!win) { alert("Please allow popups"); return; }
  win.document.open("text/html");
  win.document.write(html);
  win.document.close();
}

function Phase2Deliverables({ session }: { session: SessionRow }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [bundleProgress, setBundleProgress] = useState<string | null>(null);
  const [bundleResult, setBundleResult] = useState<{ filename: string; included: string[]; skipped: string[] } | null>(null);
  const channels = session.stage_21_outputs ?? {};
  const channelKeys = Object.keys(channels);
  const amber = PHASE_2_AMBER_DELIV;

  const download = (
    docType:
      | "detonation_territory" | "detonation_intelligence" | "the_detonation"
      | "activation_architecture" | "master_brief" | "channel_brief"
      | "distinctive_assets" | "brand_architecture" | "all_phase2",
    label: string,
    channelKey?: string,
  ) => {
    setBusy(label);
    try {
      const html = docType === "all_phase2"
        ? buildAllPhase2(session)
        : buildPhase2Document(session, docType as Phase2DocType, channelKey);
      openHtmlInNewTab(html);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to generate document");
    } finally { setBusy(null); }
  };

  const downloadAllZip = async () => {
    setBusy("bundle");
    setBundleResult(null);
    setBundleProgress("Preparing…");
    try {
      const { buildAndDownloadBundle } = await import("@/lib/download-all-bundle");
      const result = await buildAndDownloadBundle(session, (label) => setBundleProgress(label));
      setBundleResult(result);
      setBundleProgress(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to build zip");
      setBundleProgress(null);
    } finally { setBusy(null); }
  };




  const Card = ({ title, subtitle, onClick, busyKey }: {
    title: string; subtitle?: string; onClick: () => void; busyKey: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={busy !== null}
      style={{
        textAlign: "left", padding: "14px 16px", borderRadius: 8,
        background: "var(--color-surface-2)", border: `1px solid ${amber}33`,
        color: "var(--color-text-primary)", cursor: busy ? "wait" : "pointer",
        display: "flex", flexDirection: "column", gap: 4,
      }}
    >
      <span className="text-body" style={{ fontWeight: 600 }}>{title}</span>
      {subtitle && <span className="text-body-sm" style={{ color: "#8A8680" }}>{subtitle}</span>}
      <span className="text-mono" style={{
        marginTop: 6, color: amber, fontSize: 9, letterSpacing: "0.14em",
        textTransform: "uppercase",
      }}>{busy === busyKey ? "Opening…" : "Download ↓"}</span>
    </button>
  );

  const subhead = (label: string) => (
    <div className="text-mono" style={{
      color: amber, letterSpacing: "0.16em", textTransform: "uppercase",
      fontSize: 10, margin: "24px 0 12px",
    }}>{label}</div>
  );

  const showStrategic =
    session.stage_17_selected_territory ||
    session.stage_17b_output ||
    session.stage_18_selected_detonation ||
    session.stage_19_output;

  const showActivation =
    session.stage_20_output ||
    channelKeys.length > 0;

  const showBrandIdentity =
    session.stage_22_distinctive_assets ||
    session.stage_22_brand_architecture;

  return (
    <section style={{ marginTop: 64 }}>
      <hr style={{ border: 0, borderTop: `1px solid ${amber}`, margin: "0 0 32px" }} />
      <div className="text-mono" style={{
        color: amber, letterSpacing: "0.18em", textTransform: "uppercase",
        fontSize: 12, fontWeight: 700, marginBottom: 8,
      }}>BRAND DETONATION</div>
      <p className="text-body-sm" style={{ color: "#8A8680", marginBottom: 16 }}>
        Phase 2 deliverables. Click any card to open and save as PDF.
      </p>

      {showStrategic && (
        <>
          {subhead("Strategic")}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
            {session.stage_17_selected_territory && (
              <Card title="Detonation Territory" busyKey="Detonation Territory" onClick={() => download("detonation_territory", "Detonation Territory")} />
            )}
            {session.stage_17b_output && (
              <Card title="Detonation Intelligence" busyKey="Detonation Intelligence" onClick={() => download("detonation_intelligence", "Detonation Intelligence")} />
            )}
            {session.stage_18_selected_detonation && (
              <Card title="The Detonation" busyKey="The Detonation" onClick={() => download("the_detonation", "The Detonation")} />
            )}
            {session.stage_19_output && (
              <Card title="Activation Architecture" busyKey="Activation Architecture" onClick={() => download("activation_architecture", "Activation Architecture")} />
            )}
          </div>
        </>
      )}

      {showActivation && (
        <>
          {subhead("Activation")}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
            {session.stage_20_output && (
              <Card title="Master Detonation Brief" busyKey="Master Detonation Brief" onClick={() => download("master_brief", "Master Detonation Brief")} />
            )}
            {channelKeys.map((ch) => {
              const body = channels[ch] ?? "";
              const m = body.match(/CHANNEL\s+ROLE\s*[:\-]?\s*([^\n]+)/i);
              const role = m ? m[1].trim() : "Channel Brief";
              return (
                <Card key={ch} title={ch} subtitle={role} busyKey={`ch-${ch}`}
                  onClick={() => download("channel_brief", `ch-${ch}`, ch)} />
              );
            })}
          </div>
        </>
      )}

      {showBrandIdentity && (
        <>
          {subhead("Brand Identity")}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
            {session.stage_22_distinctive_assets && (
              <Card title="Conceptual Assets" busyKey="Conceptual Assets" onClick={() => download("distinctive_assets", "Conceptual Assets")} />
            )}
            {session.stage_22_brand_architecture && (
              <Card title="Brand Architecture" busyKey="Brand Architecture" onClick={() => download("brand_architecture", "Brand Architecture")} />
            )}
          </div>
        </>
      )}

      <div style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 12 }}>
        <button type="button" onClick={() => download("all_phase2", "all")} disabled={busy !== null}
          style={{
            height: 52, borderRadius: 8, border: "none", background: amber, color: "#0A0A0A",
            fontWeight: 700, fontSize: 14, cursor: busy ? "wait" : "pointer",
            letterSpacing: "0.04em",
          }}>
          {busy === "all" ? "Opening…" : "Download All Brand Detonation"}
        </button>
        <button type="button" onClick={downloadAllZip} disabled={busy !== null}
          style={{
            height: 52, borderRadius: 8, border: `1px solid ${amber}`, background: "transparent",
            color: amber, fontWeight: 700, fontSize: 14, cursor: busy ? "wait" : "pointer",
            letterSpacing: "0.04em",
          }}>
          {busy === "bundle" ? (bundleProgress ?? "Building zip…") : "Download All Strategy (.zip)"}
        </button>
        {bundleResult && (
          <div style={{ fontSize: 12, color: "#9CA3AF", lineHeight: 1.6 }}>
            <div style={{ color: "#D4D4D4", fontWeight: 600 }}>Bundle ready: {bundleResult.filename}</div>
            <div>Included {bundleResult.included.length} file{bundleResult.included.length === 1 ? "" : "s"}.
              {bundleResult.skipped.length > 0 && ` Skipped ${bundleResult.skipped.length} (missing source): ${bundleResult.skipped.join(", ")}.`}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
