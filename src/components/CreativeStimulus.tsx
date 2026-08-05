// CREATIVE STIMULUS ENGINE — Phase 1 UI
// Manual trigger inside Stage 21. One channel per run. 37 lenses generated in
// resumable batches, then the human Tissue Check pass.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  startStimulusRun,
  generateStimulusBatch,
  loadStimulusRun,
  listStimulusRuns,
  triageStimulusDirection,
  reviseStimulusDirection,
} from "@/lib/stimulus.functions";
import { getLens, LENS_COUNT } from "@/lib/stimulus/lenses";
import { StimulusGateOne, type RatedDirection } from "@/components/StimulusGateOne";
import { StimulusOrchestration } from "@/components/StimulusOrchestration";
import { StimulusPromptAudit } from "@/components/StimulusPromptAudit";

import { RawIdeaExportButton } from "@/components/RawIdeaExportButton";
import { ideaCardStyle, ideaListStyle, IDEA_COLUMN_WIDTH } from "@/components/stimulus/idea-layout";


import type { DirectionRatings } from "@/lib/stimulus/rating-prompts";

const AMBER = "#C81E1E";
const MUTED = "#8B8680";

type Direction = {
  id: string;
  lens_id: string;
  lens_name: string;
  sort_order: number;
  direction: string;
  status: string;
  instinct_brief: string | null;
  revise_notes: string | null;
  revise_count: number;
  error: string | null;
  ratings: DirectionRatings | null;
  rating_status: string;
  rating_error: string | null;
  rated_at: string | null;
  gate_one_approved: boolean;
  gate_one_approved_at: string | null;
  gate_one_notes: string | null;
};

type RunMeta = {
  tiebreaker_output?: string | null;
  tiebreaker_fired?: boolean;
  tiebreaker_reason?: string | null;
  gate_one_confirmed?: boolean;
  gate_one_confirmed_at?: string | null;
};

const TRIAGE: { value: "keep" | "keep_in_play" | "kill"; label: string }[] = [
  { value: "keep", label: "Keep" },
  { value: "keep_in_play", label: "Keep in play" },
  { value: "kill", label: "Kill" },
];

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

