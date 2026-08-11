import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";

// Public marketing surfaces are fully responsive and must never be gated.
const MOBILE_ALLOWED = ["/", "/login", "/unsubscribe"];

export function MobileGate() {
  const [tooNarrow, setTooNarrow] = useState(false);
  const pathname = useRouterState({
    select: (s) => s.location.pathname,
  });

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 559.98px)");
    const update = () => setTooNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const allowed = MOBILE_ALLOWED.includes(pathname.replace(/\/+$/, "") || "/");

  if (!tooNarrow || allowed) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 flex items-center justify-center px-6 text-center"
      style={{ backgroundColor: "#0A0908", zIndex: 9999 }}
    >
      <div style={{ maxWidth: 420 }}>
        <div
          aria-hidden
          style={{
            width: 48,
            height: 48,
            margin: "0 auto 24px",
            borderRadius: 10,
            backgroundColor: "#C81E1E",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#EDE8E0",
            fontWeight: 700,
            letterSpacing: "0.04em",
            fontFamily:
              "Inter, system-ui, -apple-system, sans-serif",
          }}
        >
          BG
        </div>
        <h1
          style={{
            color: "#EDE8E0",
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: "-0.01em",
            marginBottom: 12,
          }}
        >
          Designed for desktop
        </h1>
        <p style={{ color: "#8B8680", fontSize: 14, lineHeight: 1.55 }}>
          Brand Grenade is designed for desktop use. Please access on a screen
          wider than{" "}
          <span style={{ color: "#E5484D", fontWeight: 600 }}>560px</span>.
        </p>
      </div>
    </div>
  );
}
