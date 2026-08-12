import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getCreativeShowcase } from "@/lib/creative-showcase.functions";
import { buildCreativeShowcase } from "@/lib/creative-showcase-document";
import { download, openPrintable } from "@/lib/stimulus-export";
import { Spinner } from "@/components/ui/busy";

const AMBER = "#C81E1E";

/**
 * FULL CREATIVE SHOWCASE — one approved campaign, presented whole.
 *
 * Available once the session has a locked winning idea and at least one
 * channel expression. The document itself is the presentation: Foundation,
 * the Expressions, Proof of Coherence, then full detail underneath.
 */
export function CreativeShowcaseCard({
  sessionId,
  subhead,
}: {
  sessionId: string;
  subhead: (label: string) => React.ReactNode;
}) {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState<"download" | "print" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const showcase = useServerFn(getCreativeShowcase);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data: session } = await supabase
        .from("sessions")
        .select("locked_big_idea")
        .eq("id", sessionId)
        .maybeSingle();
      if (!session?.locked_big_idea?.trim()) return;
      const { count } = await supabase
        .from("stimulus_runs")
        .select("id", { count: "exact", head: true })
        .eq("session_id", sessionId)
        .eq("run_mode", "channel_adaptation");
      if (!cancelled) setReady((count ?? 0) > 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (!ready) return null;

  const run = async (mode: "download" | "print") => {
    setBusy(mode);
    setErr(null);
    try {
      const data = await showcase({ data: { sessionId } });
      const { filename, html } = buildCreativeShowcase(data);
      if (mode === "download") download(filename, html);
      else openPrintable(html);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Showcase build failed");
    } finally {
      setBusy(null);
    }
  };

  const btn = (label: string, mode: "download" | "print", note: string) => (
    <button
      type="button"
      disabled={busy !== null}
      aria-busy={busy === mode}
      onClick={() => void run(mode)}
      style={{
        textAlign: "left",
        padding: "14px 16px",
        borderRadius: 8,
        background: "var(--color-surface-2)",
        border: `1px solid ${AMBER}33`,
        color: "var(--color-text-primary)",
        cursor: busy ? "progress" : "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <span className="text-body" style={{ fontWeight: 600 }}>
        {label}
      </span>
      <span className="text-body-sm" style={{ color: "#8B8680" }}>
        {note}
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
        {busy === mode ? (
          <>
            <Spinner /> Building…
          </>
        ) : mode === "download" ? (
          "Download ↓"
        ) : (
          "Open / print ↗"
        )}
      </span>
    </button>
  );

  return (
    <div id="creative-showcase">
      {subhead("Full Creative Showcase")}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: 12,
        }}
      >
        {btn(
          "Full Creative Showcase",
          "download",
          "One campaign, presented whole: the foundation, every channel as an expression of it, the CD cohesion verdict, full detail underneath",
        )}
        {btn("Present it now", "print", "Same document, opened for screen presentation or print to PDF")}
      </div>
      {err && <div style={{ marginTop: 8, fontSize: 13, color: "#E5484D" }}>{err}</div>}
    </div>
  );
}
