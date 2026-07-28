import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { runLeftOfCentre, getLocStatus, resetStuckLoc } from "@/lib/loc.functions";
import { LOC_ENGINES, LOC_ENGINE_LABEL, type EngineName } from "@/lib/loc/task-types";

type EngineOutputEntry = { ok: boolean; error?: string; output?: unknown };

type LocStatusRow = {
  loc_status: string | null;
  loc_error: string | null;
  loc_task_type: string | null;
  loc_task_runner_up: string | null;
  loc_retry_count: number | null;
  loc_generated_at: string | null;
  checkpoint_c_confirmed: boolean | null;
  loc_engine_outputs: Record<string, EngineOutputEntry> | null;
};

// Fix 05 — client considers a running LOC stuck when no output activity has
// been observed for this many ms. "Activity" = the server heartbeat
// (loc_generated_at, refreshed by the runner at start, after each engine
// completes, and after the outputs write) OR a new engine appearing in
// loc_engine_outputs. Elapsed wall time alone does NOT trigger recovery.
const STUCK_NO_ACTIVITY_MS = 4 * 60 * 1000;

export function LocControls({ sessionId }: { sessionId: string }) {
  const runLoc = useServerFn(runLeftOfCentre);
  const getStatus = useServerFn(getLocStatus);
  const resetLoc = useServerFn(resetStuckLoc);
  const [status, setStatus] = useState<LocStatusRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [showRetryPanel, setShowRetryPanel] = useState(false);
  const [retryInstructions, setRetryInstructions] = useState("");
  const [keepEngines, setKeepEngines] = useState<Set<EngineName>>(new Set());
  const [now, setNow] = useState(() => Date.now());
  const autoFiredRef = useRef(false);
  const lastActivityRef = useRef<{ heartbeat: string | null; engineCount: number; observedAt: number } | null>(null);
  const autoRecoveredRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    async function tick() {
      try {
        const s = (await getStatus({ data: { sessionId } })) as LocStatusRow;
        if (!cancelled) {
          setStatus(s);
          setNow(Date.now());
        }
      } catch {
        // ignore
      }
    }
    void tick();
    timer = setInterval(tick, 5000);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [sessionId, getStatus]);

  const locked = status?.checkpoint_c_confirmed === true;
  const state = status?.loc_status ?? "pending";

  // Fix 04 — split engine outputs into successful vs failed.
  const { failedEngines, successfulEngines } = useMemo(() => {
    const failed: { engine: EngineName; error: string }[] = [];
    const success: EngineName[] = [];
    const outs = status?.loc_engine_outputs ?? {};
    for (const e of LOC_ENGINES) {
      const entry = outs[e];
      if (!entry) continue;
      if (entry.ok) success.push(e);
      else failed.push({ engine: e, error: entry.error ?? "Engine returned no output" });
    }
    return { failedEngines: failed, successfulEngines: success };
  }, [status?.loc_engine_outputs]);

  async function trigger(force: boolean, opts?: { retryInstructions?: string; keepEngines?: EngineName[] }) {
    if ((busy && !force) || locked) return;
    setBusy(true);
    try {
      await runLoc({
        data: {
          sessionId,
          force,
          ...(opts?.retryInstructions ? { retryInstructions: opts.retryInstructions } : {}),
          ...(opts?.keepEngines && opts.keepEngines.length > 0 ? { keepEngines: opts.keepEngines } : {}),
        },
      });
      toast.success(force ? "Left-of-Centre retry started" : "Left-of-Centre generation started");
      setShowRetryPanel(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "LOC run failed to start");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!status || autoFiredRef.current || locked) return;
    const s = status.loc_status;
    if (s == null || s === "pending") {
      autoFiredRef.current = true;
      void trigger(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, locked]);

  // Fix 05 — track output activity while "running". Recovery fires only
  // after STUCK_NO_ACTIVITY_MS with no heartbeat AND no new engine output.
  const currentHeartbeat = status?.loc_generated_at ?? null;
  const currentEngineCount = useMemo(() => {
    const outs = status?.loc_engine_outputs ?? {};
    return Object.keys(outs).length;
  }, [status?.loc_engine_outputs]);

  useEffect(() => {
    if (state !== "running") {
      lastActivityRef.current = null;
      autoRecoveredRef.current = false;
      return;
    }
    const prev = lastActivityRef.current;
    if (
      prev == null ||
      prev.heartbeat !== currentHeartbeat ||
      prev.engineCount !== currentEngineCount
    ) {
      lastActivityRef.current = {
        heartbeat: currentHeartbeat,
        engineCount: currentEngineCount,
        observedAt: Date.now(),
      };
    }
  }, [state, currentHeartbeat, currentEngineCount]);

  const msSinceActivity =
    state === "running" && lastActivityRef.current != null
      ? now - lastActivityRef.current.observedAt
      : 0;
  // Server heartbeat staleness is authoritative and survives reloads — a run
  // stuck for hours is recoverable the moment the panel mounts, instead of
  // waiting another 4 minutes for the client-side timer to age.
  const serverMsSinceActivity =
    state === "running"
      ? currentHeartbeat
        ? now - Date.parse(currentHeartbeat)
        : Number.POSITIVE_INFINITY
      : 0;
  const serverStale = serverMsSinceActivity > STUCK_NO_ACTIVITY_MS;
  const stuck = state === "running" && (msSinceActivity > STUCK_NO_ACTIVITY_MS || serverStale);

  useEffect(() => {
    // Only auto-recover when the server heartbeat confirms the run is dead.
    if (!stuck || !serverStale || autoRecoveredRef.current || locked) return;
    autoRecoveredRef.current = true;
    (async () => {
      try {
        await resetLoc({ data: { sessionId, force: true } });
        toast.message("LOC run appeared stuck — reset. Click retry to continue.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Reset failed");
      }
    })();
  }, [stuck, serverStale, locked, resetLoc, sessionId]);


  const badgeColor =
    state === "complete" ? "var(--color-success)"
    : state === "running" ? "var(--color-warning)"
    : state === "failed" ? "var(--color-error, #d33)"
    : "var(--color-text-tertiary)";

  function toggleKeep(engine: EngineName) {
    setKeepEngines((prev) => {
      const next = new Set(prev);
      if (next.has(engine)) next.delete(engine);
      else next.add(engine);
      return next;
    });
  }

  const hasFailures = failedEngines.length > 0;

  return (
    <div
      className="rounded-md border p-3 text-body-sm"
      style={{ borderColor: "var(--color-border-subtle)", background: "var(--color-surface-elevated, transparent)" }}
      aria-label="Left-of-Centre engine controls"
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: badgeColor }} />
          <strong>Left-of-Centre engines</strong>
          <span style={{ color: "var(--color-text-tertiary)" }}>
            {state}
            {status?.loc_retry_count != null && status.loc_retry_count > 0 ? ` · retry ${status.loc_retry_count}` : ""}
            {stuck ? " · stuck — recovering" : ""}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {(!status || status.loc_status == null || state === "failed") && (
            <button
              type="button"
              className="rounded border px-3 py-1"
              style={{ borderColor: "var(--color-border-strong, #999)" }}
              disabled={busy || locked}
              onClick={() => trigger(false)}
            >
              {busy ? "Retrying…" : state === "failed" ? "Error — click to retry" : "Generate LOC"}
            </button>
          )}
          {stuck && (
            <button
              type="button"
              className="rounded border px-3 py-1"
              style={{ borderColor: "var(--color-border-strong, #999)" }}
              disabled={busy || locked}
              onClick={async () => {
                // No force: the server re-checks loc_generated_at staleness and
                // refuses if the run is still heartbeating. Surface that to the user.
                try {
                  await resetLoc({ data: { sessionId } });
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Reset refused — run may still be active");
                  return;
                }
                await trigger(true);
              }}

            >
              Recover stuck run
            </button>
          )}
          {hasFailures && state !== "running" && (
            <button
              type="button"
              className="rounded border px-3 py-1"
              style={{ borderColor: "var(--color-border-strong, #999)", background: "var(--color-warning, #f4c542)", color: "#000" }}
              disabled={busy || locked}
              onClick={() =>
                trigger(true, {
                  keepEngines: successfulEngines,
                })
              }
              title={`Re-fire only the ${failedEngines.length} failed engine${failedEngines.length === 1 ? "" : "s"}; keep successful outputs`}
            >
              Retry {failedEngines.length} failed engine{failedEngines.length === 1 ? "" : "s"}
            </button>
          )}
          <button
            type="button"
            className="rounded border px-3 py-1"
            style={{ borderColor: "var(--color-border-strong, #999)" }}
            disabled={locked}
            onClick={() => setShowRetryPanel((v) => !v)}
          >
            {showRetryPanel ? "Close retry panel" : "Retry with instructions…"}
          </button>
        </div>
      </div>

      {/* Fix 04 — per-engine failure surface */}
      {hasFailures && (
        <div
          className="mt-3 rounded border p-3"
          style={{ borderColor: "var(--color-error, #d33)", background: "color-mix(in oklab, var(--color-error, #d33) 6%, transparent)" }}
        >
          <div className="mb-2 font-semibold" style={{ color: "var(--color-error, #d33)" }}>
            {failedEngines.length} engine{failedEngines.length === 1 ? "" : "s"} failed validation
          </div>
          <ul className="space-y-1">
            {failedEngines.map(({ engine, error }) => (
              <li key={engine} className="text-body-sm">
                <span className="font-mono font-semibold">{LOC_ENGINE_LABEL[engine]}</span>
                <span style={{ color: "var(--color-text-tertiary)" }}> — {error}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 text-body-sm" style={{ color: "var(--color-text-tertiary)" }}>
            Use "Retry failed engines" above to re-fire only these; the {successfulEngines.length} successful engine{successfulEngines.length === 1 ? "" : "s"} will be preserved.
          </div>
        </div>
      )}

      {showRetryPanel && !locked && (
        <div className="mt-3 space-y-3 rounded border p-3" style={{ borderColor: "var(--color-border-subtle)" }}>
          <div>
            <label className="block text-body-sm font-semibold mb-1">
              Retry directive (passed verbatim to every engine that re-fires)
            </label>
            <textarea
              value={retryInstructions}
              onChange={(e) => setRetryInstructions(e.target.value)}
              rows={10}
              placeholder="Paste corrective instructions here. Engines will treat this as a mandatory override and must satisfy it in their process field."
              className="w-full rounded border p-2 text-body-sm font-mono"
              style={{ borderColor: "var(--color-border-subtle)", background: "var(--color-surface-base, transparent)" }}
            />
          </div>
          <div>
            <div className="text-body-sm font-semibold mb-1">Keep these engines (skip retry — carry prior output forward)</div>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {LOC_ENGINES.map((e) => (
                <label key={e} className="flex items-center gap-2 text-body-sm">
                  <input type="checkbox" checked={keepEngines.has(e)} onChange={() => toggleKeep(e)} />
                  <span>{LOC_ENGINE_LABEL[e]}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="rounded border px-3 py-1"
              style={{ borderColor: "var(--color-border-strong, #999)" }}
              disabled={busy}
              onClick={() =>
                trigger(true, {
                  retryInstructions: retryInstructions.trim() || undefined,
                  keepEngines: Array.from(keepEngines),
                })
              }
            >
              {busy ? "Firing…" : "Fire retry"}
            </button>
          </div>
        </div>
      )}

      {status?.loc_error && (
        <div className="mt-2" style={{ color: "var(--color-error, #d33)" }}>
          LOC error: {status.loc_error}
        </div>
      )}
      {locked && (
        <div className="mt-2" style={{ color: "var(--color-text-tertiary)" }}>
          Locked — Checkpoint C confirmed for this session.
        </div>
      )}
    </div>
  );
}
