import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { TopNav } from "@/components/TopNav";
import { BrandGrenadeIcon } from "@/components/BrandGrenadeIcon";
import { supabase } from "@/integrations/supabase/client";
import { generateStrategicPlatformPdf } from "@/lib/pdf-generator";
import { runStage16 } from "@/lib/stage16.functions";
import { generateDocument } from "@/lib/document.functions";

const completeSearchSchema = z.object({
  session: z.string().uuid().optional(),
});

export const Route = createFileRoute("/complete")({
  validateSearch: completeSearchSchema,
  component: CompletePage,
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

type Format = "agency" | "consulting" | "workshop";

type SessionRow = {
  id: string;
  brand_name: string | null;
  category: string | null;
  selected_smp: string | null;
  selected_smp_field_name: string | null;
  stage_1_output: string | null;
  stage_8_output: string | null;
  stage_10_output: string | null;
  stage_11_output: string | null;
  stage_12_output: string | null;
  stage_13_output: string | null;
};

function CompletePage() {
  const { session: sessionId } = Route.useSearch();
  const runStage16Fn = useServerFn(runStage16);
  const generateDocumentFn = useServerFn(generateDocument);
  const [format, setFormat] = useState<Format>("consulting");
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
        "id, brand_name, category, selected_smp, selected_smp_field_name, stage_1_output, stage_8_output, stage_10_output, stage_11_output, stage_12_output, stage_13_output",
      )
      .eq("id", sessionId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error("Failed to load session", error);
        setSession((data as SessionRow) ?? null);
        setLoading(false);
        const urlParams =
          typeof window !== "undefined"
            ? new URLSearchParams(window.location.search)
            : new URLSearchParams();
        // eslint-disable-next-line no-console
        console.log("Final Output loading session:", {
          sessionIdFromUrl: urlParams.get("session"),
          sessionIdFromDb: (data as SessionRow | null)?.id,
          brandName: (data as SessionRow | null)?.brand_name,
          selectedSmp: (data as SessionRow | null)?.selected_smp,
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
      <TopNav session={{ brand, currentStage: 20, totalStages: 20, isRunning: false }} />
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

        {/* Format selection */}
        <div style={{ marginBottom: 16 }}>
          <span className="text-label text-primary">SELECT OUTPUT FORMAT</span>
        </div>
        <p
          className="text-body"
          style={{ color: "var(--color-text-secondary)", marginBottom: 24 }}
        >
          Select how you want to present this strategy. Same intelligence, three different formats.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 16,
          }}
        >
          <FormatCard
            id="agency"
            selected={format === "agency"}
            onSelect={setFormat}
            icon={<DeckIcon />}
            title="Agency Pitch"
            description="Proposition-led. Creative territory first. Built for the teams who will make the work."
            tag="25+ pages"
          />
          <FormatCard
            id="consulting"
            selected={format === "consulting"}
            onSelect={setFormat}
            icon={<DocsIcon />}
            title="Consulting Delivery"
            description="Evidence-led. Methodology visible. Built for the room where decisions are made."
            tag="~25 pages"
          />
          <FormatCard
            id="workshop"
            selected={format === "workshop"}
            onSelect={setFormat}
            icon={<PeopleIcon />}
            title="Brand Workshop"
            description="Session-ready. Built for the internal conversation that turns strategy into action."
            tag="~20 pages + session guide"
          />
        </div>

        {/* Download section */}
        <div style={{ marginTop: 32 }}>
          {(() => {
            const runGenerate = async (force: boolean) => {
              if (generating) return;
              if (!hasSmp) return;
              setGenerating(true);
              setDone(false);
              setLastError(null);
              setLastOutput("");
              setProgress(0);
              setProgressLabel("Preparing your document…");

              try {
                if (!sessionId) throw new Error("Missing session id");

                const gen = await generateDocumentFn({
                  data: { sessionId, format, force },
                });

                let url: string | null = null;

                if (gen.status === "ready" && gen.url) {
                  url = gen.url;
                  setProgress(100);
                  setProgressLabel("Opening document…");
                } else {
                  // Poll the sessions table every 5s until status becomes
                  // 'ready' or 'error'. Generation is running in the
                  // background on the server (ctx.waitUntil).
                  setProgressLabel("Preparing your document…");
                  const statusCol = `doc_${format}_status` as const;
                  const urlCol = `doc_${format}_url` as const;
                  const startedAt = Date.now();
                  const MAX_WAIT_MS = 5 * 60 * 1000;
                  let tick = 0;
                  while (true) {
                    await new Promise((r) => setTimeout(r, 5000));
                    tick++;
                    // Gentle indeterminate progress: cap at 90%.
                    setProgress((p) => (p < 90 ? Math.min(90, p + 5) : p));
                    setProgressLabel(
                      `Preparing your document… (${tick * 5}s)`,
                    );
                    const { data: row, error: pollError } = await supabase
                      .from("sessions")
                      .select(`${statusCol}, ${urlCol}`)
                      .eq("id", sessionId)
                      .maybeSingle();
                    if (pollError) throw new Error(pollError.message);
                    const status = (row as Record<string, unknown> | null)?.[statusCol] as
                      | string
                      | null
                      | undefined;
                    const docUrl = (row as Record<string, unknown> | null)?.[urlCol] as
                      | string
                      | null
                      | undefined;
                    if (status === "ready" && docUrl) {
                      url = docUrl;
                      setProgress(100);
                      setProgressLabel("Document ready ✓");
                      break;
                    }
                    if (status === "error") {
                      throw new Error("Document generation failed on server");
                    }
                    if (Date.now() - startedAt > MAX_WAIT_MS) {
                      throw new Error("Document generation timed out");
                    }
                  }
                }

                if (!url) throw new Error("No document URL returned");
                setDone(true);
                await openDocument(url);

                window.setTimeout(() => {
                  setGenerating(false);
                  setDone(false);
                  setProgress(0);
                  setProgressLabel("");
                }, 1500);
              } catch (e) {
                console.error("Document generation failed", e);
                setGenerating(false);
                setProgress(0);
                setProgressLabel("");
                setLastError(
                  e instanceof Error ? e.message : "Document generation failed",
                );
              }
            };
            return (
              <>
                <button
                  type="button"
                  onClick={() => runGenerate(false)}
                  disabled={generating || !hasSmp}
                  style={{
                    width: "100%",
                    height: 56,
                    borderRadius: 8,
                    border: "none",
                    backgroundColor: "var(--color-primary)",
                    color: "var(--color-background)",
                    fontWeight: 600,
                    fontSize: 16,
                    cursor: generating ? "wait" : hasSmp ? "pointer" : "not-allowed",
                    opacity: hasSmp ? 1 : 0.5,
                  }}
                >
                  {generating
                    ? done
                      ? "Document ready ✓"
                      : "Generating PDF…"
                    : `Download ${brand} Strategic Platform ↓`}
                </button>
                <div style={{ marginTop: 10, textAlign: "center" }}>
                  <button
                    type="button"
                    onClick={() => runGenerate(true)}
                    disabled={generating || !hasSmp}
                    className="text-body-sm transition-colors hover:text-text-primary"
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      color: "#5A5652",
                      cursor: generating ? "wait" : "pointer",
                    }}
                  >
                    Not complete? Regenerate →
                  </button>
                </div>
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

        {/* Pipeline stages collapsible */}
        <div style={{ marginTop: 48 }}>
          <button
            type="button"
            onClick={() => setStagesOpen((v) => !v)}
            className="text-label flex w-full items-center justify-between border-t border-border py-4 text-left transition-colors"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            <span>OPEN ENGINE ROOM</span>
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
                    Open in Engine Room
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
  icon,
  title,
  description,
  tag,
}: {
  id: Format;
  selected: boolean;
  onSelect: (id: Format) => void;
  icon: React.ReactNode;
  title: string;
  description: string;
  tag: string;
}) {
  return (
    <button
      type="button"
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
      <p
        className="text-label"
        style={{ color: "var(--color-text-tertiary)", marginTop: 12 }}
      >
        {tag}
      </p>
    </button>
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
