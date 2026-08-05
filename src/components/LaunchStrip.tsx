import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { NewRunGateButton } from "@/components/NewRunGateButton";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";

/**
 * Persistent launch strip fixed below the top navigation. Structurally
 * scoped to authenticated sessions — if there is no signed-in user, the
 * component returns null before any nav markup is emitted, so it cannot
 * leak onto public views (homepage, /login, /auth, repositories).
 */

// Allowlist: the strip renders ONLY on internal app surfaces. Any other path —
// including every current and future client repository slug — gets nothing.
const INTERNAL_PREFIXES = [
  "/dashboard",
  "/pipeline",
  "/intelligence",
  "/briefing-room",
  "/brief",
  "/detonation",
  "/creative",
  "/settings",
];

const buttonClass = "launch-strip-button";

const buttonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  height: 44,
  padding: "0 22px",
  borderRadius: 10,
  backgroundColor: "#1C1A18",
  color: "#EDE8E0",
  fontWeight: 600,
  fontSize: 14,
  letterSpacing: "0.02em",
  border: "1px solid #1C1A18",
  boxShadow: "none",
  textDecoration: "none",
  border: "none",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const arrowStyle: React.CSSProperties = {
  color: "#8B8680",
  fontSize: 13,
  lineHeight: 1,
  fontWeight: 400,
  userSelect: "none",
};

export const LAUNCH_STRIP_HEIGHT = 68;

/**
 * Most recent session with Creative Stimulus work, in progress or complete.
 * Orchestrations (Phase 3–4) rank ahead of runs (Phase 1–2) at equal
 * recency, so the link lands on the furthest-along work when both exist.
 * RLS scopes both tables to sessions the signed-in user can reach, so no
 * client-side ownership filter is needed.
 */
function useLatestCreativeSession(enabled: boolean): string | null {
  const [sessionId, setSessionId] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void (async () => {
      const [orch, run] = await Promise.all([
        supabase
          .from("stimulus_orchestrations")
          .select("session_id, updated_at")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("stimulus_runs")
          .select("session_id, updated_at")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      const o = orch.data;
      const r = run.data;
      const winner =
        o && r ? (o.updated_at >= r.updated_at ? o : r) : (o ?? r ?? null);
      setSessionId(winner?.session_id ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);
  return sessionId;
}

export function LaunchStrip() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, isAuthReady } = useAuth();
  const isInternal = INTERNAL_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
  const creativeSessionId = useLatestCreativeSession(
    Boolean(isAuthReady && user && isInternal),
  );
  // Hard gate: never render for unauthenticated visitors.
  if (!isAuthReady || !user) return null;
  if (!isInternal) return null;

  return (
    <>
      <style>{`
        .launch-strip-button {
          transition: opacity 0.15s ease, transform 0.1s ease;
        }
        .launch-strip-button:hover {
          opacity: 0.9;
        }
        .launch-strip-button:active {
          opacity: 0.85;
          transform: translateY(1px);
        }
      `}</style>
      <div
        role="navigation"
        aria-label="Platform launch"
        style={{
          position: "fixed",
          top: "calc(56px + var(--dev-mode-banner-height, 0px))",
          left: 0,
          right: 0,
          zIndex: 90,
          height: LAUNCH_STRIP_HEIGHT,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 24px",
          backgroundColor: "#0A0908",
          borderBottom: "1px solid #1C1A18",
          boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            width: "100%",
            maxWidth: 1280,
          }}
        >
          <Link to="/intelligence/new" style={buttonStyle} className={buttonClass}>
            Intelligence Lab
          </Link>
          <span aria-hidden style={arrowStyle}>→</span>
          <Link to="/briefing-room" style={buttonStyle} className={buttonClass}>
            Briefing Room
          </Link>
          <span aria-hidden style={arrowStyle}>→</span>
          <NewRunGateButton
            variant="launch"
            label="Strategy Pipeline"
            style={buttonStyle}
            className={buttonClass}
          />
          <span aria-hidden style={arrowStyle}>→</span>
          {creativeSessionId ? (
            <Link
              to="/creative/$sessionId"
              params={{ sessionId: creativeSessionId }}
              style={buttonStyle}
              className={buttonClass}
              title="Open your most recent creative work"
            >
              Creative Engine
            </Link>
          ) : (
            <button
              type="button"
              style={{ ...buttonStyle, cursor: "not-allowed", opacity: 0.55 }}
              className={buttonClass}
              disabled
              title="No creative work started yet — open the Creative Engine room from the dashboard"
            >
              Creative Engine
            </button>
          )}
        </div>
      </div>
      {/* Spacer to push page content below the fixed strip. TopNav already
          reserves its own 56px, so this only adds the strip's height. */}
      <div aria-hidden style={{ height: LAUNCH_STRIP_HEIGHT }} />
    </>
  );
}
