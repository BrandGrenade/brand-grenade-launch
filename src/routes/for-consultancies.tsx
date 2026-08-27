import { createFileRoute, Link } from "@tanstack/react-router";
import {
  MarketingPage,
  MarketingNav,
  MarketingFooter,
  GOVERNING_SENTENCE,
} from "@/components/marketing/MarketingChrome";
import {
  METHODOLOGY_HEADLINE,
  PROPOSITIONS_HEADLINE_CEILING,
  PROPOSITIONS_SHORTLIST_MIN,
  PROPOSITIONS_SHORTLIST_MAX,
  GOVERNANCE_GATE_COUNT,
  HUMAN_CONFIRMATIONS_TYPICAL_RUN,
} from "@/lib/platform-metrics";
import { STRUCTURED_OUTPUT_COUNT } from "@/lib/minto-content";

export const Route = createFileRoute("/for-consultancies")({
  head: () => ({
    meta: [
      { title: "Brand Grenade for Consultancies — A Scalable Client Capability" },
      {
        name: "description",
        content:
          "Turn brand strategy into a scalable client capability: more exploration, more throughput, less low-value production work, richer deliverables, more senior leverage.",
      },
      {
        property: "og:title",
        content: "Turn Brand Strategy Into A Scalable Client Capability",
      },
      {
        property: "og:description",
        content:
          "Augment an existing methodology, sit behind a consulting team, or become a proprietary client-facing capability.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

const BENEFITS: Array<[string, string]> = [
  [
    "More exploration",
    `Up to ~${PROPOSITIONS_HEADLINE_CEILING} divergent propositions generated and scored per brief, shortlisted to ${PROPOSITIONS_SHORTLIST_MIN}–${PROPOSITIONS_SHORTLIST_MAX} for human judgement.`,
  ],
  [
    "More strategic throughput",
    "Routes are explored in parallel rather than sequentially, so a team can run more engagements without adding headcount.",
  ],
  [
    "Less low-value production work",
    "Research synthesis, documentation and formatting are produced by the system, not by consultants at midnight.",
  ],
  [
    "Richer deliverables",
    `${STRUCTURED_OUTPUT_COUNT} structured outputs from one validated strategic source of truth — board, CMO, strategy, agency, workshop, creative and channel.`,
  ],
  [
    "More senior leverage",
    `${GOVERNANCE_GATE_COUNT} hard governance gates and ${HUMAN_CONFIRMATIONS_TYPICAL_RUN} individual human confirmations across a typical run keep partners deciding, not coordinating.`,
  ],
  [
    "A pathway beyond strategy",
    "Extend the service from strategy into creative development and activation-ready outputs, inside the same engagement.",
  ],
];

function Page() {
  return (
    <MarketingPage>
      <MarketingNav />
      <div className="wrap">
        <section className="hero" style={{ paddingBottom: 56 }}>
          <div className="section-eyebrow">For Consultancies and Big Four</div>
          <h1 className="hero-title">
            Turn brand strategy into a <em>scalable</em> client capability.
          </h1>
          <p className="hero-sub">
            Brand Grenade can augment an existing methodology, sit behind a
            consulting team as production infrastructure, or become a
            proprietary client-facing capability under your own name.
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
          <div className="section-eyebrow">Three deployment models</div>
          <h2>Behind the team, beside the methodology, or in front of the client.</h2>
          <div className="gov-grid cols-3">
            {[
              [
                "Augment",
                "Runs alongside your existing methodology — your frameworks stay authoritative, the system does the divergence, scoring and documentation.",
              ],
              [
                "Behind the team",
                "Consultants operate the system internally. Clients see your deliverables, produced faster and from a wider explored field.",
              ],
              [
                "Client-facing capability",
                "Deployed as a named capability within your practice, with governance, attribution and provenance intact.",
              ],
            ].map(([t, d]) => (
              <div className="gov-card" key={t}>
                <div className="g-title">{t}</div>
                <div className="g-desc">{d}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="section">
          <div className="section-eyebrow">What changes commercially</div>
          <h2>{METHODOLOGY_HEADLINE} proven methodologies, applied by your people.</h2>
          <div className="gov-grid cols-3">
            {BENEFITS.map(([t, d]) => (
              <div className="gov-card" key={t}>
                <div className="g-title">{t}</div>
                <div className="g-desc">{d}</div>
              </div>
            ))}
          </div>
          <div className="callout">
            <div className="c-title">
              Senior talent leverage, not senior talent replacement.
            </div>
            <div className="c-body">
              The goal isn't to remove the people. It's to remove the
              unnecessary work between the people — so partners and directors
              spend their hours on judgement, not coordination.
            </div>
          </div>
        </section>

        <section className="finalcta">
          <h2>Discuss enterprise deployment.</h2>
          <p>{GOVERNING_SENTENCE}</p>
          <div className="cta-pair">
            <Link to="/demo" className="btn-primary">
              Discuss enterprise deployment
            </Link>
            <Link to="/enterprise" className="btn-ghost">
              Enterprise and governance
            </Link>
          </div>
        </section>
      </div>
      <MarketingFooter />
    </MarketingPage>
  );
}
