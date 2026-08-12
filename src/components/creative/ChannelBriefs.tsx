// CREATIVE ENGINE — PAGE 3.
//
// The locked winning idea and line, one row per channel with an unmistakable
// status, and the exports. Nothing on this page belongs to the sweep or the
// shortlist: this page generates channel briefs and hands them over.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import {
  listStimulusRuns,
  startStimulusRun,
  generateStimulusBatch,
  loadStimulusRun,
} from "@/lib/stimulus.functions";
import { BIG_IDEA_CHANNEL_LABEL } from "@/lib/stimulus-bigidea.functions";
import { LENS_COUNT, getLens } from "@/lib/stimulus/lenses";
import { RawIdeaExportButton } from "@/components/RawIdeaExportButton";
import { StimulusOrchestration } from "@/components/StimulusOrchestration";
import { ideaCardStyle, IDEA_COLUMN_WIDTH } from "@/components/stimulus/idea-layout";

const AMBER = "#F2665F";
const MUTED = "#A8A29A";
const PAPER = "#EDE8E0";
const RED = "#FF8F87";
const GREEN = "#5FD08A";

type RunRow = {
  id: string;
  channel_name: string;
  status: string;
  error?: string | null;
  created_at?: string;
};

type DirectionRow = {
  id: string;
  lens_id: string;
  lens_name: string;
  sort_order: number;
  direction: string;
  status: string;
  error: string | null;
};

type ChannelState = "not_started" | "running" | "complete" | "failed";

const STATE_LABEL: Record<ChannelState, string> = {
  not_started: "Not started",
  running: "Running",
  complete: "Complete",
  failed: "Failed",
};

const STATE_COLOR: Record<ChannelState, string> = {
  not_started: MUTED,
  running: AMBER,
  complete: GREEN,
  failed: RED,
};

function StatusBadge({ state, progress }: { state: ChannelState; progress?: string }) {
  const color = STATE_COLOR[state];
  return (
    <span
      className="text-mono"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        border: `1px solid ${color}`,
        color,
        backgroundColor: `${color}18`,
        borderRadius: 999,
        padding: "5px 12px",
        fontSize: 11,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      {STATE_LABEL[state]}
      {progress ? ` · ${progress}` : ""}
    </span>
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
        border: `1px solid ${active ? AMBER : "#2A2724"}`,
        color: active ? AMBER : PAPER,
        padding: "8px 14px",
        borderRadius: 6,
        fontSize: 11,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {children}
    </button>
  );
}

