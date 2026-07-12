import { Link, useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";
import { NewRunGateButton } from "@/components/NewRunGateButton";

/**
 * Persistent launch strip fixed below the top navigation. The four
 * buttons are the platform's ignition keys — Intelligence Lab,
 * Briefing Room, Strategy Pipeline, Creative Engine — with identical
 * visual weight.
 *
 * Hidden on unauthenticated / public pages: /, /auth, /complete.
 */

const HIDDEN_PATHS = new Set(["/", "/auth", "/complete"]);

const buttonClass = "launch-strip-button";

const buttonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
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
  whiteSpace: "nowrap",
};

const arrowStyle: React.CSSProperties = {
  color: "var(--color-primary)",
  fontSize: 12,
  lineHeight: 1,
  fontWeight: 400,
  userSelect: "none",
};

export const LAUNCH_STRIP_HEIGHT = 68;

export function LaunchStrip() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (HIDDEN_PATHS.has(pathname)) return null;

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
        <Link to="/intelligence/new" style={buttonStyle} className={buttonClass}>
          Intelligence Lab
        </Link>
        <span aria-hidden style={arrowStyle}>→</span>
        <Link to="/brief/new" style={buttonStyle} className={buttonClass}>
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
        <button
          type="button"
          style={buttonStyle}
          className={buttonClass}
          onClick={() =>
            toast.info(
              "Creative Engine — Coming Soon. The Brand Grenade Creative Engine is currently in development."
            )
          }
        >
          Creative Engine
        </button>
      </div>
      {/* Spacer to push page content below the fixed strip. TopNav already
          reserves its own 56px, so this only adds the strip's height. */}
      <div aria-hidden style={{ height: LAUNCH_STRIP_HEIGHT }} />
    </>
  );
}
