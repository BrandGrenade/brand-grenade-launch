import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
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
          "Explosive strategy. Over 20 divergent directions — only the strongest survives. One brief in, 23 professional documents out, in 2–4 hours.",
      },
      { property: "og:title", content: "Brand Grenade — Brand Strategy Intelligence System" },
      {
        property: "og:description",
        content:
          "Explosive strategy. Over 20 divergent directions — only the strongest survives.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

/* -------------------- Motion primitives -------------------- */

function useInView<T extends Element>(options?: IntersectionObserverInit) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || inView) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          setInView(true);
          io.disconnect();
          break;
        }
      }
    }, { threshold: 0.25, ...options });
    io.observe(node);
    return () => io.disconnect();
  }, [inView, options]);
  return { ref, inView };
}

/* -------------------- Page -------------------- */

const NODES: Array<{ name: string; caption: string }> = [
  {
    name: "Intelligence Lab",
    caption: "Synthesises research into strategic brand opportunities.",
  },
  {
    name: "Briefing Room",
    caption: "Injects tension into the brief to force real answers.",
  },
  {
    name: "Strategy Pipeline",
    caption: "Builds sixteen divergent strategies. Stress-tests every one until only the strongest survives.",
  },
  {
    name: "Brand Detonation",
    caption: "Brings the strategy to life — execution-ready, across every channel.",
  },
];

const POWERS: React.ReactNode[] = [
  <>
    <span className="font-semibold text-text-primary">50+ proven methodologies</span> — strategic frameworks, behavioural science, brand science, cultural and semiotic analysis — reasoned toward the strongest defensible answer.
  </>,
  <>
    <span className="font-semibold text-text-primary">16 independent thought engines</span>, each hunting a completely different direction.
  </>,
  <>
    <span className="font-semibold text-text-primary">Six-dimension scoring</span> with two hard elimination floors — nothing weak survives.
  </>,
  <>
    <span className="font-semibold text-text-primary">Historical territory validation.</span> Every proposition tested for aligned strategic precedent.
  </>,
  <>
    <span className="font-semibold text-text-primary">28 stages, 6 human checkpoints</span> — every decision traceable.
  </>,
];

function Index() {
  const navigate = useNavigate();
  const { user, isAuthReady } = useAuth();
  const [showDemo, setShowDemo] = useState(false);

  useEffect(() => {
    if (isAuthReady && user) navigate({ to: "/dashboard" });
  }, [isAuthReady, user, navigate]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      {/* Ambient hero glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[900px]"
        style={{
          background:
            "radial-gradient(60% 55% at 30% 20%, rgba(212,146,74,0.22) 0%, rgba(212,146,74,0.08) 35%, rgba(212,146,74,0) 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -z-0 h-[600px] w-[600px] rounded-full"
        style={{
          top: "-120px",
          left: "-160px",
          background:
            "radial-gradient(closest-side, rgba(212,146,74,0.18), rgba(212,146,74,0) 70%)",
          filter: "blur(20px)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage:
            "radial-gradient(ellipse at 40% 20%, black 0%, black 40%, transparent 75%)",
        }}
      />

      {/* Top bar */}
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 pt-6 sm:px-10">
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

      {/* Hero — tight vertical rhythm so the flow appears above the fold */}
      <section className="relative z-10 mx-auto w-full max-w-6xl px-6 pt-8 sm:px-10 sm:pt-10">
        <div className="animate-fade-in" style={{ animationDuration: "600ms" }}>
          <span className="text-label text-primary">
            Brand Strategy Intelligence System
          </span>

          <h1
            className="mt-3 font-bold text-text-primary"
            style={{
              fontSize: "clamp(44px, 7.5vw, 96px)",
              lineHeight: 0.96,
              letterSpacing: "-0.035em",
            }}
          >
            Explosive{" "}
            <span
              style={{
                background:
                  "linear-gradient(180deg, var(--color-primary) 0%, #b8792e 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Strategy.
            </span>
          </h1>

          <p
            className="mt-5 text-text-secondary"
            style={{ maxWidth: 720, fontSize: 20, lineHeight: 1.5 }}
          >
            Four connected rooms. Over <span className="font-bold text-primary">20</span> divergent directions. Only the strongest survives.
          </p>
        </div>
      </section>

      {/* Flow — each node owns its caption as one visual unit */}
      <section className="relative z-10 mx-auto w-full max-w-6xl px-6 pt-8 sm:px-10 sm:pt-10">
        <FlowDiagram />
      </section>

      {/* Narrative */}
      <section className="relative z-10 mx-auto w-full max-w-3xl px-6 pt-20 sm:px-10 sm:pt-24">
        <p
          className="text-text-primary"
          style={{ fontSize: 20, lineHeight: 1.5, fontWeight: 600 }}
        >
          Raw research in. <span className="text-primary">23</span> professional documents out. <span className="text-primary">2–4 hours</span>, start to finish.
        </p>
      </section>

      {/* What powers it */}
      <section className="relative z-10 mx-auto w-full max-w-3xl px-6 pt-20 sm:px-10 sm:pt-24">
        <h2
          className="text-text-primary"
          style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-primary)" }}
        >
          What powers it
        </h2>
        <ul className="mt-6 flex flex-col gap-4">
          {POWERS.map((content, i) => (
            <PowerCard key={i} delay={i * 90}>
              {content}
            </PowerCard>
          ))}
        </ul>
      </section>

      {/* CTA */}
      <section className="relative z-10 mx-auto w-full max-w-3xl px-6 pb-32 pt-16 sm:px-10 sm:pt-20">
        <button
          type="button"
          onClick={() => setShowDemo(true)}
          className="group relative inline-flex h-14 items-center justify-center overflow-hidden rounded-md bg-primary px-10 text-[14px] font-semibold uppercase tracking-wider text-primary-foreground transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_0_40px_rgba(212,146,74,0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.99]"
        >
          <span
            aria-hidden
            className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full"
          />
          <span className="relative">Request Demo</span>
        </button>

        <p className="mt-16 text-body-sm" style={{ color: "var(--color-text-tertiary)" }}>
          Brand Grenade Strategy Intelligence System
        </p>
      </section>

      {showDemo && <RequestDemoModal onClose={() => setShowDemo(false)} />}
    </main>
  );
}

/* -------------------- Components -------------------- */

function PowerCard({
  children,
  delay,
}: {
  children: React.ReactNode;
  delay: number;
}) {
  const { ref, inView } = useInView<HTMLLIElement>();
  return (
    <li
      ref={ref}
      className="rounded-lg border border-border bg-surface-2/60 px-6 py-5 backdrop-blur-sm transition-all duration-300 hover:border-primary/40 hover:bg-surface-2"
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? "translateY(0)" : "translateY(16px)",
        transition: `opacity 500ms ease-out ${delay}ms, transform 500ms ease-out ${delay}ms, border-color 200ms, background-color 200ms`,
      }}
    >
      <span className="text-text-secondary" style={{ fontSize: 17, lineHeight: 1.5 }}>
        {children}
      </span>
    </li>
  );
}

