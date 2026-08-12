// CREATIVE ENGINE — PAGE 3.
//
// The locked winning idea and line, one row per channel with an unmistakable
// status, and the exports. Every channel adaptation is generated from the one
// locked idea, fidelity-checked automatically, and auto-retried once
// server-side before it is ever shown as failed.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { listStimulusRuns, loadStimulusRun } from "@/lib/stimulus.functions";
import {
  confirmChannelGateOne,
  editChannelAdaptation,
  generateChannelAdaptation,
  generateOfflineCreativeBrief,
  listAdaptationFidelity,
  listChannelGateOne,
  listOfflineCreativeBriefs,
  listPromptVersions,
  recheckAdaptationFidelity,
  revertPromptVersion,
} from "@/lib/stimulus-channel.functions";
import type { AdaptationFidelity } from "@/lib/stimulus/adaptation-fidelity-types";
import { BIG_IDEA_CHANNEL_LABEL } from "@/lib/stimulus-bigidea.functions";
import {
  buildChannelBriefExport,
  buildOfflineCreativeBriefExport,
  download,
} from "@/lib/stimulus-export";
import { StimulusOrchestration } from "@/components/StimulusOrchestration";
import { ideaCardStyle, IDEA_COLUMN_WIDTH } from "@/components/stimulus/idea-layout";
import { Spinner } from "@/components/ui/busy";

const AMBER = "#F2665F";
const MUTED = "#A8A29A";
const PAPER = "#EDE8E0";
const RED = "#FF8F87";
const GREEN = "#5FD08A";

