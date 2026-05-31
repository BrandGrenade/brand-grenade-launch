import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { TopNav } from "@/components/TopNav";
import { BrandGrenadeIcon } from "@/components/BrandGrenadeIcon";
import { SMPAnchor } from "@/components/SMPAnchor";
import { DetonationOutputCard } from "@/components/DetonationOutputCard";
import { DetonationBriefSection } from "@/components/DetonationBriefSection";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { PHASE_2_STAGES, PHASE_2_AMBER } from "@/lib/phase2-stages";
import { sanitiseOutput } from "@/lib/sanitise-output";

// ── Server fn imports ─────────────────────────────────────────────────────
import {
  runStage17, loadStage17, retryStage17, selectStage17Territory,
} from "@/lib/stage17.functions";
import {
  runStage17b, loadStage17b, retryStage17b,
} from "@/lib/stage17b.functions";
import {
  runStage18, loadStage18, retryStage18, selectStage18Detonation,
} from "@/lib/stage18.functions";
import { runStage19, loadStage19, retryStage19 } from "@/lib/stage19.functions";
import {
  runStage20, loadStage20, retryStage20,
  regenerateStage20Section, approveStage20,
} from "@/lib/stage20.functions";
import { runStage21, loadStage21 } from "@/lib/stage21.functions";
import { runStage22, loadStage22 } from "@/lib/stage22.functions";

const AMBER = PHASE_2_AMBER;

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
  phase_2_current_stage: string | null;
  doc_consulting_url: string | null;
  doc_agency_url: string | null;
  doc_workshop_url: string | null;
  checkpoint_a_confirmed: boolean | null;
  checkpoint_b_confirmed: boolean | null;
  checkpoint_c_confirmed: boolean | null;
  stage_17_output: string | null;
  stage_17_selected_territory: string | null;
  stage_17b_output: string | null;
  stage_18_output: string | null;
  stage_18_selected_detonation: string | null;
  stage_19_output: string | null;
  stage_20_output: string | null;
  stage_20_approved: boolean | null;
  stage_21_outputs: Record<string, string> | null;
  stage_22_output: string | null;
  stage_22_brand_architecture: string | null;
  stage_22_distinctive_assets: string | null;
};

const SESSION_COLS =
  "id, brand_name, selected_smp, user_id, phase_2_status, phase_2_current_stage, doc_consulting_url, doc_agency_url, doc_workshop_url, checkpoint_a_confirmed, checkpoint_b_confirmed, checkpoint_c_confirmed, stage_17_output, stage_17_selected_territory, stage_17b_output, stage_18_output, stage_18_selected_detonation, stage_19_output, stage_20_output, stage_20_approved, stage_21_outputs, stage_22_output, stage_22_brand_architecture, stage_22_distinctive_assets";

// ── Tiny shared UI primitives ─────────────────────────────────────────────
function AmberButton({
  children,
  onClick,
  disabled,
  variant = "solid",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "solid" | "ghost";
}) {
  const solid = variant === "solid";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="text-mono"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        backgroundColor: solid ? AMBER : "transparent",
        color: solid ? "#0A0A0A" : AMBER,
        border: `1px solid ${AMBER}`,
        borderRadius: 6,
        padding: "10px 16px",
        textTransform: "uppercase",
        fontSize: 11,
        letterSpacing: "0.12em",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        fontWeight: 600,
      }}
    >
      {children}
    </button>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 12, height: 12, borderRadius: "50%",
        border: `2px solid ${AMBER}`, borderTopColor: "transparent",
        display: "inline-block", animation: "spin 0.8s linear infinite",
      }}
    />
  );
}

function SectionTitle({ kicker, title, subtitle }: { kicker: string; title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <span className="text-label" style={{ color: AMBER, letterSpacing: "0.12em" }}>{kicker}</span>
      <h2 className="text-h2 text-text-primary" style={{ margin: "12px 0 8px", fontWeight: 700 }}>{title}</h2>
      {subtitle && <p className="text-body" style={{ color: "var(--color-text-secondary)" }}>{subtitle}</p>}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div style={{
      backgroundColor: "#7C3A3A12", border: "1px solid #7C3A3A",
      borderRadius: 8, padding: 16, marginTop: 16,
    }}>
      <p className="text-body" style={{ color: "#E89494", margin: 0 }}>{message}</p>
    </div>
  );
}

