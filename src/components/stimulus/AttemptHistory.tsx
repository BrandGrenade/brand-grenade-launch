// ATTEMPT HISTORY — every take a lens has been given, kept side by side.
// A lens is never overwritten: first output is Attempt 1, and each Revise or
// Try Again adds another. Exactly one attempt is active, and only the active
// attempt travels downstream to Gate One and orchestration.

import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listDirectionAttempts,
  setActiveAttempt,
  tryAgainStimulusDirection,
} from "@/lib/stimulus-attempts.functions";

const AMBER = "#F2665F";
const MUTED = "#A8A29A";

export type Attempt = {
  id: string;
  attempt_no: number;
  origin: string;
  direction: string | null;
  campaign_line: string | null;
  rationale: string | null;
  revise_notes: string | null;
  rating_status: string;
  created_at: string;
};

const ORIGIN_LABEL: Record<string, string> = {
  initial: "first output",
  revise: "revised",
  try_again: "try again",
};

function chip(active: boolean, disabled: boolean): React.CSSProperties {
  return {
    background: active ? `${AMBER}22` : "none",
    border: `1px solid ${active ? AMBER : "#1C1A18"}`,
    color: active ? AMBER : MUTED,
    padding: "5px 11px",
    borderRadius: 6,
    fontSize: 10,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    cursor: disabled ? "wait" : "pointer",
    opacity: disabled ? 0.6 : 1,
  };
}

/**
 * Renders the Try Again control and, once more than one attempt exists, the
 * attempt selector. Switching attempt is a preview; making one active is a
 * separate, explicit decision.
 */
export function AttemptHistory({
  directionId,
  busy,
  onChanged,
}: {
  directionId: string;
  busy?: boolean;
  /** Parent reloads the run so the card shows the newly active attempt. */
  onChanged: () => Promise<void> | void;
}) {
  const list = useServerFn(listDirectionAttempts);
  const tryAgain = useServerFn(tryAgainStimulusDirection);
  const activate = useServerFn(setActiveAttempt);

  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [working, setWorking] = useState<null | "again" | "activate" | "load">(null);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await list({ data: { directionId } });
      setAttempts(r.attempts as Attempt[]);
      setActiveId(r.activeAttemptId ?? null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load attempts");
    }
  }, [list, directionId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const viewing = attempts.find((a) => a.id === viewingId) ?? null;
  const disabled = Boolean(busy) || working !== null;

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button
          type="button"
          className="text-mono"
          disabled={disabled}
          style={chip(false, disabled)}
          onClick={async () => {
            setWorking("again");
            setErr(null);
            try {
              await tryAgain({ data: { directionId } });
              await refresh();
              setViewingId(null);
              await onChanged();
            } catch (e) {
              setErr(e instanceof Error ? e.message : "Try again failed");
            } finally {
              setWorking(null);
            }
          }}
        >
          {working === "again" ? "Thinking again…" : "Try again"}
        </button>

        {attempts.length > 1 && (
          <>
            <span className="text-mono" style={{ color: MUTED, fontSize: 10 }}>
              {attempts.length} attempts ·
            </span>
            {attempts.map((a) => {
              const isActive = a.id === activeId;
              const isViewing = viewingId ? a.id === viewingId : isActive;
              return (
                <button
                  key={a.id}
                  type="button"
                  className="text-mono"
                  disabled={disabled}
                  title={`${ORIGIN_LABEL[a.origin] ?? a.origin}${isActive ? " · active" : ""}`}
                  style={{
                    ...chip(isViewing, disabled),
                    borderStyle: isActive ? "solid" : "dashed",
                  }}
                  onClick={() => setViewingId(a.id === activeId ? null : a.id)}
                >
                  {String(a.attempt_no).padStart(2, "0")}
                  {isActive ? " ●" : ""}
                </button>
              );
            })}
          </>
        )}
      </div>

      {viewing && viewing.id !== activeId && (
        <div
          style={{
            marginTop: 12,
            border: `1px dashed ${AMBER}55`,
            borderRadius: 8,
            padding: 14,
            backgroundColor: "#0A0908",
          }}
        >
          <div className="text-mono" style={{ color: MUTED, fontSize: 10, letterSpacing: "0.1em" }}>
            Attempt {String(viewing.attempt_no).padStart(2, "0")} ·{" "}
            {ORIGIN_LABEL[viewing.origin] ?? viewing.origin} ·{" "}
            {new Date(viewing.created_at).toLocaleString()} · not active
          </div>
          {viewing.revise_notes && (
            <div className="text-body-sm" style={{ color: MUTED, marginTop: 8, fontStyle: "italic" }}>
              Revision note: {viewing.revise_notes}
            </div>
          )}
          {viewing.campaign_line && (
            <div style={{ color: "#EDE8E0", marginTop: 10, fontSize: 15 }}>
              {viewing.campaign_line}
            </div>
          )}
          <div
            className="text-body-sm"
            style={{
              color: "#EDE8E0",
              marginTop: 10,
              whiteSpace: "pre-wrap",
              lineHeight: 1.75,
              fontSize: 15,
            }}
          >
            {viewing.direction || "No output recorded for this attempt."}
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button
              type="button"
              className="text-mono"
              disabled={disabled}
              style={{ ...chip(true, disabled), cursor: disabled ? "wait" : "pointer" }}
              onClick={async () => {
                setWorking("activate");
                setErr(null);
                try {
                  await activate({ data: { directionId, attemptId: viewing.id } });
                  await refresh();
                  setViewingId(null);
                  await onChanged();
                } catch (e) {
                  setErr(e instanceof Error ? e.message : "Could not switch attempt");
                } finally {
                  setWorking(null);
                }
              }}
            >
              {working === "activate" ? "Switching…" : "Make this the active take"}
            </button>
            <button
              type="button"
              className="text-mono"
              style={chip(false, false)}
              onClick={() => setViewingId(null)}
            >
              Close
            </button>
          </div>
          <div className="text-body-sm" style={{ color: MUTED, marginTop: 10, fontSize: 12 }}>
            Only the active take is rated, approved at Gate One and carried into orchestration.
            Switching clears the current rating and Gate One approval.
          </div>
        </div>
      )}

      {err && (
        <div className="text-body-sm" style={{ color: AMBER, marginTop: 8 }}>
          {err}
        </div>
      )}
    </div>
  );
}
