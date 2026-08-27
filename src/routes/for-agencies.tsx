import { createFileRoute, Link } from "@tanstack/react-router";
import {
  MarketingPage,
  MarketingNav,
  MarketingFooter,
  GOVERNING_SENTENCE,
} from "@/components/marketing/MarketingChrome";
import {
  CREATIVE_SCORING_DIMENSIONS,
  PROPOSITIONS_HEADLINE_CEILING,
  PROPOSITIONS_SHORTLIST_MIN,
  PROPOSITIONS_SHORTLIST_MAX,
} from "@/lib/platform-metrics";
import { LENS_COUNT } from "@/lib/stimulus/lenses";

export const Route = createFileRoute("/for-agencies")({
  head: () => ({
    meta: [
      { title: "Brand Grenade for Agencies — A Larger Strategic Field, Sooner" },
      {
        name: "description",
        content:
          "Get to the stronger creative opportunity faster: more strategic territory, more creative possibility, pressure-tested earlier, coherent from idea to channel.",
      },
      {
        property: "og:title",
        content: "Get To The Stronger Creative Opportunity Faster",
      },
      {
        property: "og:description",
        content:
          "Brand Grenade doesn't dictate the creative answer. It creates more possibility and pressure-tests the strategic foundation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <MarketingPage>
      <MarketingNav />
      <div className="wrap">
        <section className="hero" style={{ paddingBottom: 56 }}>
          <div className="section-eyebrow">For Agencies</div>
          <h1 className="hero-title">
            Get to the stronger creative opportunity <em>faster</em>.
          </h1>
          <p className="hero-sub">
            Brand Grenade gives planners and creative teams a larger strategic
            field before creative development begins. It does not dictate the
            creative answer. It creates more possibility, pressure-tests the
            strategic foundation, and helps maintain coherence from campaign
            idea through channel expression.
          </p>
          <div className="hero-ctas">
            <Link to="/demo" className="btn-primary">
              See the creative system
            </Link>
            <Link to="/methodology" className="btn-ghost">
              Read the methodology
            </Link>
          </div>
        </section>

        <section className="section">
          <div className="section-eyebrow">Before the creative starts</div>
          <h2>A bigger field in front of the team, earlier in the process.</h2>
          <div className="gov-grid cols-2">
            {[
              [
                "More strategic territory",
                `Up to ~${PROPOSITIONS_HEADLINE_CEILING} divergent propositions explored and scored, shortlisted to ${PROPOSITIONS_SHORTLIST_MIN}–${PROPOSITIONS_SHORTLIST_MAX} before anyone commits.`,
              ],
              [
                "More creative possibility",
                `${LENS_COUNT} creative lenses applied to validated territories, so the team sees the range before choosing the route.`,
              ],
              [
                "Pressure-tested earlier",
                `${CREATIVE_SCORING_DIMENSIONS} creative scoring dimensions plus dedicated validation rubrics run before senior hours are spent developing the wrong idea.`,
              ],
              [
                "Coherence held across channels",
                "Approved ideas are developed and orchestrated into one campaign system rather than fracturing into five ideas under one client name.",
              ],
            ].map(([t, d]) => (
              <div className="gov-card" key={t}>
                <div className="g-title">{t}</div>
                <div className="g-desc">{d}</div>
              </div>
            ))}
          </div>
          <div className="callout">
            <div className="c-title">
              {LENS_COUNT} ways to find the idea. One system to make it coherent.
            </div>
            <div className="c-body">
              The system generates divergent creative possibilities. Humans
              decide what has potential. The system then develops, scores and
              orchestrates the strongest approved ideas. The CD still decides
              what lives.
            </div>
          </div>
        </section>

        <section className="finalcta">
          <h2>See the creative system.</h2>
          <p>{GOVERNING_SENTENCE}</p>
          <div className="cta-pair">
            <Link to="/demo" className="btn-primary">
              See the creative system
            </Link>
          </div>
        </section>
      </div>
      <MarketingFooter />
    </MarketingPage>
  );
}