// Render Phase 2 prose with markdown punctuation stripped. Heading-style
// lines (originally ##/###/**…**/all-caps short titles) are rendered with
// the .detonation-heading class (amber DM Mono uppercase). All other raw
// markdown markers are removed via sanitiseOutput before rendering.
function RichOutput({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="text-body" style={{ color: "#FFFFFF", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
      {lines.map((line, i) => {
        // Drop markdown horizontal rules entirely.
        if (/^\s*-{3,}\s*$/.test(line) || /^\s*\*{3,}\s*$/.test(line)) {
          return null;
        }
        // Heading detection runs on the RAW line so we can still recognise
        // ## / ### / **wrapped** before stripping the markers.
        const isHeading =
          /^#{1,4}\s+/.test(line) ||
          /^\*\*[^*]+\*\*\s*$/.test(line) ||
          (/^[A-Z][A-Z0-9 \-&/]{4,}$/.test(line.trim()) && line.trim().length < 60);
        if (isHeading) {
          const clean = sanitiseOutput(line);
          if (!clean) return null;
          return (
            <span key={i} className="detonation-heading">{clean}</span>
          );
        }
        const clean = sanitiseOutput(line);
        return <div key={i}>{clean || "\u00A0"}</div>;
      })}
    </div>
  );
}

// ── Card split helper (mirrors splitCards on the server) ──────────────────
type LocalCard = { id: string; name: string; markdown: string };
function splitCardsLocal(text: string): LocalCard[] {
  if (!text?.trim()) return [];
  const lines = text.split("\n");
  const blocks: Array<{ name: string; lines: string[] }> = [];
  let current: { name: string; lines: string[] } | null = null;
  for (const raw of lines) {
    const m = raw.match(/^##\s+(.+?)\s*$/);
    if (m) {
      if (current) blocks.push(current);
      current = { name: m[1].replace(/^\*+|\*+$/g, "").trim(), lines: [raw] };
    } else if (current) {
      current.lines.push(raw);
    }
  }
  if (current) blocks.push(current);
  if (blocks.length === 0) return [{ id: "card-1", name: "Output", markdown: text.trim() }];
  return blocks.map((b, i) => ({
    id: `card-${i + 1}`,
    name: b.name,
    markdown: b.lines.join("\n").trim(),
  }));
}

// Brief Quality Score parsing (mirrors server helper)
type LocalScore = {
  emotional_clarity: number | null;
  fame_invitation: number | null;
  distinctive_asset_integration: number | null;
  psychological_leverage: number | null;
  creative_sov_ambition: number | null;
  composite: number | null;
  status: "PASS" | "REVIEW" | null;
};
function pickScore(block: string, label: string): number | null {
  const re = new RegExp(`${label}\\s*[:\\-]?\\s*(\\d{1,2})\\s*/\\s*10`, "i");
  const m = block.match(re);
  return m ? parseInt(m[1], 10) : null;
}
function parseScoreLocal(output: string): { scoreBlock: string; score: LocalScore } {
  const idx = output.search(/BRIEF\s+QUALITY\s+SCORE/i);
  const scoreBlock = idx >= 0 ? output.slice(idx) : "";
  const compositeMatch = scoreBlock.match(/COMPOSITE\s*[:\-]?\s*(\d{1,2})\s*\/\s*50/i);
  const statusMatch = scoreBlock.match(/STATUS\s*[:\-]?\s*(PASS|REVIEW)/i);
  const parts = [
    pickScore(scoreBlock, "Emotional Clarity"),
    pickScore(scoreBlock, "Fame Invitation"),
    pickScore(scoreBlock, "Distinctive Asset Integration"),
    pickScore(scoreBlock, "Psychological Leverage"),
    pickScore(scoreBlock, "Creative SoV Ambition"),
  ];
  let composite = compositeMatch ? parseInt(compositeMatch[1], 10) : null;
  if (composite == null && parts.every((p) => typeof p === "number")) {
    composite = parts.reduce<number>((a, b) => a + (b as number), 0);
  }
  const status: "PASS" | "REVIEW" | null = statusMatch
    ? (statusMatch[1].toUpperCase() as "PASS" | "REVIEW")
    : composite != null ? (composite >= 40 ? "PASS" : "REVIEW") : null;
  return {
    scoreBlock,
    score: {
      emotional_clarity: parts[0],
      fame_invitation: parts[1],
      distinctive_asset_integration: parts[2],
      psychological_leverage: parts[3],
      creative_sov_ambition: parts[4],
      composite,
      status,
    },
  };
}

// Stage 20 sections — match server STAGE_20_SECTION_DEFS (deduped).
const STAGE_20_SECTIONS = [
  { id: "smp", label: "THE SMP" },
  { id: "detonation", label: "THE DETONATION" },
  { id: "three_truths", label: "THE THREE TRUTHS" },
  { id: "audience", label: "THE AUDIENCE" },
  { id: "response", label: "THE SINGLE MOST IMPORTANT RESPONSE" },
  { id: "cultural_context", label: "THE CULTURAL CONTEXT" },
  { id: "system_principles", label: "THE DETONATION SYSTEM PRINCIPLES" },
  { id: "courage_requirement", label: "THE COURAGE REQUIREMENT" },
  { id: "compounding_mechanism", label: "THE COMPOUNDING MECHANISM" },
  { id: "ambition", label: "THE CREATIVE SHARE OF VOICE TARGET" },
  { id: "never_do", label: "WHAT THE WORK MUST NEVER DO" },
] as const;

function parseStage20Local(output: string): Array<{ id: string; label: string; content: string }> {
  if (!output) return [];
  const idx = output.search(/BRIEF\s+QUALITY\s+SCORE/i);
  const body = idx >= 0 ? output.slice(0, idx) : output;
  const labels = STAGE_20_SECTIONS.map((s) => s.label);
  const pattern = new RegExp(
    `(^|\\n)\\s*(?:#{1,4}\\s*|\\*+\\s*)?(${labels
      .map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|")})\\b[^\\n]*`,
    "gi",
  );
  const hits: Array<{ id: string; label: string; start: number; bodyStart: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(body)) !== null) {
    const def = STAGE_20_SECTIONS.find((s) => s.label.toUpperCase() === m![2].toUpperCase());
    if (!def) continue;
    hits.push({
      id: def.id,
      label: def.label,
      start: m.index + (m[1]?.length ?? 0),
      bodyStart: m.index + m[0].length,
    });
  }
  const out: Array<{ id: string; label: string; content: string }> = [];
  for (let i = 0; i < hits.length; i++) {
    const cur = hits[i];
    const next = hits[i + 1];
    const end = next ? next.start : body.length;
    if (out.find((s) => s.id === cur.id)) continue;
    out.push({ id: cur.id, label: cur.label, content: body.slice(cur.bodyStart, end).trim() });
  }
  return out;
}

// ── Stage status calculation ──────────────────────────────────────────────
type StageStatus = "pending" | "complete" | "approved";
function stageStatus(num: string, s: SessionRow | null): StageStatus {
  if (!s) return "pending";
  switch (num) {
    case "17": return s.stage_17_output ? "complete" : "pending";
    case "17B": return s.stage_17b_output ? "complete" : "pending";
    case "18": return s.stage_18_output ? "complete" : "pending";
    case "19": return s.stage_19_output ? "complete" : "pending";
    case "20": return s.stage_20_approved ? "approved" : s.stage_20_output ? "complete" : "pending";
    case "21": return s.stage_21_outputs && Object.keys(s.stage_21_outputs).length > 0 ? "complete" : "pending";
    case "22": return s.stage_22_output ? "complete" : "pending";
  }
  return "pending";
}

// ── Main page ────────────────────────────────────────────────────────────
function DetonationPage() {
  const { session: sessionId } = Route.useSearch();
  const { user, isAuthReady } = useAuth();
  const [session, setSession] = useState<SessionRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeStage, setActiveStage] = useState<string>("17");

  const refresh = useCallback(async () => {
    if (!sessionId) return;
    const { data, error: e } = await supabase
      .from("sessions")
      .select(SESSION_COLS)
      .eq("id", sessionId)
      .maybeSingle();
    if (e) setError(e.message);
    else setSession((data as unknown as SessionRow) ?? null);
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      const { data, error: e } = await supabase
        .from("sessions").select(SESSION_COLS).eq("id", sessionId).maybeSingle();
      if (cancelled) return;
      if (e) setError(e.message);
      setSession((data as unknown as SessionRow) ?? null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [sessionId]);

  useEffect(() => {
    if (!isAuthReady || !user || !session) return;
    if (session.user_id !== user.id) return;
    const phase1Complete = Boolean(session.selected_smp && session.selected_smp.length > 0);
    if (!phase1Complete) return;
    if (session.phase_2_status === "not_started" || session.phase_2_status == null) {
      supabase.from("sessions").update({ phase_2_status: "in_progress" }).eq("id", session.id)
        .then(({ error: upErr }) => {
          if (upErr) console.error("Failed to start Phase 2", upErr);
          else setSession((prev) => prev ? { ...prev, phase_2_status: "in_progress" } : prev);
        });
    }
  }, [isAuthReady, user, session]);

  const brand = session?.brand_name ?? "Untitled Brand";
  const isOwner = Boolean(user && session?.user_id && user.id === session.user_id);
  const phase1Complete = Boolean(
    session?.selected_smp && session.selected_smp.length > 0,
  );

  const phase2Index = PHASE_2_STAGES.findIndex((s) => s.number === activeStage);
  const unifiedStage = phase2Index >= 0 ? 16 + phase2Index + 1 : 17;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <TopNav session={{ brand, currentStage: unifiedStage, totalStages: 23, isRunning: false }} />
      <div className="flex items-center border-b border-border bg-background px-5 py-3 sm:px-8">
        <nav className="text-body-sm flex items-center gap-1.5 truncate" style={{ color: "var(--color-text-tertiary)" }}>
          <Link to="/dashboard" className="transition-colors hover:text-text-secondary">Sessions</Link>
          <span>→</span>
          <span className="text-text-secondary truncate">{brand}</span>
          <span>→</span>
          <span>Brand Detonation</span>
        </nav>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* LEFT PANEL */}
        <aside
          className="hidden md:flex w-[280px] shrink-0 flex-col border-r border-border bg-background"
          style={{ position: "sticky", top: 0, alignSelf: "flex-start", maxHeight: "100vh" }}
        >
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
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 12px" }}>
            <div className="text-label" style={{
              color: AMBER, letterSpacing: "0.18em", fontFamily: "'DM Mono', monospace",
              fontSize: 7, textTransform: "uppercase", padding: "0 8px 12px",
            }}>STAGES</div>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 2 }}>
              {PHASE_2_STAGES.map((stage) => {
                const status = stageStatus(stage.number, session);
                const isActive = activeStage === stage.number;
                return (
                  <li key={stage.id}>
                    <button
                      type="button"
                      onClick={() => setActiveStage(stage.number)}
                      style={{
                        width: "100%", textAlign: "left", background: "none", cursor: "pointer",
                        display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
                        borderRadius: 6, border: "none",
                        backgroundColor: isActive ? "rgba(212,146,74,0.08)" : "transparent",
                        borderLeft: `2px solid ${isActive ? AMBER : "transparent"}`,
                      }}
                    >
                      <span style={{
                        fontFamily: "'DM Mono', monospace", fontSize: 10,
                        color: AMBER, minWidth: 28, letterSpacing: "0.06em",
                      }}>{stage.number}</span>
                      <span style={{
                        fontFamily: "'DM Sans', sans-serif", fontSize: 12,
                        color: "var(--color-text-secondary)", flex: 1,
                      }}>{stage.label}</span>
                      <span style={{
                        fontFamily: "'DM Mono', monospace", fontSize: 8,
                        textTransform: "uppercase", letterSpacing: "0.1em",
                        color: status === "approved" ? AMBER
                          : status === "complete" ? "#7AB179" : "#5A5652",
                      }}>
                        {status === "approved" ? "Approved"
                          : status === "complete" ? "Complete" : "Pending"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>

        {/* RIGHT PANEL */}
        <main className="flex-1 min-w-0 overflow-y-auto" style={{ padding: "32px clamp(20px, 4vw, 48px) 96px" }}>
          {!sessionId && <p className="text-body" style={{ color: "#5A5652", textAlign: "center" }}>No session specified.</p>}
          {sessionId && loading && <p className="text-body" style={{ color: "#5A5652", textAlign: "center" }}>Loading session…</p>}
          {error && <ErrorBanner message={error} />}
          {sessionId && !loading && session && (
            <>
              <header style={{ textAlign: "center", paddingBottom: 32 }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
                  <BrandGrenadeIcon size={32} />
                </div>
                <span className="text-label" style={{ color: AMBER, letterSpacing: "0.12em" }}>PHASE 2 — BRAND DETONATION</span>
                <h1 className="text-h2 text-text-primary" style={{ margin: "12px 0 0", fontWeight: 700 }}>{brand}</h1>
              </header>

              {!phase1Complete && <ErrorBanner message="Phase 1 must be complete (a selected SMP is required) before Brand Detonation can begin." />}
              {/* TODO: reinstate owner check */}
              {/* before commercial deployment */}

              {phase1Complete && (
                <div style={{ maxWidth: 880, margin: "0 auto" }}>
                  {activeStage === "17" && <Stage17 session={session} onChange={refresh} goNext={() => setActiveStage("17B")} />}
                  {activeStage === "17B" && <Stage17b session={session} onChange={refresh} goNext={() => setActiveStage("18")} />}
                  {activeStage === "18" && <Stage18 session={session} onChange={refresh} goNext={() => setActiveStage("19")} />}
                  {activeStage === "19" && <Stage19 session={session} onChange={refresh} goNext={() => setActiveStage("20")} />}
                  {activeStage === "20" && <Stage20 session={session} onChange={refresh} goNext={() => setActiveStage("21")} />}
                  {activeStage === "21" && <Stage21 session={session} onChange={refresh} goNext={() => setActiveStage("22")} />}
                  {activeStage === "22" && <Stage22 session={session} onChange={refresh} />}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// STAGE 17 — Detonation Territory
// ═════════════════════════════════════════════════════════════════════════
function Stage17({ session, onChange, goNext }: { session: SessionRow; onChange: () => void | Promise<void>; goNext: () => void }) {
  const run = useServerFn(runStage17);
  const load = useServerFn(loadStage17);
  const retry = useServerFn(retryStage17);
  const select = useServerFn(selectStage17Territory);

  const [output, setOutput] = useState<string | null>(session.stage_17_output);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [redirects, setRedirects] = useState<Record<string, string>>({});

  useEffect(() => {
    if (output === null) {
      load({ data: { sessionId: session.id } }).then((r) => r.output && setOutput(r.output)).catch(() => {});
    }
  }, [output, load, session.id]);

  const cards = useMemo(() => splitCardsLocal(output ?? ""), [output]);
  useEffect(() => {
    setChecked((prev) => {
      const next: Record<string, boolean> = {};
      cards.forEach((c) => { next[c.id] = prev[c.id] ?? true; });
      return next;
    });
  }, [cards.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRun = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await run({ data: { sessionId: session.id } });
      setOutput(r.output); onChange();
    } catch (e) { setErr(e instanceof Error ? e.message : "Stage 17 failed"); }
    finally { setBusy(false); }
  };

  const handleRetry = async () => {
    setBusy(true); setErr(null);
    try {
      const toRegen = cards.filter((c) => !checked[c.id]).map((c) => c.id);
      const r = await retry({ data: { sessionId: session.id, cardIds: toRegen, redirectInstructions: redirects } });
      setOutput(r.output); setRedirects({}); onChange();
    } catch (e) { setErr(e instanceof Error ? e.message : "Retry failed"); }
    finally { setBusy(false); }
  };

  const handleSelect = async (markdown: string) => {
    setBusy(true); setErr(null);
    try {
      await select({ data: { sessionId: session.id, territoryMarkdown: markdown } });
      await onChange();
      goNext();
    } catch (e) { setErr(e instanceof Error ? e.message : "Selection failed"); }
    finally { setBusy(false); }
  };

  return (
    <section>
      <SectionTitle kicker="STAGE 17" title="Detonation Territory" subtitle="Three candidate territories to explore. Uncheck any to regenerate; add a redirect to steer the rewrite." />
      {err && <ErrorBanner message={err} />}
      {!output ? (
        <AmberButton onClick={handleRun} disabled={busy}>
          {busy && <Spinner />} {busy ? "Generating…" : "Run Stage 17"}
        </AmberButton>
      ) : (
        <>
          {cards.map((c) => (
            <DetonationOutputCard
              key={c.id}
              cardId={c.id}
              title={c.name}
              content={sanitiseOutput(c.markdown.replace(/^##\s+.+\n?/, ""))}
              isChecked={checked[c.id] ?? true}
              onCheckChange={(id, v) => setChecked((p) => ({ ...p, [id]: v }))}
              redirectText={redirects[c.id] ?? ""}
              onRedirectChange={(id, v) => setRedirects((p) => ({ ...p, [id]: v }))}
              smp={session.selected_smp}
              showCheckbox={true}
            >
              <AmberButton onClick={() => handleSelect(c.markdown)} disabled={busy}>
                {busy && <Spinner />} {busy ? "Loading..." : "Select This Territory"}
              </AmberButton>
            </DetonationOutputCard>
          ))}
          <div style={{ marginTop: 24, display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <AmberButton variant="ghost" onClick={handleRetry} disabled={busy}>
              {busy && <Spinner />} Retry This Stage
            </AmberButton>
          </div>
        </>
      )}
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// STAGE 17B — Detonation Intelligence
// ═════════════════════════════════════════════════════════════════════════
function Stage17b({ session, onChange, goNext }: { session: SessionRow; onChange: () => void | Promise<void>; goNext: () => void }) {
  const run = useServerFn(runStage17b);
  const load = useServerFn(loadStage17b);
  const retry = useServerFn(retryStage17b);
  const [output, setOutput] = useState<string | null>(session.stage_17b_output);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [autoTriggered, setAutoTriggered] = useState(false);

  useEffect(() => {
    if (output === null) load({ data: { sessionId: session.id } }).then((r) => r.output && setOutput(r.output)).catch(() => {});
  }, [output, load, session.id]);

  const handleRun = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await run({ data: { sessionId: session.id } });
      setOutput(r.output); await onChange();
    } catch (e) { setErr(e instanceof Error ? e.message : "Stage 17B failed"); }
    finally { setBusy(false); }
  };
  const handleRetry = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await retry({ data: { sessionId: session.id, cardIds: [], redirectInstructions: {} } });
      setOutput(r.output); await onChange();
    } catch (e) { setErr(e instanceof Error ? e.message : "Retry failed"); }
    finally { setBusy(false); }
  };

  // Auto-run once on mount when the prerequisite is in place and we have no output yet.
  useEffect(() => {
    if (autoTriggered) return;
    if (!session.stage_17_selected_territory) return;
    if (output !== null && output !== "") return;
    if (busy) return;
    setAutoTriggered(true);
    void handleRun();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.stage_17_selected_territory, output]);

  const handleProceed = async () => { await onChange(); goNext(); };

  return (
    <section>
      <SectionTitle kicker="STAGE 17B" title="Detonation Intelligence"
        subtitle="Benchmark + differentiation guidance for the selected territory." />
      {err && <ErrorBanner message={err} />}
      {!output ? (
        <AmberButton onClick={handleRun} disabled={busy}>
          {busy && <Spinner />} {busy ? "Generating…" : "Run Stage 17B"}
        </AmberButton>
      ) : (
        <div style={{
          backgroundColor: "#111111", border: "1px solid #2A2A2A",
          borderRadius: 8, padding: 28,
        }}>
          <RichOutput text={output} />
          <div style={{ marginTop: 28, display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <AmberButton variant="ghost" onClick={handleRetry} disabled={busy}>{busy && <Spinner />} Retry</AmberButton>
            <AmberButton onClick={handleProceed}>Proceed to Stage 18</AmberButton>
          </div>
        </div>
      )}
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// STAGE 18 — The Detonation
// ═════════════════════════════════════════════════════════════════════════
function Stage18({ session, onChange, goNext }: { session: SessionRow; onChange: () => void | Promise<void>; goNext: () => void }) {
  const run = useServerFn(runStage18);
  const load = useServerFn(loadStage18);
  const retry = useServerFn(retryStage18);
  const select = useServerFn(selectStage18Detonation);

  const [output, setOutput] = useState<string | null>(session.stage_18_output);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [redirects, setRedirects] = useState<Record<string, string>>({});
  const [courageDismissed, setCourageDismissed] = useState(false);

  useEffect(() => {
    if (output === null) load({ data: { sessionId: session.id } }).then((r) => r.output && setOutput(r.output)).catch(() => {});
  }, [output, load, session.id]);

  const cards = useMemo(() => splitCardsLocal(output ?? ""), [output]);
  useEffect(() => {
    setChecked((prev) => {
      const next: Record<string, boolean> = {};
      cards.forEach((c) => { next[c.id] = prev[c.id] ?? true; });
      return next;
    });
  }, [cards.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const courageAbsent = cards.length === 3 && cards.every((c) =>
    /STRATEGIC\s+DISCOMFORT\s+ABSENT/i.test(c.markdown),
  );

  const handleRun = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await run({ data: { sessionId: session.id } });
      setOutput(r.output); setCourageDismissed(false); onChange();
    } catch (e) { setErr(e instanceof Error ? e.message : "Stage 18 failed"); }
    finally { setBusy(false); }
  };

  const handleRetry = async (courage: boolean) => {
    setBusy(true); setErr(null);
    try {
      const toRegen = courage ? cards.map((c) => c.id) : cards.filter((c) => !checked[c.id]).map((c) => c.id);
      const r = await retry({ data: {
        sessionId: session.id, cardIds: toRegen,
        redirectInstructions: redirects, courageRedirect: courage,
      } });
      setOutput(r.output); setRedirects({});
      // After a courage redirect, suppress the banner for this generation cycle
      // regardless of whether discomfort markers are present in the new output.
      if (courage) setCourageDismissed(true);
      else setCourageDismissed(false);
      onChange();
    } catch (e) { setErr(e instanceof Error ? e.message : "Retry failed"); }
    finally { setBusy(false); }
  };

  const handleSelect = async (markdown: string) => {
    setBusy(true); setErr(null);
    try {
      await select({ data: { sessionId: session.id, detonationMarkdown: markdown } });
      await onChange();
      goNext();
    } catch (e) { setErr(e instanceof Error ? e.message : "Selection failed"); }
    finally { setBusy(false); }
  };

  return (
    <section>
      <SectionTitle kicker="STAGE 18" title="The Detonation" subtitle="Three Detonation candidates. Uncheck any to regenerate; add a redirect to steer the rewrite." />
      {err && <ErrorBanner message={err} />}
      {!output ? (
        <AmberButton onClick={handleRun} disabled={busy || !session.stage_17b_output}>
          {busy && <Spinner />} {busy ? "Generating…" : "Run Stage 18"}
        </AmberButton>
      ) : (
        <>
          {courageAbsent && !courageDismissed && (
            <div style={{
              backgroundColor: "#1A1208", borderLeft: `4px solid ${AMBER}`,
              border: "1px solid #2A2A2A", borderRadius: 8, padding: 20, marginBottom: 20,
            }}>
              <div className="text-mono" style={{
                color: AMBER, textTransform: "uppercase", fontSize: 11,
                letterSpacing: "0.14em", marginBottom: 8,
              }}>COURAGE REVIEW</div>
              <p className="text-body" style={{ color: "#FFFFFF", lineHeight: 1.6, margin: 0 }}>
                None of these ideas generated strategic discomfort. This may indicate the territory is not being pushed hard enough.
              </p>
              <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
                <AmberButton variant="ghost" onClick={() => setCourageDismissed(true)}>Proceed with Selection</AmberButton>
                <AmberButton onClick={() => handleRetry(true)} disabled={busy}>
                  {busy && <Spinner />} Courage Redirect
                </AmberButton>
              </div>
            </div>
          )}
          {cards.map((c) => (
            <DetonationOutputCard
              key={c.id}
              cardId={c.id}
              title={c.name}
              content={sanitiseOutput(c.markdown.replace(/^##\s+.+\n?/, ""))}
              isChecked={checked[c.id] ?? true}
              onCheckChange={(id, v) => setChecked((p) => ({ ...p, [id]: v }))}
              redirectText={redirects[c.id] ?? ""}
              onRedirectChange={(id, v) => setRedirects((p) => ({ ...p, [id]: v }))}
              smp={session.selected_smp}
              showCheckbox={true}
            >
              <AmberButton onClick={() => handleSelect(c.markdown)} disabled={busy}>
                {busy && <Spinner />} {busy ? "Loading..." : "Select This Detonation"}
              </AmberButton>
            </DetonationOutputCard>
          ))}
          <div style={{ marginTop: 24, display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <AmberButton variant="ghost" onClick={() => handleRetry(false)} disabled={busy}>
              {busy && <Spinner />} Retry This Stage
            </AmberButton>
          </div>
        </>
      )}
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// STAGE 19 — Activation Architecture
// ═════════════════════════════════════════════════════════════════════════
function Stage19({ session, onChange, goNext }: { session: SessionRow; onChange: () => void | Promise<void>; goNext: () => void }) {
  const run = useServerFn(runStage19);
  const load = useServerFn(loadStage19);
  const retry = useServerFn(retryStage19);
  const [output, setOutput] = useState<string | null>(session.stage_19_output);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [autoTriggered, setAutoTriggered] = useState(false);

  useEffect(() => {
    if (output === null) load({ data: { sessionId: session.id } }).then((r) => r.output && setOutput(r.output)).catch(() => {});
  }, [output, load, session.id]);

  const handleRun = async () => {
    setBusy(true); setErr(null);
    try { const r = await run({ data: { sessionId: session.id } }); setOutput(r.output); await onChange(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Stage 19 failed"); }
    finally { setBusy(false); }
  };
  const handleRetry = async () => {
    setBusy(true); setErr(null);
    try { const r = await retry({ data: { sessionId: session.id, cardIds: [], redirectInstructions: {} } }); setOutput(r.output); await onChange(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Retry failed"); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    if (autoTriggered) return;
    if (!session.stage_18_selected_detonation) return;
    if (output !== null && output !== "") return;
    if (busy) return;
    setAutoTriggered(true);
    void handleRun();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.stage_18_selected_detonation, output]);

  const handleProceed = async () => { await onChange(); goNext(); };

  return (
    <section>
      <SectionTitle kicker="STAGE 19" title="Activation Architecture"
        subtitle="Calibration, channel hierarchy, compounding strategy, and distinctive asset activation." />
      {err && <ErrorBanner message={err} />}
      {!output ? (
        <AmberButton onClick={handleRun} disabled={busy}>
          {busy && <Spinner />} {busy ? "Generating…" : "Run Stage 19"}
        </AmberButton>
      ) : (
        <div style={{ backgroundColor: "#111111", border: "1px solid #2A2A2A", borderRadius: 8, padding: 28 }}>
          <RichOutput text={output} />
          <div style={{ marginTop: 28, display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <AmberButton variant="ghost" onClick={handleRetry} disabled={busy}>{busy && <Spinner />} Retry</AmberButton>
            <AmberButton onClick={handleProceed}>Proceed to Stage 20</AmberButton>
          </div>
        </div>
      )}
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// STAGE 20 — Master Detonation Brief
// ═════════════════════════════════════════════════════════════════════════
function Stage20({ session, onChange, goNext }: { session: SessionRow; onChange: () => void | Promise<void>; goNext: () => void }) {
  const run = useServerFn(runStage20);
  const load = useServerFn(loadStage20);
  const retry = useServerFn(retryStage20);
  const regenSection = useServerFn(regenerateStage20Section);
  const approve = useServerFn(approveStage20);

  const [output, setOutput] = useState<string | null>(session.stage_20_output);
  const [approved, setApproved] = useState<boolean>(Boolean(session.stage_20_approved));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [autoTriggered, setAutoTriggered] = useState(false);

  useEffect(() => {
    if (output === null) load({ data: { sessionId: session.id } }).then((r) => {
      if (r.output) setOutput(r.output); setApproved(r.approved);
    }).catch(() => {});
  }, [output, load, session.id]);

  const sections = useMemo(() => parseStage20Local(output ?? ""), [output]);
  const { score } = useMemo(() => parseScoreLocal(output ?? ""), [output]);

  const handleRun = async () => {
    setBusy(true); setErr(null);
    try { const r = await run({ data: { sessionId: session.id } }); setOutput(r.output); await onChange(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Stage 20 failed"); }
    finally { setBusy(false); }
  };
  const handleRetry = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await retry({ data: { sessionId: session.id, cardIds: [], redirectInstructions: {} } });
      setOutput(r.output); setApproved(false); await onChange();
    } catch (e) { setErr(e instanceof Error ? e.message : "Retry failed"); }
    finally { setBusy(false); }
  };

  const handleSectionRegen = async (sectionId: string, feedback: string): Promise<string> => {
    const r = await regenSection({ data: { sessionId: session.id, sectionId, feedback } });
    setOutput(r.output); setApproved(false); await onChange();
    const updated = parseStage20Local(r.output).find((s) => s.id === sectionId);
    return updated?.content ?? "";
  };

  const handleApprove = async () => {
    setBusy(true); setErr(null);
    try { await approve({ data: { sessionId: session.id } }); setApproved(true); await onChange(); goNext(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Approval failed"); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    if (autoTriggered) return;
    if (!session.stage_19_output) return;
    if (output !== null && output !== "") return;
    if (busy) return;
    setAutoTriggered(true);
    void handleRun();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.stage_19_output, output]);

  const handleProceed = async () => { await onChange(); goNext(); };


  const composite = score.composite ?? 0;
  const canApprove = composite >= 40 && !approved;

  return (
    <section>
      <SectionTitle kicker="STAGE 20" title="Master Detonation Brief" subtitle="Click any section to add feedback and regenerate it in place." />
      {err && <ErrorBanner message={err} />}
      {!output ? (
        <AmberButton onClick={handleRun} disabled={busy}>{busy && <Spinner />} {busy ? "Generating…" : "Run Stage 20"}</AmberButton>
      ) : (
        <>
          <div style={{ backgroundColor: "#111111", border: "1px solid #2A2A2A", borderRadius: 8, padding: 28 }}>
            {sections.length === 0 ? (
              <RichOutput text={output.replace(/BRIEF\s+QUALITY\s+SCORE[\s\S]*$/i, "").trim()} />
            ) : (
              sections.map((s) => (
                <DetonationBriefSection
                  key={s.id}
                  sectionId={s.id}
                  label={s.label}
                  content={sanitiseOutput(s.content)}
                  onRegenerate={handleSectionRegen}
                  onContentUpdate={() => { /* state already updated via handler */ }}
                />
              ))
            )}
          </div>

          {/* Brief Quality Score */}
          <div style={{
            marginTop: 24, backgroundColor: "#111111", border: "1px solid #2A2A2A",
            borderRadius: 8, padding: 24,
          }}>
            <div className="text-mono" style={{
              color: AMBER, textTransform: "uppercase", fontSize: 11,
              letterSpacing: "0.14em", marginBottom: 16,
            }}>BRIEF QUALITY SCORE</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
              {[
                ["Emotional Clarity", score.emotional_clarity],
                ["Fame Invitation", score.fame_invitation],
                ["Distinctive Assets", score.distinctive_asset_integration],
                ["Psychological Leverage", score.psychological_leverage],
                ["Creative SoV Ambition", score.creative_sov_ambition],
              ].map(([label, val]) => (
                <div key={label as string} style={{ borderTop: `1px solid ${AMBER}26`, paddingTop: 10 }}>
                  <div className="text-mono" style={{ color: "#8A8680", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</div>
                  <div className="text-body" style={{ color: "#FFFFFF", fontSize: 18, marginTop: 4 }}>
                    {typeof val === "number" ? `${val}/10` : "—/10"}
                  </div>
                </div>
              ))}
            </div>
            <div style={{
              marginTop: 20, display: "flex", alignItems: "center", justifyContent: "space-between",
              borderTop: `1px solid ${AMBER}26`, paddingTop: 16,
            }}>
              <div>
                <div className="text-mono" style={{ color: "#8A8680", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em" }}>Composite</div>
                <div className="text-body" style={{ color: AMBER, fontSize: 24, fontWeight: 600 }}>{composite}/50</div>
              </div>
              <div className="text-mono" style={{
                color: score.status === "PASS" ? AMBER : "#FFFFFF",
                fontSize: 16, textTransform: "uppercase", letterSpacing: "0.16em", fontWeight: 600,
              }}>
                {score.status ?? "REVIEW"}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 24, display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <AmberButton variant="ghost" onClick={handleRetry} disabled={busy}>{busy && <Spinner />} Retry</AmberButton>
            {approved ? (
              <AmberButton onClick={handleProceed}>Proceed to Stage 21</AmberButton>
            ) : (
              <AmberButton onClick={handleApprove} disabled={!canApprove || busy}>
                {busy && <Spinner />} Approve Brief
              </AmberButton>
            )}
          </div>
        </>
      )}
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// STAGE 21 — Channel Briefs
// ═════════════════════════════════════════════════════════════════════════
function Stage21({ session, onChange, goNext }: { session: SessionRow; onChange: () => void | Promise<void>; goNext: () => void }) {
  const run = useServerFn(runStage21);
  const load = useServerFn(loadStage21);
  const [outputs, setOutputs] = useState<Record<string, string> | null>(session.stage_21_outputs);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [autoTriggered, setAutoTriggered] = useState(false);

  useEffect(() => {
    if (outputs === null) load({ data: { sessionId: session.id } }).then((r) => r.outputs && setOutputs(r.outputs)).catch(() => {});
  }, [outputs, load, session.id]);

  const handleRun = async () => {
    setBusy(true); setErr(null);
    try { const r = await run({ data: { sessionId: session.id } }); setOutputs(r.outputs); await onChange(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Stage 21 failed"); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    if (autoTriggered) return;
    if (!session.stage_20_approved) return;
    if (outputs !== null && Object.keys(outputs).length > 0) return;
    if (busy) return;
    setAutoTriggered(true);
    void handleRun();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.stage_20_approved, outputs]);

  const handleProceed = async () => { await onChange(); goNext(); };


  const download = (filename: string, content: string) => {
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };
  const downloadAll = () => {
    if (!outputs) return;
    const combined = Object.entries(outputs)
      .map(([channel, body]) => `# ${channel}\n\n${body}`).join("\n\n---\n\n");
    download(`${session.brand_name ?? "brand"}-channel-briefs.md`, combined);
  };

  return (
    <section>
      <SectionTitle kicker="STAGE 21" title="Channel Briefs" subtitle="One detonation brief per active channel. Click a card to expand." />
      {err && <ErrorBanner message={err} />}
      {!outputs || Object.keys(outputs).length === 0 ? (
        <AmberButton onClick={handleRun} disabled={busy || !session.stage_20_approved}>
          {busy && <Spinner />} {busy ? "Generating channel briefs…" : "Run Stage 21"}
        </AmberButton>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {Object.entries(outputs).map(([channel, body]) => {
              const isOpen = expanded === channel;
              const roleMatch = body.match(/CHANNEL\s+ROLE\s*[:\-]?\s*([^\n]+)/i);
              const role = roleMatch ? roleMatch[1].trim() : "Channel Brief";
              return (
                <div key={channel} style={{
                  backgroundColor: "#111111", border: "1px solid #2A2A2A",
                  borderRadius: 8, padding: 20,
                }}>
                  <button type="button" onClick={() => setExpanded(isOpen ? null : channel)}
                    style={{ width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                    <div className="text-mono" style={{ color: AMBER, textTransform: "uppercase", fontSize: 11, letterSpacing: "0.14em" }}>{channel}</div>
                    <div className="text-body-sm" style={{ color: "#8A8680", marginTop: 4 }}>{role}</div>
                  </button>
                  {isOpen && (
                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${AMBER}26` }}>
                      <RichOutput text={body} />
                    </div>
                  )}
                  <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
                    <button type="button" onClick={() => download(`${channel.replace(/\s+/g, "-").toLowerCase()}-brief.md`, body)}
                      className="text-mono" style={{
                        background: "none", border: `1px solid ${AMBER}40`, color: AMBER,
                        padding: "6px 12px", borderRadius: 6, fontSize: 10, letterSpacing: "0.12em",
                        textTransform: "uppercase", cursor: "pointer",
                      }}>Download</button>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 24, display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <AmberButton variant="ghost" onClick={downloadAll}>Download All Channel Briefs</AmberButton>
            <AmberButton onClick={handleProceed}>Proceed to Stage 22</AmberButton>
          </div>
        </>
      )}
    </section>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// STAGE 22 — Brand Architecture
// ═════════════════════════════════════════════════════════════════════════
const ARCH_COMPONENTS = ["REFLECTION", "DOMAIN", "HERITAGE", "VALUES", "ASSETS", "PERSONALITY"] as const;

function extractArchSection(arch: string, label: string): string {
  const re = new RegExp(`(?:^|\\n)\\s*(?:#{1,4}\\s*|\\*+\\s*)?${label}\\b[^\\n]*\\n([\\s\\S]*?)(?=\\n\\s*(?:#{1,4}\\s*|\\*+\\s*)?(?:${ARCH_COMPONENTS.join("|")})\\b|$)`, "i");
  const m = arch.match(re);
  return m ? m[1].trim() : "";
}

function Stage22({ session, onChange }: { session: SessionRow; onChange: () => void | Promise<void> }) {
  const run = useServerFn(runStage22);
  const load = useServerFn(loadStage22);
  const [architecture, setArchitecture] = useState<string | null>(session.stage_22_brand_architecture);
  const [assets, setAssets] = useState<string | null>(session.stage_22_distinctive_assets);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [autoTriggered, setAutoTriggered] = useState(false);

  useEffect(() => {
    if (architecture === null && assets === null) {
      load({ data: { sessionId: session.id } }).then((r) => {
        if (r.architecture) setArchitecture(r.architecture);
        if (r.assets) setAssets(r.assets);
      }).catch(() => {});
    }
  }, [architecture, assets, load, session.id]);

  const handleRun = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await run({ data: { sessionId: session.id } });
      setArchitecture(r.architecture); setAssets(r.assets); await onChange();
    } catch (e) { setErr(e instanceof Error ? e.message : "Stage 22 failed"); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    if (autoTriggered) return;
    const stage21Ready = session.stage_21_outputs && Object.keys(session.stage_21_outputs).length > 0;
    if (!stage21Ready) return;
    if (architecture !== null && architecture !== "") return;
    if (busy) return;
    setAutoTriggered(true);
    void handleRun();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.stage_21_outputs, architecture]);


  const printPdf = () => window.print();

  const reflection = architecture ? extractArchSection(architecture, "REFLECTION") : "";
  const peripherals = (["DOMAIN", "HERITAGE", "VALUES", "ASSETS", "PERSONALITY"] as const)
    .map((label) => ({ label, content: architecture ? extractArchSection(architecture, label) : "" }));

  return (
    <section>
      <SectionTitle kicker="STAGE 22" title="Brand Architecture" subtitle="The completed brand architecture and distinctive asset architecture." />
      {err && <ErrorBanner message={err} />}
      {!architecture ? (
        <AmberButton onClick={handleRun} disabled={busy || !session.stage_20_approved}>
          {busy && <Spinner />} {busy ? "Generating…" : "Run Stage 22"}
        </AmberButton>
      ) : (
        <div id="phase2-print-region">
          {/* Visual layout: 5 peripherals around central reflection */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16,
            backgroundColor: "#0E0E0E", border: "1px solid #2A2A2A",
            borderRadius: 12, padding: 24,
          }}>
            {peripherals.slice(0, 3).map((p) => <ArchBox key={p.label} {...p} />)}
            <ArchBox {...peripherals[3]} />
            <div style={{
              backgroundColor: AMBER, color: "#0A0A0A",
              borderRadius: 8, padding: 24, display: "flex", flexDirection: "column", justifyContent: "center",
            }}>
              <div className="text-mono" style={{
                textTransform: "uppercase", fontSize: 11, letterSpacing: "0.18em", opacity: 0.7,
              }}>REFLECTION</div>
              <div className="text-mono" style={{
                fontSize: 18, lineHeight: 1.4, marginTop: 8, fontWeight: 600, whiteSpace: "pre-wrap",
              }}>{sanitiseOutput(reflection) || "—"}</div>
            </div>
            <ArchBox {...peripherals[4]} />
          </div>


          {/* Distinctive Assets */}
          {assets && (
            <div style={{ marginTop: 32 }}>
              <div className="text-mono" style={{
                color: AMBER, textTransform: "uppercase", fontSize: 12,
                letterSpacing: "0.16em", marginBottom: 16,
              }}>DISTINCTIVE ASSET ARCHITECTURE</div>
              <div style={{ backgroundColor: "#111111", border: "1px solid #2A2A2A", borderRadius: 8, padding: 24 }}>
                <RichOutput text={assets} />
              </div>
            </div>
          )}

          <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
            <AmberButton onClick={printPdf}>Download Brand Architecture</AmberButton>
          </div>
        </div>
      )}
    </section>
  );
}

function ArchBox({ label, content }: { label: string; content: string }) {
  return (
    <div style={{
      backgroundColor: "#161616", border: `1px solid ${AMBER}33`,
      borderRadius: 8, padding: 16, minHeight: 140,
    }}>
      <div className="text-mono" style={{
        color: AMBER, textTransform: "uppercase", fontSize: 10,
        letterSpacing: "0.16em", marginBottom: 8,
      }}>{label}</div>
      <div className="text-body-sm" style={{ color: "#FFFFFF", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{sanitiseOutput(content)}</div>
    </div>
  );
}
