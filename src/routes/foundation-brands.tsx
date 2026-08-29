import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { submitDemoRequest } from "@/lib/demo-request.functions";

/*
 * UNLISTED PAGE — /foundation-brands
 * Deliberately hidden from public discovery:
 *  - noindex, nofollow meta (below)
 *  - NOT linked from any nav, footer, homepage or other page
 *  - no sitemap.xml exists in this project, so nothing to exclude from
 *  - intentionally NOT password-protected: the direct URL is sent to
 *    hand-selected outreach targets and must open freely for them.
 */

// Editable value: update as Foundation Brand places are filled.
const REMAINING_PLACES: number = 3;

export const Route = createFileRoute("/foundation-brands")({
  component: FoundationBrands,
  head: () => ({
    meta: [
      { title: "Foundation Brands — Brand Grenade" },
      {
        name: "description",
        content:
          "Three enterprise brands receive a complete Brand Grenade run at no cost, in exchange for participation, feedback and agreed proof of capability.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

/* -------------------- Design system (shared with Done-For-You page) -------------------- */

const CSS = `
.bg-fb{--void:#0A0908;--ash:#1C1A18;--ash2:#252220;--paper:#EDE8E0;--smoke:#8B8680;
  --detonation:#C81E1E;--detonation-dim:rgba(200,30,30,0.1);--detonation-line:rgba(200,30,30,0.35);
  background:var(--void);color:var(--paper);font-family:'Inter',sans-serif;-webkit-font-smoothing:antialiased;min-height:100vh}
.bg-fb *,.bg-fb *::before,.bg-fb *::after{box-sizing:border-box}
.bg-fb .display{font-family:'Bebas Neue',sans-serif;letter-spacing:.01em}
.bg-fb .wrap{max-width:1080px;margin:0 auto;padding:0 48px}
@media (max-width:720px){.bg-fb .wrap{padding:0 22px}}

.bg-fb nav{position:sticky;top:0;z-index:50;background:rgba(10,9,8,0.92);backdrop-filter:blur(8px);border-bottom:1px solid var(--ash)}
.bg-fb .nav-inner{max-width:1080px;margin:0 auto;padding:16px 48px;display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:nowrap}
@media (max-width:720px){.bg-fb .nav-inner{padding:14px 22px}}
.bg-fb .nav-logo{display:flex;align-items:center;gap:10px;flex-shrink:0;text-decoration:none;color:inherit}
.bg-fb .nav-mark{font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:.04em}
.bg-fb .nav-signin{color:var(--smoke);font-size:13px;font-weight:500;text-decoration:none;flex-shrink:0;transition:color .2s}
.bg-fb .nav-signin:hover{color:var(--paper)}
.bg-fb .nav-cta{background:var(--detonation);color:var(--paper);font-size:12px;font-weight:600;padding:6px 12px;border-radius:3px;text-decoration:none;border:none;cursor:pointer;font-family:inherit;line-height:1;white-space:nowrap}

.bg-fb .hero{padding:88px 0 72px}
@media (max-width:720px){.bg-fb .hero{padding:56px 0 48px}}
.bg-fb .hero-kicker{font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--detonation);margin-bottom:20px}
.bg-fb h1.hero-title{font-family:'Bebas Neue',sans-serif;font-size:clamp(44px,6vw,72px);line-height:.96;margin-bottom:24px;max-width:20ch;font-weight:400}
.bg-fb .hero-sub{font-size:17px;color:var(--paper);font-weight:600;max-width:56ch;line-height:1.65;margin-bottom:16px}
.bg-fb .hero-note{margin-top:20px;font-size:12px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--smoke)}
.bg-fb .btn-primary{background:var(--detonation);color:var(--paper);font-size:14px;font-weight:600;padding:14px 26px;border-radius:3px;text-decoration:none;border:none;cursor:pointer;font-family:inherit;display:inline-block}

.bg-fb .section{padding:56px 0;border-top:1px solid var(--ash)}
.bg-fb .section > :last-child{margin-bottom:0}
@media (max-width:720px){.bg-fb .section{padding:44px 0}}
.bg-fb .section-eyebrow{font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--smoke);margin-bottom:16px}
.bg-fb .section h2{font-family:'Bebas Neue',sans-serif;font-size:clamp(30px,4vw,44px);font-weight:400;max-width:26ch;margin-bottom:26px;line-height:1.05}
.bg-fb .section p.body{font-size:15px;color:var(--smoke);line-height:1.75;max-width:64ch;margin-bottom:18px}
.bg-fb .section p.body strong{color:var(--paper)}
.bg-fb .callout{background:var(--ash);border:1px solid var(--detonation-line);border-radius:6px;padding:26px;max-width:70ch;margin-top:34px}
.bg-fb .callout .c-title{font-size:16px;font-weight:600;color:var(--paper);margin-bottom:10px}
.bg-fb .callout .c-body{font-size:15px;color:var(--smoke);line-height:1.7}

.bg-fb .card-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--ash);border:1px solid var(--ash);margin:32px 0}
@media (max-width:900px){.bg-fb .card-grid{grid-template-columns:1fr 1fr}}
@media (max-width:560px){.bg-fb .card-grid{grid-template-columns:1fr}}
.bg-fb .card-grid.cols-2{grid-template-columns:1fr 1fr}
@media (max-width:720px){.bg-fb .card-grid.cols-2{grid-template-columns:1fr}}
.bg-fb .card{background:var(--void);padding:26px 22px;display:flex;flex-direction:column;gap:10px;transition:background .2s}
.bg-fb .card:hover{background:var(--ash)}
.bg-fb .card .k-title{font-size:15px;font-weight:600;color:var(--paper);line-height:1.35}
.bg-fb .card .k-desc{font-size:13px;color:var(--smoke);line-height:1.6}
.bg-fb .card .k-num{font-family:'Bebas Neue',sans-serif;font-size:13px;color:var(--detonation);letter-spacing:.1em}

.bg-fb .facts{display:flex;flex-direction:column;gap:1px;background:var(--ash);border:1px solid var(--ash);margin:28px 0;max-width:64ch}
.bg-fb .fact-row{background:var(--void);padding:16px 22px;font-size:14px;color:var(--paper);display:flex;gap:14px;align-items:baseline}
.bg-fb .fact-row::before{content:"—";color:var(--detonation);flex-shrink:0}

.bg-fb .cta-row{display:flex;gap:14px;flex-wrap:wrap;margin-top:8px}
.bg-fb .btn-note{font-size:12px;color:var(--smoke);line-height:1.5;margin-top:8px}
.bg-fb footer{border-top:1px solid var(--ash);padding:32px 0 48px;text-align:center;font-size:13px;color:var(--smoke)}

.bg-fb .form-panel{width:100%;max-width:560px;background:var(--ash);border:1px solid var(--ash2);border-radius:6px;padding:32px;margin-top:8px}
.bg-fb .fb-label{display:block;font-size:13px;color:var(--smoke);margin-bottom:6px;letter-spacing:.04em;text-transform:uppercase}
.bg-fb .fb-field{width:100%;background:var(--void);border:1px solid var(--ash2);border-radius:3px;color:var(--paper);padding:12px 12px;font-size:16px;font-family:inherit;-webkit-appearance:none}
.bg-fb .fb-field:focus{outline:none;border-color:var(--detonation)}
.bg-fb textarea.fb-field{min-height:110px;resize:vertical;line-height:1.6}
@media (max-width:720px){
  .bg-fb .form-panel{max-width:none;padding:24px 20px}
  .bg-fb .fb-field{padding:14px 12px}
  .bg-fb .form-panel .btn-primary{width:100%;padding:16px 20px;font-size:16px}
}
`;

/* -------------------- Data -------------------- */

const INCLUDED = [
  {
    title: "RESEARCH SYNTHESISER & INTELLIGENCE LAB",
    desc: "Your source material processed into verified strategic intelligence — claims, tensions and opportunities, evidence-graded.",
  },
  {
    title: "FULL STRATEGIC DEVELOPMENT",
    desc: "Divergent strategic propositions explored, scored, shortlisted and validated through the Strategy Pipeline.",
  },
  {
    title: "CREATIVE IDEATION — 37 LENSES",
    desc: "Creative territories explored through the complete 37-Lens Sweep, scored and developed into a Brand Detonation.",
  },
  {
    title: "CAMPAIGN DEVELOPMENT",
    desc: "The selected detonation orchestrated into one coherent campaign platform.",
  },
  {
    title: "CHANNEL-SPECIFIC OUTPUTS",
    desc: "Channel briefs and supporting outputs that carry the strategy and the idea through to the work.",
  },
  {
    title: "STAGED & COLLABORATIVE",
    desc: "Exactly as every paid engagement — you review and approve at each step before the next stage begins.",
  },
];

const STEPS = [
  "Apply below.",
  "Short qualification conversation.",
  "Accept or decline.",
  "Full run, staged exactly as any paid engagement.",
  "Feedback and proof rights agreed.",
  "Open conversation on what comes next.",
];

/* -------------------- Application form -------------------- */

function ApplicationForm() {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [challenge, setChallenge] = useState("");
  const [pressure, setPressure] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError("");
    if (!name.trim() || !company.trim() || !email.trim() || !challenge.trim()) {
      setError("Name, company, email and your challenge are required.");
      return;
    }
    setSubmitting(true);
    try {
      await submitDemoRequest({
        data: {
          name: name.trim(),
          email: email.trim(),
          company: company.trim(),
          message: [
            "a1=Foundation Brands Application",
            `Role: ${role.trim() || "—"}`,
            `Phone: ${phone.trim() || "—"}`,
            "",
            "Challenge:",
            challenge.trim(),
            "",
            "Budget/timeline pressure:",
            pressure.trim() || "—",
          ].join("\n"),
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
      <div className="form-panel">
        <h2 className="display" style={{ fontSize: 28, fontWeight: 400, margin: "0 0 14px" }}>
          Application received
        </h2>
        <p className="body" style={{ fontSize: 14, color: "var(--smoke)", lineHeight: 1.7, margin: 0 }}>
          Thanks — we'll review your application and be in touch about the
          qualification conversation.
        </p>
      </div>
    );
  }

  return (
    <form className="form-panel" onSubmit={handleSubmit}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label htmlFor="fb-name" className="fb-label">Name</label>
          <input id="fb-name" required value={name} onChange={(e) => setName(e.target.value)} className="fb-field" maxLength={120} />
        </div>
        <div>
          <label htmlFor="fb-company" className="fb-label">Company</label>
          <input id="fb-company" required value={company} onChange={(e) => setCompany(e.target.value)} className="fb-field" maxLength={160} />
        </div>
        <div>
          <label htmlFor="fb-role" className="fb-label">Role / title</label>
          <input id="fb-role" value={role} onChange={(e) => setRole(e.target.value)} className="fb-field" maxLength={120} />
        </div>
        <div>
          <label htmlFor="fb-email" className="fb-label">Email</label>
          <input id="fb-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="fb-field" maxLength={255} />
        </div>
        <div>
          <label htmlFor="fb-phone" className="fb-label">Phone (optional)</label>
          <input id="fb-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="fb-field" maxLength={40} />
        </div>
        <div>
          <label htmlFor="fb-challenge" className="fb-label">
            What's the strategic or creative challenge you're facing?
          </label>
          <textarea id="fb-challenge" required value={challenge} onChange={(e) => setChallenge(e.target.value)} className="fb-field" maxLength={1200} />
        </div>
        <div>
          <label htmlFor="fb-pressure" className="fb-label">
            Is there budget or timeline pressure driving this now? (optional)
          </label>
          <textarea id="fb-pressure" value={pressure} onChange={(e) => setPressure(e.target.value)} className="fb-field" maxLength={600} style={{ minHeight: 70 }} />
        </div>

        {error && (
          <div style={{ fontSize: 13, color: "#E5484D" }} role="alert">
            {error}
          </div>
        )}

        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? "Sending…" : "Apply for a Foundation Brand Place →"}
        </button>
        <p style={{ fontSize: 12, color: "var(--smoke)", lineHeight: 1.6, margin: 0 }}>
          This is a no-cost programme. No payment is involved at any point.
        </p>
      </div>
    </form>
  );
}

/* -------------------- Page -------------------- */

function FoundationBrands() {
  useEffect(() => {
    document.title = "Foundation Brands — Brand Grenade";
  }, []);

  const scrollToApply = () => {
    document.getElementById("apply")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="bg-fb">
      <style>{CSS}</style>

      <nav>
        <div className="nav-inner">
          <Link to="/" className="nav-logo">
            <img
              src="/brand-grenade-icon.png"
              alt="Brand Grenade"
              width={22}
              height={22}
              style={{ display: "block" }}
            />
            <div className="nav-mark">BRAND GRENADE</div>
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <button type="button" className="nav-cta" onClick={scrollToApply}>
              Apply
            </button>
          </div>
        </div>
      </nav>

      <div className="wrap">
        {/* HERO */}
        <section className="hero">
          <div className="hero-kicker">
            Not a free trial. A Foundation Brand programme.
          </div>
          <h1 className="hero-title">Seeking three Foundation Brands.</h1>
          <p className="hero-sub">
            Three enterprise brands receive a complete Brand Grenade run —
            Research, Intelligence, Strategy, Creative Ideation and Campaign —
            at no cost, in exchange for participation, feedback and agreed
            permission to use the engagement as proof of capability.
          </p>
          <button type="button" className="btn-primary" onClick={scrollToApply}>
            Apply for a Foundation Brand Place →
          </button>
          <div className="hero-note">
            {REMAINING_PLACES} place{REMAINING_PLACES === 1 ? "" : "s"} only.
          </div>
        </section>

        {/* WHAT THIS IS */}
        <section className="section">
          <div className="section-eyebrow">What this is</div>
          <h2>A selective, capped programme.</h2>
          <p className="body">
            The Foundation Brand programme is a selective, capped programme —
            three places only — for enterprise brands with a genuine, live
            strategic or creative challenge.
          </p>
          <p className="body">
            In exchange for the complete system run at no cost, Foundation
            Brands agree to{" "}
            <strong>participate in review at each stage</strong>, provide{" "}
            <strong>honest feedback</strong>, and grant{" "}
            <strong>
              permission to reference the engagement as proof of capability
            </strong>
            .
          </p>
        </section>

        {/* WHO THIS IS FOR */}
        <section className="section">
          <div className="section-eyebrow">Who this is for</div>
          <h2>Enterprise brands with a live challenge.</h2>
          <p className="body">
            Enterprise brands — Australia/APAC focus, selectively global — with
            a visible strategic, brand, repositioning or campaign challenge.
          </p>
          <p className="body">
            Best suited to senior decision-makers:{" "}
            <strong>
              CMO, Chief Brand Officer, Marketing Director, Brand Director, Head
              of Strategy, Chief Strategy Officer.
            </strong>
          </p>
        </section>

        {/* WHAT'S INCLUDED */}
        <section className="section">
          <div className="section-eyebrow">What's included</div>
          <h2>The complete system. Unmodified.</h2>
          <p className="body">
            The same run as the paid Full Pipeline tier — nothing removed,
            nothing watered down.
          </p>
          <div className="card-grid cols-2">
            {INCLUDED.map((c) => (
              <div className="card" key={c.title}>
                <div className="k-title">{c.title}</div>
                <div className="k-desc">{c.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* WHAT'S REQUIRED */}
        <section className="section">
          <div className="section-eyebrow">What's required</div>
          <h2>Three commitments.</h2>
          <div className="facts">
            <div className="fact-row">
              A genuine, current strategic or creative challenge — not a
              hypothetical brief.
            </div>
            <div className="fact-row">
              Availability to review and provide feedback at each stage.
            </div>
            <div className="fact-row">
              Agreement to the proof principles before starting — what can be
              referenced, how, and with what approval.
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="section">
          <div className="section-eyebrow">How it works</div>
          <h2>Six steps.</h2>
          <div className="card-grid cols-2">
            {STEPS.map((s, i) => (
              <div className="card" key={s}>
                <div className="k-num">{String(i + 1).padStart(2, "0")}</div>
                <div className="k-title">{s}</div>
              </div>
            ))}
          </div>
          <div className="cta-row">
            <button type="button" className="btn-primary" onClick={scrollToApply}>
              Apply for a Foundation Brand Place →
            </button>
          </div>
          <div className="btn-note">
            {REMAINING_PLACES} place{REMAINING_PLACES === 1 ? "" : "s"} only.
          </div>
        </section>

        {/* APPLY */}
        <section className="section" id="apply">
          <div className="section-eyebrow">Apply</div>
          <h2>Apply for a Foundation Brand Place.</h2>
          <p className="body">
            Tell us who you are and what you're trying to solve. Applications
            are reviewed against the three commitments above.
          </p>
          <ApplicationForm />
        </section>
      </div>

      <footer>
        <div>
          Brand Grenade — Enterprise Brand Strategy and Creative Development
          System
        </div>
      </footer>
    </div>
  );
}
