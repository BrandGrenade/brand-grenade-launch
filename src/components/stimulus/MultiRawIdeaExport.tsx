// MULTI-SELECT RAW IDEA EXPORT — several lenses in one print-ready document.
// Same content and format as the single Raw Idea export, one lens per page, so
// a shortlist can be read and marked up away from the screen.

import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getRawIdeaExportBatch } from "@/lib/stimulus-gate-two.functions";
import {
  buildRawIdeaBatchExport,
  download,
  openPrintable,
  type RawIdeaBatchExport,
} from "@/lib/stimulus-export";

const AMBER = "#C81E1E";
const MUTED = "#8B8680";

function btn(disabled: boolean, primary = false): React.CSSProperties {
  return {
    background: primary ? `${AMBER}22` : "none",
    border: `1px solid ${primary ? AMBER : `${AMBER}55`}`,
    color: AMBER,
    padding: "6px 12px",
    borderRadius: 6,
    fontSize: 10,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.4 : 1,
  };
}

/**
 * Selection toolbar. Rendered above a lens list whenever the list supports
 * multi-select; stays out of the way until something is actually selected.
 */
export function MultiRawIdeaExportBar({
  selectedIds,
  totalSelectable,
  onSelectAll,
  onClear,
}: {
  selectedIds: string[];
  totalSelectable: number;
  onSelectAll: () => void;
  onClear: () => void;
}) {
  const fetchBatch = useServerFn(getRawIdeaExportBatch);
  const [busy, setBusy] = useState<null | "download" | "print">(null);
  const [err, setErr] = useState<string | null>(null);

  const run = async (mode: "download" | "print") => {
    setBusy(mode);
    setErr(null);
    try {
      const data = (await fetchBatch({
        data: { directionIds: selectedIds },
      })) as unknown as RawIdeaBatchExport;
      const { filename, html } = buildRawIdeaBatchExport(data);
      if (mode === "download") download(filename, html);
      else openPrintable(html);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(null);
    }
  };

  const n = selectedIds.length;
  const none = n === 0 || busy !== null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
        marginBottom: 16,
        padding: "10px 14px",
        border: `1px solid ${n > 0 ? `${AMBER}44` : "#1C1A18"}`,
        borderRadius: 8,
        backgroundColor: "#0A0908",
      }}
    >
      <span className="text-mono" style={{ color: n > 0 ? AMBER : MUTED, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase" }}>
        {n > 0 ? `${n} selected` : "Select lenses to export together"}
      </span>
      <button type="button" className="text-mono" style={btn(false)} onClick={onSelectAll}>
        Select all ({totalSelectable})
      </button>
      {n > 0 && (
        <button type="button" className="text-mono" style={btn(false)} onClick={onClear}>
          Clear
        </button>
      )}
      <span style={{ flex: 1 }} />
      <button
        type="button"
        className="text-mono"
        disabled={none}
        style={btn(none, true)}
        onClick={() => void run("download")}
      >
        {busy === "download" ? "Building…" : "Download selected"}
      </button>
      <button
        type="button"
        className="text-mono"
        disabled={none}
        style={btn(none)}
        onClick={() => void run("print")}
      >
        {busy === "print" ? "Preparing…" : "Print selected"}
      </button>
      {err && (
        <span className="text-body-sm" style={{ color: AMBER, width: "100%" }}>
          {err}
        </span>
      )}
    </div>
  );
}

/** Per-card selection checkbox. */
export function SelectLensCheckbox({
  checked,
  onToggle,
}: {
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={checked}
      aria-label={checked ? "Deselect this lens for export" : "Select this lens for export"}
      className="text-mono"
      style={{
        width: 22,
        height: 22,
        flexShrink: 0,
        borderRadius: 4,
        border: `1px solid ${checked ? AMBER : "#2A2724"}`,
        background: checked ? `${AMBER}22` : "none",
        color: AMBER,
        fontSize: 12,
        lineHeight: 1,
        cursor: "pointer",
      }}
    >
      {checked ? "✓" : ""}
    </button>
  );
}
