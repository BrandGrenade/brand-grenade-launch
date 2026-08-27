import { createFileRoute, Link } from "@tanstack/react-router";
import {
  MarketingPage,
  MarketingNav,
  MarketingFooter,
  GOVERNING_SENTENCE,
} from "@/components/marketing/MarketingChrome";
import {
  GOVERNANCE_GATE_COUNT,
  HUMAN_CONFIRMATIONS_TYPICAL_RUN,
  STRATEGY_SCORING_DIMENSIONS,
  CREATIVE_SCORING_DIMENSIONS,
} from "@/lib/platform-metrics";

import { STRUCTURED_OUTPUT_COUNT } from "@/lib/minto-content";

export const Route = createFileRoute("/enterprise")({
  head: () => ({
    meta: [
      { title: "Brand Grenade Enterprise — Deployment, Governance, Provenance" },
      {
        name: "description",
        content:
          "How Brand Grenade is deployed inside an enterprise: governance gates, proprietary research handling, attribution, verification and output provenance.",
      },
      { property: "og:title", content: "Brand Grenade Enterprise" },
      {
        property: "og:description",
        content:
          "Deployment, governance, data handling, attribution, verification, human checkpoints and output provenance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

/**
 * Every claim on this page maps to behaviour implemented in the platform:
 * governance gates (checkpoint-gate), claim-level attribution and
 * classification (Research Synthesiser), live verification of public claims
 * (fact-verify), and per-document source authority (document-source-authority).
 * Do not add a security or compliance claim here without a corresponding
 * implementation to point at.
 */
const GOVERNANCE: Array<[string, string]> = [
  [
    "Human checkpoints",
    `${GOVERNANCE_GATE_COUNT} hard governance gates (A–F) block progression until a named human confirms. A typical full run records ${HUMAN_CONFIRMATIONS_TYPICAL_RUN} individual human confirmations.`,
  ],
  [
    "Proprietary research handling",
    "Client-proprietary material is used for analysis and attributed to its source document. It is not checked against the internet and is never published into externally verifiable claims.",
  ],
  [
    "Attribution",
    "Research is extracted at claim level and each claim carries its source document and heading through every downstream stage.",
  ],
  [
    "Verification",
    "Publicly checkable claims are live-verified during synthesis, and verification status travels with the claim into strategy and creative.",
  ],
  [
    "Output provenance",
    `Every one of the ${STRUCTURED_OUTPUT_COUNT} structured outputs is built from the recorded stage outputs of a specific session — across ${PIPELINE_STEPS_CLAIM} — not regenerated freehand at export time.`,
  ],
  [
    "Scoring transparency",
    `${STRATEGY_SCORING_DIMENSIONS} strategic and ${CREATIVE_SCORING_DIMENSIONS} creative scoring dimensions are recorded per candidate, so any selection can be re-inspected after the fact.`,
  ],
];

function Page() {
  return (
    <MarketingPage>
      <MarketingNav />
      <div className="wrap">
        <section className="hero" style={{ paddingBottom: 56 }}>
          <div className="section-eyebrow">Enterprise</div>
          <h1 className="hero-title">
            Deployed with <em>governance</em>, attribution and provenance intact.
          </h1>
          <p className="hero-sub">
            Brand Grenade is used on real client work, so the parts that matter
            to an enterprise — who approved what, where a claim came from, and
            which session produced a given document — are recorded rather than
            asserted.
          </p>
          <div className="hero-ctas">
            <Link to="/demo" className="btn-primary">
              Discuss enterprise deployment
            </Link>
            <Link to="/methodology" className="btn-ghost">
              Read the methodology
            </Link>
          </div>
        </section>

        <section className="section">
          <div className="section-eyebrow">Governance and data handling</div>
          <h2>What the system records, and what it refuses to do.</h2>
          <div className="gov-grid cols-2">
            {GOVERNANCE.map(([t, d]) => (
              <div className="gov-card" key={t}>
                <div className="g-title">{t}</div>
                <div className="g-desc">{d}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="section">
          <div className="section-eyebrow">Implementation</div>
          <h2>Deployment shape is decided with you, not published as a tier.</h2>
          <p className="body">
            Implementation covers access and roles for your team, how
            proprietary research enters the system, which outputs your
            stakeholders need, and who holds each governance gate. Partner and
            white-label arrangements are discussed case by case where they are
            genuinely available.
          </p>
          <p className="body">
            Commercial terms follow the deployment model. Pricing is discussed
            once we understand how the system will be used, by whom, and at
            what volume.
          </p>
        </section>

        <section className="finalcta">
          <h2>Discuss enterprise deployment.</h2>
          <p>{GOVERNING_SENTENCE}</p>
          <div className="cta-pair">
            <Link to="/demo" className="btn-primary">
              Discuss enterprise deployment
            </Link>
          </div>
        </section>
      </div>
      <MarketingFooter />
    </MarketingPage>
  );
}
