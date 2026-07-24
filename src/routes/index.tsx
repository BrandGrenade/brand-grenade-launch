import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { BrandGrenadeIcon } from "@/components/BrandGrenadeIcon";
import { submitDemoRequest } from "@/lib/demo-request.functions";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Brand Grenade — Brand Strategy Intelligence System" },
      {
        name: "description",
        content:
          "Explosive strategy. Over 20+ divergent strategic directions — only the strongest survives. Four rooms. Twenty-eight stages. Six human checkpoints.",
      },
      { property: "og:title", content: "Brand Grenade — Brand Strategy Intelligence System" },
      {
        property: "og:description",
        content:
          "Explosive strategy. Over 20+ divergent strategic directions — only the strongest survives.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function Index() {
  const navigate = useNavigate();
  const { user, isAuthReady } = useAuth();
  const [showDemo, setShowDemo] = useState(false);

  useEffect(() => {
    if (isAuthReady && user) {
      navigate({ to: "/dashboard" });
    }
  }, [isAuthReady, user, navigate]);

  return (
    <main className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 pt-8 sm:px-10">
        <div className="flex items-center gap-3">
          <BrandGrenadeIcon size={28} />
          <span
            className="text-text-primary"
            style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em" }}
          >
            BRAND GRENADE
          </span>
        </div>
        <Link
          to="/login"
          className="text-body-sm font-semibold text-text-secondary transition-colors hover:text-primary"
        >
          Sign in →
        </Link>
      </header>

      <section className="mx-auto w-full max-w-4xl px-6 py-14 sm:px-10 sm:py-20">
        <div className="mt-4">
          <hr className="mb-10 h-px w-full border-0 bg-border" />
          <span className="text-label text-primary">
            Brand Strategy Intelligence System
          </span>

          <h1
            className="text-display mt-3 text-text-primary"
            style={{ fontSize: "clamp(40px, 6vw, 64px)", lineHeight: 1.02, letterSpacing: "-0.02em" }}
          >
            Explosive Strategy.
          </h1>

          <p className="text-body-lg mt-6 text-text-secondary" style={{ maxWidth: 640 }}>
            Over <Stat>20+</Stat> divergent strategic directions. Only the strongest survives.
          </p>

          <p className="text-body-lg mt-4 text-text-secondary" style={{ maxWidth: 640 }}>
            Four rooms. Twenty-eight stages. Six human checkpoints. One brief in — twenty-three professional documents out. Two to four hours.
          </p>

          {/* Flow */}
          <div
            className="mt-10 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-0"
            aria-label="Process flow: Intelligence Lab to Briefing Room to Strategy Pipeline to Creative Engine"
          >
            <FlowNode label="Intelligence Lab" />
            <FlowArrow />
            <FlowNode label="Briefing Room" />
            <FlowArrow />
            <FlowNode label="Strategy Pipeline" />
            <FlowArrow />
            <FlowNode label="Creative Engine" />
          </div>

          <p className="text-body-lg mt-10 text-text-secondary" style={{ maxWidth: 640 }}>
            <span className="font-semibold text-primary">Brand Strategy</span> searches every direction that's ever worked, and sixteen more that haven't, before one validated proposition survives.
          </p>

          <p className="text-body-lg mt-4 text-text-secondary" style={{ maxWidth: 640 }}>
            <span className="font-semibold text-primary">Brand Detonation</span> turns it into a complete creative platform — territory, idea, channel architecture, agency-ready briefs.
          </p>

          <ul className="mt-10 flex flex-col gap-3">
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
            <li className="rounded-md border border-border bg-surface-2 px-5 py-4">
              <span className="text-body-lg text-text-primary">
                Six-dimension scoring, two hard elimination floors — nothing weak survives.
              </span>
            </li>
            <li className="rounded-md border border-border bg-surface-2 px-5 py-4">
              <span className="text-body-lg text-text-primary">
                <Stat>28</Stat> stages, <Stat>6</Stat> human checkpoints — every decision traceable.
              </span>
            </li>
          </ul>

          <div className="mt-10">
            <button
              type="button"
              onClick={() => setShowDemo(true)}
              className="inline-flex h-12 items-center justify-center rounded-md bg-primary px-8 text-[14px] font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Request Demo
            </button>
          </div>

          <div className="mt-16">
            <p className="text-body-sm" style={{ color: "var(--color-text-tertiary)" }}>
              Brand Grenade Strategy Intelligence System
            </p>
          </div>
        </div>
      </section>

      {showDemo && <RequestDemoModal onClose={() => setShowDemo(false)} />}
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

function FlowNode({ label }: { label: string }) {
  return (
    <div className="flex-1 rounded-md border border-primary/40 bg-surface-2 px-4 py-3 text-center">
      <span className="text-body-sm font-semibold text-primary">{label}</span>
    </div>
  );
}

function FlowArrow() {
  return (
    <div aria-hidden="true" className="flex items-center justify-center text-primary sm:px-2">
      <span className="sm:hidden text-lg leading-none">↓</span>
      <span className="hidden sm:inline text-lg leading-none">→</span>
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
            <p className="text-body-sm text-text-secondary">Thanks — we'll be in touch.</p>
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
