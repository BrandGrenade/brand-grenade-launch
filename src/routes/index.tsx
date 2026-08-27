import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  MarketingPage,
  MarketingNav,
  MarketingFooter,
  RequestDemoModal,
  GOVERNING_SENTENCE,
} from "@/components/marketing/MarketingChrome";
import {
  STRATEGY_SCORING_DIMENSIONS,
  CREATIVE_SCORING_DIMENSIONS,
  PROPOSITIONS_HEADLINE_CEILING,
  PROPOSITIONS_SHORTLIST_MIN,
  PROPOSITIONS_SHORTLIST_MAX,
  METHODOLOGY_HEADLINE,
  LATERAL_ENGINE_COUNT,
  GOVERNANCE_GATE_COUNT,
  HUMAN_CONFIRMATIONS_TYPICAL_RUN,
  PROCESSING_HOURS_MIN,
  PROCESSING_HOURS_MAX,
} from "@/lib/platform-metrics";
import { LENS_COUNT } from "@/lib/stimulus/lenses";
import { ROOM_DEFS } from "@/lib/rooms";
import { STRUCTURED_OUTPUT_COUNT } from "@/lib/minto-content";

const ROOM_WORD = ROOM_DEFS.length === 5 ? "Five" : String(ROOM_DEFS.length);

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      {
        title: "Brand Grenade — Enterprise Brand Strategy & Creative Intelligence System",
      },
      {
        name: "description",
        content:
          "From intelligence to strategy to creative to market. One connected system for building, validating, communicating and activating brand strategy.",
      },
      {
        property: "og:title",
        content: "From Intelligence To Strategy To Creative To Market",
      },
      {
        property: "og:description",
        content:
          "One connected system for building, validating, communicating and activating brand strategy. Human judgement stays in the room. The heavy lifting doesn't.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

/* -------------------- Data -------------------- */

const JOURNEY: Array<[string, string]> = [
  ["Research", "Fragmented evidence read at claim level and attributed."],
  ["Intelligence", "Ranked strategic territory, before the brief exists."],
  ["Briefing", "The brief interrogated until it names the real tension."],
  ["Strategy", "Serious routes explored in parallel, scored, validated."],
  ["Creative", `${LENS_COUNT} lenses explored, judged, developed, orchestrated.`],
  ["Activation", "Channel and execution-ready outputs from the same source."],
];

const QUICK = [
  {
    id: "room-00",
    num: "ROOM 00 · RESEARCH SYNTHESISER — OPTIONAL",
    desc: "Turns fragmented research — scan, sales, qualitative, quantitative, desktop, industry — into one structured, attributed evidence base.",
  },
  {
    id: "room-01",
    num: "ROOM 01 · INTELLIGENCE LAB",
    desc: "Finds the strategic opportunity before the brief is written.",
  },
  {
    id: "room-02",
    num: "ROOM 02 · BRIEFING ROOM",
    desc: "Interrogates the brief until it identifies the real problem and tension.",
  },
  {
    id: "room-03",
    num: "ROOM 03 · STRATEGY PIPELINE",
    desc: "Explores serious strategic routes in parallel, validates the one that survives.",
  },
  {
    id: "room-04",
    num: "ROOM 04 · CREATIVE STIMULUS ENGINE",
    desc: `Explores ${LENS_COUNT} creative lenses, scores the possibilities, orchestrates the strongest ideas into one coherent campaign.`,
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
    num: "ROOM 00 · RESEARCH SYNTHESISER — OPTIONAL",
    name: "Research Synthesiser",
    desc: (
      <>
        Reads across scan data, sales data, qual and quant research, desktop
        research and industry reports — identifies what matters to brand
        strategy, verifies public claims, and structures the evidence for the
        Intelligence Lab. Proprietary data is attributed, never checked against
        the internet. Skippable if your research is already sorted.
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
        <br />
        (illustrative sample)
      </>
    ),
  },
  {
    id: "room-01",
    num: "ROOM 01",
    name: "Intelligence Lab",
    desc: "Finds the strategic opportunity before the brief is written — so the team never spends weeks solving a problem that was wrong from the start.",
    facts: ["Ten analytical layers", "Confidence-calibrated"],
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
    desc: "Interrogates the brief until it identifies the real problem and the real tension — because a brief vague enough for everyone to agree on is too weak for anyone to answer well.",
    facts: ["Six-step diagnostic", "Truths, not assumptions"],
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
    desc: "Explores serious strategic routes in parallel, then validates the one that survives — so the strategy in the room already beat the field, not one team's best guess under deadline.",
    facts: [
      `${METHODOLOGY_HEADLINE} methodologies`,
      `${LATERAL_ENGINE_COUNT} lateral engines`,
      `${STRATEGY_SCORING_DIMENSIONS}-dimension strategic validation`,
      "Historical territory validation",
    ],
    proof: (
      <>
        Selected · Strategic Compliance: Direct
        <br />
        Fame 8 · Uniqueness: search-verified
        <br />
        (illustrative sample)
      </>
    ),
  },
  {
    id: "room-04",
    num: "ROOM 04",
    name: "Creative Stimulus Engine",
    desc: `Explores ${LENS_COUNT} creative lenses against validated strategy. Human judgement selects the field. The system then scores, develops and orchestrates the strongest approved ideas into one coherent campaign — rather than fracturing into five different ideas under one client name.`,
    facts: [
      `${LENS_COUNT} creative lenses`,
      `${CREATIVE_SCORING_DIMENSIONS}-dimension creative scoring`,
      "Perfect Imperfection standard",
      "Signature Registry & cross-channel cohesion",
      "Live-verified against real competing campaigns",
    ],
    proof: (
      <>
        Approved territory → 6 channels
        <br />
        Cohesion: passed · CD note attached
        <br />
        (illustrative sample)
      </>
    ),
    last: true,
  },
];

const OUTPUTS: Array<[string, string, string]> = [
  [
    "Board",
    "Board Strategy Recommendation",
    "Evidence-led and decision-ready, with the reasoning available underneath.",
  ],
  [
    "CMO",
    "Strategy and Creative Vision",
    "Strategy and creative unified for executive socialisation.",
  ],
  [
    "Strategy",
    "Complete Brand Strategy",
    "Full reasoning, territories, positioning and validation.",
  ],
  [
    "Agency",
    "Agency Strategy / Creative Pitch",
    "Proposition-led, built for the teams making the work.",
  ],
  [
    "Workshop",
    "Brand Workshop",
    "Session-ready material for internal alignment.",
  ],
  [
    "Creative",
    "Creative Territories and Ideas",
    `${LENS_COUNT}-lens exploration, selection, development and orchestration.`,
  ],
  [
    "Channel",
    "Channel Briefs",
    "Execution-ready direction from the same strategic foundation.",
  ],
  [
    "Execution",
    "Creative / MarTech Prompts",
    "Tool-specific and paste-ready where required — a person takes them into the relevant tool.",
  ],
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
    <MarketingPage>
      <MarketingNav onDemo={() => setShowDemo(true)} />

      <div className="wrap">
        {/* 1 — HERO */}
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
            From intelligence to strategy to creative to <em>market</em>.
          </h1>

          <p className="hero-sub">
            One connected system for building, validating, communicating and
            activating brand strategy — raw research and briefs through
            parallel strategic reasoning, human validation and {LENS_COUNT}{" "}
            creative lenses, producing strategy, creative direction and
            activation-ready outputs.
          </p>

          <p className="hero-weight">
            Human judgement stays in the room.{" "}
            <span>The heavy lifting doesn't.</span>
          </p>

          <div className="hero-ctas">
            <button
              type="button"
              className="btn-primary"
              onClick={() => setShowDemo(true)}
            >
              See Brand Grenade in action
            </button>
            <a href="#rooms-nav" className="btn-ghost">
              Explore the system
            </a>
          </div>

          <div className="hero-stats">
            <div className="stat-row-label">The Method</div>
            <div className="stat-row">
              <div className="hstat">
                <div className="n">
                  {METHODOLOGY_HEADLINE.replace("+", "")}
                  <span>+</span>
                </div>
                <div className="l">
                  Proven strategic methodologies, applied simultaneously
                </div>
              </div>
              <div className="hstat">
                <div className="n">~{PROPOSITIONS_HEADLINE_CEILING}</div>
                <div className="l">
                  Divergent propositions generated and scored per brief,
                  shortlisted to {PROPOSITIONS_SHORTLIST_MIN}–
                  {PROPOSITIONS_SHORTLIST_MAX} for human judgement
                </div>
              </div>
              <div className="hstat">
                <div className="n">{LENS_COUNT}</div>
                <div className="l">
                  Creative lenses, orchestrated into one coherent campaign
                </div>
              </div>
            </div>
            <div className="stat-row-label">The Outcome</div>
            <div className="stat-row" style={{ marginBottom: 0 }}>
              <div className="hstat">
                <div className="n">
                  {GOVERNANCE_GATE_COUNT}
                  <span>/{HUMAN_CONFIRMATIONS_TYPICAL_RUN}</span>
                </div>
                <div className="l">
                  {GOVERNANCE_GATE_COUNT} hard governance gates (A–F), with{" "}
                  {HUMAN_CONFIRMATIONS_TYPICAL_RUN} individual human
                  confirmations across a typical full run
                </div>
              </div>
              <div className="hstat">
                <div className="n">
                  {STRATEGY_SCORING_DIMENSIONS}
                  <span>+{CREATIVE_SCORING_DIMENSIONS}</span>
                </div>
                <div className="l">
                  {STRATEGY_SCORING_DIMENSIONS} strategic scoring dimensions,{" "}
                  {CREATIVE_SCORING_DIMENSIONS} creative scoring dimensions,
                  plus dedicated validation rubrics
                </div>
              </div>
              <div className="hstat">
                <div className="n">{STRUCTURED_OUTPUT_COUNT}</div>
                <div className="l">
                  Structured outputs, every run — strategy, creative platform
                  and channel execution
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 2 — WHAT MAKES IT DIFFERENT */}
        <section className="section">
          <div className="section-eyebrow">What Makes It Different</div>
          <h2>
            Most research tools stop at intelligence. Most strategy systems stop
            at strategy. Brand Grenade keeps going.
          </h2>
          <div className="chain">
            {JOURNEY.map(([name, desc], i) => (
              <div className="chain-node" key={name}>
                <div className="cn-num">{String(i + 1).padStart(2, "0")}</div>
                <div className="cn-name">{name}</div>
                <div className="cn-desc">{desc}</div>
              </div>
            ))}
          </div>
          <p className="body">
            One connected architecture, not a set of tools bolted together.
            Every link inherits the evidence, reasoning and decisions of the one
            before it.
          </p>
        </section>

        {/* 3 — WHAT IT ACTUALLY IS */}
        <section className="section">
          <div className="section-eyebrow">What Brand Grenade Actually Is</div>
          <h2>A strategic production system.</h2>
          <p className="body">
            Research synthesis, strategic reasoning, briefing, divergent
            exploration, validation, creative development and output generation
            — combined in one connected environment, operated by the people who
            already do this work.
          </p>
        </section>

        {/* 4 — THE BOTTLENECK */}
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
            been spent. Creative develops from one route because there was never
            time to explore alternatives properly. And the most experienced
            people in the building spend their week coordinating the process
            instead of exercising the judgement they were hired for.
          </p>
          <div className="callout">
            <div className="c-title">
              Brand Grenade doesn't just compress the process. It changes its
              geometry.
            </div>
            <div className="c-body">
              Multiple serious routes are explored at once — challenged, scored
              and stress-tested before senior teams commit. People still decide,
              with a much larger field of possibility in front of them.
            </div>
          </div>
        </section>

        {/* 5 — FIVE ROOMS */}
        <section
          id="rooms-nav"
          style={{ padding: "64px 0", borderTop: "1px solid var(--ash)" }}
        >
          <div className="section-eyebrow">
            {ROOM_WORD} Rooms, One Connected System
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
              <div className="room-proof-label">Session Excerpt</div>
              <div className="room-proof-body">{room.proof}</div>
            </div>
          </div>
        ))}

        {/* 6 — THE STRATEGIC ENGINE */}
        <section className="section">
          <div className="section-eyebrow">The Strategic Engine</div>
          <h2>Don't commit to the first good answer.</h2>
          <div className="chain-row">
            <div className="chain-stat">
              <div className="n">
                {METHODOLOGY_HEADLINE.replace("+", "")}
                <span>+</span>
              </div>
              <div className="l">Proven strategic methodologies</div>
            </div>
            <div className="chain-stat">
              <div className="n">~{PROPOSITIONS_HEADLINE_CEILING}</div>
              <div className="l">
                Divergent strategic propositions explored, shortlisted to{" "}
                {PROPOSITIONS_SHORTLIST_MIN}–{PROPOSITIONS_SHORTLIST_MAX}
              </div>
            </div>
            <div className="chain-stat">
              <div className="n">{STRATEGY_SCORING_DIMENSIONS}</div>
              <div className="l">Strategic scoring dimensions</div>
            </div>
          </div>
          <div className="callout">
            <div className="c-title">
              {GOVERNANCE_GATE_COUNT} hard governance gates, with{" "}
              {HUMAN_CONFIRMATIONS_TYPICAL_RUN} individual human confirmations
              across a typical run.
            </div>
            <div className="c-body">
              The objective isn't more options for the sake of options. It's
              finding the strongest strategic opportunity before committing the
              organisation to it.
            </div>
          </div>
        </section>

        {/* 7 — CREATIVE DIFFERENTIATOR */}
        <section className="section">
          <div className="section-eyebrow">The Creative Differentiator</div>
          <h2>Strategy doesn't end with the strategy.</h2>
          <p className="body">
            Validated strategic territories are explored through {LENS_COUNT}{" "}
            creative lenses. The system generates divergent creative
            possibilities. Humans decide what has potential. The system then
            develops, scores and orchestrates the strongest approved ideas into
            one coherent campaign.
          </p>
          <div className="chain-row">
            <div className="chain-stat">
              <div className="n">{LENS_COUNT}</div>
              <div className="l">Creative lenses</div>
            </div>
            <div className="chain-stat">
              <div className="n">{CREATIVE_SCORING_DIMENSIONS}</div>
              <div className="l">Creative scoring dimensions</div>
            </div>
            <div className="chain-stat">
              <div className="n">1</div>
              <div className="l">Coherent campaign system</div>
            </div>
          </div>
          <div className="callout">
            <div className="c-title">
              {LENS_COUNT} ways to find the idea. One system to make it coherent.
            </div>
            <div className="c-body">
              Exploration, judgement, development, orchestration — in that
              order, with a creative director deciding what lives.
            </div>
          </div>
        </section>

        {/* 8 — OUTPUT ECOSYSTEM */}
        <section className="section" id="outputs">
          <div className="section-eyebrow">The Output Ecosystem</div>
          <h2>
            One strategic source of truth. Every output the organisation needs.
          </h2>
          <div className="gov-grid">
            {OUTPUTS.map(([kicker, title, desc]) => (
              <div className="gov-card" key={title}>
                <span className="g-kicker">{kicker.toUpperCase()}</span>
                <div className="g-title">{title}</div>
                <div className="g-desc">{desc}</div>
              </div>
            ))}
          </div>
          <div className="callout">
            <div className="c-title">
              One strategy. Different outputs for everyone who has to act on it.
            </div>
            <div className="c-body">
              The same validated intelligence, translated into the specific
              outputs different stakeholders need — {STRUCTURED_OUTPUT_COUNT}{" "}
              structured deliverables per full run.
            </div>
          </div>
        </section>

        {/* 9 — THE COMMERCIAL CONSEQUENCE */}
        <section className="section">
          <div className="section-eyebrow">The Commercial Consequence</div>
          <h2>The old model was built for sequential thinking.</h2>
          <div className="compare2">
            <div className="col">
              <div className="col-label">Sequential model</div>
              <ul>
                <li>Research, handed over</li>
                <li>Strategy, handed over</li>
                <li>Planning, handed over</li>
                <li>Creative, handed over</li>
                <li>Activation — meaning lost at every handoff</li>
              </ul>
            </div>
            <div className="col hot">
              <div className="col-label">Brand Grenade connects the chain</div>
              <ul>
                <li>Research to Intelligence</li>
                <li>Intelligence to Brief</li>
                <li>Brief to Strategy</li>
                <li>Strategy to Creative</li>
                <li>Creative to activation-ready outputs</li>
              </ul>
            </div>
          </div>
          <div className="callout">
            <div className="c-title">
              The goal isn't to remove the people. It's to remove the
              unnecessary work between the people.
            </div>
            <div className="c-body">
              Brand Grenade is senior talent leverage, not senior talent
              replacement.
            </div>
          </div>
        </section>

        {/* 10 — WHO IT IS FOR */}
        <section className="section">
          <div className="section-eyebrow">Who It Is For</div>
          <h2>Built for the people who have to turn strategy into action.</h2>
          <div className="gov-grid cols-3">
            <Link to="/for-cmos" className="gov-card">
              <span className="g-kicker">CMOS &amp; ENTERPRISE</span>
              <div className="g-title">
                From intelligence to an actionable brand system
              </div>
              <div className="g-desc">
                Board-ready strategy, CMO-ready socialisation, agency-ready
                direction, channel-ready outputs — one source of truth.
                <br />
                <br />
                Request a CMO demo →
              </div>
            </Link>
            <Link to="/for-consultancies" className="gov-card">
              <span className="g-kicker">CONSULTANCIES &amp; BIG FOUR</span>
              <div className="g-title">
                A scalable strategic capability, not a one-off project
              </div>
              <div className="g-desc">
                Explore more routes, increase consultant leverage, reduce
                low-value research and documentation work, produce richer
                deliverables, and extend the service from strategy into creative
                and activation.
                <br />
                <br />
                Discuss enterprise deployment →
              </div>
            </Link>
            <Link to="/for-agencies" className="gov-card">
              <span className="g-kicker">AGENCIES</span>
              <div className="g-title">
                More possibility before the team commits
              </div>
              <div className="g-desc">
                Explore more strategic territory, develop more creative
                possibilities, pressure-test earlier, and hold campaign cohesion
                across channels.
                <br />
                <br />
                See the creative system →
              </div>
            </Link>
          </div>
        </section>

        {/* 11 — HUMAN JUDGEMENT */}
        <section className="section">
          <div className="section-eyebrow">Human Judgement</div>
          <h2>The machine does the work. Humans make the decisions.</h2>
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
            Brand Grenade does not automate judgement. It automates the enormous
            amount of work surrounding judgement — research, divergence,
            testing, scoring, documentation and orchestration — so experienced
            people can spend more of their time deciding what matters.
          </p>
          <p className="body">
            The researcher still decides what matters. The planner still
            determines the opportunity. The CD still decides what lives.
          </p>
        </section>

        {/* 12 — PROOF OF SCALE */}
        <section className="section">
          <div className="section-eyebrow">Proof Of Scale</div>
          <h2>Architectural proof, not a feature list.</h2>
          <div className="gov-grid cols-3">
            {[
              [`${METHODOLOGY_HEADLINE}`, "Strategic methodologies"],
              [
                `~${PROPOSITIONS_HEADLINE_CEILING}`,
                `Strategic routes explored, shortlisted to ${PROPOSITIONS_SHORTLIST_MIN}–${PROPOSITIONS_SHORTLIST_MAX}`,
              ],
              [`${LENS_COUNT}`, "Creative lenses"],
              [
                `${STRATEGY_SCORING_DIMENSIONS}+${CREATIVE_SCORING_DIMENSIONS}`,
                "Strategic and creative scoring dimensions",
              ],
              [
                `${STRUCTURED_OUTPUT_COUNT}`,
                "Structured strategic, creative and activation outputs",
              ],
              [
                `${PROCESSING_HOURS_MIN}–${PROCESSING_HOURS_MAX} hrs`,
                "System processing time per full run",
              ],
            ].map(([n, l]) => (
              <div className="gov-card" key={l}>
                <div
                  className="display"
                  style={{ fontSize: 34, marginBottom: 6 }}
                >
                  {n}
                </div>
                <div className="g-desc">{l}</div>
              </div>
            ))}
          </div>
          <p className="body" style={{ marginTop: 24 }}>
            {PROCESSING_HOURS_MIN}–{PROCESSING_HOURS_MAX} hours is system
            processing time, observed rather than telemetry-aggregated. It is
            not an unattended machine replacing a professional engagement:
            human judgement and {GOVERNANCE_GATE_COUNT} governance gates remain
            part of the process throughout.
          </p>
        </section>

        {/* 13 — THE DEMO */}
        <section className="finalcta" id="contact">
          <h2>See Brand Grenade actually produce the work.</h2>
          <p>
            One real brief. {ROOM_WORD.toLowerCase()} connected rooms. A
            complete strategic, creative and activation ecosystem. No pitch
            deck. No hypothetical mock-up. See the actual system and the outputs
            it produces.
          </p>
          <div className="cta-pair">
            <button
              type="button"
              className="btn-primary"
              onClick={() => setShowDemo(true)}
            >
              See Brand Grenade in action
            </button>
            <Link to="/enterprise" className="btn-ghost">
              Discuss enterprise deployment
            </Link>
          </div>
        </section>

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
            <i>→</i>
            <b>Activation</b>
          </div>
          <p>{GOVERNING_SENTENCE}</p>
        </section>
      </div>

      <MarketingFooter />

      {showDemo && <RequestDemoModal onClose={() => setShowDemo(false)} />}
    </MarketingPage>
  );
}
