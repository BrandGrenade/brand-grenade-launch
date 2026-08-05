import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getFullFinishedExport } from "@/lib/stimulus-gate-two.functions";
import { buildFullFinishedExport, download } from "@/lib/stimulus-export";

const AMBER = "#C81E1E";

/**
 * Creative Showcase deliverable. Renders only when the session has an
 * orchestration with Gate Two confirmed — before that the prompt set is not
 * signed off and must not be handed out as a finished document. The export
 * itself reuses the exact same server payload and HTML builder as the Gate
 * Two panel inside Stage 21, so the two never drift.
 */
export function CreativeShowcaseCard({
  sessionId,
  subhead,
}: {
  sessionId: string;
  subhead: (label: string) => React.ReactNode;
}) {
  const [orchestrationId, setOrchestrationId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fullExport = useServerFn(getFullFinishedExport);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("stimulus_orchestrations")
        .select("id, updated_at")
        .eq("session_id", sessionId)
        .eq("gate_two_confirmed", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled) setOrchestrationId(data?.id ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (!orchestrationId) return null;

  return (
    <div id="creative-showcase">
      {subhead("Creative Stimulus")}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: 12,
        }}
      >
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setErr(null);
            try {
              const data = await fullExport({ data: { orchestrationId } });
              const { filename, html } = buildFullFinishedExport(data);
              download(filename, html);
            } catch (e) {
              setErr(e instanceof Error ? e.message : "Export failed");
            } finally {
              setBusy(false);
            }
          }}
          style={{
            textAlign: "left",
            padding: "14px 16px",
            borderRadius: 8,
            background: "var(--color-surface-2)",
            border: `1px solid ${AMBER}33`,
            color: "var(--color-text-primary)",
            cursor: busy ? "wait" : "pointer",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <span className="text-body" style={{ fontWeight: 600 }}>
            Creative Showcase
          </span>
          <span className="text-body-sm" style={{ color: "#8B8680" }}>
            Gate Two-approved prompt set, ratings and decision record
          </span>
          <span
            className="text-mono"
            style={{
              marginTop: 6,
              color: AMBER,
              fontSize: 9,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            {busy ? "Building…" : "Download ↓"}
          </span>
        </button>
      </div>
      {err && (
        <div style={{ marginTop: 8, fontSize: 12, color: "#C97A7A" }}>{err}</div>
      )}
    </div>
  );
}
