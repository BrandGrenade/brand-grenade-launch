// PLATFORM-WIDE PROGRESS INDICATORS.
//
// One source of truth for "this is actively working". Anywhere the UI shows a
// running/in-progress state it must use one of these — never a static icon and
// never a bare disabled button (which renders the browser's stop-sign cursor).

import type { CSSProperties } from "react";

const AMBER = "#F2665F";
const MUTED = "#A8A29A";
const GREEN = "#5FD08A";
const RED = "#FF8F87";

/** Animated ring. Inherits currentColor so it works on any button or badge. */
export function Spinner({
  size = 12,
  style,
}: {
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <span
      aria-hidden="true"
      className="bg-spinner"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        border: `${Math.max(2, Math.round(size / 7))}px solid currentColor`,
        borderTopColor: "transparent",
        display: "inline-block",
        verticalAlign: "-0.1em",
        flex: "0 0 auto",
        ...style,
      }}
    />
  );
}

/** Determinate bar when a step count exists ("n of 37"). */
export function ProgressBar({
  value,
  total,
  label,
  color = AMBER,
}: {
  value: number;
  total: number;
  label?: string;
  color?: string;
}) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div style={{ minWidth: 160 }} aria-label={label ?? `${value} of ${total}`}>
      <div
        style={{
          height: 6,
          borderRadius: 999,
          backgroundColor: `${color}22`,
          overflow: "hidden",
        }}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={total}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            backgroundColor: color,
            borderRadius: 999,
            transition: "width 0.3s ease",
          }}
        />
      </div>
      <div
        className="text-mono"
        style={{
          marginTop: 5,
          color: MUTED,
          fontSize: 10,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}
      >
        {label ?? `${value} / ${total}`}
      </div>
    </div>
  );
}

/** Indeterminate bar for running work with no step count. */
export function IndeterminateBar({ color = AMBER }: { color?: string }) {
  return (
    <div
      role="progressbar"
      aria-valuetext="Running"
      style={{
        height: 4,
        borderRadius: 999,
        backgroundColor: `${color}22`,
        overflow: "hidden",
        minWidth: 120,
      }}
    >
      <div
        className="bg-indeterminate"
        style={{ height: "100%", width: "40%", backgroundColor: color, borderRadius: 999 }}
      />
    </div>
  );
}

export type RunState = "not_started" | "running" | "complete" | "failed";

const PILL: Record<RunState, { label: string; color: string }> = {
  not_started: { label: "Not started", color: MUTED },
  running: { label: "Running", color: AMBER },
  complete: { label: "Complete", color: GREEN },
  failed: { label: "Failed", color: RED },
};

/**
 * Status pill. "Running" is the only state that animates — at a glance it is
 * unmistakably different from not started, complete and failed.
 */
export function StatusPill({
  state,
  label,
  detail,
}: {
  state: RunState;
  label?: string;
  detail?: string;
}) {
  const { label: base, color } = PILL[state];
  return (
    <span
      className={`text-mono${state === "running" ? " bg-running-pulse" : ""}`}
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
      {state === "running" ? <Spinner size={11} /> : null}
      {state === "complete" ? "✓ " : null}
      {state === "failed" ? "✕ " : null}
      {label ?? base}
      {detail ? ` · ${detail}` : ""}
    </span>
  );
}

/** Props to spread on any button that is disabled because it is working. */
export function busyProps(busy: boolean) {
  return busy ? ({ "aria-busy": true, "data-busy": "true" } as const) : {};
}
