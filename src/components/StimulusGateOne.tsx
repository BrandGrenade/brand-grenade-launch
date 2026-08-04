// CREATIVE STIMULUS ENGINE — PHASE 2 UI. Gate One: the full rating system.
// Eight dimensions shown independently. Never collapsed into one number.

import { useCallback, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  rateStimulusBatch,
  runStimulusTiebreaker,
  setGateOneApproval,
  confirmGateOne,
} from "@/lib/stimulus-rating.functions";
import type { DirectionRatings } from "@/lib/stimulus/rating-prompts";
import { RawIdeaExportButton } from "@/components/RawIdeaExportButton";


const AMBER = "#E8A33D";
const MUTED = "#8A8680";
const RED = "#E86A3D";

export type RatedDirection = {
  id: string;
  lens_name: string;
  sort_order: number;
  direction: string;
  status: string;
  ratings: DirectionRatings | null;
  rating_status: string;
  rating_error: string | null;
  gate_one_approved: boolean;
  gate_one_approved_at: string | null;
  gate_one_notes: string | null;
};

function Chip({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <span
      className="text-mono"
      style={{
        border: `1px solid ${tone ?? "#2A2A2A"}`,
        color: tone ?? MUTED,
        borderRadius: 4,
        padding: "3px 8px",
        fontSize: 10,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
      }}
    >
      {label} {value}
    </span>
  );
}

function toneFor(v: string | undefined) {
  if (v === "High" || v === "Direct") return AMBER;
  if (v === "Low" || v === "Tangential") return RED;
  return MUTED;
}

function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div
        className="text-mono"
        style={{ color: MUTED, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase" }}
      >
        {title}
      </div>
      <div className="text-body-sm" style={{ color: "#E8E4DE", marginTop: 5, lineHeight: 1.6 }}>
        {children}
      </div>
    </div>
  );
}

