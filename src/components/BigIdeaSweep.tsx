// CREATIVE STIMULUS ENGINE — BIG IDEA SWEEP UI.
//
// The corrected sequence: one 37-lens sweep against the SMP alone, Tissue
// Check, Gate One, then ONE winning idea and ONE winning line locked before
// any channel-specific brief exists.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  startBigIdeaRun,
  generateBigIdeaBatch,
  checkBigIdeaLines,
  lockWinningIdea,
  unlockWinningIdea,
} from "@/lib/stimulus-bigidea.functions";
import {
  loadStimulusRun,
  listStimulusRuns,
  triageStimulusDirection,
  reviseStimulusDirection,
} from "@/lib/stimulus.functions";
import { LENS_COUNT, getLens } from "@/lib/stimulus/lenses";
import { StimulusGateOne, type RatedDirection } from "@/components/StimulusGateOne";
import { ideaCardStyle, ideaListStyle, IDEA_COLUMN_WIDTH } from "@/components/stimulus/idea-layout";
import type { LineCheck } from "@/lib/stimulus/line-check-types";
import type { DirectionRatings } from "@/lib/stimulus/rating-prompts";

const AMBER = "#C81E1E";
const MUTED = "#8B8680";
const RED = "#C81E1E";
const GREEN = "#C81E1E";

/**
 * Convergence record. `inSweep` is written as each lens generates (compared
 * against the prior set, regenerated in a loop on collision); `fullSet` is the
 * second-pass ledger over all 37 root tensions.
 */
type ConvergenceVerdict = {
  verdict?: string;
  collidesWith?: string[];
  why?: string;
  regenerations?: number;
  forced?: boolean;
};
type IdeaConvergence = ConvergenceVerdict & { fullSet?: ConvergenceVerdict };

type Idea = {
  id: string;
  lens_id: string;
  lens_name: string;
  sort_order: number;
  direction: string;
  campaign_line: string | null;
  expression_under_master: string | null;
  master_line_at_generation: string | null;
  rationale: string | null;
  root_tension: string | null;
  convergence: IdeaConvergence | null;
  line_check: LineCheck | null;
  status: string;
  instinct_brief: string | null;
  revise_count: number;
  error: string | null;
  ratings: DirectionRatings | null;
  rating_status: string;
  rating_error: string | null;
  gate_one_approved: boolean;
  gate_one_approved_at: string | null;
  gate_one_notes: string | null;
};

type RunMeta = {
  id?: string;
  run_mode?: string;
  status?: string;
  winning_direction_id?: string | null;
  winning_line_direction_id?: string | null;
  winning_line?: string | null;
  locked_at?: string | null;
  tiebreaker_output?: string | null;
  tiebreaker_fired?: boolean;
  tiebreaker_reason?: string | null;
  gate_one_confirmed?: boolean;
  gate_one_confirmed_at?: string | null;
};

