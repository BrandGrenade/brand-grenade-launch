import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { BrandGrenadeIcon } from "@/components/BrandGrenadeIcon";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Brand Grenade — Explosive Strategy" },
      {
        name: "description",
        content:
          "Every category has a consensus. Brand Grenade finds that agreement and detonates it.",
      },
    ],
  }),
});

const proofPoints = [
  "The strategic territory no competitor dares occupy",
  "The argument that makes your recommendation impossible to dismiss",
  "Three documents built for the room where the decision gets made",
];

function Index() {
  const navigate = useNavigate();
  const { user, isAuthReady } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);

  useEffect(() => {
    if (isAuthReady && user) {
      navigate({ to: "/dashboard" });
    }
  }, [isAuthReady, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError("");
    setSubmitting(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setSubmitting(false);
    if (signInError) {
      setError("Incorrect email or password");
      return;
    }
    navigate({ to: "/dashboard" });
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0A0A0A",
        color: "#F0EDE8",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
        position: "relative",
      }}
    >
      {/* Sign in link — top right */}
      <button
        type="button"
        onClick={() => setShowSignIn(true)}
        style={{
          position: "absolute",
          top: 24,
          right: 32,
          background: "transparent",
          border: "none",
          color: "#8A8680",
          fontFamily: "inherit",
          fontWeight: 300,
          fontSize: 14,
          cursor: "pointer",
          padding: 8,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "#F0EDE8")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "#8A8680")}
      >
        Sign in
      </button>

      <div
        style={{
          maxWidth: 640,
          margin: "0 auto",
          padding: "80px 32px 120px",
        }}
      >
        {/* Brand mark */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <BrandGrenadeIcon size={32} />
            <span
              style={{
                fontFamily: "inherit",
                fontWeight: 700,
                fontSize: 15,
                color: "#F0EDE8",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                lineHeight: 1,
              }}
            >
              BRAND GRENADE
            </span>
          </div>
          <div
            style={{
              marginTop: 8,
              fontFamily: "inherit",
              fontWeight: 300,
              fontSize: 18,
              color: "#C8873A",
              letterSpacing: "0.04em",
            }}
          >
            Explosive Strategy.
          </div>
        </div>

        {/* Hero */}
        <h1
          className="bg-hero"
          style={{
            marginTop: 72,
            marginBottom: 0,
            fontFamily: "inherit",
            fontWeight: 700,
            fontSize: 56,
            color: "#F0EDE8",
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            maxWidth: 600,
          }}
        >
          Pull the pin.
        </h1>

        {/* Paragraph 1 */}
        <p
          className="bg-p1"
          style={{
            marginTop: 32,
            marginBottom: 0,
            fontFamily: "inherit",
            fontWeight: 300,
            fontSize: 20,
            color: "#F0EDE8",
            lineHeight: 1.65,
            maxWidth: 540,
          }}
        >
          Every category has a consensus. Every competitor has agreed — implicitly,
          commercially, defensively — on what not to say. Brand Grenade finds that
          agreement and detonates it.
        </p>

        {/* Paragraph 2 */}
        <p
          className="bg-p2"
          style={{
            marginTop: 24,
            marginBottom: 0,
            fontFamily: "inherit",
            fontWeight: 300,
            fontSize: 18,
            color: "#8A8680",
            lineHeight: 1.8,
            maxWidth: 520,
          }}
        >
          A 20-stage AI-driven process of competitive intelligence, human insight,
          strategic divergence, and rigorous validation — building the case, testing
          it against everything the market can throw at it, and delivering the one
          thing that makes everything else possible.
        </p>

        {/* Centre statement */}
        <div
          className="bg-centre"
          style={{
            marginTop: 40,
            marginBottom: 48,
            fontFamily: "inherit",
            fontWeight: 700,
            fontSize: 28,
            color: "#C8873A",
            lineHeight: 1.2,
            letterSpacing: "-0.01em",
            maxWidth: 520,
          }}
        >
          One proposition. Unassailable. Yours.
        </div>

        {/* Proof points */}
        <ul
          style={{
            marginTop: 48,
            marginBottom: 0,
            padding: 0,
            listStyle: "none",
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          {proofPoints.map((p) => (
            <li
              key={p}
              style={{ display: "flex", alignItems: "flex-start" }}
            >
              <span
                style={{
                  color: "#C8873A",
                  fontWeight: 300,
                  fontSize: 18,
                  marginRight: 14,
                  lineHeight: 1.5,
                }}
              >
                —
              </span>
              <span
                className="bg-proof"
                style={{
                  color: "#F0EDE8",
                  fontWeight: 300,
                  fontSize: 18,
                  lineHeight: 1.5,
                  maxWidth: 460,
                }}
              >
                {p}
              </span>
            </li>
          ))}
        </ul>

        {/* Primary CTA */}
        <div style={{ marginTop: 56 }}>
          <button
            type="button"
            onClick={() => navigate({ to: "/brief" })}
            className="bg-cta"
            style={{
              background: "#C8873A",
              color: "#0A0A0A",
              fontFamily: "inherit",
              fontWeight: 700,
              fontSize: 15,
              height: 52,
              padding: "0 32px",
              borderRadius: 10,
              border: "none",
              letterSpacing: "0.02em",
              display: "inline-block",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#D4924A";
              e.currentTarget.style.transform = "scale(1.02)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#C8873A";
              e.currentTarget.style.transform = "scale(1)";
            }}
          >
            Pull the pin →
          </button>
        </div>

        {/* Secondary CTA */}
        <div style={{ marginTop: 16 }}>
          <button
            type="button"
            onClick={() => navigate({ to: "/dashboard" })}
            style={{
              background: "transparent",
              border: "none",
              padding: 0,
              fontFamily: "inherit",
              fontWeight: 300,
              fontSize: 13,
              color: "#5A5652",
              cursor: "pointer",
              display: "block",
              transition: "color 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#8A8680")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#5A5652")}
          >
            Or see a completed strategy
          </button>
        </div>
      </div>

      {/* Sign in modal */}
      {showSignIn && (
        <div
          onClick={() => setShowSignIn(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#141414",
              border: "1px solid #2a2a2a",
              borderRadius: 12,
              padding: 32,
              width: "100%",
              maxWidth: 380,
            }}
          >
            <h2
              style={{
                fontFamily: "inherit",
                fontWeight: 700,
                fontSize: 20,
                color: "#F0EDE8",
                margin: 0,
                marginBottom: 24,
              }}
            >
              Sign in
            </h2>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column" }}>
              <label htmlFor="email" style={{ fontSize: 13, color: "#8A8680", marginBottom: 6 }}>
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  height: 44,
                  borderRadius: 8,
                  border: "1px solid #2a2a2a",
                  background: "#0A0A0A",
                  color: "#F0EDE8",
                  padding: "0 12px",
                  fontFamily: "inherit",
                  fontSize: 14,
                }}
                placeholder="you@studio.com"
              />
              <label
                htmlFor="password"
                style={{ fontSize: 13, color: "#8A8680", marginTop: 16, marginBottom: 6 }}
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  height: 44,
                  borderRadius: 8,
                  border: "1px solid #2a2a2a",
                  background: "#0A0A0A",
                  color: "#F0EDE8",
                  padding: "0 12px",
                  fontFamily: "inherit",
                  fontSize: 14,
                }}
                placeholder="••••••••"
              />
              <button
                type="submit"
                disabled={submitting}
                style={{
                  marginTop: 24,
                  height: 48,
                  borderRadius: 10,
                  border: "none",
                  background: "#C8873A",
                  color: "#0A0A0A",
                  fontFamily: "inherit",
                  fontWeight: 700,
                  fontSize: 14,
                  letterSpacing: "0.02em",
                  cursor: submitting ? "not-allowed" : "pointer",
                  opacity: submitting ? 0.6 : 1,
                }}
              >
                {submitting ? "Signing in…" : "Sign In"}
              </button>
              {error && (
                <p role="alert" style={{ marginTop: 12, fontSize: 13, color: "#C0392B" }}>
                  {error}
                </p>
              )}
            </form>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 767px) {
          .bg-hero { font-size: 36px !important; margin-top: 54px !important; max-width: 100% !important; }
          .bg-p1 { font-size: 17px !important; margin-top: 24px !important; max-width: 100% !important; }
          .bg-p2 { font-size: 15px !important; margin-top: 18px !important; max-width: 100% !important; }
          .bg-centre { font-size: 22px !important; margin-top: 30px !important; margin-bottom: 36px !important; max-width: 100% !important; }
          .bg-proof { font-size: 15px !important; max-width: 100% !important; }
          .bg-cta { width: calc(100% - 64px) !important; }
        }
      `}</style>
    </main>
  );
}
