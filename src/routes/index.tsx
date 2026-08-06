import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { submitDemoRequest } from "@/lib/demo-request.functions";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Brand Grenade — Brand Strategy & Creative Intelligence System" },
      {
        name: "description",
        content:
          "Brand Grenade takes a brand from raw intelligence to validated strategy to orchestrated creative — in hours, not weeks. Four connected rooms, 50+ methodologies, 37 creative lenses.",
      },
      {
        property: "og:title",
        content: "Brand Grenade — Brand Strategy & Creative Intelligence System",
      },
      {
        property: "og:description",
        content:
          "From raw intelligence to validated strategy to orchestrated creative — in hours, not weeks. Human judgement stays in the room.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

/* -------------------- Design system (scoped) -------------------- */

const CSS = `
.bg-home{--void:#0A0908;--ash:#1C1A18;--ash2:#252220;--paper:#EDE8E0;--smoke:#8B8680;
  --detonation:#C81E1E;--detonation-dim:rgba(200,30,30,0.1);--detonation-line:rgba(200,30,30,0.35);
  background:var(--void);color:var(--paper);font-family:'Inter',sans-serif;-webkit-font-smoothing:antialiased;min-height:100vh}
.bg-home *,.bg-home *::before,.bg-home *::after{box-sizing:border-box}
.bg-home .display{font-family:'Bebas Neue',sans-serif;letter-spacing:.01em}
.bg-home .wrap{max-width:1080px;margin:0 auto;padding:0 48px}
@media (max-width:720px){.bg-home .wrap{padding:0 22px}}

.bg-home nav{position:sticky;top:0;z-index:50;background:rgba(10,9,8,0.92);backdrop-filter:blur(8px);border-bottom:1px solid var(--ash)}
.bg-home .nav-inner{max-width:1080px;margin:0 auto;padding:16px 48px;display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap}
@media (max-width:720px){.bg-home .nav-inner{padding:14px 22px}}
.bg-home .nav-logo{display:flex;align-items:center;gap:10px;flex-shrink:0}
.bg-home .nav-mark{font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:.04em}
.bg-home .nav-signin{color:var(--smoke);font-size:13px;font-weight:500;text-decoration:none;flex-shrink:0;transition:color .2s}
.bg-home .nav-signin:hover{color:var(--paper)}
.bg-home .nav-cta{background:var(--detonation);color:var(--paper);font-size:13px;font-weight:600;padding:9px 18px;border-radius:3px;text-decoration:none;border:none;cursor:pointer;font-family:inherit}
.bg-home .nav-rooms{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.bg-home .nav-rooms a{color:var(--smoke);text-decoration:none;font-size:11px;font-weight:600;letter-spacing:.02em;white-space:nowrap;transition:color .2s}
.bg-home .nav-rooms a:hover{color:var(--paper)}
.bg-home .nav-arrow{color:var(--ash2);font-size:11px}

.bg-home .hero{padding:100px 0 80px}
@media (max-width:720px){.bg-home .hero{padding:56px 0 48px}}
.bg-home .pin-row{display:flex;align-items:center;gap:24px;margin-bottom:48px}
.bg-home .pin{width:12px;height:12px;border-radius:50%;background:var(--paper);opacity:.2;flex-shrink:0;transition:background .4s,opacity .4s,box-shadow .4s}
.bg-home .pin.armed{background:var(--detonation);opacity:1;box-shadow:0 0 0 5px var(--detonation-dim)}
.bg-home .pin-line{flex:1;height:1px;background:var(--ash2)}
.bg-home .pin-label{font-size:10px;color:var(--smoke);letter-spacing:.08em;text-transform:uppercase;white-space:nowrap}
@media (max-width:720px){.bg-home .pin-label{display:none}}
.bg-home h1.hero-title{font-family:'Bebas Neue',sans-serif;font-size:clamp(48px,6.5vw,80px);line-height:.96;margin-bottom:24px;max-width:20ch;font-weight:400}
.bg-home h1.hero-title em{font-style:normal;color:var(--detonation)}
.bg-home .hero-sub{font-size:17px;color:var(--smoke);max-width:56ch;line-height:1.65;margin-bottom:28px}
.bg-home .hero-weight{font-size:17px;font-weight:600;color:var(--paper);margin-bottom:36px}
.bg-home .hero-weight span{color:var(--detonation)}
.bg-home .hero-ctas{display:flex;gap:16px;flex-wrap:wrap}
.bg-home .btn-primary{background:var(--detonation);color:var(--paper);font-size:14px;font-weight:600;padding:14px 26px;border-radius:3px;text-decoration:none;border:none;cursor:pointer;font-family:inherit}
.bg-home .btn-ghost{border:1px solid var(--ash2);color:var(--paper);font-size:14px;font-weight:500;padding:13px 26px;border-radius:3px;text-decoration:none}
.bg-home .hero-stats{margin-top:64px}
.bg-home .stat-row-label{font-size:10px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--smoke);margin-bottom:8px}
.bg-home .stat-row{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--ash);border:1px solid var(--ash);margin-bottom:24px}
@media (max-width:720px){.bg-home .stat-row{grid-template-columns:1fr}}
.bg-home .hstat{background:var(--void);padding:24px 20px}
.bg-home .hstat .n{font-family:'Bebas Neue',sans-serif;font-size:34px;color:var(--paper)}
.bg-home .hstat .n span{color:var(--detonation)}
.bg-home .hstat .l{font-size:13px;color:var(--smoke);margin-top:6px;line-height:1.5}

.bg-home .section{padding:80px 0;border-top:1px solid var(--ash)}
@media (max-width:720px){.bg-home .section{padding:56px 0}}
.bg-home .section-eyebrow{font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--smoke);margin-bottom:16px}
.bg-home .section h2{font-size:34px;max-width:26ch;margin-bottom:28px;font-weight:600;font-family:'Inter',sans-serif;line-height:1.2}
.bg-home .section p.body{font-size:15px;color:var(--smoke);line-height:1.75;max-width:64ch;margin-bottom:18px}
.bg-home .callout{background:var(--ash);border:1px solid var(--detonation-line);border-radius:6px;padding:26px;max-width:70ch;margin-top:34px}
.bg-home .callout .c-title{font-size:16px;font-weight:600;color:var(--paper);margin-bottom:10px}
.bg-home .callout .c-body{font-size:15px;color:var(--smoke);line-height:1.7}

.bg-home .quicknav{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--ash);border:1px solid var(--ash)}
@media (max-width:900px){.bg-home .quicknav{grid-template-columns:1fr 1fr}}
@media (max-width:560px){.bg-home .quicknav{grid-template-columns:1fr}}
.bg-home .qcard{background:var(--void);padding:24px 20px;text-decoration:none;color:inherit;display:block;transition:background .2s}
.bg-home .qcard:hover{background:var(--ash)}
.bg-home .qcard .q-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
.bg-home .qcard .q-num{font-family:'Bebas Neue',sans-serif;font-size:13px;color:var(--detonation);letter-spacing:.1em}
.bg-home .qcard .q-arrow{color:var(--ash2);font-size:14px}
.bg-home .qcard .q-desc{font-size:13px;color:var(--smoke);line-height:1.55}

.bg-home .room{padding:56px 0;border-top:1px solid var(--ash);display:grid;grid-template-columns:64px 1fr 1fr;gap:32px}
@media (max-width:820px){.bg-home .room{grid-template-columns:28px 1fr;gap:20px}.bg-home .room-proof{grid-column:2}}
.bg-home .room-pin-col{display:flex;flex-direction:column;align-items:center;padding-top:4px}
.bg-home .room-pin{width:16px;height:16px;border-radius:50%;background:var(--detonation);box-shadow:0 0 0 5px var(--detonation-dim);flex-shrink:0}
.bg-home .room-pin-line{width:1px;flex:1;background:var(--ash2);margin-top:12px}
.bg-home .room-num{font-family:'Bebas Neue',sans-serif;font-size:13px;color:var(--detonation);letter-spacing:.1em;margin-bottom:8px}
.bg-home .room-name{font-size:26px;font-weight:600;margin-bottom:14px;font-family:'Inter',sans-serif}
.bg-home .room-desc{font-size:14px;color:var(--smoke);line-height:1.65;margin-bottom:16px}
.bg-home .room-facts{display:flex;flex-wrap:wrap;gap:8px}
.bg-home .room-fact{font-size:11px;color:var(--paper);background:var(--ash);border:1px solid var(--ash2);padding:5px 10px;border-radius:3px}
.bg-home .room-proof{background:var(--ash);border:1px solid var(--ash2);border-radius:6px;padding:22px 24px;align-self:start}
.bg-home .room-proof-label{font-size:10px;color:var(--smoke);letter-spacing:.08em;text-transform:uppercase;margin-bottom:12px}
.bg-home .room-proof-body{font-size:13px;color:var(--paper);line-height:1.7;font-family:monospace}
.bg-home .redacted{background:var(--smoke);color:var(--smoke);border-radius:2px;padding:0 2px}

.bg-home .rhythm{display:flex;flex-direction:column;gap:1px;background:var(--ash);border:1px solid var(--ash);margin:36px 0;max-width:52ch}
.bg-home .rhythm-row{background:var(--void);padding:16px 22px;display:flex;align-items:center;gap:16px}
.bg-home .rhythm-row .who{font-size:12px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;width:88px;flex-shrink:0}
.bg-home .rhythm-row .who.machine{color:var(--detonation)}
.bg-home .rhythm-row .who.human{color:var(--smoke)}
.bg-home .rhythm-row .what{font-size:14px;color:var(--paper)}

.bg-home .closing{padding:88px 0;border-top:1px solid var(--ash)}
.bg-home .closing h2{font-family:'Bebas Neue',sans-serif;font-size:clamp(34px,4.6vw,52px);font-weight:400;margin-bottom:24px}
.bg-home .seq{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:28px}
.bg-home .seq b{font-size:13px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--paper)}
.bg-home .seq i{font-style:normal;color:var(--detonation);font-size:13px}
.bg-home .closing p{font-size:16px;color:var(--smoke);line-height:1.75;max-width:64ch}

.bg-home .finalcta{padding:100px 0;border-top:1px solid var(--ash);text-align:center}
.bg-home .finalcta h2{font-size:clamp(36px,5vw,56px);margin-bottom:20px;font-family:'Bebas Neue',sans-serif;font-weight:400}
.bg-home .finalcta p{color:var(--smoke);font-size:15px;margin-bottom:32px;max-width:56ch;margin-left:auto;margin-right:auto;line-height:1.7}
.bg-home .footer-byline{font-size:12px;color:var(--smoke);margin-top:16px;line-height:1.6;text-align:center;width:100%;max-width:640px;margin-left:auto;margin-right:auto}
.bg-home .footer-byline + .footer-byline{margin-top:8px}
.bg-home footer{border-top:1px solid var(--ash);padding:32px 0;text-align:center;font-size:13px;color:var(--smoke)}

/* ---------- Mobile ---------- */
@media (max-width:720px){
  .bg-home{overflow-x:hidden}
  .bg-home .nav-inner{gap:12px;flex-wrap:nowrap}
  .bg-home .nav-rooms{display:none}
  .bg-home .nav-mark{font-size:16px}
  .bg-home .nav-cta{padding:10px 14px;font-size:13px}
  .bg-home .nav-signin{font-size:13px}
  .bg-home .pin-row{gap:14px;margin-bottom:32px}
  .bg-home h1.hero-title{font-size:clamp(40px,11vw,58px);max-width:none;margin-bottom:20px}
  .bg-home .hero-sub,.bg-home .hero-weight{font-size:16px}
  .bg-home .hero-ctas{flex-direction:column;align-items:stretch;gap:12px}
  .bg-home .hero-ctas .btn-primary,.bg-home .hero-ctas .btn-ghost{
    display:block;width:100%;text-align:center;padding:16px 20px;font-size:15px}
  .bg-home .hero-stats{margin-top:44px}
  .bg-home .section h2{font-size:26px;max-width:none}
  .bg-home .closing{padding:64px 0}
  .bg-home .finalcta{padding:64px 0}
  .bg-home .room{padding:44px 0;grid-template-columns:1fr;gap:16px}
  .bg-home .room-pin-col{flex-direction:row;align-items:center;gap:12px;padding-top:0}
  .bg-home .room-pin-line{width:100%;height:1px;flex:1;margin-top:0}
  .bg-home .room-proof{grid-column:auto;padding:18px}
  .bg-home .room-proof-body{font-size:13px;word-break:break-word}
  .bg-home .room-name{font-size:22px}
  .bg-home .rhythm{max-width:none}
  .bg-home .rhythm-row{padding:14px 16px;gap:12px}
  .bg-home .rhythm-row .who{width:72px;font-size:12px}
  .bg-home .callout{padding:20px}
}

/* ---------- Demo request sheet ---------- */
.bg-demo-overlay{position:fixed;inset:0;z-index:100;display:flex;align-items:center;
  justify-content:center;background:rgba(10,9,8,0.86);padding:24px;overflow-y:auto;
  -webkit-overflow-scrolling:touch}
.bg-demo-panel{width:100%;max-width:460px;background:var(--ash);border:1px solid var(--ash2);
  border-radius:6px;padding:32px}
.bg-demo-field{width:100%;background:var(--void);border:1px solid var(--ash2);border-radius:3px;
  color:var(--paper);padding:12px 12px;font-size:16px;font-family:inherit;-webkit-appearance:none}
.bg-demo-field:focus{outline:none;border-color:var(--detonation)}
@media (max-width:720px){
  .bg-demo-overlay{padding:0;align-items:stretch;justify-content:stretch}
  .bg-demo-panel{max-width:none;border:none;border-radius:0;min-height:100dvh;
    padding:24px 20px calc(32px + env(safe-area-inset-bottom));display:flex;flex-direction:column}
  .bg-demo-field{padding:14px 12px}
  .bg-demo-panel .btn-primary{width:100%;padding:16px 20px;font-size:16px}
}
`;

/* -------------------- Data -------------------- */

const QUICK = [
  {
    id: "room-00",
    num: "00 · RESEARCH SYNTHESISER — OPTIONAL",
    desc: "Turn disparate research — scan data, sales data, qualitative, quantitative, desktop, industry reports — into one structured, attributed evidence base.",
  },
  {
    id: "room-01",
    num: "01 · INTELLIGENCE LAB",
    desc: "Turn research, culture, category and competitive signals into ranked strategic territory — before a brief is even written.",
  },
  {
    id: "room-02",
    num: "02 · BRIEFING ROOM",
    desc: "Interrogate the brief until it names the real tension, and answers it rather than avoiding it.",
  },
  {
    id: "room-03",
    num: "03 · STRATEGY PIPELINE",
    desc: "Explore every serious strategic route in parallel, then validate the one that survives against real precedent.",
  },
  {
    id: "room-04",
    num: "04 · CREATIVE ENGINE",
    desc: "Generate 37 divergent creative territories, score them, and orchestrate the strongest approved ideas into one campaign.",
  },
];

type Room = {
  id: string;
  num: string;
  name: string;
  desc: React.ReactNode;
  facts: string[];
  proof: React.ReactNode;
  last?: boolean;
};

const R = ({ n }: { n: number }) => (
  <span className="redacted">{"█".repeat(n)}</span>
);

const ROOMS: Room[] = [
  {
    id: "room-00",
    num: "ROOM 00 — OPTIONAL",
    name: "Research Synthesiser",
    desc: (
      <>
        Reads across scan data, sales data, qual and quant research, desktop research, and industry reports — identifies what matters to brand strategy, verifies public claims, and automatically structures the evidence in Intelligence Lab. Your proprietary data is never checked against the internet, only clearly attributed. Skippable — go straight to Intelligence Lab if your research is already sorted.
        <br />
        Extract → Classify → Verify → Structure
      </>
    ),
    facts: [
      "PDF, DOCX, PPTX, XLSX, CSV, TXT",
      "Claim-level extraction",
      "Public claims live-verified",
      "Proprietary data attributed, never exposed",
    ],
    proof: (
      <>
        14 claims · 9 externally verifiable
        <br />
        5 client-proprietary · filed across 4 headings
      </>
    ),
  },
  {
    id: "room-01",
    num: "ROOM 01",
    name: "Intelligence Lab",
    desc: "Finds the real opportunity before a single word of brief gets written — so the team never spends weeks solving a problem that was wrong from the start.",
    facts: ["8 analytical layers", "Confidence-calibrated"],
    proof: (
      <>
        Territory 04 — Confidence: High
        <br />"<R n={16} /> ownership,
        <br />
        not <R n={8} />, is the open lane."
      </>
    ),
  },
  {
    id: "room-02",
    num: "ROOM 02",
    name: "Briefing Room",
    desc: "Forces the brief to answer the hard question instead of avoiding it — because a brief vague enough for everyone to agree on is too weak for anyone to actually answer well.",
    facts: ["6-step diagnostic", "Truths, not assumptions"],
    proof: (
      <>
        Tension: <R n={8} /> demands trust,
        <br />
        the audience has already
        <br />
        been burned by <R n={8} />.
      </>
    ),
  },
  {
    id: "room-03",
    num: "ROOM 03",
    name: "Strategy Pipeline",
    desc: "Searches every serious direction at once, then proves the one that survives — so the strategy in the room already beat the twenty that didn't, not one team's best guess under deadline.",
    facts: [
      "50+ methodologies",
      "16 lateral engines",
      "Six-dimension strategic validation",
      "Historical territory validation",
    ],
    proof: (
      <>
        Selected · Strategic Compliance: Direct
        <br />
        Fame 8 · Uniqueness: search-verified
      </>
    ),
  },
  {
    id: "room-04",
    num: "ROOM 04",
    name: "Creative Engine",
    desc: "Generates 37 divergent creative territories at once. Human judgement selects the field. The system then scores, develops and orchestrates the strongest ideas into one coherent campaign — built to the standard of the best creative teams, without fracturing into five different ideas under one client name.",
    facts: [
      "37 creative lenses",
      "Eight-dimension creative scoring",
      "Perfect Imperfection standard",
      "Signature Registry & cross-channel cohesion",
      "Live-verified against every real competing campaign",
    ],
    proof: (
      <>
        Approved territory → 6 channels
        <br />
        Cohesion: passed · CD note attached
      </>
    ),
    last: true,
  },
];

const RHYTHM: Array<[string, string]> = [
  ["Machine", "Generates"],
  ["Humans", "Judge"],
  ["Machine", "Validates"],
  ["Humans", "Approve"],
  ["Machine", "Orchestrates"],
  ["Humans", "Sign off"],
];

/* -------------------- Page -------------------- */

function Index() {
  const navigate = useNavigate();
  const { user, isAuthReady } = useAuth();
  const [showDemo, setShowDemo] = useState(false);
  const [armed, setArmed] = useState(0);

  useEffect(() => {
    if (isAuthReady && user) navigate({ to: "/dashboard" });
  }, [isAuthReady, user, navigate]);

  useEffect(() => {
    const t = window.setInterval(
      () => setArmed((a) => (a >= 4 ? 4 : a + 1)),
      420,
    );
    return () => window.clearInterval(t);
  }, []);

  return (
    <div className="bg-home">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <nav>
        <div className="nav-inner">
          <a
            href="#hero"
            className="nav-logo"
            style={{ textDecoration: "none", color: "inherit" }}
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            <img
              src="/brand-grenade-icon.png"
              alt="Brand Grenade"
              width={22}
              height={22}
              style={{ display: "block" }}
            />
            <div className="nav-mark">BRAND GRENADE</div>
          </a>
          <div className="nav-rooms">
            <a href="#room-00">Research Synthesiser</a>
            <span className="nav-arrow">→</span>
            <a href="#room-01">Intelligence Lab</a>
            <span className="nav-arrow">→</span>
            <a href="#room-02">Briefing Room</a>
            <span className="nav-arrow">→</span>
            <a href="#room-03">Strategy Pipeline</a>
            <span className="nav-arrow">→</span>
            <a href="#room-04">Creative Engine</a>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <Link to="/login" className="nav-signin">
              Sign in
            </Link>
            <button
              type="button"
              className="nav-cta"
              onClick={() => setShowDemo(true)}
            >
              Request a demo
            </button>
          </div>
        </div>
      </nav>

      <div className="wrap">
        {/* HERO */}
        <section className="hero" id="hero">
          <div className="pin-row">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="contents">
                <div className={`pin${i < armed ? " armed" : ""}`} />
                {i < 3 && <div className="pin-line" />}
              </div>
            ))}
            <span className="pin-label">
              Enterprise Brand Strategy and Creative Intelligence System
            </span>
          </div>

          <h1 className="hero-title">
            The intelligence system for brand strategy <em>and creative.</em>
          </h1>

          <p className="hero-sub">
            Brand Grenade takes a brand from raw intelligence to validated
            strategy to orchestrated creative — in hours, not weeks. Proven
            methodologies, lateral engines and creative intelligence run in
            parallel so the strongest opportunity is identified,
            pressure-tested, and turned into distinctive work that stays
            coherent from first idea to final channel.
          </p>

          <p className="hero-weight">
            Human judgement stays in the room.{" "}
            <span>The heavy lifting doesn't.</span>
          </p>

          <div className="hero-ctas">
            <a href="#walkthrough" className="btn-primary">
              Follow a real brief through it ↓
            </a>
            <a href="#rooms-nav" className="btn-ghost">
              See the five rooms
            </a>
          </div>

          <div className="hero-stats">
            <div className="stat-row-label">The Method</div>
            <div className="stat-row">
              <div className="hstat">
                <div className="n">
                  50<span>+</span>
                </div>
                <div className="l">
                  Proven strategic methodologies, applied simultaneously
                </div>
              </div>
              <div className="hstat">
                <div className="n">
                  20<span>+</span>
                </div>
                <div className="l">
                  Divergent strategic propositions, explored in parallel
                </div>
              </div>
              <div className="hstat">
                <div className="n">37</div>
                <div className="l">
                  Creative lenses, orchestrated into one coherent campaign
                </div>
              </div>
            </div>
            <div className="stat-row-label">The Outcome</div>
            <div className="stat-row" style={{ marginBottom: 0 }}>
              <div className="hstat">
                <div className="n">
                  2–4<span>hrs</span>
                </div>
                <div className="l">
                  Raw intelligence to finished creative direction
                </div>
              </div>
              <div className="hstat">
                <div className="n">14</div>
                <div className="l">
                  Scoring dimensions applied across strategy and creative,
                  before anything reaches a human for sign-off
                </div>
              </div>
              <div className="hstat">
                <div className="n">23</div>
                <div className="l">
                  Structured outputs, every run — strategy, creative platform,
                  and channel execution
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FOUR ROOMS QUICK NAV */}
        <section
          id="rooms-nav"
          style={{ padding: "64px 0", borderTop: "1px solid var(--ash)" }}
        >
          <div className="section-eyebrow">
            The Five Rooms — One Connected System
          </div>
          <div className="quicknav">
            {QUICK.map((q) => (
              <a key={q.id} href={`#${q.id}`} className="qcard">
                <div className="q-top">
                  <span className="q-num">{q.num}</span>
                  <span className="q-arrow">→</span>
                </div>
                <div className="q-desc">{q.desc}</div>
              </a>
            ))}
          </div>
        </section>

        {/* THE BOTTLENECK */}
        <section className="section">
          <div className="section-eyebrow">The Bottleneck</div>
          <h2>
            The problem isn't intelligence. It's the work required to turn
            intelligence into a decision.
          </h2>
          <p className="body">
            Research arrives fragmented — category, culture, competitor and
            customer evidence sitting in separate documents, owned by separate
            people, never fully reconciled. Strategic routes get explored
            sequentially rather than in parallel, so the team commits to one
            direction long before it knows what the alternatives would have
            produced. Validation arrives late, after senior hours have already
            been spent developing a route nobody has yet pressure-tested.
            Creative develops in a single direction because there was never
            time to develop more than one properly. And the most experienced
            people in the building spend the majority of their week
            coordinating the process instead of exercising the judgement they
            were hired for.
          </p>
          <div className="callout">
            <div className="c-title">
              Brand Grenade doesn't compress that process. It changes its
              geometry.
            </div>
            <div className="c-body">
              Instead of one route explored slowly, many routes are explored at
              once — challenged, scored, and stress-tested before a single
              senior hour is spent developing the wrong one. The planner, the
              strategist and the CD arrive at the decision with the field
              already in front of them, not with one option and a deadline.
            </div>
          </div>
        </section>

        {/* WALKTHROUGH INTRO */}
        <section
          className="section"
          id="walkthrough"
          style={{ paddingBottom: 24 }}
        >
          <div className="section-eyebrow">Not A Claim — A Walkthrough</div>
          <h2 style={{ marginBottom: 16 }}>
            Follow one real brief through all five rooms.
          </h2>
          <p className="body">
            Every excerpt below is a real, redacted extract from an actual
            session — not a mockup. Identifying details removed; the mechanism
            is exactly what runs today.
          </p>
        </section>

        {/* ROOMS */}
        {ROOMS.map((room) => (
          <div className="room" id={room.id} key={room.id}>
            <div className="room-pin-col">
              <div className="room-pin" />
              {!room.last && <div className="room-pin-line" />}
            </div>
            <div className="room-content">
              <div className="room-num">{room.num}</div>
              <div className="room-name">{room.name}</div>
              <div className="room-desc">{room.desc}</div>
              <div className="room-facts">
                {room.facts.map((f) => (
                  <div className="room-fact" key={f}>
                    {f}
                  </div>
                ))}
              </div>
            </div>
            <div className="room-proof">
              <div className="room-proof-label">Live Session Excerpt</div>
              <div className="room-proof-body">{room.proof}</div>
            </div>
          </div>
        ))}

        {/* HUMAN GOVERNANCE */}
        <section className="section">
          <div className="section-eyebrow">What Doesn't Change</div>
          <h2>
            The researcher still decides what matters. The planner still
            determines the opportunity. The CD still decides what lives.
          </h2>
          <div className="rhythm">
            {RHYTHM.map(([who, what]) => (
              <div className="rhythm-row" key={what}>
                <span
                  className={`who ${who === "Machine" ? "machine" : "human"}`}
                >
                  {who}
                </span>
                <span className="what">{what}</span>
              </div>
            ))}
          </div>
          <p className="body">
            Brand Grenade does not automate judgement. It automates the
            enormous amount of work that surrounds judgement — the research,
            the divergence, the testing, the scoring, the documentation — so
            the people making the real decisions are making them on a stronger
            foundation, faster.
          </p>
        </section>

        {/* CLOSING STATEMENT */}
        <section className="closing">
          <h2>From possibility to decision.</h2>
          <div className="seq">
            <b>Research</b>
            <i>→</i>
            <b>Intelligence</b>
            <i>→</i>
            <b>Briefing</b>
            <i>→</i>
            <b>Strategy</b>
            <i>→</i>
            <b>Creative</b>
          </div>
          <p>
            Research goes in. Every room builds on the one before it — nothing
            skipped, nothing reinterpreted. Nothing gets lost between the
            strategy deck and the work.
          </p>
        </section>

        {/* FINAL CTA */}
        <section className="finalcta" id="contact">
          <h2>See the system at work.</h2>
          <p>
            Request a demo. See exactly what the system produces — not a
            pitch, the capability itself.
          </p>
          <button
            type="button"
            className="btn-primary"
            onClick={() => setShowDemo(true)}
          >
            Request a demo
          </button>
        </section>
      </div>

      <footer>
        <div>Brand Grenade — Enterprise Brand Strategy and Creative Intelligence System</div>
        <div className="footer-byline">
          Brand Grenade was built by Adrian Pritchard, a brand strategist and creative director who has worked at McCann, DDB, and TBWA. His work has been recognised at Cannes, One Show, D&AD, and AWARD. It was built to systemise the strategic and creative intelligence that has traditionally lived inside senior human teams — without removing human judgement from the process.
        </div>
      </footer>

      {showDemo && <RequestDemoModal onClose={() => setShowDemo(false)} />}
    </div>
  );
}

