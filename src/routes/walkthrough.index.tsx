// Demo Mode — session picker for the linear walkthrough.

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Play, Search } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { Input } from "@/components/ui/input";
import { listWalkthroughSessions } from "@/lib/walkthrough.functions";
import { useDemoMode } from "@/lib/demo-mode";

export const Route = createFileRoute("/walkthrough/")({
  head: () => ({
    meta: [
      { title: "Walkthrough — Brand Grenade" },
      {
        name: "description",
        content: "Present a completed strategy run as one continuous, linear narrative.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: WalkthroughPicker,
});

const CREAM = "#EDE8E0";
const MUTED = "#8B8680";
const LINE = "#1C1A18";
const RED = "#E5484D";

function WalkthroughPicker() {
  const navigate = useNavigate();
  const listFn = useServerFn(listWalkthroughSessions);
  const [q, setQ] = useState("");
  const { enabled, setEnabled } = useDemoMode();

  // Landing here is an explicit request to present.
  useEffect(() => {
    if (!enabled) setEnabled(true);
  }, [enabled, setEnabled]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["walkthrough-sessions"],
    queryFn: () => listFn({ data: undefined as never }),
  });

  const rows = useMemo(() => {
    const all = data ?? [];
    const term = q.trim().toLowerCase();
    return term
      ? all.filter(
          (r) =>
            r.brand_name.toLowerCase().includes(term) ||
            (r.category ?? "").toLowerCase().includes(term),
        )
      : all;
  }, [data, q]);

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main style={{ maxWidth: 1000, margin: "0 auto", padding: "56px 32px 96px" }}>
        <p
          className="text-label"
          style={{ color: RED, letterSpacing: "0.14em", textTransform: "uppercase" }}
        >
          Demo Mode
        </p>
        <h1 className="text-h1" style={{ color: CREAM, marginTop: 8 }}>
          Walkthrough
        </h1>
        <p className="text-body" style={{ color: MUTED, marginTop: 10, maxWidth: 620 }}>
          Choose a completed session and present it as one continuous narrative — research,
          intelligence, tension, every proposition considered and why the others were set aside,
          each human checkpoint, the full creative sweep, and the locked outputs.
        </p>

        <div style={{ position: "relative", marginTop: 32, maxWidth: 420 }}>
          <Search
            size={16}
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              color: MUTED,
            }}
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search brand"
            style={{ paddingLeft: 36 }}
          />
        </div>

        <div style={{ marginTop: 28 }}>
          {isLoading ? (
            <p className="text-body" style={{ color: MUTED }}>
              <Loader2 className="inline animate-spin" size={14} /> Loading sessions…
            </p>
          ) : error ? (
            <p className="text-body" style={{ color: RED }}>
              Could not load sessions.
            </p>
          ) : rows.length === 0 ? (
            <p className="text-body" style={{ color: MUTED }}>
              No sessions found.
            </p>
          ) : (
            rows.map((r) => (
              <button
                key={r.id}
                onClick={() =>
                  navigate({
                    to: "/walkthrough/$sessionId",
                    params: { sessionId: r.id },
                    search: { step: 0 },
                    
                  })
                }
                style={{
                  display: "flex",
                  width: "100%",
                  alignItems: "center",
                  gap: 20,
                  textAlign: "left",
                  padding: "18px 4px",
                  borderBottom: `1px solid ${LINE}`,
                  background: "transparent",
                  cursor: "pointer",
                }}
              >
                <div style={{ flex: 1 }}>
                  <p className="text-h3" style={{ color: CREAM }}>
                    {r.brand_name}
                  </p>
                  <p className="text-label" style={{ color: MUTED, marginTop: 4 }}>
                    {r.category || "—"} · stage {r.current_stage} ·{" "}
                    {new Date(r.created_at).toLocaleDateString("en-GB")}
                  </p>
                </div>
                {r.locked_big_idea ? (
                  <span className="text-label" style={{ color: "#7BB661" }}>
                    IDEA LOCKED
                  </span>
                ) : null}
                <Play size={16} style={{ color: MUTED }} />
              </button>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
