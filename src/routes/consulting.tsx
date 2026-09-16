import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { openCalendlyBooking } from "@/lib/calendly";
import { LENS_COUNT } from "@/lib/stimulus/lenses";

export const Route = createFileRoute("/consulting")({
  component: DoneForYou,
  head: () => ({
    meta: [
      { title: "Brand Grenade Consulting — 48-Hour Guaranteed Turnaround" },
      {
        name: "description",
        content:
          "The complete Brand Grenade system, run on your brief. Every stage delivered within 48 hours of your approval to proceed — guaranteed. Book a 30-minute scoping call.",
      },
      {
        property: "og:title",
        content: "Brand Grenade Consulting — 48-Hour Guaranteed Turnaround",
      },
      {
        property: "og:description",
        content:
          "The full Brand Grenade system run on your brief. Every stage delivered within 48 hours of your approval to proceed — guaranteed.",
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
.bg-dfy .hero-hook{font-size:clamp(20px,2.6vw,27px);font-weight:600;line-height:1.4;color:var(--paper);max-width:34ch;margin-bottom:26px}
.bg-dfy .hero-kicker{font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--detonation);margin-bottom:20px}
.bg-dfy h1.hero-title{font-family:'Bebas Neue',sans-serif;font-size:clamp(44px,6vw,72px);line-height:.96;margin-bottom:24px;max-width:20ch;font-weight:400}
.bg-dfy .hero-body{font-size:16px;color:var(--smoke);max-width:60ch;line-height:1.7;margin-bottom:18px}
.bg-dfy .hero-guarantee{font-size:17px;font-weight:600;color:var(--paper);max-width:56ch;line-height:1.6;margin-bottom:18px}
.bg-dfy .btn-primary{background:var(--detonation);color:var(--paper);font-size:14px;font-weight:600;padding:14px 26px;border-radius:3px;text-decoration:none;border:none;cursor:pointer;font-family:inherit;display:inline-block}

.bg-dfy .section{padding:56px 0;border-top:1px solid var(--ash)}
.bg-dfy .section > :last-child{margin-bottom:0}
@media (max-width:720px){.bg-dfy .section{padding:44px 0}}
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
.bg-dfy .tier .t-price{font-family:'Bebas Neue',sans-serif;font-size:40px;line-height:1;color:var(--paper);letter-spacing:.02em;margin-top:2px}
.bg-dfy .tier .price-note{font-size:12.5px;color:var(--smoke);line-height:1.6;border-left:2px solid var(--detonation);padding-left:12px}
.bg-dfy .tier .t-best{font-size:13px;color:var(--smoke);line-height:1.6;border-top:1px solid var(--ash);padding-top:14px;margin-top:auto}
.bg-dfy .tier .t-best strong{color:var(--paper)}
.bg-dfy .tier .t-deliverables{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.bg-dfy .tier .t-deliverables li{font-size:13px;color:var(--smoke);line-height:1.55;padding-left:16px;position:relative}
.bg-dfy .tier .t-deliverables li::before{content:"•";position:absolute;left:0;color:var(--detonation)}
.bg-dfy .tier .t-deliverables .t-lead{font-size:12px;color:var(--paper);font-weight:600;letter-spacing:.04em;padding-left:0;margin-bottom:2px}
.bg-dfy .tier .t-deliverables .t-lead::before{display:none}
.bg-dfy .tier .btn-primary{text-align:center}

.bg-dfy .seq{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:8px 0 26px}
.bg-dfy .seq b{font-size:13px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--paper)}
.bg-dfy .seq i{font-style:normal;color:var(--detonation);font-size:13px}

.bg-dfy .cta-row{display:flex;gap:14px;flex-wrap:wrap;margin-top:8px}
.bg-dfy .btn-note{font-size:13px;color:var(--smoke);line-height:1.6;margin-top:14px}
.bg-dfy footer{border-top:1px solid var(--ash);padding:32px 0 92px;text-align:center;font-size:13px;color:var(--smoke)}
@media (max-width:720px){.bg-dfy footer{padding:32px 0}}

.bg-dfy .sticky-cta{position:fixed;left:0;right:0;bottom:0;z-index:60;background:rgba(10,9,8,0.94);backdrop-filter:blur(8px);border-top:1px solid var(--ash);padding:12px 22px;display:flex;align-items:center;justify-content:center;gap:18px}
.bg-dfy .sticky-cta span{font-size:12px;color:var(--smoke);letter-spacing:.06em;text-transform:uppercase;font-weight:600}
@media (max-width:560px){.bg-dfy .sticky-cta span{display:none}}
`;

/* -------------------- Data -------------------- */

const WHY = [
  {
    title: "You need the capability, not the software.",
    desc: "You have the problem. You don't necessarily have the team, time or internal capacity to run a full Brand Grenade engagement.",
    strong: "We do it for you — using the complete system.",
  },
  {
    title: "You can't afford a six-week process.",
    desc: "A pitch, repositioning, strategic challenge or campaign doesn't always have six weeks.",
    strong:
      "Brand Grenade compresses the process into 48-hour guaranteed turnarounds without removing the evidence, strategic rigour, validation or human judgement.",
  },
  {
    title: "You want to prove it first.",
    desc: "Run Brand Grenade on a real business problem before committing to a platform licence or internal implementation.",
    strong:
      "Experience exactly what the system produces. See how it works on your business. Then decide what comes next.",
  },
];

const STEPS = [
  { num: "01 — SCOPE", desc: "We work with you to define the business problem and brief." },
  { num: "02 — RUN", desc: "We put the relevant Brand Grenade stages to work." },
  { num: "03 — REVIEW", desc: "You receive the complete output and working record." },
  { num: "04 — APPROVE", desc: "You decide whether the work is ready to progress." },
  { num: "05 — CONTINUE", desc: "We move into the next stage only when you approve it." },
];

const TIER_1_DELIVERABLES = [
  "Full Research Synthesiser evidence base — every claim classified and verified",
  "Intelligence Lab analysis of the problem, tension and opportunity",
  "Strategic Territory Intelligence Report",
  "Multiple distinct strategic territories, scored and compared",
  "Clear strategic recommendation with the reasoning and evidence behind it",
  "Honest reasoning included, including why other territories were not recommended",
  "Complete working record",
];

const TIER_2_DELIVERABLES = [
  "Everything in Tier 1",
  "You review and approve the Intelligence stage before strategic development begins",
  "Validated proposition and positioning — pressure-tested against the evidence, strategic territories and evaluation criteria",
  "Full scored proposition set with the evidence and reasoning behind every score",
  "Named-competitor defensibility analysis — why the recommended position is difficult for named rivals to occupy",
  "Brand Fit Validation — credibility dimensions, guardrails and strategic commitments for taking the position to market",
  "Complete Strategy Pipeline working record",
];

const TIER_3_DELIVERABLES = [
  "Everything in Tiers 1 and 2",
  "You review and approve between stages",
  `Creative ideation through ${LENS_COUNT} distinct creative lenses`,
  "Multiple genuinely different creative directions generated and evaluated",
  "Full creative sweep — every direction generated and rated through to the approved shortlist",
  "Creative Detonation — from strategic territory to central creative idea",
  "Detonation Territory, Detonation Intelligence, The Detonation, Activation Architecture, Master Detonation Brief",
  "Individual channel-specific briefs with strategic rationale",
  "Tool-specific, paste-ready prompts for executional development",
  "Conceptual creative assets and brand architecture documentation",
  "Full creative showcase — one campaign, every channel expression",
  "The complete, board-ready document set: Board Strategy Recommendation, Strategic Platform, Brand Strategy Workshop, and Strategy and Creative Vision",
  "Complete creative working record",
];

const TIER_PRICE = "$4,000";
const FULL_RUN_PRICE = "$10,000";
const FULL_RUN_INDIVIDUAL = "$12,000";
const FULL_RUN_SAVING = "$2,000";

/* -------------------- Page -------------------- */

function DoneForYou() {
  useEffect(() => {
    document.title = "Brand Grenade Consulting — 48-Hour Guaranteed Turnaround";
  }, []);

  const open = (context: string) => openCalendlyBooking(context);

  const ScopingCallCta = ({ context }: { context: string }) => (
    <div className="cta-row">
      <button
        type="button"
        className="btn-primary"
        onClick={() => open(context)}
      >
        Book a 30-minute scoping call
      </button>
    </div>
  );

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
              onClick={() => open("Brand Grenade Consulting")}
            >
              Book a 30-minute scoping call
            </button>
          </div>
        </div>
      </nav>

      <div className="wrap">
        {/* HERO */}
        <section className="hero">
          <p className="hero-hook">
            Urgent brand problem. No six weeks to fix it. No enterprise budget
            to throw at it.
          </p>
          <div className="hero-kicker">Brand Grenade Consulting</div>
          <h1 className="hero-title">
            The full Brand Grenade system. Run on your brief.
          </h1>
          <p className="hero-body">
            Give us a real brand problem. We run it through the complete Brand
            Grenade system — from raw intelligence through validated strategy,
            Creative Detonation and coherent campaign development.
          </p>
          <p className="hero-guarantee">
            Every stage delivered within 48 hours of your approval to proceed —
            guaranteed.
          </p>
          <p className="hero-body">
            You review. You approve. We move to the next stage.
          </p>
          <ScopingCallCta context="Brand Grenade Consulting" />
        </section>

        {/* WHY CONSULTING */}
        <section className="section">
          <div className="section-eyebrow">Why Consulting?</div>
          <div className="card-grid">
            {WHY.map((w) => (
              <div className="card" key={w.title}>
                <div className="k-title">{w.title}</div>
                <div className="k-desc">{w.desc}</div>
                <div className="k-desc" style={{ color: "var(--paper)" }}>
                  {w.strong}
                </div>
              </div>
            ))}
          </div>
          <ScopingCallCta context="Brand Grenade Consulting" />
        </section>

        {/* THE SAME SYSTEM */}
        <section className="section">
          <div className="section-eyebrow">The same system. Run by us, on your brief.</div>
          <p className="body">
            This is not a consulting team using a simplified AI tool.
          </p>
          <p className="body">
            <strong>
              It is Brand Grenade itself — the methodology, reasoning engines,
              validation processes, human checkpoints and Creative Stimulus
              Engine — run on your brief.
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
            <b>Creative Detonation</b>
            <i>→</i>
            <b>Campaign</b>
          </div>
          <p className="body">Every engagement runs through the same system.</p>
          <p className="body">You choose how far you take the problem.</p>
          <p className="body">
            <strong>The system does the heavy lifting. Humans make the decisions.</strong>
          </p>
        </section>

        {/* THREE TIERS */}
        <section className="section">
          <div className="section-eyebrow">Three levels of engagement</div>
          <div className="card-grid">
            <div className="tier">
              <div className="t-tag">TIER 1 — INTELLIGENCE</div>
              <div className="t-name">From raw research to strategic opportunity.</div>
              <div className="t-desc">
                We take your brief through the Research Synthesiser and
                Intelligence Lab to establish what is actually known, what
                matters, where the tension lies and where the strategic
                opportunity sits.
              </div>
              <div className="t-desc">
                Multiple distinct strategic territories are generated, scored
                and compared, with the reasoning and evidence behind the
                recommendation.
              </div>
              <div className="t-meta">1 stage · delivered within 48 hours</div>
              <div className="t-price">{TIER_PRICE}</div>
              <ul className="t-deliverables">
                <li className="t-lead">What you receive:</li>
                {TIER_1_DELIVERABLES.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
              <div className="t-best">
                <strong>Best when:</strong> You need to understand the problem,
                identify the opportunity and establish where the strongest
                strategic ground sits.
              </div>
              <ScopingCallCta context="Tier 1 — Intelligence" />
            </div>
            <div className="tier">
              <div className="t-tag">TIER 2 — STRATEGY</div>
              <div className="t-name">From intelligence to a complete, validated strategy.</div>
              <div className="t-desc">
                Everything in Tier 1, taken through full strategic development —
                proposition generation, competitive scoring, pressure-testing
                and brand fit validation.
              </div>
              <div className="t-desc">
                Your proposition and positioning are built out, pressure-tested
                and validated — ready to brief an agency, align stakeholders or
                build creative against.
              </div>
              <div className="t-meta">2 stages · delivered within 48 hours per stage</div>
              <div className="t-price">{TIER_PRICE}</div>
              <ul className="t-deliverables">
                <li className="t-lead">What you receive:</li>
                {TIER_2_DELIVERABLES.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
              <div className="t-note">
                Note: the fully assembled, board-ready document set (Board
                Strategy Recommendation, Strategic Platform, Brand Strategy
                Workshop, Strategy and Creative Vision) is generated once
                Creative Detonation is complete — see Tier 3. Tier 2 delivers
                the complete validated strategy itself, in full working form,
                ahead of that final assembly step.
              </div>
              <div className="t-best">
                <strong>Best when:</strong> You need a complete, validated
                strategic answer, not just a diagnosis.
              </div>
              <ScopingCallCta context="Tier 2 — Strategy" />
            </div>
            <div className="tier">
              <div className="t-tag">TIER 3 — FULL PIPELINE</div>
              <div className="t-name">Intelligence → Strategy → Creative Detonation → Campaign</div>
              <div className="t-desc">
                The complete Brand Grenade proposition.
              </div>
              <div className="t-desc">
                Everything in Tiers 1 and 2, plus Creative Detonation — Brand
                Grenade's systematic creative ideation process.
              </div>
              <div className="t-desc">
                The Creative Stimulus Engine takes the validated strategy
                through {LENS_COUNT} distinct creative lenses, generating
                genuinely different creative directions rather than multiple
                executions of the same idea.
              </div>
              <div className="t-desc">
                Those directions are scored, challenged, refined and narrowed
                into one coherent campaign platform — with the strategic
                rationale and architecture to take it into development.
              </div>
              <div className="t-meta">3 stages · delivered within 48 hours per stage</div>
              <div className="t-price">{TIER_PRICE}</div>
              <div className="price-note">
                Buy all three separately and it's {FULL_RUN_INDIVIDUAL}. Commit
                to the full run upfront and it's {FULL_RUN_PRICE} — a genuine{" "}
                {FULL_RUN_SAVING} saving.
              </div>
              <ul className="t-deliverables">
                <li className="t-lead">What you receive:</li>
                {TIER_3_DELIVERABLES.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
              <div className="t-best">
                <strong>Best when:</strong> You need to go from the strategic
                problem all the way to creative ideation, creative direction
                and a coherent campaign.
              </div>
              <ScopingCallCta context="Tier 3 — Full Pipeline" />
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="section">
          <div className="section-eyebrow">How it works</div>
          <p className="body">Staged, collaborative and transparent.</p>
          <p className="body">
            <strong>
              You get a real checkpoint at every stage — not just a finished
              result at the end.
            </strong>
          </p>
          <div className="card-grid">
            {STEPS.map((s) => (
              <div className="card" key={s.num}>
                <div className="k-num">{s.num}</div>
                <div className="k-desc">{s.desc}</div>
              </div>
            ))}
          </div>
          <p className="body">
            The process is fast. The thinking is rigorous. The reasoning is
            visible.
          </p>
          <p className="body">
            <strong>
              You are never asked to simply accept an AI-generated answer.
            </strong>
          </p>
          <ScopingCallCta context="How it works" />
        </section>

        {/* FOUNDER */}
        <section className="section">
          <div className="section-eyebrow">
            Built by someone who has sat on the other side of the table
          </div>
          <p className="body">
            Brand Grenade isn't an AI experiment built by technologists guessing
            at what strategy and creative excellence look like.
          </p>
          <p className="body">
            It's built by a creative leader with executive-level experience at
            McCann, DDB, and TBWA — a former agency board member who has twice
            built and exited his own agency. Work recognised with Cannes Lions,
            D&amp;AD, AWARD, Effie, and One Show honours, across categories
            both locally and globally.
          </p>
          <p className="body">
            Brand Grenade holds itself to the same rigour, evidence discipline,
            and creative standard that reputation was built on — systematised,
            so it can run on your brief in days instead of weeks.
          </p>
          <ScopingCallCta context="Brand Grenade Consulting" />
          <p className="btn-note">No commitment. No implementation required.</p>
        </section>
      </div>

      <footer>
        <div>
          Brand Grenade — Enterprise Brand Strategy and Creative Development
          System
        </div>
      </footer>

      <div className="sticky-cta">
        <span>
          Every stage delivered within 48 hours of your approval — guaranteed
        </span>
        <button
          type="button"
          className="nav-cta"
          onClick={() => open("Brand Grenade Consulting")}
        >
          Book a 30-minute scoping call
        </button>
      </div>
    </div>
  );
}
