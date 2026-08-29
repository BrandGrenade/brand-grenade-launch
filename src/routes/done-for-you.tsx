import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { openCalendlyBooking } from "@/lib/calendly";
import { LENS_COUNT } from "@/lib/stimulus/lenses";
import { STRUCTURED_OUTPUT_COUNT } from "@/lib/minto-content";

export const Route = createFileRoute("/done-for-you")({
  component: DoneForYou,
  head: () => ({
    meta: [
      { title: "Done-For-You — Brand Grenade Run On Your Brief" },
      {
        name: "description",
        content:
          "The complete Brand Grenade system, run on your brief. Intelligence, validated strategy, creative ideation and coherent campaign development — each stage delivered in 48 hours.",
      },
      {
        property: "og:title",
        content: "Done-For-You — Brand Grenade Run On Your Brief",
      },
      {
        property: "og:description",
        content:
          "Intelligence, validated strategy, creative ideation and coherent campaign development — each stage delivered in 48 hours.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

/* -------------------- Design system (shared with homepage) -------------------- */

const CSS = `
.bg-dfy{--void:#0A0908;--ash:#1C1A18;--ash2:#252220;--paper:#EDE8E0;--smoke:#8B8680;
  --detonation:#C81E1E;--detonation-dim:rgba(200,30,30,0.1);--detonation-line:rgba(200,30,30,0.35);
  background:var(--void);color:var(--paper);font-family:'Inter',sans-serif;-webkit-font-smoothing:antialiased;min-height:100vh}
.bg-dfy *,.bg-dfy *::before,.bg-dfy *::after{box-sizing:border-box}
.bg-dfy .display{font-family:'Bebas Neue',sans-serif;letter-spacing:.01em}
.bg-dfy .wrap{max-width:1080px;margin:0 auto;padding:0 48px}
@media (max-width:720px){.bg-dfy .wrap{padding:0 22px}}

.bg-dfy nav{position:sticky;top:0;z-index:50;background:rgba(10,9,8,0.92);backdrop-filter:blur(8px);border-bottom:1px solid var(--ash)}
.bg-dfy .nav-inner{max-width:1080px;margin:0 auto;padding:16px 48px;display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:nowrap}
@media (max-width:720px){.bg-dfy .nav-inner{padding:14px 22px}}
.bg-dfy .nav-logo{display:flex;align-items:center;gap:10px;flex-shrink:0;text-decoration:none;color:inherit}
.bg-dfy .nav-mark{font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:.04em}
.bg-dfy .nav-signin{color:var(--smoke);font-size:13px;font-weight:500;text-decoration:none;flex-shrink:0;transition:color .2s}
.bg-dfy .nav-signin:hover{color:var(--paper)}
.bg-dfy .nav-cta{background:var(--detonation);color:var(--paper);font-size:12px;font-weight:600;padding:6px 12px;border-radius:3px;text-decoration:none;border:none;cursor:pointer;font-family:inherit;line-height:1;white-space:nowrap}

.bg-dfy .hero{padding:88px 0 72px}
@media (max-width:720px){.bg-dfy .hero{padding:56px 0 48px}}
.bg-dfy .hero-kicker{font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--detonation);margin-bottom:20px}
.bg-dfy h1.hero-title{font-family:'Bebas Neue',sans-serif;font-size:clamp(44px,6vw,72px);line-height:.96;margin-bottom:24px;max-width:20ch;font-weight:400}
.bg-dfy .hero-sub{font-size:17px;color:var(--paper);font-weight:600;max-width:56ch;line-height:1.65;margin-bottom:16px}
.bg-dfy .hero-body{font-size:16px;color:var(--smoke);max-width:60ch;line-height:1.7;margin-bottom:32px}
.bg-dfy .hero-note{margin-top:20px;font-size:12px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--smoke)}
.bg-dfy .btn-primary{background:var(--detonation);color:var(--paper);font-size:14px;font-weight:600;padding:14px 26px;border-radius:3px;text-decoration:none;border:none;cursor:pointer;font-family:inherit;display:inline-block}
.bg-dfy .btn-ghost{border:1px solid var(--ash2);color:var(--paper);font-size:14px;font-weight:500;padding:13px 26px;border-radius:3px;text-decoration:none;background:none;cursor:pointer;font-family:inherit;display:inline-block}

.bg-dfy .section{padding:72px 0;border-top:1px solid var(--ash)}
@media (max-width:720px){.bg-dfy .section{padding:52px 0}}
.bg-dfy .section-eyebrow{font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--smoke);margin-bottom:16px}
.bg-dfy .section h2{font-family:'Bebas Neue',sans-serif;font-size:clamp(30px,4vw,44px);font-weight:400;max-width:26ch;margin-bottom:26px;line-height:1.05}
.bg-dfy .section p.body{font-size:15px;color:var(--smoke);line-height:1.75;max-width:64ch;margin-bottom:18px}
.bg-dfy .section p.body strong{color:var(--paper)}
.bg-dfy .callout{background:var(--ash);border:1px solid var(--detonation-line);border-radius:6px;padding:26px;max-width:70ch;margin-top:34px}
.bg-dfy .callout .c-title{font-size:16px;font-weight:600;color:var(--paper);margin-bottom:10px}
.bg-dfy .callout .c-body{font-size:15px;color:var(--smoke);line-height:1.7}

.bg-dfy .card-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--ash);border:1px solid var(--ash);margin:32px 0}
@media (max-width:900px){.bg-dfy .card-grid{grid-template-columns:1fr 1fr}}
@media (max-width:560px){.bg-dfy .card-grid{grid-template-columns:1fr}}
.bg-dfy .card-grid.cols-2{grid-template-columns:1fr 1fr}
@media (max-width:720px){.bg-dfy .card-grid.cols-2{grid-template-columns:1fr}}
.bg-dfy .card{background:var(--void);padding:26px 22px;display:flex;flex-direction:column;gap:10px;transition:background .2s}
.bg-dfy .card:hover{background:var(--ash)}
.bg-dfy .card .k-title{font-size:15px;font-weight:600;color:var(--paper);line-height:1.35}
.bg-dfy .card .k-desc{font-size:13px;color:var(--smoke);line-height:1.6}
.bg-dfy .card .k-num{font-family:'Bebas Neue',sans-serif;font-size:13px;color:var(--detonation);letter-spacing:.1em}

.bg-dfy .tier{background:var(--void);padding:30px 26px;display:flex;flex-direction:column;gap:14px}
.bg-dfy .tier .t-tag{font-family:'Bebas Neue',sans-serif;font-size:14px;color:var(--detonation);letter-spacing:.12em}
.bg-dfy .tier .t-name{font-size:20px;font-weight:600;color:var(--paper)}
.bg-dfy .tier .t-desc{font-size:14px;color:var(--smoke);line-height:1.7}
.bg-dfy .tier .t-meta{font-size:12px;color:var(--paper);font-weight:600;letter-spacing:.04em}
.bg-dfy .tier .t-note{font-size:12px;color:var(--smoke);line-height:1.6}
.bg-dfy .tier .t-best{font-size:13px;color:var(--smoke);line-height:1.6;border-top:1px solid var(--ash);padding-top:14px}
.bg-dfy .tier .t-best strong{color:var(--paper)}
.bg-dfy .tier .t-deliverables{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.bg-dfy .tier .t-deliverables li{font-size:13px;color:var(--smoke);line-height:1.55;padding-left:16px;position:relative}
.bg-dfy .tier .t-deliverables li::before{content:"•";position:absolute;left:0;color:var(--detonation)}
.bg-dfy .tier .t-deliverables .t-lead{font-size:12px;color:var(--paper);font-weight:600;letter-spacing:.04em;padding-left:0;margin-bottom:2px}
.bg-dfy .tier .t-deliverables .t-lead::before{display:none}
.bg-dfy .tier .btn-primary{margin-top:auto;text-align:center}

.bg-dfy .seq{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:8px 0 26px}
.bg-dfy .seq b{font-size:13px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--paper)}
.bg-dfy .seq i{font-style:normal;color:var(--detonation);font-size:13px}

.bg-dfy .facts{display:flex;flex-direction:column;gap:1px;background:var(--ash);border:1px solid var(--ash);margin:28px 0;max-width:64ch}
.bg-dfy .fact-row{background:var(--void);padding:16px 22px;font-size:14px;color:var(--paper);display:flex;gap:14px;align-items:baseline}
.bg-dfy .fact-row::before{content:"—";color:var(--detonation);flex-shrink:0}

.bg-dfy .faq{border-top:1px solid var(--ash);margin-top:8px}
.bg-dfy .faq-item{border-bottom:1px solid var(--ash);padding:22px 0}
.bg-dfy .faq-q{font-size:15px;font-weight:600;color:var(--paper);margin-bottom:8px}
.bg-dfy .faq-a{font-size:14px;color:var(--smoke);line-height:1.7;max-width:68ch}

.bg-dfy .cta-row{display:flex;gap:14px;flex-wrap:wrap;margin-top:8px}
.bg-dfy .btn-note{font-size:12px;color:var(--smoke);line-height:1.5;margin-top:8px}
.bg-dfy footer{border-top:1px solid var(--ash);padding:32px 0;text-align:center;font-size:13px;color:var(--smoke)}

.bg-dfy .sticky-cta{position:fixed;left:0;right:0;bottom:0;z-index:60;background:rgba(10,9,8,0.94);backdrop-filter:blur(8px);border-top:1px solid var(--ash);padding:12px 22px;display:flex;align-items:center;justify-content:center;gap:18px}
.bg-dfy .sticky-cta span{font-size:12px;color:var(--smoke);letter-spacing:.06em;text-transform:uppercase;font-weight:600}
@media (max-width:560px){.bg-dfy .sticky-cta span{display:none}}

.bg-dfy-overlay{position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;background:rgba(10,9,8,0.86);padding:24px;overflow-y:auto;-webkit-overflow-scrolling:touch}
.bg-dfy-panel{width:100%;max-width:460px;background:var(--ash);border:1px solid var(--ash2);border-radius:6px;padding:32px}
.bg-dfy-field{width:100%;background:var(--void);border:1px solid var(--ash2);border-radius:3px;color:var(--paper);padding:12px 12px;font-size:16px;font-family:inherit;-webkit-appearance:none}
.bg-dfy-field:focus{outline:none;border-color:var(--detonation)}
@media (max-width:720px){
  .bg-dfy-overlay{padding:0;align-items:stretch;justify-content:stretch}
  .bg-dfy-panel{max-width:none;border:none;border-radius:0;min-height:100dvh;padding:24px 20px calc(32px + env(safe-area-inset-bottom));display:flex;flex-direction:column}
  .bg-dfy-field{padding:14px 12px}
  .bg-dfy-panel .btn-primary{width:100%;padding:16px 20px;font-size:16px}
  .bg-dfy .sticky-cta{position:static;border-top:none;padding:0;background:none;backdrop-filter:none}
}
`;

/* -------------------- Data -------------------- */

const WHY = [
  {
    title: "YOU NEED THE CAPABILITY, NOT THE SOFTWARE.",
    desc: "You have the problem. You don't necessarily have the team, time or capability to run a complete Brand Grenade engagement yourself. We do it for you.",
  },
  {
    title: "YOU HAVE AN URGENT BRIEF.",
    desc: "A pitch, repositioning, strategic challenge or campaign can't always wait for a conventional six-week process. We can put the full system to work immediately.",
  },
  {
    title: "YOU WANT TO PROVE IT FIRST.",
    desc: "Experience what Brand Grenade produces on a real business problem before investing in implementing the platform inside your organisation. Run it with us first.",
  },
];

const OUTPUTS = [
  {
    title: "BOARD",
    lead: "The decision.",
    desc: "Evidence-led recommendations built for the room that approves the direction.",
  },
  {
    title: "CMO",
    lead: "The story.",
    desc: "Strategy and creative vision brought together to socialise the opportunity and align the organisation.",
  },
  {
    title: "AGENCY",
    lead: "The brief to make the work.",
    desc: "A proposition-led strategy and creative platform built for the people who will develop the campaign.",
  },
  {
    title: "CREATIVE",
    lead: "The territory and the idea.",
    desc: "37 creative lenses explored, scored and developed into distinctive creative territories — then orchestrated into one coherent campaign.",
  },
  {
    title: "CHANNEL",
    lead: "The expression.",
    desc: "Channel-specific strategies and briefs that translate the campaign without losing the strategic or creative idea.",
  },
  {
    title: "EXECUTION",
    lead: "The tools to make it happen.",
    desc: "Detailed briefs, prompt sets and supporting outputs that carry the strategy through to the work.",
  },
];

const WHO = [
  {
    title: "CREATIVE / BRAND AGENCIES",
    desc: "You need to win the pitch and brief your creative team properly — with a strategic foundation sophisticated enough to justify the work that follows.",
    detail:
      "Ready-to-present territories, clear creative guardrails and full coherence from strategy through to the work.",
    fit: "→ Tier 2 or 3, structured for agency handoff",
  },
  {
    title: "BRAND OWNERS / IN-HOUSE MARKETING",
    desc: "You need clarity on the real problem and your real options before you commit budget.",
    detail:
      "A diagnosis, ranked strategic options and the specific conditions that have to be true before you commit.",
    fit: "→ Start with Tier 1, upgrade to Tier 2 when you're ready to build",
  },
  {
    title: "CONSULTANCIES",
    desc: "You need genuine hypothesis stress-testing, real option generation and evidence discipline you can stand behind in front of a client.",
    detail:
      "Bring us an existing point of view and let Brand Grenade challenge it — or use the system to develop the options from scratch.",
    fit: "→ Custom Intelligence Lab engagement available",
  },
  {
    title: "MARTECH / TECHNOLOGY IMPLEMENTERS",
    desc: "You need the strategic and creative logic that should sit above the stack — determining what the technology is actually built to deliver, not just how it's architected.",
    detail: "",
    fit: "→ Tier 2 or 3",
  },
  {
    title: "FRACTIONAL CMOS / SOLO STRATEGISTS",
    desc: "You need leverage and speed without losing rigour — a complete strategic and creative capability you can bring into your own engagement without having to build the infrastructure yourself.",
    detail: "",
    fit: "→ Tier 1, or a white-label engagement where appropriate",
  },
];

const FAQS: [string, string][] = [
  [
    "What do I need to provide to get started?",
    "At minimum, the brand, the problem you're trying to solve and what you need the work to answer. You can also provide existing research, presentations, documents, data and other source material through the Research Synthesiser.",
  ],
  [
    'What does "48 hours" mean?',
    "Each stage is delivered within 48 hours of the stage commencing and the required inputs being received. For Tier 2 and Tier 3, you have a review and decision point between stages. Overall elapsed time therefore depends on how quickly you review and approve each stage.",
  ],
  [
    "Are the reviews genuinely part of the process?",
    "Yes. They are decision points, not courtesy presentations. You review the output before the next stage begins, and your judgement determines whether the work proceeds, needs adjustment or requires a change in direction.",
  ],
  [
    "What happens if I don't agree with the strategic direction?",
    "Your review happens before the next stage begins. If the work needs adjustment within the agreed brief and scope, we address it before proceeding. A materially changed brief or fundamentally new direction may require a revised scope.",
  ],
  [
    "Can I start with Tier 1 and upgrade later?",
    "Yes. Tier 1 is designed to be a genuine entry point to the system. If the diagnosis identifies an opportunity worth developing, you can continue into Tier 2 or Tier 3.",
  ],
  [
    "What exactly do I receive?",
    "You receive the outputs associated with the tier you select, produced directly from the Brand Grenade system. Depending on the tier and brief, these can include strategic reports, propositions, positioning, strategic territories, creative territories, campaign development, channel briefs, prompts and supporting documentation.",
  ],
  [
    "Is this just AI generating the strategy?",
    "No. Brand Grenade combines AI-based reasoning and generation with proven strategic methodologies, multiple reasoning engines, structured validation and explicit human checkpoints. Done-for-You is the full Brand Grenade system run by us on your brief.",
  ],
  [
    "Can you work with an existing strategy or point of view?",
    "Yes. You can bring an existing strategy, hypothesis, proposition or point of view and use Brand Grenade to interrogate, stress-test and develop it rather than starting from scratch.",
  ],
  [
    "Can I use my own research?",
    "Yes. Existing research can be uploaded and processed through the Research Synthesiser, including supported documents, presentations, spreadsheets and other source material.",
  ],
  [
    "Does Done-for-You include campaign production?",
    "No. Brand Grenade takes the work through strategy, creative ideation and campaign development, producing the creative platform, campaign thinking, channel briefs, prompts and supporting outputs. Physical production, media buying and campaign execution remain with your agency, production partners or internal team.",
  ],
  [
    "Can an agency use the work with its client?",
    "Yes, subject to the agreed engagement and IP terms. Done-for-You can be structured specifically for agency strategy, pitch, client presentation or creative handoff.",
  ],
  [
    "Can Done-for-You be delivered as a white-label engagement?",
    "White-label arrangements are available for selected agency and consultancy engagements. Permitted use, attribution and IP arrangements are agreed as part of the engagement.",
  ],
  [
    "Who owns the work?",
    "The ownership and permitted use of client-specific deliverables are defined in the engagement terms. Brand Grenade's underlying methodology, system, software, frameworks and intellectual property remain Brand Grenade's unless otherwise agreed in writing.",
  ],
  [
    "Is my information confidential?",
    "Client-provided information is treated as confidential and kept separate from public research and verification processes. Proprietary client information is not exposed as public information for verification. Specific confidentiality, data handling and contractual requirements can be agreed for enterprise engagements.",
  ],
  [
    "Can you work under an NDA?",
    "Yes. NDA and additional confidentiality requirements can be accommodated where agreed as part of the engagement.",
  ],
  [
    "Can you work with an urgent brief?",
    "Yes. The staged Done-for-You model is specifically designed for situations where the work cannot wait for a conventional strategy process. Subject to the brief, required inputs and availability, the first stage can begin immediately.",
  ],
  [
    "What if we already have a strategy?",
    "That's not a problem. Brand Grenade can work from existing strategic thinking, research or hypotheses and use the system to interrogate, challenge, develop or extend them. You don't necessarily need to start from zero.",
  ],
  [
    "Can Done-for-You be used as a trial before platform implementation?",
    "Yes. Done-for-You is designed to provide a practical way to experience Brand Grenade on a real business problem before deciding whether to implement the platform within your own organisation.",
  ],
  [
    "Is there a minimum engagement?",
    "Tier 1 is the entry-level Done-for-You engagement. Larger or more specialised engagements can be scoped where the brief requires additional work beyond the standard tiers.",
  ],
  [
    "Can we continue after the Done-for-You project?",
    "Yes. Done-for-You can be a standalone engagement or the first step toward implementing Brand Grenade within your organisation. Larger ongoing engagements can also be scoped where you need continued strategic and creative development.",
  ],
  [
    "Can you run only part of the system for us?",
    "Yes. The three tiers provide structured entry points, but bespoke engagements can be scoped where you need a specific capability — for example intelligence, strategic challenge, creative ideation or a combination of stages.",
  ],
];

/* -------------------- Page -------------------- */

function DoneForYou() {
  useEffect(() => {
    document.title = "Done-For-You — Brand Grenade Run On Your Brief";
  }, []);

  const open = (context: string) => openCalendlyBooking(context);

  return (
    <div className="bg-dfy">
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
            <Link to="/" className="nav-signin">
              Platform
            </Link>
            <Link to="/login" className="nav-signin">
              Sign in
            </Link>
            <button
              type="button"
              className="nav-cta"
              onClick={() => open("Done-For-You project")}
            >
              Start a project
            </button>
          </div>
        </div>
      </nav>

      <div className="wrap">
        {/* HERO */}
        <section className="hero">
          <div className="hero-kicker">Brand Grenade Done-For-You</div>
          <h1 className="hero-title">
            The complete Brand Grenade system. Run on your brief.
          </h1>
          <p className="hero-sub">
            Get the full Brand Grenade capability without implementing the
            platform yourself.
          </p>
          <p className="hero-body">
            We take your brand from raw data and research through intelligence,
            validated strategy, creative ideation and coherent campaign
            development — using the complete Brand Grenade system and producing
            the full suite of strategic and creative deliverables along the
            way.
          </p>
          <button
            type="button"
            className="btn-primary"
            onClick={() => open("Done-For-You project")}
          >
            Start a Done-For-You project →
          </button>
          <div className="hero-note">Each stage delivered in 48 hours.</div>
        </section>

        {/* WHY DONE-FOR-YOU */}
        <section className="section">
          <div className="section-eyebrow">Why Done-For-You?</div>
          <div className="card-grid">
            {WHY.map((w) => (
              <div className="card" key={w.title}>
                <div className="k-title">{w.title}</div>
                <div className="k-desc">{w.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* THE SAME SYSTEM */}
        <section className="section">
          <div className="section-eyebrow">The same system. Run by us, on your brief.</div>
          <p className="body">
            This isn't a consulting team using a simplified AI tool.
          </p>
          <p className="body">
            <strong>
              It's Brand Grenade itself — the platform's methodology, reasoning
              engines, validation processes and Creative Stimulus Engine — run
              by us on your brief.
            </strong>
          </p>
          <div className="seq">
            <b>Research</b>
            <i>→</i>
            <b>Intelligence</b>
            <i>→</i>
            <b>Brief</b>
            <i>→</i>
            <b>Strategy</b>
            <i>→</i>
            <b>Creative Ideation</b>
            <i>→</i>
            <b>Campaign</b>
          </div>
          <p className="body">
            Every tier runs through Brand Grenade. The difference is how far
            through the system your brief travels — and how much of the output
            you receive along the way.
          </p>
          <div className="callout">
            <div className="c-body">
              You get the capability without having to build the capability.
            </div>
          </div>
        </section>

        {/* THREE TIERS */}
        <section className="section">
          <div className="section-eyebrow">The three levels of engagement</div>
          <div className="card-grid">
            <div className="tier">
              <div className="t-tag">TIER 1</div>
              <div className="t-name">INTELLIGENCE</div>
              <div className="t-desc">
                Brand diagnosis and strategic territory.
              </div>
              <div className="t-desc">
                Research Synthesiser and Intelligence Lab, run on your brief. A
                structured, evidence-checked read of your category and
                position, multiple distinct strategic territories scored and
                compared, and a clear recommendation with the reasoning shown.
              </div>
              <div className="t-meta">One 48-hour stage.</div>
              <ul className="t-deliverables">
                <li>Full Research Synthesiser evidence base — every claim classified and verified</li>
                <li>Strategic Territory Intelligence Report — multiple distinct territories, scored and compared, with full reasoning shown</li>
                <li>Honest reasoning included even where no clear rationale existed for what wasn't recommended</li>
              </ul>
              <div className="t-best">
                <strong>Best when:</strong> you need to understand the problem,
                identify the opportunity and establish where the strategy
                should go.
              </div>
              <button
                type="button"
                className="btn-primary"
                onClick={() => open("Tier 1 — Intelligence")}
              >
                Start Tier 1 →
              </button>
              <div className="btn-note">Books a 30-minute call to scope this tier - no payment required yet.</div>
            </div>
            <div className="tier">
              <div className="t-tag">TIER 2</div>
              <div className="t-name">STRATEGY</div>
              <div className="t-desc">
                Intelligence through complete, validated strategy.
              </div>
              <div className="t-desc">
                Everything in Tier 1, taken through full strategic development —
                your validated proposition, positioning and territory, built
                out and pressure-tested, ready to brief an agency or build
                creative against.
              </div>
              <div className="t-meta">Two 48-hour stages.</div>
              <div className="t-note">
                You review and approve the Intelligence stage before strategic
                development begins. Overall timing depends on your review and
                approval.
              </div>
              <ul className="t-deliverables">
                <li className="t-lead">Everything in Tier 1, plus:</li>
                <li>Brand Strategy and Creative Development Summary</li>
                <li>Consulting Delivery document with full working appendix</li>
                <li>Your validated proposition and positioning, fully reasoned</li>
                <li>Four audience-tailored formats: executive Strategy & Creative Vision, Agency Pitch, Board Strategy Recommendation, Brand Workshop</li>
                <li>The complete strategy pipeline — full canonical record, every stage</li>
              </ul>
              <div className="t-best">
                <strong>Best when:</strong> you need a complete strategic
                answer, not just a diagnosis.
              </div>
              <button
                type="button"
                className="btn-primary"
                onClick={() => open("Tier 2 — Strategy")}
              >
                Start Tier 2 →
              </button>
              <div className="btn-note">Books a 30-minute call to scope this tier - no payment required yet.</div>
            </div>
            <div className="tier">
              <div className="t-tag">TIER 3</div>
              <div className="t-name">FULL PIPELINE</div>
              <div className="t-desc">
                Intelligence → Strategy → Creative Ideation → Campaign
              </div>
              <div className="t-desc">
                The complete Brand Grenade proposition. Everything in Tiers 1
                and 2, plus creative ideation through 37 lenses, scored and
                refined into one coherent campaign — territory, creative
                direction, channel-specific briefs and supporting execution
                outputs.
              </div>
              <div className="t-meta">Three 48-hour stages.</div>
              <div className="t-note">
                You review and approve the work between stages. Overall timing
                depends on your review and approval.
              </div>
              <div className="t-note">
                Capacity is limited to protect quality and turnaround.
              </div>
              <ul className="t-deliverables">
                <li className="t-lead">Everything in Tier 2, plus:</li>
                <li>The complete creative sweep — every direction generated and rated, through to the approved shortlist</li>
                <li>Full Brand Detonation suite: Detonation Territory, Detonation Intelligence, The Detonation, Activation Architecture, Master Detonation Brief</li>
                <li>Individual channel-specific briefs, each with its own strategic rationale</li>
                <li>A tool-specific, paste-ready prompt set for executional development</li>
                <li>Conceptual creative assets and brand architecture documentation</li>
                <li>The full creative showcase — one campaign, every channel expression, presented as a whole</li>
              </ul>
              <div className="t-best">
                <strong>Best when:</strong> you need to go from the strategic
                problem all the way to creative ideation and coherent campaign
                development.
              </div>
              <button
                type="button"
                className="btn-primary"
                onClick={() => open("Tier 3 — Full Pipeline")}
              >
                Start Full Pipeline →
              </button>
              <div className="btn-note">Books a 30-minute call to scope this tier - no payment required yet.</div>
            </div>
          </div>
          <div className="callout">
            <div className="c-title">Not sure which tier fits?</div>
            <div className="c-body" style={{ marginBottom: 18 }}>
              Tell us what you're trying to solve and we'll recommend where to
              start.
            </div>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => open("Not sure which tier")}
            >
              Talk to us →
            </button>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="section">
          <div className="section-eyebrow">
            How it works — staged. Collaborative. Not a black box.
          </div>
          <p className="body">
            <strong>
              You get a real checkpoint at every stage, not just a finished
              result at the end.
            </strong>
          </p>
          <div className="card-grid">
            <div className="card">
              <div className="k-num">01 — INTELLIGENCE</div>
              <div className="k-desc">
                You brief us. We run the Research Synthesiser and Intelligence
                Lab against your brief and source material.
              </div>
              <div className="k-desc" style={{ color: "var(--paper)" }}>
                Delivered in 48 hours.
              </div>
              <div className="k-desc">
                You review the output before anything else runs.
              </div>
            </div>
            <div className="card">
              <div className="k-num">02 — STRATEGY</div>
              <div className="k-desc">
                For Tier 2 and Tier 3, the intelligence is taken through full
                strategic development — propositions, positioning, territories
                and validation.
              </div>
              <div className="k-desc" style={{ color: "var(--paper)" }}>
                Delivered in 48 hours.
              </div>
              <div className="k-desc">
                You review and sign off before creative ideation begins.
              </div>
            </div>
            <div className="card">
              <div className="k-num">03 — CREATIVE IDEATION</div>
              <div className="k-desc">
                For Tier 3, the validated strategy moves through the Creative
                Stimulus Engine and its 37 creative lenses. Ideas are explored,
                scored and developed into distinctive creative territories, then
                orchestrated into one coherent campaign with channel-specific
                work.
              </div>
              <div className="k-desc" style={{ color: "var(--paper)" }}>
                Delivered in 48 hours.
              </div>
            </div>
          </div>
          <p className="body">
            Each stage is a genuine 48-hour turnaround. Overall elapsed time
            depends on your review and approval between stages.
          </p>
        </section>

        {/* YOUR JUDGEMENT */}
        <section className="section">
          <div className="section-eyebrow">Your judgement stays in the process.</div>
          <p className="body">
            Done-for-You doesn't mean handing us a brief and disappearing until
            the final delivery.
          </p>
          <p className="body">
            Every stage gives you an opportunity to review the thinking,
            challenge the direction and decide whether to proceed.
          </p>
          <p className="body">
            <strong>
              The system generates. You judge. The system validates. You
              approve.
            </strong>
          </p>
          <div className="callout">
            <div className="c-body">
              If the work needs adjustment within the agreed brief and scope,
              we address it before proceeding to the next stage. A materially
              changed brief or fundamentally new direction may require a
              revised scope.
            </div>
          </div>
        </section>

        {/* WHAT YOU GET */}
        <section className="section">
          <div className="section-eyebrow">What you get</div>
          <h2>FROM RAW DATA TO THE WORK.</h2>
          <p className="body">
            Brand Grenade takes raw data and research through intelligence,
            validated strategy and creative ideation — producing a connected
            suite of strategic and creative deliverables along the way. Board.
            CMO. Strategy team. Agency. Creative team. Channel teams. Same
            intelligence. Same strategic foundation. Different outputs for
            different decisions.
          </p>
          <div className="card-grid">
            {OUTPUTS.map((o) => (
              <div className="card" key={o.title}>
                <div className="k-title">{o.title}</div>
                <div className="k-desc">
                  <strong style={{ color: "var(--paper)" }}>{o.lead}</strong>{" "}
                  {o.desc}
                </div>
              </div>
            ))}
          </div>
          <div className="callout">
            <div className="c-title">
              ONE STRATEGIC SOURCE OF TRUTH. EVERYONE WORKING FROM IT.
            </div>
            <div className="c-body">
              Instead of a strategy disappearing into a deck and being
              reinterpreted by every team downstream, Brand Grenade carries the
              validated thinking through the entire process. Less translation.
              Less loss. More coherence. More usable work.
            </div>
          </div>
        </section>

        {/* WHO THIS IS FOR */}
        <section className="section">
          <div className="section-eyebrow">Who this is for</div>
          <div className="card-grid cols-2">
            {WHO.map((w) => (
              <div className="card" key={w.title}>
                <div className="k-title">{w.title}</div>
                <div className="k-desc">{w.desc}</div>
                {w.detail && <div className="k-desc">{w.detail}</div>}
                <div
                  className="k-desc"
                  style={{ color: "var(--detonation)", fontWeight: 600 }}
                >
                  {w.fit}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SEE THE SYSTEM */}
        <section className="section">
          <div className="section-eyebrow">See the system in action.</div>
          <p className="body">
            Brand Grenade isn't a collection of templates or an AI tool that
            produces a strategy document. It is a connected system that takes a
            brief through intelligence, strategy and creative ideation — with
            human judgement at every critical decision point.
          </p>
          <p className="body">
            The result is not one document. It is a connected body of
            intelligence and deliverables that can move from the boardroom to
            the CMO, strategy team, agency, creative team and channel teams
            without losing the thinking along the way.
          </p>
          <div className="facts">
            <div className="fact-row">{LENS_COUNT} creative lenses</div>
            <div className="fact-row">50+ proven strategic methodologies</div>
            <div className="fact-row">
              Up to ~20 divergent strategic propositions explored, shortlisted
              to 3-5 for human judgement
            </div>
            <div className="fact-row">
              {STRUCTURED_OUTPUT_COUNT} structured outputs
            </div>
            <div className="fact-row">Human checkpoints throughout</div>
          </div>
          <div className="cta-row">
            <Link to="/" hash="walkthrough" className="btn-primary">
              See Brand Grenade in action →
            </Link>
          </div>
          <p className="body" style={{ marginTop: 16 }}>
            Live demonstration available by request.
          </p>
        </section>

        {/* BOUNDARY */}
        <section className="section">
          <div className="section-eyebrow">The boundary is clear.</div>
          <p className="body">
            Done-for-You takes the work through intelligence, strategy, creative
            ideation and campaign development. It produces the strategic and
            creative platforms, campaign thinking, channel briefs, prompts and
            supporting outputs required to take the work forward.
          </p>
          <div className="callout">
            <div className="c-body">
              Physical production, media buying and campaign execution remain
              with your agency, production partners or internal team.
            </div>
          </div>
        </section>

        {/* GET STARTED */}
        <section className="section">
          <div className="section-eyebrow">Get started</div>
          <h2>HAVE A BRAND PROBLEM?</h2>
          <p className="body">
            Tell us what you're trying to solve and we'll recommend the right
            level of Brand Grenade engagement.
          </p>
          <div className="cta-row" style={{ marginBottom: 20 }}>
            <button
              type="button"
              className="btn-primary"
              onClick={() => open("Done-For-You project")}
            >
              Start a Done-For-You project →
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => open("Discuss a project")}
            >
              Discuss your project →
            </button>
          </div>
          <p className="body">
            Want to talk it through first?{" "}
            <button
              type="button"
              onClick={() => open("Book a 30-minute call")}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                color: "var(--paper)",
                fontWeight: 600,
                fontSize: "inherit",
                fontFamily: "inherit",
                cursor: "pointer",
                textDecoration: "underline",
                textUnderlineOffset: 3,
              }}
            >
              Book a 30-minute call →
            </button>
          </p>
          <div className="btn-note">Books a 30-minute call to scope this tier - no payment required yet.</div>
          <div className="callout">
            <div className="c-title">
              WANT TO TRY BRAND GRENADE BEFORE YOU IMPLEMENT IT?
            </div>
            <div className="c-body" style={{ marginBottom: 18 }}>
              Done-for-You is also the fastest way to experience the system on
              a real business problem before bringing the capability into your
              own organisation. Run a real brief with us. See what Brand
              Grenade produces. Then decide whether you want to implement it
              yourself.
            </div>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => open("Discuss implementation")}
            >
              Discuss implementation →
            </button>
          </div>
        </section>

        {/* FAQ */}
        <section className="section">
          <div className="section-eyebrow">Frequently asked questions</div>
          <div className="faq">
            {FAQS.map(([q, a]) => (
              <div className="faq-item" key={q}>
                <div className="faq-q">{q}</div>
                <div className="faq-a">{a}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <footer>
        <div>
          Brand Grenade — Enterprise Brand Strategy and Creative Development
          System
        </div>
      </footer>

      <div className="sticky-cta">
        <span>Each stage delivered in 48 hours</span>
        <button
          type="button"
          className="nav-cta"
          onClick={() => open("Done-For-You project")}
        >
          Start a project
        </button>
      </div>
    </div>
  );
}