/* -------------------- Modal -------------------- */

const fieldStyle: React.CSSProperties = { resize: "vertical" };

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  color: "var(--smoke)",
  marginBottom: 6,
  letterSpacing: ".04em",
  textTransform: "uppercase",
};

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
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="bg-demo-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-heading"
      onClick={onClose}
    >
      <div
        className="bg-demo-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 22,
          }}
        >
          <h2
            id="demo-heading"
            className="display"
            style={{ fontSize: 28, fontWeight: 400, color: "var(--paper)" }}
          >
            {done ? "Request received" : "Request a demo"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "none",
              border: "none",
              color: "var(--smoke)",
              cursor: "pointer",
              fontSize: 16,
            }}
          >
            ✕
          </button>
        </div>

        {done ? (
          <>
            <p style={{ fontSize: 14, color: "var(--smoke)", lineHeight: 1.7 }}>
              Thanks — we'll be in touch.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="btn-primary"
              style={{ marginTop: 24, width: "100%" }}
            >
              Close
            </button>
          </>
        ) : (
          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: 16 }}
          >
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
              <label htmlFor="demo-message" style={labelStyle}>
                Message (optional)
              </label>
              <textarea
                id="demo-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="bg-demo-field"
                style={fieldStyle}
                rows={4}
                maxLength={2000}
              />
            </div>

            {error && (
              <p style={{ fontSize: 13, color: "var(--detonation)" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary"
              style={{ opacity: submitting ? 0.6 : 1 }}
            >
              {submitting ? "Sending…" : "Send request"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
