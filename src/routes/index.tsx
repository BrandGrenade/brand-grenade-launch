import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { BrandGrenadeIcon } from "@/components/BrandGrenadeIcon";
import { submitDemoRequest } from "@/lib/demo-request.functions";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Brand Grenade" },
      {
        name: "description",
        content:
          "The first AI strategy methodology that runs as a system. 20 stages. Three human checkpoints. One complete brand strategy platform.",
      },
    ],
  }),
});


function Index() {
  const navigate = useNavigate();
  const { user, isAuthReady } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
    <main className="flex min-h-screen flex-col lg:flex-row">
      {/* RIGHT COLUMN — order first so it appears on top on mobile */}
      <section
        className="order-1 flex w-full items-center justify-center border-b border-border bg-surface-2 px-6 py-16 sm:px-10 lg:order-2 lg:w-[45%] lg:border-b-0 lg:border-l lg:p-20"
        aria-labelledby="auth-heading"
      >
        <div className="w-full max-w-sm">
          <span className="text-label text-primary">Access</span>
          <h2 id="auth-heading" className="text-h2 mt-3 mb-8 text-text-primary">
            Sign in to continue
          </h2>

          <form onSubmit={handleSubmit} className="flex flex-col">
            <label htmlFor="email" className="text-body-sm mb-2 text-text-secondary">
              Email address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-base h-11"
              placeholder="you@studio.com"
            />

            <label htmlFor="password" className="text-body-sm mb-2 mt-4 text-text-secondary">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-base h-11"
              placeholder="••••••••"
            />

            <button
              type="submit"
              disabled={submitting}
              className="mt-6 inline-flex h-12 items-center justify-center rounded-md bg-primary px-5 text-[14px] font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-2 disabled:opacity-60"
            >
              {submitting ? "Signing in…" : "Sign In"}
            </button>

            {error && (
              <p
                role="alert"
                className="text-body-sm mt-3"
                style={{ color: "var(--color-destructive, #C0392B)" }}
              >
                {error}
              </p>
            )}

            <div className="mt-4 text-center">
              <a
                href="#request-access"
                className="text-body-sm text-primary transition-colors hover:text-primary-hover"
              >
                Request Demo
              </a>
            </div>
          </form>
        </div>
      </section>

      {/* LEFT COLUMN */}
      <section className="order-2 flex w-full flex-col bg-background px-6 py-16 sm:px-10 lg:order-1 lg:w-[55%] lg:p-20">
        {/* Top — brand mark */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <BrandGrenadeIcon size={32} />
            <h1
              className="text-display text-text-primary"
              style={{ fontSize: "clamp(32px, 5vw, 48px)", lineHeight: 1, margin: 0 }}
            >
              BRAND GRENADE
            </h1>
          </div>
          <hr className="mt-6 h-px w-full border-0 bg-border" />
        </div>

        {/* Middle — vertically centred */}
        <div className="flex flex-1 flex-col justify-center py-16">
          <span className="text-label text-primary">
            Brand Strategy Intelligence System
          </span>

          <h2
            className="text-h1 mt-4 text-text-primary"
            style={{ maxWidth: "480px" }}
          >
            Explosive Strategy.
          </h2>

          <p
            className="text-body-lg mt-6 text-text-secondary"
            style={{ maxWidth: "480px" }}
          >
            Over 20 divergent strategic directions explored on every brief. Only the strongest survives.
          </p>

          <p
            className="text-body-lg mt-4 text-text-secondary"
            style={{ maxWidth: "480px" }}
          >
            Four rooms. Twenty-eight stages. Six human checkpoints.
          </p>

          <p
            className="text-body mt-4 text-text-secondary"
            style={{ maxWidth: "480px" }}
          >
            Brand Strategy takes your brief and searches it from every direction that's ever worked — and sixteen more that have never been tried — before a single validated proposition survives. Evidenced, pressure-tested, ready to present at board level.
          </p>

          <p
            className="text-body mt-4 text-text-secondary"
            style={{ maxWidth: "480px" }}
          >
            Brand Detonation takes that proposition and builds the complete creative strategy — the territory, the idea, the channel architecture, and the briefs your agency needs to bring it to life.
          </p>

          <p
            className="text-body mt-4 text-text-secondary"
            style={{ maxWidth: "480px" }}
          >
            One brief in. Twenty-three professional documents out. Two to four hours.
          </p>

          <ul className="mt-10 flex flex-col gap-3">
            <li className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="mt-[9px] inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
              />
              <span className="text-body text-text-secondary">
                Over 20 genuinely divergent strategic propositions generated on every brief, before one is chosen
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="mt-[9px] inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
              />
              <span className="text-body text-text-secondary">
                Fifty-plus proven methodologies, reasoned sequentially toward the strongest defensible answer
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="mt-[9px] inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
              />
              <span className="text-body text-text-secondary">
                Sixteen independent lateral engines, each forbidden from starting where the brief starts — searching for what the evidence alone would never reach
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="mt-[9px] inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
              />
              <span className="text-body text-text-secondary">
                Calibrated six-dimension scoring, two hard elimination floors — nothing weak survives to reach a human
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="mt-[9px] inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
              />
              <span className="text-body text-text-secondary">
                Historical territory validation — a capability we haven't seen matched anywhere else
              </span>
            </li>
          </ul>
        </div>

        {/* Bottom — copyright */}
        <div>
          <p className="text-body-sm" style={{ color: "var(--color-text-tertiary)" }}>
            Brand Grenade Strategy Intelligence System
          </p>
        </div>
      </section>
    </main>
  );
}