function RatingBlock({ r }: { r: DirectionRatings }) {
  const u = r.creative_uniqueness;
  return (
    <div style={{ marginTop: 14, borderTop: "1px solid #2A2A2A", paddingTop: 14 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Chip label="Strategic" value={r.strategic_compliance?.rating ?? "—"} tone={toneFor(r.strategic_compliance?.rating)} />
        <Chip label="Brand Glue" value={r.brand_glue?.rating ?? "—"} tone={toneFor(r.brand_glue?.rating)} />
        <Chip label="Fame" value={r.fame?.rating ?? "—"} tone={toneFor(r.fame?.rating)} />
        <Chip label="Uniqueness" value={u?.rating ?? "—"} tone={toneFor(u?.rating)} />
        <Chip label="Ambition" value={r.creative_ambition?.rating ?? "—"} tone={toneFor(r.creative_ambition?.rating)} />
        <Chip
          label="Producibility"
          value={r.producibility?.pass ? "Pass" : "Fail"}
          tone={r.producibility?.pass ? MUTED : RED}
        />
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
        <Chip label="C" value={r.crab?.clear ?? "—"} tone={toneFor(r.crab?.clear)} />
        <Chip label="R" value={r.crab?.relevant ?? "—"} tone={toneFor(r.crab?.relevant)} />
        <Chip label="A" value={r.crab?.appealing ?? "—"} tone={toneFor(r.crab?.appealing)} />
        <Chip label="B" value={r.crab?.believable ?? "—"} tone={toneFor(r.crab?.believable)} />
      </div>

      <Row title="1 · Strategic compliance">
        <div>
          <strong style={{ color: AMBER }}>SMP element:</strong> {r.strategic_compliance?.smp_element}
        </div>
        <div style={{ marginTop: 4 }}>
          <strong style={{ color: AMBER }}>Tension dramatised:</strong>{" "}
          {r.strategic_compliance?.dramatizes_tension ? "Yes" : "No"} — {r.strategic_compliance?.tension_note}
        </div>
        <div style={{ marginTop: 4 }}>
          <strong style={{ color: AMBER }}>Journey placement:</strong> {r.strategic_compliance?.journey_placement}
        </div>
        <div style={{ marginTop: 4 }}>{r.strategic_compliance?.rationale}</div>
        {r.strategic_compliance?.what_can_save_it && (
          <div style={{ marginTop: 8, color: AMBER }}>
            <strong>What can save it:</strong> {r.strategic_compliance.what_can_save_it}
          </div>
        )}
      </Row>

      <Row title="2 · Brand glue">
        {r.brand_glue?.rationale}
        {r.brand_glue?.reusable_asset && (
          <div style={{ marginTop: 4, color: MUTED }}>Reusable asset: {r.brand_glue.reusable_asset}</div>
        )}
      </Row>

      <Row title="3 · CRAB — relevance grounded in human truth">{r.crab?.relevant_human_truth}</Row>
      <Row title="4 · Fame">{r.fame?.rationale}</Row>

      <Row title="5 · Creative uniqueness (live web search)">
        <div style={{ color: u?.web_search_performed ? MUTED : RED }}>
          {u?.web_search_performed
            ? `Live search performed — ${(u.searches_run ?? []).length} quer${(u.searches_run ?? []).length === 1 ? "y" : "ies"}.`
            : "No live search was made — treat this as model assertion only."}
        </div>
        {(u?.searches_run ?? []).length > 0 && (
          <ul style={{ margin: "6px 0 0", paddingLeft: 18, color: MUTED }}>
            {u.searches_run.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        )}
        <div style={{ marginTop: 6 }}>{u?.verdict}</div>
        {(u?.prior_executions ?? []).length > 0 && (
          <div style={{ marginTop: 8, color: RED }}>
            <strong>Prior executions found:</strong>
            <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
              {u.prior_executions.map((p, i) => (
                <li key={`${p.brand}-${i}`}>
                  {p.brand} — {p.campaign} ({p.year}): {p.how_similar}{" "}
                  {p.source_url && (
                    <a href={p.source_url} target="_blank" rel="noreferrer noopener" style={{ color: AMBER }}>
                      source ↗
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Row>

      <Row title="6 · Creative ambition">{r.creative_ambition?.judgement}</Row>

      <Row title="7 · Producibility (feasibility only — not a quality score)">
        {r.producibility?.note}
        {(r.producibility?.concerns ?? []).length > 0 && (
          <ul style={{ margin: "4px 0 0", paddingLeft: 18, color: MUTED }}>
            {r.producibility.concerns.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        )}
      </Row>

      <Row title="8 · Brand integrity check">
        {(r.brand_integrity?.concerns ?? []).length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {r.brand_integrity.concerns.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        ) : (
          <span style={{ color: MUTED }}>No integrity concerns raised.</span>
        )}
        {r.brand_integrity?.flag_note && (
          <div style={{ marginTop: 8, color: AMBER, border: `1px solid ${AMBER}55`, borderRadius: 6, padding: 10 }}>
            ⚑ {r.brand_integrity.flag_note}
          </div>
        )}
      </Row>
    </div>
  );
}

function Btn({
  children,
  onClick,
  active,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="text-mono"
      style={{
        background: active ? `${AMBER}22` : "none",
        border: `1px solid ${active ? AMBER : "#2A2A2A"}`,
        color: active ? AMBER : MUTED,
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

export function StimulusGateOne({
  runId,
  directions,
  run,
  onRefresh,
  onRevise,
}: {
  runId: string;
  directions: RatedDirection[];
  run: {
    tiebreaker_output?: string | null;
    tiebreaker_fired?: boolean;
    tiebreaker_reason?: string | null;
    gate_one_confirmed?: boolean;
    gate_one_confirmed_at?: string | null;
  };
  onRefresh: () => Promise<void>;
  onRevise: (directionId: string, notes: string) => Promise<void>;
}) {
  const rate = useServerFn(rateStimulusBatch);
  const tiebreak = useServerFn(runStimulusTiebreaker);
  const approve = useServerFn(setGateOneApproval);
  const confirm = useServerFn(confirmGateOne);

  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tbMsg, setTbMsg] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [revise, setRevise] = useState<Record<string, string>>({});

  const survivors = useMemo(
    () => directions.filter((d) => d.status === "keep" || d.status === "keep_in_play"),
    [directions],
  );
  const unrated = survivors.filter((d) => d.rating_status === "unrated").length;
  const approved = survivors.filter((d) => d.gate_one_approved).length;

  const runRating = useCallback(async () => {
    setBusy("rate");
    setErr(null);
    try {
      let done = false;
      while (!done) {
        const r = await rate({ data: { runId, batchSize: 2 } });
        done = r.done;
        await onRefresh();
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Rating failed");
    } finally {
      setBusy(null);
    }
  }, [rate, runId, onRefresh]);

  if (survivors.length === 0) return null;

  return (
    <div style={{ marginTop: 28, border: `1px solid ${AMBER}44`, borderRadius: 8, padding: 20, backgroundColor: "#0B0B0B" }}>
      <div className="text-mono" style={{ color: AMBER, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase" }}>
        Gate One — full rating system
      </div>
      <div className="text-body-sm" style={{ color: MUTED, marginTop: 6 }}>
        {survivors.length} direction{survivors.length === 1 ? "" : "s"} survived Tissue Check · {unrated} unrated ·{" "}
        {approved} approved. Eight dimensions, scored independently — Producibility is a feasibility flag and never
        averages with the seven quality ratings.
      </div>

      {err && (
        <div className="text-body-sm" style={{ color: RED, marginTop: 10 }}>
          {err}
        </div>
      )}

      <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Btn active onClick={runRating} disabled={busy !== null || unrated === 0}>
          {busy === "rate" ? "Rating…" : unrated === 0 ? "All survivors rated" : `Rate ${unrated} survivor${unrated === 1 ? "" : "s"}`}
        </Btn>
        <Btn
          disabled={busy !== null || survivors.filter((d) => d.rating_status === "rated").length < 2}
          onClick={async () => {
            setBusy("tb");
            setErr(null);
            try {
              const r = await tiebreak({ data: { runId, force: false } });
              setTbMsg(r.fired ? null : r.reason);
              await onRefresh();
            } catch (e) {
              setErr(e instanceof Error ? e.message : "Tie-breaker failed");
            } finally {
              setBusy(null);
            }
          }}
        >
          {busy === "tb" ? "Thinking…" : "Seasoned CD pass"}
        </Btn>
        <Btn
          disabled={busy !== null || approved === 0 || run.gate_one_confirmed}
          onClick={async () => {
            setBusy("gate");
            setErr(null);
            try {
              await confirm({ data: { runId } });
              await onRefresh();
            } catch (e) {
              setErr(e instanceof Error ? e.message : "Gate One confirmation failed");
            } finally {
              setBusy(null);
            }
          }}
        >
          {run.gate_one_confirmed ? "Gate One confirmed" : `Confirm Gate One (${approved})`}
        </Btn>
      </div>

      {tbMsg && (
        <div className="text-body-sm" style={{ color: MUTED, marginTop: 10 }}>
          Tie-breaker did not fire — {tbMsg}
        </div>
      )}

      {run.tiebreaker_fired && run.tiebreaker_output && (
        <div style={{ marginTop: 16, border: `1px solid ${AMBER}55`, borderRadius: 8, padding: 16 }}>
          <div className="text-mono" style={{ color: AMBER, fontSize: 10, letterSpacing: "0.12em" }}>
            SEASONED CREATIVE DIRECTOR PASS
          </div>
          <div className="text-body-sm" style={{ color: MUTED, marginTop: 4 }}>
            {run.tiebreaker_reason}
          </div>
          <div className="text-body-sm" style={{ color: "#E8E4DE", marginTop: 10, whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
            {run.tiebreaker_output}
          </div>
        </div>
      )}

      <div style={{ marginTop: 18, display: "grid", gap: 16 }}>
        {survivors.map((d) => (
          <div
            key={d.id}
            style={{
              backgroundColor: "#111",
              border: `1px solid ${d.gate_one_approved ? AMBER : "#2A2A2A"}`,
              borderRadius: 8,
              padding: 18,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div className="text-mono" style={{ color: AMBER, fontSize: 13, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                {String(d.sort_order + 1).padStart(2, "0")} · {d.lens_name}
              </div>
              {d.gate_one_approved_at && (
                <span className="text-mono" style={{ color: AMBER, fontSize: 10 }}>
                  APPROVED {new Date(d.gate_one_approved_at).toLocaleString()}
                </span>
              )}
            </div>
            <div className="text-body-sm" style={{ color: "#E8E4DE", marginTop: 10, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
              {d.direction}
            </div>

            {d.rating_status === "failed" && (
              <div className="text-body-sm" style={{ color: RED, marginTop: 10 }}>
                Rating failed: {d.rating_error}
              </div>
            )}
            {d.ratings && <RatingBlock r={d.ratings} />}

            <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <input
                value={notes[d.id] ?? d.gate_one_notes ?? ""}
                onChange={(e) => setNotes((p) => ({ ...p, [d.id]: e.target.value }))}
                placeholder="Approval / revision notes"
                style={{
                  flex: "1 1 220px",
                  backgroundColor: "#000",
                  color: "#E8E4DE",
                  border: "1px solid #2A2A2A",
                  borderRadius: 6,
                  padding: "8px 10px",
                  fontFamily: "inherit",
                  fontSize: 13,
                }}
              />
              <Btn
                active={d.gate_one_approved}
                disabled={busy !== null || !d.ratings}
                onClick={async () => {
                  setBusy(d.id);
                  try {
                    await approve({
                      data: {
                        directionId: d.id,
                        approved: !d.gate_one_approved,
                        notes: notes[d.id] ?? d.gate_one_notes ?? undefined,
                      },
                    });
                    await onRefresh();
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                {d.gate_one_approved ? "Approved — undo" : "Approve for campaign set"}
              </Btn>
              <Btn
                disabled={busy !== null}
                onClick={async () => {
                  const n = (revise[d.id] ?? notes[d.id] ?? "").trim();
                  if (!n) {
                    setRevise((p) => ({ ...p, [d.id]: "" }));
                    setErr("Add notes first — send back with instructions, not empty.");
                    return;
                  }
                  setBusy(d.id);
                  setErr(null);
                  try {
                    await onRevise(d.id, n);
                    await onRefresh();
                  } catch (e) {
                    setErr(e instanceof Error ? e.message : "Revise failed");
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                Send back with notes
              </Btn>
              <RawIdeaExportButton directionId={d.id} />

            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
