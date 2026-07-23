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
  const [showDemo, setShowDemo] = useState(false);

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
              <button
                type="button"
                onClick={() => setShowDemo(true)}
                className="text-body-sm text-primary transition-colors hover:text-primary-hover"
              >
                Request Demo
              </button>
            </div>
          </form>
        </div>
      </section>

      {showDemo && <RequestDemoModal onClose={() => setShowDemo(false)} />}

      {/* LEFT COLUMN */}
      <section className="order-2 flex w-full flex-col bg-background px-6 py-10 sm:px-10 lg:order-1 lg:w-[55%] lg:p-12">
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
          <hr className="mt-5 h-px w-full border-0 bg-border" />
        </div>

        {/* Middle */}
        <div className="flex flex-1 flex-col justify-start pt-8 lg:pt-10">
          <span className="text-label text-primary">
            Brand Strategy Intelligence System
          </span>

          <h2 className="text-h1 mt-3 text-text-primary" style={{ maxWidth: "480px" }}>
            Explosive Strategy.
          </h2>

          <p className="text-body-lg mt-5 text-text-secondary" style={{ maxWidth: "520px" }}>
            Over <Stat>20+</Stat> divergent strategic directions. Only the strongest survives.
          </p>

          {/* Stats row */}
          <div
            className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-4"
            style={{ maxWidth: "560px" }}
          >
            <StatCard number="4" label="Rooms" />
            <StatCard number="28" label="Stages" />
            <StatCard number="6" label="Checkpoints" />
            <StatCard number="2–4h" label="End to end" />
          </div>

          <p className="text-body-lg mt-6 text-text-secondary" style={{ maxWidth: "520px" }}>
            One brief in — <Stat>23</Stat> professional documents out.
          </p>

          <p className="text-body-lg mt-5 text-text-secondary" style={{ maxWidth: "520px" }}>
            <span className="font-semibold text-primary">Brand Strategy</span> searches every direction that's ever worked, and <Stat>16</Stat> more that haven't, before one validated proposition survives.
          </p>

          <p className="text-body-lg mt-4 text-text-secondary" style={{ maxWidth: "520px" }}>
            <span className="font-semibold text-primary">Brand Detonation</span> turns it into a complete creative platform — territory, idea, channel architecture, agency-ready briefs.
          </p>

          <ul className="mt-10 flex flex-col gap-3" style={{ maxWidth: "560px" }}>
            <li className="rounded-md border border-border bg-surface-2 px-5 py-4">
              <span className="text-body-lg text-text-primary">
                <Stat>50+</Stat> proven methodologies, reasoned toward the strongest defensible answer.
              </span>
            </li>
            <li className="rounded-md border border-border bg-surface-2 px-5 py-4">
              <span className="text-body-lg text-text-primary">
                <Stat>16</Stat> independent lateral engines, forbidden from starting where the brief starts.
              </span>
            </li>
          </ul>

          {/* CTA */}
          <div className="mt-8" style={{ maxWidth: "560px" }}>
            <button
              type="button"
              onClick={() => setShowDemo(true)}
              className="inline-flex h-12 items-center justify-center rounded-md bg-primary px-8 text-[14px] font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Request Demo
            </button>
          </div>
        </div>

        {/* Bottom — copyright */}
        <div className="mt-12">
          <p className="text-body-sm" style={{ color: "var(--color-text-tertiary)" }}>
            Brand Grenade Strategy Intelligence System
          </p>
        </div>
      </section>
    </main>
  );
}

function Stat({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-bold text-primary" style={{ fontSize: "1.08em" }}>
      {children}
    </span>
  );
}

function StatCard({ number, label }: { number: string; label: string }) {
  return (
    <div className="flex flex-col items-start bg-background px-4 py-4">
      <span
        className="font-bold text-primary"
        style={{ fontSize: "28px", lineHeight: 1.1, letterSpacing: "-0.02em" }}
      >
        {number}
      </span>
      <span className="text-label mt-2 text-text-tertiary">{label}</span>
    </div>
  );
}

function RequestDemoModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError("");
    if (!name.trim() || !email.trim() || !company.trim()) {
      setError("Name, email and company are required.");
      return;
    }
    setSubmitting(true);
    try {
      await submitDemoRequest({
        data: {
          name: name.trim(),
          email: email.trim(),
          company: company.trim(),
          message: message.trim() || null,
        },
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-heading"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg border border-border bg-surface-2 p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-start justify-between">
          <h2 id="demo-heading" className="text-h2 text-text-primary">
            {done ? "Request received" : "Request a demo"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-text-tertiary hover:text-text-primary"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {done ? (
          <>
            <p className="text-body-sm text-text-secondary">
              Thanks — we'll be in touch.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 w-full rounded bg-primary px-4 py-2 text-white hover:bg-primary-hover"
            >
              Close
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="demo-name" className="text-body-sm mb-2 block text-text-secondary">Name</label>
              <input id="demo-name" required value={name} onChange={(e) => setName(e.target.value)} className="input-base h-11 w-full" maxLength={120} />
            </div>
            <div>
              <label htmlFor="demo-email" className="text-body-sm mb-2 block text-text-secondary">Email</label>
              <input id="demo-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input-base h-11 w-full" maxLength={255} />
            </div>
            <div>
              <label htmlFor="demo-company" className="text-body-sm mb-2 block text-text-secondary">Company</label>
              <input id="demo-company" required value={company} onChange={(e) => setCompany(e.target.value)} className="input-base h-11 w-full" maxLength={160} />
            </div>
            <div>
              <label htmlFor="demo-message" className="text-body-sm mb-2 block text-text-secondary">
                Message <span className="text-text-tertiary">(optional)</span>
              </label>
              <textarea id="demo-message" value={message} onChange={(e) => setMessage(e.target.value)} className="input-base w-full py-2" rows={4} maxLength={2000} />
            </div>

            {error && <p className="text-body-sm text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 rounded bg-primary px-4 py-2 text-white hover:bg-primary-hover disabled:opacity-60"
            >
              {submitting ? "Sending…" : "Send request"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
