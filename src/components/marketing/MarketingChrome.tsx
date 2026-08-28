import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { MARKETING_CSS } from "./marketing-css";
import { submitDemoRequest } from "@/lib/demo-request.functions";

/* -------------------- Shell -------------------- */

export function MarketingPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-home">
      <style dangerouslySetInnerHTML={{ __html: MARKETING_CSS }} />
      {children}
    </div>
  );
}

/* -------------------- Navigation -------------------- */

const NAV_GROUPS: Array<{ label: string; links: Array<[string, string]> }> = [
  {
    label: "Product",
    links: [
      ["The Five Rooms", "/#rooms-nav"],
      ["Outputs", "/#outputs"],
      ["Methodology", "/methodology"],
    ],
  },
  {
    label: "Solutions",
    links: [
      ["For CMOs", "/for-cmos"],
      ["For Consultancies", "/for-consultancies"],
      ["For Agencies", "/for-agencies"],
      ["Enterprise", "/enterprise"],
    ],
  },
  {
    label: "Proof",
    links: [["See a Demo", "/demo"]],
  },
];

export function MarketingNav({ onDemo }: { onDemo?: () => void }) {
  return (
    <nav>
      <div className="nav-inner">
        <Link
          to="/"
          className="nav-logo"
          style={{ textDecoration: "none", color: "inherit" }}
        >
          <img
            src="/brand-grenade-icon.png"
            alt="Brand Grenade"
            width={22}
            height={22}
            style={{ display: "block" }}
          />
          <div className="nav-mark">BRAND GRENADE</div>
        </Link>

        <div className="nav-rooms">
          {NAV_GROUPS.map((g, gi) => (
            <span key={g.label} className="nav-group">
              <span className="g-label">{g.label}</span>
              {g.links.map(([label, href]) => (
                <a key={href} href={href}>
                  {label}
                </a>
              ))}
              {gi < NAV_GROUPS.length - 1 && (
                <span className="nav-arrow">·</span>
              )}
            </span>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <Link to="/login" className="nav-signin">
            Sign in
          </Link>
          {onDemo ? (
            <button type="button" className="nav-cta" onClick={onDemo}>
              See Brand Grenade in action
            </button>
          ) : (
            <Link to="/demo" className="nav-cta">
              See Brand Grenade in action
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}

/* -------------------- Footer -------------------- */

export const GOVERNING_SENTENCE =
  "Brand Grenade is the system that takes a brand from raw intelligence through strategy and creative development to activation-ready outputs — producing the working deliverables required at every stage, from one connected strategic source of truth.";

export function MarketingFooter() {
  return (
    <footer>
      <div className="governing">{GOVERNING_SENTENCE}</div>
      <div className="footer-byline">
        Brand Grenade was built by Adrian Pritchard, a brand strategist and
        creative director who has worked at McCann, DDB, and TBWA. His work has
        been recognised at Cannes, One Show, D&amp;AD, and AWARD.
      </div>
      <div className="footer-byline">
        It was built to systemise the strategic and creative intelligence that
        has traditionally lived inside senior human teams — without removing
        human judgement from the process.
      </div>
    </footer>
  );
}

/* -------------------- Demo request -------------------- */

export const DEMO_ROLES = [
  "Enterprise / CMO",
  "Consultancy / Big Four",
  "Advertising / Creative Agency",
  "Brand / Strategy Consultancy",
  "Other",
] as const;

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  color: "#8B8680",
  marginBottom: 6,
  letterSpacing: ".04em",
  textTransform: "uppercase",
};

export function DemoRequestForm({
  heading = "See Brand Grenade in action",
  onDone,
}: {
  heading?: string;
  onDone?: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [jobRole, setJobRole] = useState("");
  const [segment, setSegment] = useState<string>(DEMO_ROLES[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError("");
    if (!name.trim() || !email.trim() || !company.trim()) {
      setError("Name, company and email are required.");
      return;
    }
    setSubmitting(true);
    try {
      await submitDemoRequest({
        data: {
          name: name.trim(),
          email: email.trim(),
          company: company.trim(),
          message: `Role: ${jobRole.trim() || "—"} · Segment: ${segment}`,
        },
      });
      setDone(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div>
        <h2
          className="display"
          style={{ fontSize: 28, fontWeight: 400, marginBottom: 14 }}
        >
          Request received
        </h2>
        <p style={{ fontSize: 14, color: "#8B8680", lineHeight: 1.7 }}>
          Thanks — we'll be in touch to arrange the walkthrough.
        </p>
        {onDone && (
          <button
            type="button"
            onClick={onDone}
            className="btn-primary"
            style={{ marginTop: 24, width: "100%" }}
          >
            Close
          </button>
        )}
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "flex", flexDirection: "column", gap: 16 }}
    >
      <h2
        className="display"
        style={{ fontSize: 28, fontWeight: 400, margin: 0 }}
      >
        {heading}
      </h2>
      <div>
        <label htmlFor="demo-name" style={labelStyle}>
          Name
        </label>
        <input
          id="demo-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="bg-demo-field"
          maxLength={120}
        />
      </div>
      <div>
        <label htmlFor="demo-company" style={labelStyle}>
          Company
        </label>
        <input
          id="demo-company"
          required
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          className="bg-demo-field"
          maxLength={160}
        />
      </div>
      <div>
        <label htmlFor="demo-role" style={labelStyle}>
          Role
        </label>
        <input
          id="demo-role"
          value={jobRole}
          onChange={(e) => setJobRole(e.target.value)}
          className="bg-demo-field"
          maxLength={120}
        />
      </div>
      <div>
        <label htmlFor="demo-email" style={labelStyle}>
          Email
        </label>
        <input
          id="demo-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="bg-demo-field"
          maxLength={255}
        />
      </div>
      <div>
        <label htmlFor="demo-segment" style={labelStyle}>
          Which best describes you
        </label>
        <select
          id="demo-segment"
          value={segment}
          onChange={(e) => setSegment(e.target.value)}
          className="bg-demo-field"
        >
          {DEMO_ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div style={{ fontSize: 13, color: "#E5484D" }} role="alert">
          {error}
        </div>
      )}

      <button type="submit" className="btn-primary" disabled={submitting}>
        {submitting ? "Sending…" : "Request the walkthrough"}
      </button>
      <p style={{ fontSize: 12, color: "#8B8680", lineHeight: 1.6, margin: 0 }}>
        Pricing is discussed once the deployment model is understood.
      </p>
    </form>
  );
}

export function RequestDemoModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="bg-demo-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Request a demo"
      onClick={onClose}
    >
      <div className="bg-demo-panel" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "none",
              border: "none",
              color: "#8B8680",
              cursor: "pointer",
              fontSize: 16,
            }}
          >
            ✕
          </button>
        </div>
        <DemoRequestForm onDone={onClose} />
      </div>
    </div>
  );
}
