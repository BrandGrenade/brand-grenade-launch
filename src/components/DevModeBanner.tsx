import { useDevMode } from "@/lib/dev-mode";

/**
 * Persistent amber banner that appears at the very top of the viewport
 * whenever Development Mode is enabled. Mirrors the visual treatment of
 * the Demo Mode banner.
 */
export function DevModeBanner() {
  const { enabled } = useDevMode();
  if (!enabled) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 200,
        backgroundColor: "#D4924A",
        color: "#1A1410",
        textAlign: "center",
        padding: "8px 16px",
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: "0.04em",
        borderBottom: "1px solid rgba(0,0,0,0.2)",
      }}
    >
      DEV MODE ACTIVE — Abbreviated output. Not for client presentation.
    </div>
  );
}