function Btn({
  children,
  onClick,
  active,
  disabled,
  tone = AMBER,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  tone?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="text-mono"
      style={{
        background: active ? `${tone}22` : "none",
        border: `1px solid ${active ? tone : "#1C1A18"}`,
        color: active ? tone : MUTED,
        padding: "6px 12px",
        borderRadius: 6,
        fontSize: 10,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}

function verdictTone(v: LineCheck["verdict"] | undefined) {
  if (v === "on_strategy") return GREEN;
  if (v === "generic") return RED;
  if (v === "drift") return RED;
  return MUTED;
}

function wordCount(v: string) {
  return v.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * FIELD 2 — Expression under master.
 *
 * Structurally cannot exist before Stage 18 locks a master line, so the
 * "candidate only" state below is the DEFAULT presentation for a first sweep,
 * not an error or an edge case. When Stage 17 is re-run the master line is
 * cleared and the stored pairing is nulled in the same operation (DB trigger
 * sessions_clear_orphaned_expressions), so this block falls back to the
 * candidate-only state immediately rather than showing a dead pairing.
 */
function ExpressionBlock({ d }: { d: Idea }) {
  const master = (d.master_line_at_generation ?? "").trim();
  const expression = (d.expression_under_master ?? "").trim();
  const paired = Boolean(master && expression);

  return (
    <div
      style={{
        marginTop: 14,
        borderRadius: 10,
        border: `1px dashed ${paired ? "#2A2724" : "#1C1A18"}`,
        backgroundColor: paired ? "#0A0908" : "transparent",
        padding: paired ? "14px 16px" : "12px 16px",
      }}
    >
      <div
        className="text-mono"
        style={{ color: MUTED, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase" }}
      >
        {paired ? "Field 2 · Expression under master" : "Field 2 · Not applicable yet"}
      </div>
      {paired ? (
        <>
          <div style={{ marginTop: 10, fontSize: 17, lineHeight: 1.45 }}>
            <span style={{ color: MUTED }}>{master}</span>{" "}
            <span style={{ color: "#EDE8E0" }}>{expression}</span>
          </div>
          <div className="text-body-sm" style={{ color: MUTED, marginTop: 8, lineHeight: 1.6 }}>
            Supporting copy under the locked master line (grey). Judged on whether this idea is
            strong enough to <em>serve</em> the existing line — it is not a candidate to replace it.
          </div>
        </>
      ) : (
        <div className="text-body-sm" style={{ color: MUTED, marginTop: 8, lineHeight: 1.6 }}>
          No master line locked yet — candidate only. The sweep runs against the proposition before
          the Detonation line exists, so on a first pass every lens produces Field 1 alone. Once
          Stage 18 locks a master line, re-run this lens to generate its expression underneath it.
        </div>
      )}
    </div>
  );
}

function LineBlock({ d }: { d: Idea }) {
  const c = d.line_check;
  const words = wordCount(d.campaign_line ?? "");
  const overLength = words > 7;
  return (
    <div style={{ marginTop: 18, borderTop: "1px solid #1C1A18", paddingTop: 16 }}>
      <div
        className="text-mono"
        style={{
          color: MUTED,
          fontSize: 10,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          display: "flex",
          gap: 10,
          alignItems: "baseline",
          flexWrap: "wrap",
        }}
      >
        <span>Field 1 · Candidate master line</span>
        {words > 0 && (
          <span style={{ color: overLength ? RED : MUTED }}>
            {words} {words === 1 ? "word" : "words"}
            {overLength ? " · over the 3–7 word standard" : ""}
          </span>
        )}
      </div>
      <div style={{ color: "#EDE8E0", fontSize: 20, marginTop: 8, lineHeight: 1.35 }}>
        {d.campaign_line?.trim() || "—"}
      </div>
      {c && (
        <div style={{ marginTop: 10 }}>
          <span
            className="text-mono"
            style={{
              border: `1px solid ${verdictTone(c.verdict)}`,
              color: verdictTone(c.verdict),
              borderRadius: 4,
              padding: "3px 8px",
              fontSize: 10,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            Line check · {c.verdict.replace("_", " ")}
          </span>
          <div className="text-body-sm" style={{ color: MUTED, marginTop: 8, lineHeight: 1.6 }}>
            <div>
              <strong style={{ color: "#EDE8E0" }}>Says:</strong> {c.says}
            </div>
            <div style={{ marginTop: 4 }}>{c.reasoning}</div>
            <div style={{ marginTop: 4 }}>
              <strong style={{ color: "#EDE8E0" }}>Swap test:</strong> {c.swap_test}
            </div>
          </div>
        </div>
      )}
      <ExpressionBlock d={d} />
    </div>
  );
}

/**
 * Root tension + collision state. The field label is "Idea collision check",
 * never "Anti-convergence" — sanitize-output.ts strips blocks under that label.
 */
function ConvergenceBlock({ d }: { d: Idea }) {
  const tension = (d.root_tension ?? "").trim();
  const inSweep = d.convergence ?? null;
  const fullSet = d.convergence?.fullSet ?? null;
  if (!tension && !inSweep) return null;

  const collides =
    (fullSet?.verdict ?? "").toUpperCase() === "COLLIDES" ||
    (fullSet == null && (inSweep?.verdict ?? "").toUpperCase() === "COLLIDES");
  const hits = (fullSet?.collidesWith ?? inSweep?.collidesWith ?? []).filter(Boolean);
  const why = (fullSet?.why ?? inSweep?.why ?? "").trim();
  const regens = inSweep?.regenerations ?? 0;
  const tone = collides ? RED : MUTED;

  return (
    <div style={{ marginTop: 18, borderTop: "1px solid #1C1A18", paddingTop: 16 }}>
      <div
        className="text-mono"
        style={{
          color: MUTED,
          fontSize: 10,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          display: "flex",
          gap: 10,
          alignItems: "baseline",
          flexWrap: "wrap",
        }}
      >
        <span>Idea collision check</span>
        <span style={{ border: `1px solid ${tone}`, color: tone, borderRadius: 4, padding: "3px 8px" }}>
          {collides ? "Collides" : "Clear"}
        </span>
        {fullSet && <span>Full-set ledger</span>}
        {regens > 0 && (
          <span>
            {regens} regeneration{regens === 1 ? "" : "s"} to clear
          </span>
        )}
      </div>
      {tension && (
        <div className="text-body-sm" style={{ color: "#EDE8E0", marginTop: 8, lineHeight: 1.6 }}>
          <strong style={{ color: MUTED }}>Root tension:</strong> {tension}
        </div>
      )}
      {collides && (
        <div className="text-body-sm" style={{ color: tone, marginTop: 8, lineHeight: 1.6 }}>
          Shares a root tension with {hits.length > 0 ? hits.join(", ") : "another lens"}
          {why ? ` — ${why}` : "."}
        </div>
      )}
    </div>
  );
}

function IdeaCard({
  d,
  isWinner,
  isLineWinner,
  locked,
  onTriage,
  onRevise,
  onPickIdea,
  onPickLine,
}: {
  d: Idea;
  isWinner: boolean;
  isLineWinner: boolean;
  locked: boolean;
  onTriage: (status: "keep" | "keep_in_play" | "kill", instinct: string) => Promise<void>;
  onRevise: (notes: string) => Promise<void>;
  onPickIdea: () => void;
  onPickLine: () => void;
}) {
  const lens = getLens(d.lens_id);
  const [instinct, setInstinct] = useState(d.instinct_brief ?? "");
  const [notes, setNotes] = useState("");
  const [showRevise, setShowRevise] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => setInstinct(d.instinct_brief ?? ""), [d.instinct_brief]);

  return (
    <div
      style={ideaCardStyle({
        accent: isWinner ? AMBER : d.status === "keep" ? `${AMBER}77` : null,
        dimmed: d.status === "kill",
      })}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "baseline" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14, minWidth: 0 }}>
          <span className="text-mono" style={{ color: `${AMBER}88`, fontSize: 22, lineHeight: 1 }}>
            {String(d.sort_order + 1).padStart(2, "0")}
          </span>
          <span
            style={{
              color: AMBER,
              fontFamily: "Inter, system-ui, sans-serif",
              fontSize: 16,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            {d.lens_name}
          </span>
        </div>
        {(isWinner || isLineWinner) && (
          <span className="text-mono" style={{ color: AMBER, fontSize: 10, letterSpacing: "0.12em" }}>
            {isWinner ? "WINNING IDEA" : ""} {isLineWinner ? "WINNING LINE" : ""}
          </span>
        )}
      </div>
      {lens && (
        <div className="text-body-sm" style={{ color: MUTED, marginTop: 8 }}>
          {lens.approach}
        </div>
      )}

      <div
        className="text-body-sm"
        style={{ color: "#EDE8E0", marginTop: 20, whiteSpace: "pre-wrap", lineHeight: 1.75, fontSize: 15 }}
      >
        {d.direction || d.error || "Not generated."}
      </div>

      <LineBlock d={d} />

      {d.rationale && (
        <div style={{ marginTop: 18, borderTop: "1px solid #1C1A18", paddingTop: 16 }}>
          <div
            className="text-mono"
            style={{ color: MUTED, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase" }}
          >
            Why it wins
          </div>
          <div
            className="text-body-sm"
            style={{ color: "#EDE8E0", marginTop: 8, whiteSpace: "pre-wrap", lineHeight: 1.7 }}
          >
            {d.rationale}
          </div>
        </div>
      )}

      <textarea
        value={instinct}
        onChange={(e) => setInstinct(e.target.value)}
        rows={2}
        placeholder="Initial instinct — what you'd do with this, in your own words."
        style={{
          width: "100%",
          marginTop: 16,
          backgroundColor: "#0A0908",
          color: "#EDE8E0",
          border: "1px solid #1C1A18",
          borderRadius: 6,
          padding: 10,
          fontFamily: "inherit",
          fontSize: 13,
          resize: "vertical",
        }}
      />

      <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {(["keep", "keep_in_play", "kill"] as const).map((t) => (
          <Btn
            key={t}
            active={d.status === t}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onTriage(t, instinct);
              } finally {
                setBusy(false);
              }
            }}
          >
            {t.replace("_", " ")}
          </Btn>
        ))}
        <Btn onClick={() => setShowRevise((v) => !v)} disabled={busy}>
          Revise
        </Btn>
        <Btn onClick={onPickIdea} active={isWinner} disabled={locked}>
          Select as winning idea
        </Btn>
        <Btn onClick={onPickLine} active={isLineWinner} disabled={locked || !d.campaign_line}>
          Use this line
        </Btn>
      </div>

      {showRevise && (
        <div style={{ marginTop: 12 }}>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="What to change — the lens stays, the idea and line get rewritten."
            style={{
              width: "100%",
              backgroundColor: "#0A0908",
              color: "#EDE8E0",
              border: `1px solid ${AMBER}40`,
              borderRadius: 6,
              padding: 10,
              fontFamily: "inherit",
              fontSize: 13,
              resize: "vertical",
            }}
          />
          <div style={{ marginTop: 8 }}>
            <Btn
              disabled={busy || !notes.trim()}
              onClick={async () => {
                setBusy(true);
                try {
                  await onRevise(notes.trim());
                  setNotes("");
                  setShowRevise(false);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Rewriting…" : "Rewrite through this lens"}
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}

export function BigIdeaSweep({
  sessionId,
  onLocked,
}: {
  sessionId: string;
  onLocked?: () => void;
}) {
  const start = useServerFn(startBigIdeaRun);
  const batch = useServerFn(generateBigIdeaBatch);
  const load = useServerFn(loadStimulusRun);
  const listRuns = useServerFn(listStimulusRuns);
  const checkLines = useServerFn(checkBigIdeaLines);
  const lock = useServerFn(lockWinningIdea);
  const unlock = useServerFn(unlockWinningIdea);
  const triage = useServerFn(triageStimulusDirection);
  const revise = useServerFn(reviseStimulusDirection);

  const [runId, setRunId] = useState<string | null>(null);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [run, setRun] = useState<RunMeta>({});
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [view, setView] = useState<"ideas" | "lines">("ideas");
  const [pickIdea, setPickIdea] = useState<string | null>(null);
  const [pickLine, setPickLine] = useState<string | null>(null);

  const refresh = useCallback(
    async (id: string) => {
      const r = await load({ data: { runId: id } });
      const list = r.directions as unknown as Idea[];
      setIdeas(list);
      setRun(r.run as RunMeta);
      setPickIdea((r.run as RunMeta).winning_direction_id ?? null);
      setPickLine((r.run as RunMeta).winning_line_direction_id ?? null);
      setProgress(list.filter((d) => d.status !== "pending").length);
    },
    [load],
  );

  // Open the session's existing big idea sweep, if there is one.
  useEffect(() => {
    void (async () => {
      try {
        const r = await listRuns({ data: { sessionId } });
        const rows = r.runs as { id: string; run_mode?: string }[];
        const big = rows.find((x) => x.run_mode === "big_idea");
        if (big) {
          setRunId(big.id);
          await refresh(big.id);
        }
      } catch {
        /* non-fatal */
      }
    })();
  }, [listRuns, refresh, sessionId]);

  const runSweep = async (force: boolean) => {
    setBusy(true);
    setErr(null);
    try {
      const { runId: id } = await start({ data: { sessionId, force } });
      setRunId(id);
      await refresh(id);
      let done = false;
      while (!done) {
        const r = await batch({ data: { runId: id, batchSize: 3 } });
        done = r.done;
        setProgress(LENS_COUNT - r.remaining);
        await refresh(id);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Big idea sweep failed");
    } finally {
      setBusy(false);
    }
  };

  const locked = Boolean(run.locked_at);
  const counts = useMemo(
    () => ({
      keep: ideas.filter((d) => d.status === "keep").length,
      play: ideas.filter((d) => d.status === "keep_in_play").length,
      kill: ideas.filter((d) => d.status === "kill").length,
      unchecked: ideas.filter((d) => d.campaign_line && !d.line_check).length,
    }),
    [ideas],
  );

  const lines = useMemo(
    () => ideas.filter((d) => (d.campaign_line ?? "").trim()),
    [ideas],
  );

  const chosenIdea = ideas.find((d) => d.id === pickIdea) ?? null;
  const chosenLine = ideas.find((d) => d.id === pickLine) ?? null;

  return (
    <div style={{ width: "100%" }}>
      <div style={{ maxWidth: IDEA_COLUMN_WIDTH, margin: "0 auto" }}>
        <div
          className="text-mono"
          style={{ color: AMBER, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase" }}
        >
          Step 1 · The big idea, before any channel
        </div>
        <p className="text-body-sm" style={{ color: MUTED, marginTop: 8, lineHeight: 1.7 }}>
          One sweep of all {LENS_COUNT} lenses against the approved proposition, verbatim, with the
          strategic truths as supporting evidence only. No channel brief is read or referenced here.
          Each lens returns its strongest idea, a candidate master line built to the 3–7 word poster
          standard, and the case for taking it forward. Where a master line is already locked, each
          lens also returns the supporting expression that sits underneath it. One idea and one
          master line get locked — then, and only then, channel briefs adapt them.
        </p>

        {err && (
          <div className="text-body-sm" style={{ color: RED, marginTop: 12 }}>
            {err}
          </div>
        )}

        <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <Btn onClick={() => void runSweep(false)} disabled={busy} active>
            {busy
              ? `Generating ${progress}/${LENS_COUNT}…`
              : ideas.length > 0
                ? "Resume sweep"
                : `Run ${LENS_COUNT}-lens big idea sweep`}
          </Btn>
          {ideas.length > 0 && (
            <Btn onClick={() => void runSweep(true)} disabled={busy || locked}>
              Start a fresh sweep
            </Btn>
          )}
          {runId && lines.length > 0 && (
            <Btn
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setErr(null);
                try {
                  await checkLines({ data: { runId, recheck: false } });
                  await refresh(runId);
                } catch (e) {
                  setErr(e instanceof Error ? e.message : "Line check failed");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {counts.unchecked > 0 ? `Check ${counts.unchecked} lines on strategy` : "Re-check lines"}
            </Btn>
          )}
        </div>

        {ideas.length > 0 && (
          <div style={{ marginTop: 22, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <span className="text-mono" style={{ color: MUTED, fontSize: 10, letterSpacing: "0.12em" }}>
              TISSUE CHECK — {counts.keep} keep · {counts.play} in play · {counts.kill} killed
            </span>
            <Btn active={view === "ideas"} onClick={() => setView("ideas")}>
              Ideas
            </Btn>
            <Btn active={view === "lines"} onClick={() => setView("lines")}>
              Candidate master lines ({lines.length})
            </Btn>
          </div>
        )}

        {/* Selection panel — exactly one idea, exactly one line. */}
        {ideas.length > 0 && (
          <div
            style={{
              marginTop: 22,
              border: `1px solid ${locked ? AMBER : "#1C1A18"}`,
              borderRadius: 12,
              padding: "18px 22px",
              backgroundColor: "#0A0908",
            }}
          >
            <div
              className="text-mono"
              style={{ color: locked ? AMBER : MUTED, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase" }}
            >
              {locked ? "Locked campaign idea" : "Select one idea and one candidate master line"}
            </div>
            <div className="text-body-sm" style={{ color: "#EDE8E0", marginTop: 10, lineHeight: 1.7 }}>
              <div>
                <strong style={{ color: AMBER }}>Idea:</strong>{" "}
                {chosenIdea ? `${chosenIdea.lens_name} — ${chosenIdea.direction.slice(0, 160)}…` : "— none selected"}
              </div>
              <div style={{ marginTop: 6 }}>
                <strong style={{ color: AMBER }}>Master line:</strong>{" "}
                {chosenLine?.campaign_line ?? "— none selected"}
                {chosenLine && chosenIdea && chosenLine.id !== chosenIdea.id && (
                  <span className="text-mono" style={{ color: MUTED, fontSize: 10, marginLeft: 8 }}>
                    (paired from {chosenLine.lens_name})
                  </span>
                )}
              </div>
            </div>
            <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {!locked && (
                <Btn
                  active
                  disabled={busy || !pickIdea || !pickLine}
                  onClick={async () => {
                    if (!runId || !pickIdea || !pickLine) return;
                    setBusy(true);
                    setErr(null);
                    try {
                      await lock({ data: { runId, directionId: pickIdea, lineDirectionId: pickLine } });
                      await refresh(runId);
                      onLocked?.();
                    } catch (e) {
                      setErr(e instanceof Error ? e.message : "Lock failed");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Lock this idea and line
                </Btn>
              )}
              {locked && (
                <Btn
                  disabled={busy}
                  tone={RED}
                  onClick={async () => {
                    if (!runId) return;
                    setBusy(true);
                    try {
                      await unlock({ data: { runId } });
                      await refresh(runId);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Unlock
                </Btn>
              )}
            </div>
            {locked && (
              <div className="text-body-sm" style={{ color: MUTED, marginTop: 12, lineHeight: 1.7 }}>
                Channel briefs generated from here on are bound to this idea and line. Regenerate
                Stage 21 in the Strategy Pipeline to cascade it.
              </div>
            )}
          </div>
        )}
      </div>

      {/* The line pool — Field 1 only. Field 2 is never eligible to become the
          master line, so it deliberately does not appear here. */}
      {view === "lines" && lines.length > 0 && (
        <div style={{ ...ideaListStyle, marginTop: 28, gap: 14 }}>
          {lines.map((d) => (
            <div key={d.id} style={ideaCardStyle({ accent: d.id === pickLine ? AMBER : null })}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "baseline" }}>
                <div style={{ color: "#EDE8E0", fontSize: 20, lineHeight: 1.35 }}>{d.campaign_line}</div>
                <Btn active={d.id === pickLine} disabled={locked} onClick={() => setPickLine(d.id)}>
                  Use this line
                </Btn>
              </div>
              <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <span className="text-mono" style={{ color: MUTED, fontSize: 10, letterSpacing: "0.1em" }}>
                  {d.lens_name}
                </span>
                <span
                  className="text-mono"
                  style={{
                    color: wordCount(d.campaign_line ?? "") > 7 ? RED : MUTED,
                    fontSize: 10,
                    letterSpacing: "0.1em",
                  }}
                >
                  {wordCount(d.campaign_line ?? "")}w
                </span>
                {d.line_check && (
                  <span
                    className="text-mono"
                    style={{
                      border: `1px solid ${verdictTone(d.line_check.verdict)}`,
                      color: verdictTone(d.line_check.verdict),
                      borderRadius: 4,
                      padding: "2px 7px",
                      fontSize: 10,
                      textTransform: "uppercase",
                    }}
                  >
                    {d.line_check.verdict.replace("_", " ")}
                  </span>
                )}
              </div>
              {d.line_check && (
                <div className="text-body-sm" style={{ color: MUTED, marginTop: 8, lineHeight: 1.6 }}>
                  {d.line_check.reasoning}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {view === "ideas" && ideas.length > 0 && (
        <div style={{ ...ideaListStyle, marginTop: 28 }}>
          {ideas.map((d) => (
            <IdeaCard
              key={d.id}
              d={d}
              locked={locked}
              isWinner={d.id === pickIdea}
              isLineWinner={d.id === pickLine}
              onPickIdea={() => setPickIdea(d.id)}
              onPickLine={() => setPickLine(d.id)}
              onTriage={async (status, instinct) => {
                await triage({ data: { directionId: d.id, status, instinctBrief: instinct } });
                setIdeas((prev) =>
                  prev.map((x) => (x.id === d.id ? { ...x, status, instinct_brief: instinct } : x)),
                );
              }}
              onRevise={async (notes) => {
                await revise({ data: { directionId: d.id, notes } });
                if (runId) await refresh(runId);
              }}
            />
          ))}
        </div>
      )}

      {runId && ideas.length > 0 && (
        <StimulusGateOne
          runId={runId}
          run={run}
          directions={ideas as unknown as RatedDirection[]}
          onRefresh={async () => {
            if (runId) await refresh(runId);
          }}
          onRevise={async (directionId, notes) => {
            await revise({ data: { directionId, notes } });
            if (runId) await refresh(runId);
          }}
        />
      )}
    </div>
  );
}
