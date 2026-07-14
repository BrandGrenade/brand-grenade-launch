import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { runLeftOfCentre, getLocStatus, finalizeLeftOfCentre } from "@/lib/loc.functions";

type LocStatusRow = {
  loc_status: string | null;
  loc_error: string | null;
  loc_task_type: string | null;
  loc_task_runner_up: string | null;
  loc_retry_count: number | null;
  loc_generated_at: string | null;
  checkpoint_c_confirmed: boolean | null;
};

/**
 * Compact controls for the parallel Left-of-Centre engine track.
 *
 * - Shows current LOC status (pending / running / complete / failed).
 * - "Generate LOC" for sessions where it never ran (legacy).
 * - "Retry Left-of-Centre Engines" writes a fresh set, overwriting the
 *   previous one. Independent of core Stage 9. Locked after Checkpoint C.
 */
export function LocControls({ sessionId }: { sessionId: string }) {
  const runLoc = useServerFn(runLeftOfCentre);
  const getStatus = useServerFn(getLocStatus);
  const finalizeLoc = useServerFn(finalizeLeftOfCentre);
  const [status, setStatus] = useState<LocStatusRow | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    async function tick() {
      try {
        const s = (await getStatus({ data: { sessionId } })) as LocStatusRow;
        if (!cancelled) setStatus(s);
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

  async function trigger(force: boolean) {
    if (busy || locked) return;
    setBusy(true);
    try {
      await runLoc({ data: { sessionId, force } });
      toast.success(force ? "Left-of-Centre retry started" : "Left-of-Centre generation started");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "LOC run failed to start");
    } finally {
      setBusy(false);
    }
  }

  async function recover() {
    if (busy || locked) return;
    setBusy(true);
    try {
      const r = (await finalizeLoc({ data: { sessionId } })) as { ok?: boolean; alreadyComplete?: boolean };
      if (r.alreadyComplete) toast.info("LOC already complete");
      else toast.success("LOC recovered from persisted data");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "LOC recovery failed");
    } finally {
      setBusy(false);
    }
  }

  const badgeColor =
    state === "complete"
      ? "var(--color-success)"
      : state === "running"
        ? "var(--color-warning)"
        : state === "failed"
          ? "var(--color-error, #d33)"
          : "var(--color-text-tertiary)";

  return (
    <div
      className="rounded-md border p-3 text-body-sm"
      style={{
        borderColor: "var(--color-border-subtle)",
        background: "var(--color-surface-elevated, transparent)",
      }}
      aria-label="Left-of-Centre engine controls"
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: badgeColor }}
          />
          <strong>Left-of-Centre engines</strong>
          <span style={{ color: "var(--color-text-tertiary)" }}>
            {state}
            {status?.loc_retry_count != null && status.loc_retry_count > 0
              ? ` · retry ${status.loc_retry_count}`
              : ""}
          </span>
        </div>

        {status?.loc_task_type && (
          <span style={{ color: "var(--color-text-tertiary)" }}>
            Task: <strong>{status.loc_task_type.replaceAll("_", " ")}</strong>
            {status.loc_task_runner_up
              ? ` (runner-up: ${status.loc_task_runner_up.replaceAll("_", " ")})`
              : ""}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {(!status || status.loc_status == null || state === "failed") && (
            <button
              type="button"
              className="rounded border px-3 py-1"
              style={{ borderColor: "var(--color-border-strong, #999)" }}
              disabled={busy || locked}
              onClick={() => trigger(false)}
            >
              {busy ? "Starting…" : "Generate LOC"}
            </button>
          )}
          <button
            type="button"
            className="rounded border px-3 py-1"
            style={{ borderColor: "var(--color-border-strong, #999)" }}
            disabled={busy || locked || state === "running" || state === "complete"}
            onClick={recover}
            title="Rebuild the LOC output from the engine + validation data already saved (no re-run)"
          >
            {busy ? "Recovering…" : "Recover LOC"}
          </button>
          <button
            type="button"
            className="rounded border px-3 py-1"
            style={{ borderColor: "var(--color-border-strong, #999)" }}
            disabled={busy || locked || state === "running"}
            onClick={() => trigger(true)}
            title={
              locked
                ? "Locked: Checkpoint C confirmed"
                : "Overwrites the current LOC set with a fresh independent generation"
            }
          >
            {busy ? "Retrying…" : "Retry Left-of-Centre Engines"}
          </button>
        </div>
      </div>

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