type RunRow = {
  id: string;
  channel_name: string;
  status: string;
  run_mode?: string | null;
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

type PromptVersionRow = {
  id: string;
  versionNo: number;
  text: string;
  origin: string;
  fidelity: AdaptationFidelity | null;
  createdAt: string;
};

type OfflineBriefRow = { runId: string; text: string; createdAt: string };

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
      className="text-mono"
      aria-busy={state === "running"}
    >
      {state === "running" ? <Spinner size={11} /> : null}
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

const VERDICT_COLOR: Record<string, string> = {
  pass: GREEN,
  drift: "#E5A23D",
  break: RED,
};

const VERDICT_LABEL: Record<string, string> = {
  pass: "Faithful",
  drift: "Drifted",
  break: "Broke away",
};

function FidelityBadge({ f }: { f: AdaptationFidelity }) {
  const color = VERDICT_COLOR[f.verdict] ?? MUTED;
  return (
    <span
      className="text-mono"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
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
      Fidelity · {VERDICT_LABEL[f.verdict] ?? f.verdict} · {f.score}/10
    </span>
  );
}

function AdaptationFidelityPanel({
  fidelity,
  onRecheck,
  busy,
}: {
  fidelity: AdaptationFidelity | null;
  onRecheck: () => void;
  busy: boolean;
}) {
  const color = fidelity ? (VERDICT_COLOR[fidelity.verdict] ?? MUTED) : MUTED;
  return (
    <div
      style={{
        marginTop: 18,
        padding: 20,
        border: `1px solid ${fidelity && fidelity.verdict !== "pass" ? color : "#2A2724"}`,
        borderRadius: 10,
        backgroundColor: "#0A0908",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <div
          className="text-mono"
          style={{ color: AMBER, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase" }}
        >
          Fidelity to the locked idea
        </div>
        <Btn onClick={onRecheck} disabled={busy}>
          {busy ? <><Spinner /> Checking…</> : fidelity ? "Re-check" : "Run check"}
        </Btn>
      </div>

      {!fidelity ? (
        <div className="text-body-sm" style={{ color: MUTED, marginTop: 12, lineHeight: 1.7 }}>
          This adaptation has not been held against the locked idea yet — treat it as unverified.
        </div>
      ) : (
        <>
          <div style={{ marginTop: 12 }}>
            <FidelityBadge f={fidelity} />
          </div>
          <div className="text-body-sm" style={{ color: PAPER, marginTop: 12, lineHeight: 1.7 }}>
            {fidelity.reasoning}
          </div>
          <div
            className="text-mono"
            style={{
              color: fidelity.lineVerbatim ? GREEN : RED,
              fontSize: 11,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginTop: 12,
            }}
          >
            {fidelity.lineVerbatim
              ? "Campaign line carried verbatim"
              : "Campaign line NOT carried verbatim"}
          </div>
          {fidelity.missing.length > 0 && (
            <ul className="text-body-sm" style={{ color: RED, marginTop: 12, lineHeight: 1.7, paddingLeft: 18 }}>
              {fidelity.missing.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          )}
          {fidelity.misreadingEvidence && (
            <div className="text-body-sm" style={{ color: RED, marginTop: 10, lineHeight: 1.7 }}>
              Misreading evidence: {fidelity.misreadingEvidence}
            </div>
          )}
          {fidelity.verdict !== "pass" && (
            <div className="text-body-sm" style={{ color: MUTED, marginTop: 12, lineHeight: 1.7 }}>
              Automatic retry already ran once. Regenerate or edit this channel before anything
              downstream uses it.
            </div>
          )}
        </>
      )}
    </div>
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
  const adapt = useServerFn(generateChannelAdaptation);
  const load = useServerFn(loadStimulusRun);
  const listFidelity = useServerFn(listAdaptationFidelity);
  const recheck = useServerFn(recheckAdaptationFidelity);
  const saveEdit = useServerFn(editChannelAdaptation);
  const listVersions = useServerFn(listPromptVersions);
  const revertVersion = useServerFn(revertPromptVersion);
  const genOffline = useServerFn(generateOfflineCreativeBrief);
  const listOffline = useServerFn(listOfflineCreativeBriefs);
  const listGateOne = useServerFn(listChannelGateOne);
  const confirmGate = useServerFn(confirmChannelGateOne);

  const [runs, setRuns] = useState<RunRow[]>([]);
  const [running, setRunning] = useState<Record<string, boolean>>({});
  const [failed, setFailed] = useState<Record<string, string>>({});
  const [openRunId, setOpenRunId] = useState<string | null>(null);
  const [openDirections, setOpenDirections] = useState<DirectionRow[]>([]);
  const [openBusy, setOpenBusy] = useState(false);
  const [fidelityByRun, setFidelityByRun] = useState<Record<string, AdaptationFidelity>>({});
  const [recheckBusy, setRecheckBusy] = useState(false);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [versions, setVersions] = useState<PromptVersionRow[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [viewingVersion, setViewingVersion] = useState<PromptVersionRow | null>(null);
  const [versionBusy, setVersionBusy] = useState(false);
  const [offline, setOffline] = useState<Record<string, OfflineBriefRow>>({});
  const [offlineRunning, setOfflineRunning] = useState<Record<string, boolean>>({});
  const [offlineFailed, setOfflineFailed] = useState<Record<string, string>>({});
  const [openOfflineChannel, setOpenOfflineChannel] = useState<string | null>(null);
  const [gateOne, setGateOne] = useState<Record<string, { runId: string; confirmed: boolean }>>({});
  const [gateBusy, setGateBusy] = useState<string | null>(null);
  const [gateError, setGateError] = useState<string | null>(null);

  const anyRunning = Object.values(running).some(Boolean);

  const refreshRuns = useCallback(async () => {
    try {
      const r = await listRuns({ data: { sessionId } });
      // Only content-creation-prompt runs belong in this list. Legacy 37-lens
      // sweep runs and the offline creative briefs must never surface here.
      setRuns(
        (r.runs as RunRow[]).filter(
          (x) => x.run_mode === "channel_adaptation" && x.channel_name !== BIG_IDEA_CHANNEL_LABEL,
        ),
      );
    } catch {
      /* non-fatal — the next action re-reads */
    }
  }, [listRuns, sessionId]);

  const refreshFidelity = useCallback(async () => {
    try {
      const r = await listFidelity({ data: { sessionId } });
      setFidelityByRun(r.byRun as Record<string, AdaptationFidelity>);
    } catch {
      /* non-fatal */
    }
  }, [listFidelity, sessionId]);

  const refreshOffline = useCallback(async () => {
    try {
      const r = await listOffline({ data: { sessionId } });
      setOffline(r.byChannel as Record<string, OfflineBriefRow>);
    } catch {
      /* non-fatal */
    }
  }, [listOffline, sessionId]);

  const refreshGateOne = useCallback(async () => {
    try {
      const r = await listGateOne({ data: { sessionId } });
      setGateOne(r.byChannel as Record<string, { runId: string; confirmed: boolean }>);
    } catch {
      /* non-fatal */
    }
  }, [listGateOne, sessionId]);

  const refreshVersions = useCallback(
    async (runId: string, directionId: string) => {
      try {
        const r = await listVersions({ data: { runId, directionId } });
        setVersions(r.versions as PromptVersionRow[]);
      } catch {
        setVersions([]);
      }
    },
    [listVersions],
  );

  useEffect(() => {
    void refreshRuns();
    void refreshFidelity();
    void refreshOffline();
    void refreshGateOne();
  }, [refreshRuns, refreshFidelity, refreshOffline, refreshGateOne]);

  const confirmGateOneFor = useCallback(
    async (channelsToConfirm: string[] | null, confirmed = true) => {
      setGateBusy(channelsToConfirm?.length === 1 ? channelsToConfirm[0]! : "__all__");
      setGateError(null);
      try {
        const r = await confirmGate({
          data: {
            sessionId,
            ...(channelsToConfirm ? { channels: channelsToConfirm } : {}),
            confirmed,
          },
        });
        if (r.skipped.length > 0) {
          setGateError(
            r.skipped.map((s) => `${s.channel}: ${s.reason}`).join(" · "),
          );
        }
      } catch (e) {
        setGateError(e instanceof Error ? e.message : "Gate One confirmation failed");
      } finally {
        setGateBusy(null);
        await refreshGateOne();
      }
    },
    [confirmGate, refreshGateOne, sessionId],
  );


  /** The newest run for a channel is the one that counts. */
  const latest = useMemo(() => {
    const map = new Map<string, RunRow>();
    for (const r of runs) if (!map.has(r.channel_name)) map.set(r.channel_name, r);
    return map;
  }, [runs]);

  const stateFor = (channel: string): ChannelState => {
    if (running[channel]) return "running";
    if (failed[channel]) return "failed";
    const run = latest.get(channel);
    if (!run) return "not_started";
    if (run.error) return "failed";
    if (run.status === "generating") return "failed"; // left mid-flight, needs re-running
    return "complete";
  };

  const openBrief = useCallback(
    async (runId: string) => {
      setOpenBusy(true);
      setOpenRunId(runId);
      setEditing(null);
      setShowVersions(false);
      setViewingVersion(null);
      setVersions([]);
      try {
        const r = await load({ data: { runId } });
        const dirs = (r.directions as DirectionRow[]).filter((d) =>
          Boolean(d.direction?.trim() || d.error),
        );
        setOpenDirections(dirs);
        if (dirs[0]) await refreshVersions(runId, dirs[0].id);
      } finally {
        setOpenBusy(false);
      }
    },
    [load, refreshVersions],
  );

  /** One channel: generate the human-facing offline creative brief. */
  const generateOffline = useCallback(
    async (channel: string) => {
      setOfflineRunning((p) => ({ ...p, [channel]: true }));
      setOfflineFailed((p) => {
        const next = { ...p };
        delete next[channel];
        return next;
      });
      try {
        const r = await genOffline({ data: { sessionId, channelName: channel } });
        setOffline((p) => ({
          ...p,
          [channel]: { runId: r.runId, text: r.text, createdAt: new Date().toISOString() },
        }));
        setOpenOfflineChannel(channel);
      } catch (e) {
        setOfflineFailed((p) => ({
          ...p,
          [channel]: e instanceof Error ? e.message : "Offline creative brief failed",
        }));
      } finally {
        setOfflineRunning((p) => ({ ...p, [channel]: false }));
      }
    },
    [genOffline, sessionId],
  );

  /** One channel: generate, auto-check and auto-retry all happen server-side. */
  const generate = useCallback(
    async (channel: string, opts?: { open?: boolean }) => {
      setRunning((p) => ({ ...p, [channel]: true }));
      setFailed((p) => {
        const next = { ...p };
        delete next[channel];
        return next;
      });
      try {
        const { runId } = await adapt({ data: { sessionId, channelName: channel } });
        if (opts?.open) await openBrief(runId);
        return runId;
      } catch (e) {
        setFailed((p) => ({
          ...p,
          [channel]: e instanceof Error ? e.message : "Channel brief generation failed",
        }));
        return null;
      } finally {
        setRunning((p) => ({ ...p, [channel]: false }));
        await refreshRuns();
        await refreshFidelity();
        await refreshGateOne();
      }
    },
    [adapt, openBrief, refreshFidelity, refreshGateOne, refreshRuns, sessionId],
  );

  /** All channels at once — six concurrent server calls, not a queue. */
  const generateAll = async () => {
    await Promise.allSettled(channels.map((c) => generate(c)));
    await refreshRuns();
    await refreshFidelity();
    await refreshGateOne();
  };

  const runRecheck = async (runId: string) => {
    setRecheckBusy(true);
    try {
      const r = await recheck({ data: { runId } });
      setFidelityByRun((p) => ({ ...p, [runId]: r.fidelity as AdaptationFidelity }));
    } catch {
      await refreshFidelity();
    } finally {
      setRecheckBusy(false);
    }
  };

  const saveEdited = async (runId: string, directionId: string, text: string) => {
    setEditBusy(true);
    try {
      const r = await saveEdit({ data: { runId, directionId, text } });
      setFidelityByRun((p) => ({ ...p, [runId]: r.fidelity as AdaptationFidelity }));
      setOpenDirections((ds) => ds.map((d) => (d.id === directionId ? { ...d, direction: text } : d)));
      setEditing(null);
      setViewingVersion(null);
      await refreshVersions(runId, directionId);
    } finally {
      setEditBusy(false);
    }
  };

  const revertTo = async (runId: string, directionId: string, version: PromptVersionRow) => {
    setVersionBusy(true);
    try {
      const r = await revertVersion({ data: { runId, directionId, versionId: version.id } });
      setFidelityByRun((p) => ({ ...p, [runId]: r.fidelity as AdaptationFidelity }));
      setOpenDirections((ds) =>
        ds.map((d) => (d.id === directionId ? { ...d, direction: r.text } : d)),
      );
      setViewingVersion(null);
      await refreshVersions(runId, directionId);
    } finally {
      setVersionBusy(false);
    }
  };

  const downloadBrief = (channel: string, adaptation: string, runId: string) => {
    const { filename, html } = buildChannelBriefExport({
      brandName: brandName || "Brand",
      channelName: channel,
      lockedLine,
      lockedIdea,
      lockedLens,
      adaptation,
      versionNo: versions[0]?.versionNo ?? null,
      fidelity: fidelityByRun[runId] ?? null,
    });
    download(filename, html);
  };

  const downloadOffline = (channel: string, text: string) => {
    const { filename, html } = buildOfflineCreativeBriefExport({
      brandName: brandName || "Brand",
      channelName: channel,
      lockedLine,
      lockedIdea,
      lockedLens,
      brief: text,
    });
    download(filename, html);
  };


  const locked = Boolean(lockedIdea);
  const openChannel = [...latest.entries()].find(([, r]) => r.id === openRunId)?.[0] ?? "";
  const doneCount = channels.filter((c) => stateFor(c) === "complete").length;
  const runningCount = channels.filter((c) => stateFor(c) === "running").length;
  const confirmedCount = channels.filter((c) => gateOne[c]?.confirmed).length;

  return (
    <div style={{ width: "100%" }}>
      <div style={{ maxWidth: IDEA_COLUMN_WIDTH, margin: "0 auto" }}>
        <div
          className="text-mono"
          style={{ color: AMBER, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase" }}
        >
          Step 3 · Winning idea, content creation input prompts, offline creative briefs, export
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
              Both artefacts must be generated from a locked idea.{" "}
              <Link to="/creative/$sessionId/shortlist" params={{ sessionId }} style={{ color: AMBER }}>
                Go to Step 2 · Shortlist
              </Link>{" "}
              and lock a winning idea and line first.
            </div>
          )}
        </div>

        {/* CHANNELS */}
        <div
          style={{
            marginTop: 34,
            display: "flex",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div
            className="text-mono"
            style={{
              color: PAPER,
              fontSize: 11,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              flex: 1,
              minWidth: 240,
            }}
          >
            Content creation input prompts · {doneCount}/{channels.length} complete
            {runningCount > 0 ? ` · ${runningCount} running` : ""}
          </div>
          <Btn
            active
            disabled={!locked || anyRunning || channels.length === 0}
            onClick={() => void generateAll()}
          >
            {anyRunning
              ? `Generating ${runningCount} channels…`
              : "Generate all content creation input prompts"}
          </Btn>
        </div>
        <p className="text-body-sm" style={{ color: MUTED, marginTop: 8, lineHeight: 1.7 }}>
          Every channel produces two artefacts from the one locked idea and line. The{" "}
          <strong style={{ color: PAPER }}>content creation input prompt</strong> is tool-ready,
          script-level input for a content-generation system; the{" "}
          <strong style={{ color: PAPER }}>offline creative brief</strong> is direction and rationale
          for a human creative team working away from the platform. Prompts are fidelity-checked the
          moment they finish and automatically regenerated once if they drift — a channel is only
          shown as failed when it fails the check twice.
        </p>

        {/* GATE ONE — what Orchestration consumes */}
        <div
          style={{
            marginTop: 20,
            border: `1px solid ${confirmedCount === doneCount && doneCount > 0 ? GREEN : "#2A2724"}`,
            borderRadius: 12,
            padding: "16px 18px",
          }}
        >
          <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            <div
              className="text-mono"
              style={{
                color: PAPER,
                fontSize: 11,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                flex: 1,
                minWidth: 240,
              }}
            >
              Gate One · {confirmedCount}/{channels.length} prompts confirmed for orchestration
            </div>
            <Btn
              active
              disabled={gateBusy !== null || doneCount === 0}
              onClick={() => void confirmGateOneFor(null, true)}
            >
              {gateBusy === "__all__" ? "Confirming…" : "Confirm Gate One on all channels"}
            </Btn>
          </div>
          <p className="text-body-sm" style={{ color: MUTED, marginTop: 8, lineHeight: 1.7 }}>
            The Orchestration Engine only reads Gate One-confirmed content creation input prompts.
            Confirming is a human sign-off per channel — regenerating or reverting a prompt creates a
            new run, which must be confirmed again before it can be orchestrated.
          </p>
          {gateError && (
            <div className="text-body-sm" style={{ color: RED, marginTop: 8, lineHeight: 1.6 }}>
              {gateError}
            </div>
          )}
        </div>


        {channels.length === 0 && (
          <div className="text-body-sm" style={{ color: RED, marginTop: 14, lineHeight: 1.7 }}>
            No channels exist for this session yet. Run Stage 21 in the Strategy Pipeline to create
            them, then come back here.
          </div>
        )}

        <div style={{ display: "grid", gap: 14, marginTop: 18 }}>
          {channels.map((c) => {
            const state = stateFor(c);
            const run = latest.get(c);
            const f = run ? fidelityByRun[run.id] : undefined;
            const ob = offline[c];
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
                  <StatusBadge state={state} />
                  {run && state === "complete" && f && <FidelityBadge f={f} />}
                  {gateOne[c]?.confirmed && gateOne[c]?.runId === run?.id && (
                    <span
                      className="text-mono"
                      style={{
                        color: GREEN,
                        border: `1px solid ${GREEN}`,
                        borderRadius: 999,
                        padding: "3px 10px",
                        fontSize: 10,
                        letterSpacing: "0.12em",
                      }}
                    >
                      GATE ONE CONFIRMED
                    </span>
                  )}
                </div>
                {run && state === "complete" && f && f.verdict !== "pass" && (
                  <div className="text-body-sm" style={{ color: RED, marginTop: 12, lineHeight: 1.6 }}>
                    This prompt {f.verdict === "break" ? "broke away from" : "drifted from"} the
                    locked idea, and the automatic retry did not clear it. Open it below for the
                    reasoning, then regenerate or edit.
                  </div>
                )}

                {state === "running" && (
                  <div className="text-body-sm" style={{ color: AMBER, marginTop: 12, lineHeight: 1.6 }}>
                    Turning the locked idea into {c} generation input, checking fidelity, retrying if
                    needed…
                  </div>
                )}

                {state === "failed" && (
                  <div className="text-body-sm" style={{ color: RED, marginTop: 12, lineHeight: 1.6 }}>
                    {failed[c] || run?.error || "This content creation input prompt did not finish."}{" "}
                    Regenerate to run it again.
                  </div>
                )}

                <div
                  className="text-mono"
                  style={{
                    color: MUTED,
                    fontSize: 10,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    marginTop: 16,
                  }}
                >
                  Artefact 1 · Content creation input prompt
                </div>
                <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <Btn
                    active
                    disabled={!locked || running[c]}
                    onClick={() => void generate(c, { open: true })}
                  >
                    {state === "not_started"
                      ? `Generate ${c} prompt`
                      : state === "running"
                        ? `Generating ${c}…`
                        : `Regenerate ${c} prompt`}
                  </Btn>
                  {run && state !== "not_started" && (
                    <Btn
                      onClick={() => void openBrief(run.id)}
                      active={openRunId === run.id}
                      disabled={openBusy}
                    >
                      {openRunId === run.id ? `Showing ${c} prompt below` : `Open ${c} prompt`}
                    </Btn>
                  )}
                  {state === "complete" && (
                    <Btn
                      disabled={gateBusy !== null}
                      active={!gateOne[c]?.confirmed}
                      onClick={() =>
                        void confirmGateOneFor([c], !(gateOne[c]?.confirmed ?? false))
                      }
                    >
                      {gateBusy === c
                        ? "Saving…"
                        : gateOne[c]?.confirmed
                          ? `Withdraw Gate One on ${c}`
                          : `Confirm Gate One on ${c}`}
                    </Btn>
                  )}
                </div>

                <div
                  className="text-mono"
                  style={{
                    color: MUTED,
                    fontSize: 10,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    marginTop: 18,
                  }}
                >
                  Artefact 2 · Offline creative brief
                  {ob ? " · generated" : offlineRunning[c] ? " · writing…" : " · not generated"}
                </div>
                {offlineFailed[c] && (
                  <div className="text-body-sm" style={{ color: RED, marginTop: 10, lineHeight: 1.6 }}>
                    {offlineFailed[c]}
                  </div>
                )}
                <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <Btn disabled={!locked || offlineRunning[c]} onClick={() => void generateOffline(c)}>
                    {offlineRunning[c]
                      ? `Writing ${c} offline brief…`
                      : ob
                        ? `Regenerate ${c} offline brief`
                        : `Generate ${c} offline brief`}
                  </Btn>
                  {ob && (
                    <>
                      <Btn
                        active={openOfflineChannel === c}
                        onClick={() => setOpenOfflineChannel(openOfflineChannel === c ? null : c)}
                      >
                        {openOfflineChannel === c ? "Hide offline brief" : "Read offline brief"}
                      </Btn>
                      <Btn onClick={() => downloadOffline(c, ob.text)}>Download offline brief</Btn>
                    </>
                  )}
                </div>
                {ob && openOfflineChannel === c && (
                  <div
                    style={{
                      marginTop: 14,
                      padding: 18,
                      border: "1px solid #2A2724",
                      borderRadius: 10,
                      color: PAPER,
                      whiteSpace: "pre-wrap",
                      lineHeight: 1.8,
                      fontSize: 15,
                    }}
                  >
                    {ob.text}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* THE OPENED CONTENT CREATION INPUT PROMPT */}
      {openRunId && (
        <div style={{ maxWidth: IDEA_COLUMN_WIDTH, margin: "42px auto 0" }}>
          <div
            className="text-mono"
            style={{ color: AMBER, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase" }}
          >
            Content creation input prompt · {openChannel || "run"}
            {versions[0] ? ` · version ${versions[0].versionNo} (active)` : ""}
          </div>
          {openBusy && (
            <div className="text-body-sm" style={{ color: MUTED, marginTop: 10 }}>
              Loading the content creation input prompt…
            </div>
          )}
          {!openBusy && openDirections.length === 0 && (
            <div className="text-body-sm" style={{ color: RED, marginTop: 14, lineHeight: 1.7 }}>
              This prompt has no stored content. Re-generate the channel above.
            </div>
          )}
          <div style={{ display: "grid", gap: 20, marginTop: 18 }}>
            {openDirections.map((d) => (
              <div key={d.id} style={ideaCardStyle({ accent: null })}>
                <div
                  className="text-mono"
                  style={{ color: AMBER, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase" }}
                >
                  Tool-ready generation input — the locked idea in this channel
                </div>

                {editing?.id === d.id ? (
                  <>
                    <textarea
                      value={editing.text}
                      onChange={(e) => setEditing({ id: d.id, text: e.target.value })}
                      spellCheck={false}
                      style={{
                        width: "100%",
                        minHeight: 320,
                        marginTop: 16,
                        background: "#0A0908",
                        border: "1px solid #2A2724",
                        borderRadius: 8,
                        color: PAPER,
                        padding: 16,
                        fontSize: 14,
                        lineHeight: 1.7,
                        resize: "vertical",
                      }}
                    />
                    <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <Btn
                        active
                        disabled={editBusy || !editing.text.trim()}
                        onClick={() => void saveEdited(openRunId, d.id, editing.text)}
                      >
                        {editBusy
                          ? <><Spinner /> Saving new version and re-checking…</>
                          : "Save as new version & re-check fidelity"}
                      </Btn>
                      <Btn onClick={() => setEditing(null)} disabled={editBusy}>
                        Cancel
                      </Btn>
                    </div>
                  </>
                ) : (
                  <>
                    <div
                      style={{
                        color: PAPER,
                        marginTop: 16,
                        whiteSpace: "pre-wrap",
                        lineHeight: 1.8,
                        fontSize: 15,
                      }}
                    >
                      {d.direction?.trim() || d.error || "Not generated."}
                    </div>
                    <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <Btn onClick={() => setEditing({ id: d.id, text: d.direction ?? "" })}>
                        Edit prompt
                      </Btn>
                      <Btn
                        disabled={!openChannel || Boolean(running[openChannel])}
                        onClick={() => void generate(openChannel, { open: true })}
                      >
                        {openChannel && running[openChannel] ? "Regenerating…" : "Regenerate prompt"}
                      </Btn>
                      <Btn
                        disabled={!d.direction?.trim()}
                        onClick={() => downloadBrief(openChannel, d.direction ?? "", openRunId)}
                      >
                        Download this prompt
                      </Btn>
                      <Btn active={showVersions} onClick={() => setShowVersions(!showVersions)}>
                        {showVersions
                          ? "Hide version history"
                          : `Version history (${versions.length})`}
                      </Btn>
                    </div>
                  </>
                )}

                {showVersions && !editing && (
                  <div
                    style={{
                      marginTop: 18,
                      border: "1px solid #2A2724",
                      borderRadius: 10,
                      padding: 18,
                      backgroundColor: "#0A0908",
                    }}
                  >
                    <div
                      className="text-mono"
                      style={{ color: AMBER, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase" }}
                    >
                      Version history — append-only. Nothing is overwritten and no earlier version
                      is ever reactivated: restoring an older version copies its text forward into a
                      new, higher-numbered version, which becomes the active one.
                    </div>
                    {versions.length === 0 && (
                      <div className="text-body-sm" style={{ color: MUTED, marginTop: 12 }}>
                        No versions recorded yet for this prompt. Regenerate or edit it to start the
                        history.
                      </div>
                    )}
                    <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
                      {versions.map((v, i) => (
                        <div
                          key={v.id}
                          style={{
                            display: "flex",
                            gap: 12,
                            alignItems: "center",
                            flexWrap: "wrap",
                            borderTop: i === 0 ? "none" : "1px solid #1E1B19",
                            paddingTop: i === 0 ? 0 : 10,
                          }}
                        >
                          <div
                            className="text-mono"
                            style={{ color: i === 0 ? GREEN : PAPER, fontSize: 11, letterSpacing: "0.1em" }}
                          >
                            v{v.versionNo} ·{" "}
                            {v.origin === "reverted" ? "copied forward from an earlier version" : v.origin.replace("_", " ")}
                            {i === 0 ? " · ACTIVE" : ""}
                          </div>
                          <div className="text-mono" style={{ color: MUTED, fontSize: 11, flex: 1 }}>
                            {new Date(v.createdAt).toLocaleString()}
                            {v.fidelity ? ` · ${VERDICT_LABEL[v.fidelity.verdict] ?? v.fidelity.verdict} ${v.fidelity.score}/10` : ""}
                          </div>
                          <Btn
                            onClick={() =>
                              setViewingVersion(viewingVersion?.id === v.id ? null : v)
                            }
                            active={viewingVersion?.id === v.id}
                          >
                            {viewingVersion?.id === v.id ? "Hide" : "View"}
                          </Btn>
                          {i !== 0 && (
                            <Btn
                              disabled={versionBusy}
                              onClick={() => void revertTo(openRunId, d.id, v)}
                            >
                              {versionBusy
                                ? <><Spinner /> Copying forward…</>
                                : `Copy v${v.versionNo} forward as v${(versions[0]?.versionNo ?? v.versionNo) + 1}`}
                            </Btn>
                          )}
                        </div>
                      ))}
                    </div>
                    {viewingVersion && (
                      <div
                        style={{
                          marginTop: 14,
                          padding: 16,
                          border: "1px solid #2A2724",
                          borderRadius: 8,
                          color: PAPER,
                          whiteSpace: "pre-wrap",
                          lineHeight: 1.7,
                          fontSize: 14,
                        }}
                      >
                        {viewingVersion.text}
                      </div>
                    )}
                  </div>
                )}

                <AdaptationFidelityPanel
                  fidelity={fidelityByRun[openRunId] ?? null}
                  onRecheck={() => void runRecheck(openRunId)}
                  busy={recheckBusy}
                />
              </div>
            ))}
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
