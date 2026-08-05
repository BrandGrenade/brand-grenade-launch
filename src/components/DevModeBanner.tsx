import { useDevMode } from "@/lib/dev-mode";
import { useEffect, useRef } from "react";

/**
 * Persistent amber banner that appears at the very top of the viewport
 * whenever Development Mode is enabled. Mirrors the visual treatment of
 * the Demo Mode banner.
 */
export function DevModeBanner() {
  const { enabled } = useDevMode();
  const bannerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (!enabled) {
      root.style.setProperty("--dev-mode-banner-height", "0px");
      return;
    }

    const updateHeight = () => {
      const height = bannerRef.current?.offsetHeight ?? 0;
      root.style.setProperty("--dev-mode-banner-height", `${height}px`);
    };

    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    if (bannerRef.current) observer.observe(bannerRef.current);
    window.addEventListener("resize", updateHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateHeight);
      root.style.setProperty("--dev-mode-banner-height", "0px");
    };
  }, [enabled]);

  if (!enabled) return null;
  return (
    <div
      ref={bannerRef}
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 200,
        backgroundColor: "#C81E1E",
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
