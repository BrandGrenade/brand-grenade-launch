import { Link, useRouterState } from "@tanstack/react-router";
import { NewRunGateButton } from "@/components/NewRunGateButton";

/**
 * Persistent launch strip fixed below the top navigation. The three
 * buttons are the platform's ignition keys — Intelligence Engine,
 * Briefing Room, New Pipeline Run — with identical visual weight and
 * a small sequential number prefix.
 *
 * Hidden on unauthenticated / public pages: /, /auth, /complete.
 */

const HIDDEN_PATHS = new Set(["/", "/auth", "/complete"]);

const numberStyle: React.CSSProperties = {
  fontFamily:
    'ui-monospace, "JetBrains Mono", SFMono-Regular, Menlo, monospace',
  fontSize: 11,
  opacity: 0.65,
  letterSpacing: "0.08em",
};

const buttonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  height: 44,
  padding: "0 22px",
  borderRadius: 10,
  backgroundColor: "#D4924A",
  color: "#0A0A0A",
  fontWeight: 700,
  fontSize: 14,
  letterSpacing: "0.02em",
  boxShadow: "0 2px 12px rgba(212,146,74,0.25)",
  textDecoration: "none",
  border: "none",
  cursor: "pointer",
};

export const LAUNCH_STRIP_HEIGHT = 68;

export function LaunchStrip() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (HIDDEN_PATHS.has(pathname)) return null;

  return (
    <>
      <div
        role="navigation"
        aria-label="Platform launch"
        style={{
          position: "fixed",
          top: 56,
          left: 0,
          right: 0,
          zIndex: 90,
          height: LAUNCH_STRIP_HEIGHT,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "0 24px",
          backgroundColor: "#0F0F0F",
          borderBottom: "1px solid #2A2A2A",
          boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
        }}
      >
        <Link to="/intelligence/new" style={buttonStyle}>
          <span aria-hidden style={numberStyle}>01</span>
          Intelligence Engine
        </Link>
        <Link to="/brief/new" style={buttonStyle}>
          <span aria-hidden style={numberStyle}>02</span>
          Briefing Room
        </Link>
        <NewRunGateButton variant="launch" label="New Pipeline Run" prefix="03" />
      </div>
      {/* Spacer to push page content below the fixed strip. TopNav already
          reserves its own 56px, so this only adds the strip's height. */}
      <div aria-hidden style={{ height: LAUNCH_STRIP_HEIGHT }} />
    </>
  );
}

