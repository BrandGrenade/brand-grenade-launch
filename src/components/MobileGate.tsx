import { useEffect, useState } from "react";

export function MobileGate() {
  const [tooNarrow, setTooNarrow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023.98px)");
    const update = () => setTooNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  if (!tooNarrow) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 flex items-center justify-center px-6 text-center"
      style={{ backgroundColor: "#0A0A0A", zIndex: 9999 }}
    >
      <div style={{ maxWidth: 420 }}>
        <div
          aria-hidden
          style={{
            width: 48,
            height: 48,
            margin: "0 auto 24px",
            borderRadius: 10,
            backgroundColor: "#C8873A",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#FFFFFF",
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
            color: "#F0EDE8",
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: "-0.01em",
            marginBottom: 12,
          }}
        >
          Designed for desktop
        </h1>
        <p style={{ color: "#8A8680", fontSize: 14, lineHeight: 1.55 }}>
          Brand Grenade is designed for desktop use. Please access on a screen
          wider than{" "}
          <span style={{ color: "#C8873A", fontWeight: 600 }}>1024px</span>.
        </p>
      </div>
    </div>
  );
}