function FlowDiagram() {
  const { ref, inView } = useInView<HTMLDivElement>({ threshold: 0.15 });
  return (
    <div
      ref={ref}
      className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-stretch sm:gap-0"
      aria-label="Four-room process flow"
    >
      {NODES.map((node, i) => (
        <div key={node.name} className="contents">
          <FlowNode
            name={node.name}
            caption={node.caption}
            index={i + 1}
            shown={inView}
            delay={i * 180}
          />
          {i < NODES.length - 1 && (
            <FlowArrow shown={inView} delay={i * 180 + 90} />
          )}
        </div>
      ))}
    </div>
  );
}

function FlowNode({
  name,
  caption,
  index,
  shown,
  delay,
}: {
  name: string;
  caption: string;
  index: number;
  shown: boolean;
  delay: number;
}) {
  return (
    <div
      className="group relative flex flex-1 cursor-default flex-col overflow-hidden rounded-lg border border-primary/25 bg-gradient-to-b from-surface-2/80 to-surface-2/40 px-5 py-5 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/70 hover:from-surface-2 hover:to-surface-2/70 hover:shadow-[0_0_28px_rgba(212,146,74,0.28)]"
      style={{
        minHeight: 168,
        opacity: shown ? 1 : 0,
        transform: shown ? "translateY(0) scale(1)" : "translateY(8px) scale(0.96)",
        transition: `opacity 500ms ease-out ${delay}ms, transform 500ms cubic-bezier(0.2,0.8,0.2,1) ${delay}ms, border-color 200ms, box-shadow 200ms, background-color 200ms`,
      }}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="inline-flex h-6 w-6 items-center justify-center rounded border border-primary/40 font-mono text-primary/80 transition-colors group-hover:border-primary group-hover:text-primary"
          style={{ fontSize: 10, letterSpacing: "0.08em" }}
        >
          {String(index).padStart(2, "0")}
        </span>
        <span className="text-body-sm font-semibold text-text-primary transition-colors group-hover:text-primary">
          {name}
        </span>
      </div>
      <p
        className="mt-3 text-text-secondary"
        style={{ fontSize: 13.5, lineHeight: 1.5 }}
      >
        {caption}
      </p>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      />
    </div>
  );
}

function FlowArrow({ shown, delay }: { shown: boolean; delay: number }) {
  return (
    <div
      aria-hidden="true"
      className="flex items-center justify-center sm:px-2"
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "scale(1)" : "scale(0.6)",
        transition: `opacity 400ms ease-out ${delay}ms, transform 400ms ease-out ${delay}ms`,
      }}
    >
      {/* Horizontal (desktop) */}
      <svg
        className="hidden sm:block"
        width="32"
        height="10"
        viewBox="0 0 32 10"
        fill="none"
      >
        <defs>
          <linearGradient id="flowArrowH" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.15" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="1" />
          </linearGradient>
        </defs>
        <line x1="0" y1="5" x2="26" y2="5" stroke="url(#flowArrowH)" strokeWidth="1.5" />
        <path d="M22 1 L30 5 L22 9" stroke="var(--color-primary)" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {/* Vertical (mobile) */}
      <svg
        className="sm:hidden"
        width="10"
        height="24"
        viewBox="0 0 10 24"
        fill="none"
      >
        <defs>
          <linearGradient id="flowArrowV" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.15" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="1" />
          </linearGradient>
        </defs>
        <line x1="5" y1="0" x2="5" y2="18" stroke="url(#flowArrowV)" strokeWidth="1.5" />
        <path d="M1 14 L5 22 L9 14" stroke="var(--color-primary)" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/* -------------------- Modal -------------------- */

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-heading"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg border border-border bg-surface-2 p-8 shadow-2xl animate-scale-in"
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
