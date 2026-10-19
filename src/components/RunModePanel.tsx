import { readHubContext } from "@/lib/hub/context";
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { createSession } from "@/lib/stage1.functions";

type Row = {
  run_mode: string;
  diagnostic_status: string | null;
  brand_name: string;
  category: string;
  brief_text: string;
  stage_10_structured: { current_position?: Record<string, unknown> } | null;
};

const DIMS: [string, string][] = [
  ["fame", "Fame"], ["truth_strength", "Truth"], ["competitive_impossibility", "Comp. Imp."],
  ["brand_permission", "Permission"], ["clean_air", "Clean Air"], ["commercial_precedent", "Precedent"],
];

/** Diagnostic status + "continue as full run", and the Stage 10 current-position baseline row. */
export function RunModePanel({ sessionId, refreshKey }: { sessionId: string; refreshKey?: unknown }) {
  const [row, setRow] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const create = useServerFn(createSession);

  useEffect(() => {
    supabase
      .from("sessions")
      .select("run_mode, diagnostic_status, brand_name, category, brief_text, stage_10_structured")
      .eq("id", sessionId)
      .single()
      .then(({ data }) => setRow(data as unknown as Row));
  }, [sessionId, refreshKey]);

  if (!row) return null;
  const cp = row.stage_10_structured?.current_position as
    | (Record<string, any> & { status: string })
    | undefined;
  const isDiag = row.run_mode === "diagnostic";
  if (!isDiag && !cp) return null;

  return (
    <div className="mx-5 mt-3 space-y-3 rounded-md border p-4 text-body-sm" style={{ borderColor: "var(--color-border)" }}>
      {isDiag && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <strong>Diagnostic run</strong> —{" "}
            {row.diagnostic_status === "complete"
              ? "complete and locked."
              : row.diagnostic_status === "partial"
                ? "partial: a required output (Stages 2, 9, 10, 11, 13 or the current position) is missing. Locked."
                : "in progress. Stops after Stage 13."}
          </div>
          {row.diagnostic_status !== "in_progress" && (
            <button
              type="button"
              disabled={busy}
              className="rounded-md border px-3 py-1.5"
              style={{ borderColor: "var(--color-border)" }}
              onClick={async () => {
                setBusy(true);
                try {
                  const { sessionId: id } = await create({
                    data: {
                      hub: readHubContext(),
                      brandName: row.brand_name,
                      category: row.category,
                      briefText: row.brief_text,
                      runMode: "full",
                      continuesDiagnosticId: sessionId,
                    },
                  });
                  navigate({ to: "/pipeline", search: { session: id } as never });
                } finally {
                  setBusy(false);
                }
              }}
            >
              Start full run from this diagnostic
            </button>
          )}
        </div>
      )}
      {cp && (
        <div>
          <strong>Current position (baseline — not selectable)</strong>
          {cp.status !== "scored" ? (
            <p className="mt-1" style={{ color: "var(--color-text-secondary)" }}>{String(cp.reason ?? "Not scored.")}</p>
          ) : (
            <div className="mt-2 overflow-x-auto">
              <p>
                “{String(cp.line)}” — <em>{String(cp.evidence_label)}</em>
                {cp.source ? `, ${cp.source}` : ""}
                {cp.source_date ? `, ${cp.source_date}` : ""}
              </p>
              <table className="mt-2 w-full text-left">
                <thead>
                  <tr><th className="pr-3">Proposition</th>{DIMS.map(([, l]) => <th key={l} className="pr-3">{l}</th>)}<th>/90</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="pr-3">Current (baseline)</td>
                    {DIMS.map(([k]) => <td key={k} className="pr-3">{cp[k]?.score}</td>)}
                    <td>{cp.composite}</td>
                  </tr>
                  {(cp.deltas ?? []).map((d: Record<string, any>) => (
                    <tr key={d.smp}>
                      <td className="pr-3">{d.smp} (difference)</td>
                      {DIMS.map(([k]) => <td key={k} className="pr-3">{d[k] > 0 ? `+${d[k]}` : d[k]}</td>)}
                      <td>{d.composite > 0 ? `+${d.composite}` : d.composite}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