export function ChannelBriefs({
  sessionId,
  brandName,
  channels,
  lockedIdea,
  lockedLine,
  lockedLens,
}: {
  sessionId: string;
  brandName: string;
  channels: string[];
  lockedIdea: string | null;
  lockedLine: string | null;
  lockedLens: string | null;
}) {
  const listRuns = useServerFn(listStimulusRuns);
  const start = useServerFn(startStimulusRun);
  const batch = useServerFn(generateStimulusBatch);
  const load = useServerFn(loadStimulusRun);

  const [runs, setRuns] = useState<RunRow[]>([]);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [running, setRunning] = useState<string | null>(null);
  const [failed, setFailed] = useState<Record<string, string>>({});
  const [openRunId, setOpenRunId] = useState<string | null>(null);
  const [openDirections, setOpenDirections] = useState<DirectionRow[]>([]);
  const [openBusy, setOpenBusy] = useState(false);

  const refreshRuns = useCallback(async () => {
    try {
      const r = await listRuns({ data: { sessionId } });
      setRuns((r.runs as RunRow[]).filter((x) => x.channel_name !== BIG_IDEA_CHANNEL_LABEL));
    } catch {
      /* non-fatal — the next action re-reads */
    }
  }, [listRuns, sessionId]);

  useEffect(() => {
    void refreshRuns();
  }, [refreshRuns]);

  /** The newest run for a channel is the one that counts. */
  const latest = useMemo(() => {
    const map = new Map<string, RunRow>();
    for (const r of runs) if (!map.has(r.channel_name)) map.set(r.channel_name, r);
    return map;
  }, [runs]);

  const stateFor = (channel: string): ChannelState => {
    if (running === channel) return "running";
    if (failed[channel]) return "failed";
    const run = latest.get(channel);
    if (!run) return "not_started";
    if (run.error) return "failed";
    if (run.status === "generating") return "failed"; // left mid-flight, needs re-running
    return "complete";
  };

  const generate = async (channel: string) => {
    setRunning(channel);
    setFailed((p) => ({ ...p, [channel]: "" }));
    setProgress((p) => ({ ...p, [channel]: 0 }));
    try {
      const { runId } = await start({ data: { sessionId, channelName: channel } });
      let done = false;
      while (!done) {
        const r = await batch({ data: { runId, batchSize: 4 } });
        done = r.done;
        setProgress((p) => ({ ...p, [channel]: LENS_COUNT - r.remaining }));
      }
      await refreshRuns();
      setFailed((p) => {
        const next = { ...p };
        delete next[channel];
        return next;
      });
      await openBrief(runId);
    } catch (e) {
      setFailed((p) => ({
        ...p,
        [channel]: e instanceof Error ? e.message : "Channel brief generation failed",
      }));
      await refreshRuns();
    } finally {
      setRunning(null);
    }
  };

  const openBrief = async (runId: string) => {
    setOpenBusy(true);
    setOpenRunId(runId);
    try {
      const r = await load({ data: { runId } });
      setOpenDirections(r.directions as DirectionRow[]);
    } finally {
      setOpenBusy(false);
    }
  };

  const locked = Boolean(lockedIdea);

  return (
    <div style={{ width: "100%" }}>
      <div style={{ maxWidth: IDEA_COLUMN_WIDTH, margin: "0 auto" }}>
        <div
          className="text-mono"
          style={{ color: AMBER, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase" }}
        >
          Step 3 · Winning idea, channel briefs, export
        </div>

        {/* THE LOCKED WINNER */}
        <div
          style={{
            marginTop: 16,
            border: `1px solid ${locked ? AMBER : "#2A2724"}`,
            borderRadius: 14,
            padding: "22px 26px",
            backgroundColor: locked ? `${AMBER}0D` : "transparent",
          }}
        >
          <div
            className="text-mono"
            style={{ color: locked ? AMBER : MUTED, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase" }}
          >
            {locked ? "★ Locked winning idea" : "No winning idea locked yet"}
          </div>
          {locked ? (
            <>
              <div style={{ color: PAPER, fontSize: 26, lineHeight: 1.3, marginTop: 12, fontWeight: 600 }}>
                {lockedLine || "— no line locked"}
              </div>
              <div className="text-body-sm" style={{ color: PAPER, marginTop: 12, lineHeight: 1.7 }}>
                {lockedIdea}
              </div>
              {lockedLens && (
                <div className="text-mono" style={{ color: MUTED, fontSize: 11, marginTop: 12, letterSpacing: "0.1em" }}>
                  FROM LENS · {lockedLens.toUpperCase()}
                </div>
              )}
            </>
          ) : (
            <div className="text-body-sm" style={{ color: MUTED, marginTop: 10, lineHeight: 1.7 }}>
              Channel briefs must be generated from a locked idea.{" "}
              <Link to="/creative/$sessionId/shortlist" params={{ sessionId }} style={{ color: AMBER }}>
                Go to Step 2 · Shortlist
              </Link>{" "}
              and lock a winning idea and line first.
            </div>
          )}
        </div>

        {/* CHANNELS */}
        <div
          className="text-mono"
          style={{
            color: PAPER,
            fontSize: 11,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            marginTop: 34,
          }}
        >
          Channel briefs · {channels.length} channel{channels.length === 1 ? "" : "s"}
        </div>
        <p className="text-body-sm" style={{ color: MUTED, marginTop: 8, lineHeight: 1.7 }}>
          Each channel is swept through all {LENS_COUNT} lenses against its own Stage 21 brief and the
          locked idea. Generate them one at a time — the status on each row tells you exactly where it is.
        </p>

        {channels.length === 0 && (
          <div className="text-body-sm" style={{ color: RED, marginTop: 14, lineHeight: 1.7 }}>
            No channel briefs exist for this session yet. Run Stage 21 in the Strategy Pipeline to
            create them, then come back here.
          </div>
        )}

        <div style={{ display: "grid", gap: 14, marginTop: 18 }}>
          {channels.map((c) => {
            const state = stateFor(c);
            const run = latest.get(c);
            const done = progress[c] ?? 0;
            return (
              <div
                key={c}
                style={{
                  border: `1px solid ${state === "running" ? AMBER : "#2A2724"}`,
                  borderRadius: 12,
                  padding: "18px 20px",
                  backgroundColor: "#0A0908",
                }}
              >
                <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ color: PAPER, fontSize: 17, fontWeight: 600, flex: 1, minWidth: 220 }}>{c}</div>
                  <StatusBadge
                    state={state}
                    progress={state === "running" ? `${done}/${LENS_COUNT} lenses` : undefined}
                  />
                </div>

                {state === "running" && (
                  <div
                    style={{
                      marginTop: 14,
                      height: 8,
                      borderRadius: 999,
                      backgroundColor: "#1C1A18",
                      overflow: "hidden",
                    }}
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={LENS_COUNT}
                    aria-valuenow={done}
                  >
                    <div
                      style={{
                        width: `${Math.round((done / LENS_COUNT) * 100)}%`,
                        height: "100%",
                        backgroundColor: AMBER,
                        transition: "width 0.4s ease",
                      }}
                    />
                  </div>
                )}

                {state === "failed" && (
                  <div className="text-body-sm" style={{ color: RED, marginTop: 12, lineHeight: 1.6 }}>
                    {failed[c] || run?.error || "This run stopped before all 37 lenses finished."} Press
                    the generate button to run it again.
                  </div>
                )}

                <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <Btn
                    active
                    disabled={!locked || Boolean(running)}
                    onClick={() => void generate(c)}
                  >
                    {state === "not_started"
                      ? `Generate ${c} brief`
                      : state === "running"
                        ? `Generating ${c}…`
                        : `Regenerate ${c} brief`}
                  </Btn>
                  {run && state !== "not_started" && (
                    <Btn
                      onClick={() => void openBrief(run.id)}
                      active={openRunId === run.id}
                      disabled={openBusy}
                    >
                      {openRunId === run.id ? `Showing ${c} brief below` : `Open ${c} brief`}
                    </Btn>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* THE OPENED BRIEF */}
      {openRunId && (
        <div style={{ maxWidth: IDEA_COLUMN_WIDTH, margin: "42px auto 0" }}>
          <div
            className="text-mono"
            style={{ color: AMBER, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase" }}
          >
            Open channel brief · {latest.get(
              [...latest.entries()].find(([, r]) => r.id === openRunId)?.[0] ?? "",
            )?.channel_name ?? "run"}
          </div>
          {openBusy && (
            <div className="text-body-sm" style={{ color: MUTED, marginTop: 10 }}>
              Loading the 37 directions…
            </div>
          )}
          <div style={{ display: "grid", gap: 20, marginTop: 18 }}>
            {openDirections.map((d) => {
              const lens = getLens(d.lens_id);
              return (
                <div key={d.id} style={ideaCardStyle({ accent: null })}>
                  <div style={{ display: "flex", gap: 14, alignItems: "baseline" }}>
                    <span className="text-mono" style={{ color: AMBER, fontSize: 20 }}>
                      {String(d.sort_order + 1).padStart(2, "0")}
                    </span>
                    <span style={{ color: PAPER, fontSize: 18, fontWeight: 600 }}>{d.lens_name}</span>
                  </div>
                  {lens && (
                    <div className="text-body-sm" style={{ color: MUTED, marginTop: 8 }}>
                      {lens.approach}
                    </div>
                  )}
                  <div
                    className="text-body-sm"
                    style={{ color: PAPER, marginTop: 16, whiteSpace: "pre-wrap", lineHeight: 1.75, fontSize: 15 }}
                  >
                    {d.direction || d.error || "Not generated."}
                  </div>
                  <div style={{ marginTop: 14 }}>
                    <RawIdeaExportButton directionId={d.id} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ORCHESTRATION + FULL FINISHED EXPORT */}
      <div style={{ maxWidth: IDEA_COLUMN_WIDTH, margin: "48px auto 0" }}>
        <StimulusOrchestration sessionId={sessionId} brandName={brandName} />
      </div>
    </div>
  );
}