function DirectionCard({
  d,
  onTriage,
  onRevise,
}: {
  d: Direction;
  onTriage: (status: "keep" | "keep_in_play" | "kill", instinct?: string) => Promise<void>;
  onRevise: (notes: string) => Promise<void>;
}) {
  const lens = getLens(d.lens_id);
  const [instinct, setInstinct] = useState(d.instinct_brief ?? "");
  const [notes, setNotes] = useState("");
  const [showRevise, setShowRevise] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => setInstinct(d.instinct_brief ?? ""), [d.instinct_brief]);

  const killed = d.status === "kill";

  return (
    <div
      style={ideaCardStyle({
        accent: d.status === "keep" ? AMBER + "77" : null,
        dimmed: killed,
      })}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "baseline" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14, minWidth: 0 }}>
          <span
            className="text-mono"
            style={{ color: `${AMBER}88`, fontSize: 22, letterSpacing: "0.04em", lineHeight: 1 }}
          >
            {String(d.sort_order + 1).padStart(2, "0")}
          </span>
          <span
            style={{
              color: AMBER,
              fontFamily: "'DM Mono', monospace",
              fontSize: 16,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              lineHeight: 1.3,
            }}
          >
            {d.lens_name}
          </span>
        </div>
        {d.revise_count > 0 && (
          <span className="text-mono" style={{ color: MUTED, fontSize: 10 }}>
            revised ×{d.revise_count}
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
        style={{
          color: "#EDE8E0",
          marginTop: 20,
          whiteSpace: "pre-wrap",
          lineHeight: 1.75,
          fontSize: 15,
        }}
      >
        {d.direction || d.error || "Not generated."}
      </div>


      {lens && lens.references.length > 0 && (
        <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 8 }}>
          {lens.references.map((r) => (
            <a
              key={r.url}
              href={r.url}
              target="_blank"
              rel="noreferrer noopener"
              className="text-mono"
              style={{
                color: MUTED,
                border: "1px solid #1C1A18",
                borderRadius: 999,
                padding: "3px 10px",
                fontSize: 10,
                textDecoration: "none",
              }}
            >
              {r.label} ↗
            </a>
          ))}
        </div>
      )}

      <textarea
        value={instinct}
        onChange={(e) => setInstinct(e.target.value)}
        rows={2}
        placeholder="Initial instinct — what you'd do with this, in your own words."
        style={{
          width: "100%",
          marginTop: 14,
          backgroundColor: "#0A0908",
          color: "#EDE8E0",
          border: "1px solid #1C1A18",
          borderRadius: 6,
          padding: 10,
          fontFamily: "inherit",
          fontSize: 13,
          lineHeight: 1.5,
          resize: "vertical",
        }}
      />

      <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {TRIAGE.map((t) => (
          <Btn
            key={t.value}
            active={d.status === t.value}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onTriage(t.value, instinct);
              } finally {
                setBusy(false);
              }
            }}
          >
            {t.label}
          </Btn>
        ))}
        <Btn onClick={() => setShowRevise((v) => !v)} disabled={busy}>
          Revise
        </Btn>
        <RawIdeaExportButton directionId={d.id} />

      </div>

      {showRevise && (
        <div style={{ marginTop: 12 }}>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="What to change — the lens stays, the direction gets rewritten."
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

export function CreativeStimulus({
  sessionId,
  channels,
  brandName,
  defaultOpen = false,
  variant = "panel",
}: {
  sessionId: string;
  channels: string[];
  brandName: string;
  /** Deep links (?panel=creative) expand the panel on mount. */
  defaultOpen?: boolean;
  /** "page" removes the collapsible chrome — the engine owns the whole room. */
  variant?: "panel" | "page";
}) {

  const start = useServerFn(startStimulusRun);
  const batch = useServerFn(generateStimulusBatch);
  const load = useServerFn(loadStimulusRun);
  const listRuns = useServerFn(listStimulusRuns);
  const triage = useServerFn(triageStimulusDirection);
  const revise = useServerFn(reviseStimulusDirection);

  const isPage = variant === "page";
  const [open, setOpen] = useState(defaultOpen || variant === "page");

  const [channel, setChannel] = useState(channels[0] ?? "");
  const [runId, setRunId] = useState<string | null>(null);
  const [runs, setRuns] = useState<
    { id: string; channel_name: string; status: string; created_at?: string }[]
  >([]);
  const [directions, setDirections] = useState<Direction[]>([]);
  const [runMeta, setRunMeta] = useState<RunMeta>({});
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "keep" | "keep_in_play" | "kill" | "untriaged">("all");

  const refreshRuns = useCallback(async () => {
    try {
      const r = await listRuns({ data: { sessionId } });
      setRuns(
        r.runs as { id: string; channel_name: string; status: string; created_at?: string }[],
      );
    } catch {
      /* non-fatal */
    }
  }, [listRuns, sessionId]);

  useEffect(() => {
    if (open) void refreshRuns();
  }, [open, refreshRuns]);

  const openRun = useCallback(
    async (id: string) => {
      setRunId(id);
      const r = await load({ data: { runId: id } });
      setDirections(r.directions as Direction[]);
      setRunMeta(r.run as RunMeta);
      setProgress((r.directions as Direction[]).filter((d) => d.status !== "pending").length);
    },
    [load],
  );

  const handleStart = async () => {
    if (!channel) return;
    setBusy(true);
    setErr(null);
    setDirections([]);
    setProgress(0);
    try {
      const { runId: id } = await start({ data: { sessionId, channelName: channel } });
      setRunId(id);
      let done = false;
      while (!done) {
        const r = await batch({ data: { runId: id, batchSize: 4 } });
        done = r.done;
        setProgress(LENS_COUNT - r.remaining);
        const cur = await load({ data: { runId: id } });
        setDirections(cur.directions as Direction[]);
        setRunMeta(cur.run as RunMeta);
      }
      await refreshRuns();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Creative Stimulus generation failed");
    } finally {
      setBusy(false);
    }
  };

  const patch = (id: string, next: Partial<Direction>) =>
    setDirections((prev) => prev.map((d) => (d.id === id ? { ...d, ...next } : d)));

  const visible = useMemo(() => {
    if (filter === "all") return directions;
    if (filter === "untriaged")
      return directions.filter((d) => !["keep", "keep_in_play", "kill"].includes(d.status));
    return directions.filter((d) => d.status === filter);
  }, [directions, filter]);

  const counts = useMemo(
    () => ({
      keep: directions.filter((d) => d.status === "keep").length,
      play: directions.filter((d) => d.status === "keep_in_play").length,
      kill: directions.filter((d) => d.status === "kill").length,
    }),
    [directions],
  );

  if (channels.length === 0) return null;

  return (
    <div
      style={
        isPage
          ? { width: "100%" }
          : { marginTop: 28, border: `1px solid ${AMBER}33`, borderRadius: 8, padding: 20, backgroundColor: "#0A0908" }
      }
    >
      {!isPage && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          style={{ width: "100%", textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer" }}
        >
          <div
            className="text-mono"
            style={{ color: AMBER, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase" }}
          >
            Creative Stimulus Engine
          </div>
          <div className="text-body-sm" style={{ color: MUTED, marginTop: 6 }}>
            Sweeps one channel brief through all {LENS_COUNT} creative lenses, then hands the output to a human
            Tissue Check. Raw stimulus, not finished work. {open ? "Hide" : "Open"}.
          </div>
        </button>
      )}


      {open && (
        <div style={{ marginTop: 18 }}>
          {err && (
            <div className="text-body-sm" style={{ color: "#C81E1E", marginBottom: 12 }}>
              {err}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              disabled={busy}
              style={{
                backgroundColor: "#0A0908",
                color: "#EDE8E0",
                border: "1px solid #1C1A18",
                borderRadius: 6,
                padding: "8px 10px",
                fontFamily: "inherit",
                fontSize: 13,
              }}
            >
              {channels.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <Btn onClick={handleStart} disabled={busy || !channel} active>
              {busy ? `Generating ${progress}/${LENS_COUNT}…` : "Run 37-lens sweep"}
            </Btn>
            {runs.length > 0 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {runs.map((r) => (
                  <Btn key={r.id} active={r.id === runId} disabled={busy} onClick={() => void openRun(r.id)}>
                    {`${r.channel_name.slice(0, 28)}${r.channel_name.length > 28 ? "…" : ""} · ${
                      r.created_at ? new Date(r.created_at).toLocaleDateString() : ""
                    } · ${r.id.slice(0, 6)}`}
                  </Btn>
                ))}
              </div>
            )}
          </div>

          {directions.length > 0 && (
            <>
              <div
                style={{
                  marginTop: 28,
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                  alignItems: "center",
                  ...(isPage
                    ? {
                        position: "sticky" as const,
                        top: 128,
                        zIndex: 20,
                        backgroundColor: "#0A0908f2",
                        backdropFilter: "blur(6px)",
                        border: "1px solid #1C1A18",
                        borderRadius: 10,
                        padding: "12px 16px",
                        maxWidth: IDEA_COLUMN_WIDTH,
                        margin: "28px auto 0",
                      }
                    : {}),
                }}
              >
                <span className="text-mono" style={{ color: MUTED, fontSize: 10, letterSpacing: "0.12em" }}>
                  TISSUE CHECK — {counts.keep} keep · {counts.play} in play · {counts.kill} killed
                </span>
                {(["all", "untriaged", "keep", "keep_in_play", "kill"] as const).map((f) => (
                  <Btn key={f} active={filter === f} onClick={() => setFilter(f)}>
                    {f.replace("_", " ")}
                  </Btn>
                ))}
              </div>


              <div style={{ ...ideaListStyle, marginTop: 24 }}>

                {visible.map((d) => (
                  <DirectionCard
                    key={d.id}
                    d={d}
                    onTriage={async (status, instinct) => {
                      await triage({ data: { directionId: d.id, status, instinctBrief: instinct ?? "" } });
                      patch(d.id, { status, instinct_brief: instinct ?? "" });
                    }}
                    onRevise={async (notes) => {
                      const r = await revise({ data: { directionId: d.id, notes } });
                      patch(d.id, {
                        direction: r.direction,
                        status: "generated",
                        revise_notes: notes,
                        revise_count: d.revise_count + 1,
                      });
                    }}
                  />
                ))}
              </div>

              {runId && <StimulusPromptAudit runId={runId} />}

              {runId && (

                <StimulusGateOne
                  runId={runId}
                  run={runMeta}
                  directions={directions as unknown as RatedDirection[]}
                  onRefresh={async () => {
                    const cur = await load({ data: { runId } });
                    setDirections(cur.directions as Direction[]);
                    setRunMeta(cur.run as RunMeta);
                  }}
                  onRevise={async (directionId, notes) => {
                    await revise({ data: { directionId, notes } });
                  }}
                />
              )}
            </>
          )}

          <StimulusOrchestration sessionId={sessionId} brandName={brandName} />
        </div>
      )}
    </div>
  );
}
