import { createFileRoute, Link } from "@tanstack/react-router";
import {
  MarketingPage,
  MarketingNav,
  MarketingFooter,
  GOVERNING_SENTENCE,
} from "@/components/marketing/MarketingChrome";
import { STRUCTURED_OUTPUT_COUNT } from "@/lib/minto-content";
import {
  GOVERNANCE_GATE_COUNT,
  HUMAN_CONFIRMATIONS_TYPICAL_RUN,
} from "@/lib/platform-metrics";

export const Route = createFileRoute("/for-cmos")({
  head: () => ({
    meta: [
      { title: "Brand Grenade for CMOs — From Intelligence To An Actionable System" },
      {
        name: "description",
        content:
          "One strategic source of truth instead of multiple disconnected interpretations: board-ready strategy, CMO socialisation, agency direction and channel-ready outputs.",
      },
      {
        property: "og:title",
        content: "From Brand Intelligence To An Actionable Brand System",
      },
      {
        property: "og:description",
        content:
          "Evidence to decision to board to CMO to agency to creative to channel — from one connected strategic source of truth.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

const CHAIN: Array<[string, string]> = [
  ["Evidence", "Research read at claim level, attributed and verified."],
  ["Decision", "Routes explored in parallel, scored, shortlisted for judgement."],
  ["Board", "Evidence-led recommendation, decision-ready."],
  ["CMO", "Strategy and creative vision, unified for socialisation."],
  ["Agency", "Proposition-led direction for the teams making the work."],
  ["Creative", "Territories explored, selected, developed, orchestrated."],
  ["Channel", "Execution-ready briefs from the same strategic foundation."],
];

function Page() {
  return (
    <MarketingPage>
      <MarketingNav />
      <div className="wrap">
        <section className="hero" style={{ paddingBottom: 56 }}>
          <div className="section-eyebrow">For CMOs and Enterprise Marketing Teams</div>
          <h1 className="hero-title">
            From brand intelligence to an <em>actionable</em> brand system.
          </h1>
          <p className="hero-sub">
            One strategic source of truth instead of multiple disconnected
            interpretations — board-ready strategy, CMO-ready socialisation,
            agency-ready direction and channel-ready outputs, all traceable to
            the same validated intelligence.
          </p>
          <div className="hero-ctas">
            <Link to="/demo" className="btn-primary">
              Request a CMO demo
            </Link>
            <Link to="/methodology" className="btn-ghost">
              Read the methodology
            </Link>
          </div>
        </section>

        <section className="section">
          <div className="section-eyebrow">One connected chain</div>
          <h2>Evidence to decision to board to CMO to agency to creative to channel.</h2>
          <div className="chain">
            {CHAIN.map(([name, desc], i) => (
              <div className="chain-node" key={name}>
                <div className="cn-num">{String(i + 1).padStart(2, "0")}</div>
                <div className="cn-name">{name}</div>
                <div className="cn-desc">{desc}</div>
              </div>
            ))}
          </div>
          <p className="body">
            Each link inherits the one before it. Nothing is reinterpreted
            between the strategy deck and the work, and nothing is lost between
            the agency brief and the channel execution.
          </p>
        </section>

        <section className="section">
          <div className="section-eyebrow">What lands on your desk</div>
          <h2>{STRUCTURED_OUTPUT_COUNT} structured outputs, one strategy behind all of them.</h2>
          <div className="gov-grid cols-2">
            {[
              [
                "Board Strategy Recommendation",
                "Evidence-led and decision-ready, with the reasoning available underneath.",
              ],
              [
                "Strategy and Creative Vision",
                "Unified for executive socialisation, so the story holds in the room.",
              ],
              [
                "Agency Strategy / Creative Pitch",
                "Proposition-led direction built for the teams making the work.",
              ],
              [
                "Channel Briefs",
                "Execution-ready direction derived from the same strategic foundation.",
              ],
            ].map(([t, d]) => (
              <div className="gov-card" key={t}>
                <div className="g-title">{t}</div>
                <div className="g-desc">{d}</div>
              </div>
            ))}
          </div>
          <div className="callout">
            <div className="c-title">Human judgement stays in the room.</div>
            <div className="c-body">
              {GOVERNANCE_GATE_COUNT} hard governance gates (A–F), with{" "}
              {HUMAN_CONFIRMATIONS_TYPICAL_RUN} individual human confirmations
              across a typical full run. Nothing reaches a board pack that a
              named person did not approve.
            </div>
          </div>
        </section>

        <section className="finalcta">
          <h2>Request a CMO demo.</h2>
          <p>{GOVERNING_SENTENCE}</p>
          <div className="cta-pair">
            <Link to="/demo" className="btn-primary">
              Request a CMO demo
            </Link>
          </div>
        </section>
      </div>
      <MarketingFooter />
    </MarketingPage>
  );
}
