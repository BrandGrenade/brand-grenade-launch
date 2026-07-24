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

function CountUp({
  to,
  suffix = "",
  duration = 1400,
}: {
  to: number;
  suffix?: string;
  duration?: number;
}) {
  const { ref, inView } = useInView<HTMLSpanElement>();
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // easeOutQuint
      const eased = 1 - Math.pow(1 - t, 5);
      setVal(Math.round(to * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to, duration]);
  return (
    <span ref={ref} className="tabular-nums">
      {val}
      {suffix}
    </span>
  );
}

/* -------------------- Page -------------------- */

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
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 pt-8 sm:px-10">
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

      {/* Hero */}
      <section className="relative z-10 mx-auto w-full max-w-4xl px-6 pt-12 sm:px-10 sm:pt-16">
        <div className="animate-fade-in" style={{ animationDuration: "600ms" }}>
          <span className="text-label text-primary">
            Brand Strategy Intelligence System
          </span>

          <h1
            className="mt-5 font-bold text-text-primary"
            style={{
              fontSize: "clamp(56px, 10vw, 128px)",
              lineHeight: 0.94,
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
            className="mt-7 text-text-secondary"
            style={{ maxWidth: 640, fontSize: 20, lineHeight: 1.55 }}
          >
            Over{" "}
            <Stat>
              <CountUp to={20} suffix="+" />
            </Stat>{" "}
            divergent strategic directions. Only the strongest survives.
          </p>

          <p
            className="mt-4 text-text-secondary"
            style={{ maxWidth: 640, fontSize: 18, lineHeight: 1.55 }}
          >
            Four rooms. Twenty-eight stages. Six human checkpoints. One brief in — twenty-three professional documents out. Two to four hours.
          </p>
        </div>
      </section>

      {/* Flow */}
      <section className="relative z-10 mx-auto w-full max-w-4xl px-6 pt-10 sm:px-10 sm:pt-14">
        <FlowDiagram />
      </section>

      {/* Products */}
      <section className="relative z-10 mx-auto w-full max-w-4xl px-6 pt-24 sm:px-10 sm:pt-32">
        <p
          className="text-text-secondary"
          style={{ maxWidth: 640, fontSize: 20, lineHeight: 1.55 }}
        >
          <span className="font-semibold text-text-primary">Brand Strategy</span> searches every direction that's ever worked, and sixteen more that haven't, before one validated proposition survives.
        </p>

        <p
          className="mt-5 text-text-secondary"
          style={{ maxWidth: 640, fontSize: 20, lineHeight: 1.55 }}
        >
          <span className="font-semibold text-text-primary">Brand Detonation</span> turns it into a complete creative platform — territory, idea, channel architecture, agency-ready briefs.
        </p>
      </section>

      {/* Differentiators */}
      <section className="relative z-10 mx-auto w-full max-w-4xl px-6 pt-20 sm:px-10 sm:pt-24">
        <ul className="flex flex-col gap-4">
          <DiffCard delay={0}>
            <Stat>
              <CountUp to={50} suffix="+" />
            </Stat>{" "}
            proven methodologies, reasoned toward the strongest defensible answer.
          </DiffCard>
          <DiffCard delay={100}>
            <Stat>
              <CountUp to={16} />
            </Stat>{" "}
            independent lateral engines, forbidden from starting where the brief starts.
          </DiffCard>
          <DiffCard delay={200}>
            Six-dimension scoring, two hard elimination floors — nothing weak survives.
          </DiffCard>
          <DiffCard delay={300}>
            <Stat>
              <CountUp to={28} />
            </Stat>{" "}
            stages,{" "}
            <Stat>
              <CountUp to={6} />
            </Stat>{" "}
            human checkpoints — every decision traceable.
          </DiffCard>
        </ul>
      </section>


      {/* CTA */}
      <section className="relative z-10 mx-auto w-full max-w-4xl px-6 pb-32 pt-20 sm:px-10 sm:pt-24">
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

        <p className="mt-20 text-body-sm" style={{ color: "var(--color-text-tertiary)" }}>
          Brand Grenade Strategy Intelligence System
        </p>
      </section>

      {showDemo && <RequestDemoModal onClose={() => setShowDemo(false)} />}
    </main>
  );
}

/* -------------------- Components -------------------- */

function Stat({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-bold text-primary" style={{ fontSize: "1.08em" }}>
      {children}
    </span>
  );
}

function DiffCard({
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
      className="rounded-lg border border-border bg-surface-2/60 px-7 py-6 backdrop-blur-sm transition-all duration-300 hover:border-primary/40 hover:bg-surface-2"
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? "translateY(0)" : "translateY(16px)",
        transition: `opacity 600ms ease-out ${delay}ms, transform 600ms ease-out ${delay}ms, border-color 200ms, background-color 200ms`,
      }}
    >
      <span className="text-text-primary" style={{ fontSize: 18, lineHeight: 1.5 }}>
        {children}
      </span>
    </li>
  );
}

function FlowDiagram() {
  const { ref, inView } = useInView<HTMLDivElement>({ threshold: 0.35 });
  const nodes = ["Intelligence Lab", "Briefing Room", "Strategy Pipeline", "Creative Engine"];
  return (
    <div
      ref={ref}
      className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-0"
      aria-label="Process flow: Intelligence Lab to Briefing Room to Strategy Pipeline to Creative Engine"
    >
      {nodes.map((label, i) => (
        <div
          key={label}
          className="contents"
        >
          <FlowNode label={label} shown={inView} delay={i * 220} />
          {i < nodes.length - 1 && (
            <FlowArrow shown={inView} delay={i * 220 + 110} />
          )}
        </div>
      ))}
    </div>
  );
}

function FlowNode({
  label,
  shown,
  delay,
}: {
  label: string;
  shown: boolean;
  delay: number;
}) {
  return (
    <div
      className="group flex-1 cursor-default rounded-md border border-primary/40 bg-surface-2/70 px-4 py-4 text-center backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary hover:bg-surface-2 hover:shadow-[0_0_24px_rgba(212,146,74,0.35)]"
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "translateY(0) scale(1)" : "translateY(8px) scale(0.96)",
        transition: `opacity 500ms ease-out ${delay}ms, transform 500ms cubic-bezier(0.2,0.8,0.2,1) ${delay}ms, border-color 200ms, box-shadow 200ms, background-color 200ms`,
      }}
    >
      <span className="text-body-sm font-semibold text-primary transition-colors group-hover:text-primary-hover">
        {label}
      </span>
    </div>
  );
}

function FlowArrow({ shown, delay }: { shown: boolean; delay: number }) {
  return (
    <div
      aria-hidden="true"
      className="flex items-center justify-center text-primary sm:px-3"
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "scale(1)" : "scale(0.6)",
        transition: `opacity 400ms ease-out ${delay}ms, transform 400ms ease-out ${delay}ms`,
      }}
    >
      <span className="sm:hidden text-lg leading-none">↓</span>
      <span className="hidden sm:inline text-lg leading-none">→</span>
    </div>
  );
}

/* -------------------- Modal (unchanged) -------------------- */

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
