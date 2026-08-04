// Raw Idea Export — tier one. Reachable from Tissue Check and Gate One, with no
// orchestration required. Gives the spark and its rating snapshot, nothing else.

import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getRawIdeaExport } from "@/lib/stimulus-gate-two.functions";
import { buildRawIdeaExport, download, type RawIdeaExport } from "@/lib/stimulus-export";

const AMBER = "#E8A33D";
const MUTED = "#8A8680";

export function RawIdeaExportButton({ directionId }: { directionId: string }) {
  const fetchExport = useServerFn(getRawIdeaExport);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        disabled={busy}
        className="text-mono"
        onClick={async () => {
          setBusy(true);
          setErr(null);
          try {
            const data = (await fetchExport({ data: { directionId } })) as unknown as RawIdeaExport;
            const { filename, html } = buildRawIdeaExport(data);
            download(filename, html);
          } catch (e) {
            setErr(e instanceof Error ? e.message : "Export failed");
          } finally {
            setBusy(false);
          }
        }}
        style={{
          background: "none",
          border: `1px solid ${AMBER}55`,
          color: AMBER,
          padding: "6px 12px",
          borderRadius: 6,
          fontSize: 10,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          cursor: busy ? "wait" : "pointer",
          opacity: busy ? 0.6 : 1,
        }}
      >
        {busy ? "Exporting…" : "Raw idea export"}
      </button>
      {err && (
        <span className="text-body-sm" style={{ color: "#E86A3D", marginLeft: 8 }}>
          {err}
        </span>
      )}
      {!err && <span style={{ display: "none", color: MUTED }} />}
    </>
  );
}
