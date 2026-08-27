// FULL CREATIVE SHOWCASE — the campaign presentation, on its own page.
//
// Reached from the Brand Register's "Showcase" link. It renders the built
// showcase document itself rather than dropping the user on the Deliverables
// page, and still offers download / print of the same document.

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { TopNav } from "@/components/TopNav";
import { supabase } from "@/integrations/supabase/client";
import { getCreativeShowcase } from "@/lib/creative-showcase.functions";
import { buildCreativeShowcase } from "@/lib/creative-showcase-document";
import { download, openPrintable } from "@/lib/stimulus-export";
import { Spinner } from "@/components/ui/busy";
import { NUMBERED_STAGE_COUNT } from "@/lib/stage-manifest";

const AMBER = "#C81E1E";
const MUTED = "#8B8680";

export const Route = createFileRoute("/showcase")({
  component: ShowcasePage,
  head: () => ({
    meta: [
      { title: "Full Creative Showcase — Brand Grenade" },
      {
        name: "description",
        content:
          "One locked campaign presented whole: the foundation, every channel expression, the cohesion verdict and the full working detail.",
      },
      { property: "og:title", content: "Full Creative Showcase — Brand Grenade" },
      {
        property: "og:description",
        content: "The complete campaign presentation for a locked Brand Grenade idea.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function ShowcasePage() {
  const sessionId =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("session")
      : null;

  const showcase = useServerFn(getCreativeShowcase);
  const [brand, setBrand] = useState("");
  const [doc, setDoc] = useState<{ filename: string; html: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await supabase
          .from("sessions")
          .select("brand_name")
          .eq("id", sessionId)
          .maybeSingle();
        if (!cancelled) setBrand(data?.brand_name ?? "");
        const payload = await showcase({ data: { sessionId } });
        if (!cancelled) setDoc(buildCreativeShowcase(payload));
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Showcase build failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, showcase]);

  const btnStyle: React.CSSProperties = {
    padding: "10px 16px",
    borderRadius: 8,
    border: `1px solid ${AMBER}`,
    background: "transparent",
    color: AMBER,
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopNav session={{ brand: brand || "Showcase", currentStage: NUMBERED_STAGE_COUNT, totalStages: NUMBERED_STAGE_COUNT, isRunning: false }} />
      <div className="flex items-center border-b border-border bg-background px-5 py-3 sm:px-8">
        <nav className="text-body-sm flex items-center gap-1.5 truncate" style={{ color: "var(--color-text-tertiary)" }}>
          <Link to="/dashboard" className="transition-colors hover:text-text-secondary">
            Sessions
          </Link>
          <span>→</span>
          <span className="text-text-secondary truncate">{brand || "Session"}</span>
          <span>→</span>
          <span>Full Creative Showcase</span>
        </nav>
      </div>

      <main className="mx-auto w-full max-w-[1100px] px-5 sm:px-8" style={{ paddingTop: 32, paddingBottom: 64 }}>
        <h1 className="text-h1 text-text-primary" style={{ fontWeight: 700, marginBottom: 8 }}>
          {brand ? `${brand} — Full Creative Showcase` : "Full Creative Showcase"}
        </h1>
        <p className="text-body-sm" style={{ color: MUTED, marginBottom: 20 }}>
          One campaign, presented whole: the foundation, every channel as an expression of it, the cohesion verdict,
          full detail underneath.
        </p>

        {!sessionId && <p style={{ color: MUTED }}>No session specified.</p>}
        {loading && sessionId && (
          <p style={{ color: MUTED }}>
            <Spinner /> Building the showcase…
          </p>
        )}
        {err && <p style={{ color: "#E5484D" }}>{err}</p>}

        {doc && (
          <>
            <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
              <button type="button" style={btnStyle} onClick={() => download(doc.filename, doc.html)}>
                Download ↓
              </button>
              <button type="button" style={btnStyle} onClick={() => openPrintable(doc.html)}>
                Open / print ↗
              </button>
              {sessionId && (
                <a href={`/complete?session=${encodeURIComponent(sessionId)}`} style={{ ...btnStyle, textDecoration: "none" }}>
                  All deliverables →
                </a>
              )}
            </div>
            <iframe
              title="Full Creative Showcase"
              srcDoc={doc.html}
              style={{
                width: "100%",
                height: "80vh",
                border: "1px solid var(--color-border)",
                borderRadius: 12,
                background: "#0A0908",
              }}
            />
          </>
        )}
      </main>
    </div>
  );
}
