import { createFileRoute, Link } from "@tanstack/react-router";
import {
  MarketingPage,
  MarketingNav,
  MarketingFooter,
  GOVERNING_SENTENCE,
} from "@/components/marketing/MarketingChrome";
import {
  METHODOLOGY_HEADLINE,
  STRATEGY_SCORING_DIMENSIONS,
  CREATIVE_SCORING_DIMENSIONS,
  LATERAL_ENGINE_COUNT,
  GOVERNANCE_GATE_COUNT,
  HUMAN_CONFIRMATIONS_TYPICAL_RUN,
  PROPOSITIONS_HEADLINE_CEILING,
  PROPOSITIONS_SHORTLIST_MIN,
  PROPOSITIONS_SHORTLIST_MAX,
  PIPELINE_STEPS_CLAIM,
} from "@/lib/platform-metrics";

import { LENS_COUNT } from "@/lib/stimulus/lenses";
import { STRUCTURED_OUTPUT_COUNT } from "@/lib/minto-content";

export const Route = createFileRoute("/methodology")({
  head: () => ({
    meta: [
      { title: "Brand Grenade Methodology — How The System Works" },
      {
        name: "description",
        content:
          "Research synthesis, intelligence, brief interrogation, parallel strategy, validation, creative divergence, scoring, human checkpoints, orchestration and output generation.",
      },
      { property: "og:title", content: "Brand Grenade Methodology" },
      {
        property: "og:description",
        content:
          "Systemising the strategic and creative intelligence traditionally held inside senior human teams — with human judgement integral throughout.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

const ARCHITECTURE: Array<[string, string]> = [
  [
    "Research synthesis",
    "Scan, sales, qualitative, quantitative, desktop and industry research read at claim level, classified, verified where public, and structured into one attributed evidence base.",
  ],
  [
    "Intelligence",
    "Category, culture, competitive and customer signals analysed into ranked strategic territory, confidence-calibrated, before a brief exists.",
  ],
  [
    "Brief interrogation",
    "The brief is challenged until it names the real problem and the real tension, rather than a version vague enough for everyone to agree on.",
  ],
  [
    "Parallel strategy",
    `Serious strategic routes explored simultaneously, including ${LATERAL_ENGINE_COUNT} lateral engines that deliberately attack the obvious answer.`,
  ],
  [
    "Validation",
    `${STRATEGY_SCORING_DIMENSIONS} strategic scoring dimensions plus dedicated validation rubrics — distinctiveness, brand permission, commercial precedent and historical territory checks.`,
  ],
  [
    "Creative divergence",
    `Validated territories explored through ${LENS_COUNT} creative lenses, generating divergent possibilities rather than one route developed under deadline.`,
  ],
  [
    "Creative scoring",
    `${CREATIVE_SCORING_DIMENSIONS} creative scoring dimensions applied before anything reaches a creative director for judgement.`,
  ],
  [
    "Human checkpoints",
    `${GOVERNANCE_GATE_COUNT} hard governance gates (A–F), with ${HUMAN_CONFIRMATIONS_TYPICAL_RUN} individual human confirmations across a typical full run.`,
  ],
  [
    "Orchestration",
    "Approved ideas developed and assembled into one coherent campaign system, cohesion checked across channels.",
  ],
  [
    "Output generation",
    `${STRUCTURED_OUTPUT_COUNT} structured outputs generated from the same validated source of truth, across ${PIPELINE_STEPS_CLAIM}.`,
  ],
];

function Page() {
  return (
    <MarketingPage>
      <MarketingNav />
      <div className="wrap">
        <section className="hero" style={{ paddingBottom: 56 }}>
          <div className="section-eyebrow">Methodology</div>
          <h1 className="hero-title">
            The architecture behind the <em>work</em>.
          </h1>
          <p className="hero-sub">
            Brand Grenade systemises the strategic and creative intelligence
            traditionally held inside senior human teams. {METHODOLOGY_HEADLINE}{" "}
            proven methodologies are applied inside one connected architecture,
            with human judgement integral at every decision point.
          </p>
        </section>

        <section className="section">
          <div className="section-eyebrow">Ten parts of one architecture</div>
          <h2>Each stage builds on the one before it. Nothing is reinterpreted.</h2>
          <div className="gov-grid cols-2">
            {ARCHITECTURE.map(([t, d], i) => (
              <div className="gov-card" key={t}>
                <span className="g-kicker">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="g-title">{t}</div>
                <div className="g-desc">{d}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="section">
          <div className="section-eyebrow">The philosophy</div>
          <h2>Don't commit to the first good answer.</h2>
          <p className="body">
            Up to ~{PROPOSITIONS_HEADLINE_CEILING} divergent propositions are
            generated and scored per brief, then shortlisted to{" "}
            {PROPOSITIONS_SHORTLIST_MIN}–{PROPOSITIONS_SHORTLIST_MAX} for human
            judgement. The objective isn't more options for the sake of
            options. It's finding the strongest strategic opportunity before
            committing the organisation to it.
          </p>
          <div className="callout">
            <div className="c-title">
              The machine does the work. Humans make the decisions.
            </div>
            <div className="c-body">
              Brand Grenade does not automate judgement. It automates the
              enormous amount of work surrounding judgement — research,
              divergence, testing, scoring, documentation and orchestration —
              so experienced people spend more of their time deciding what
              matters.
            </div>
          </div>
        </section>

        <section className="finalcta">
          <h2>See it produce the work.</h2>
          <p>{GOVERNING_SENTENCE}</p>
          <div className="cta-pair">
            <Link to="/demo" className="btn-primary">
              See Brand Grenade in action
            </Link>
          </div>
        </section>
      </div>
      <MarketingFooter />
    </MarketingPage>
  );
}
