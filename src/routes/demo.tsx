import { createFileRoute } from "@tanstack/react-router";
import {
  MarketingPage,
  MarketingNav,
  MarketingFooter,
  DemoRequestForm,
} from "@/components/marketing/MarketingChrome";
import { ROOM_DEFS } from "@/lib/rooms";
import { STRUCTURED_OUTPUT_COUNT } from "@/lib/minto-content";
import { LENS_COUNT } from "@/lib/stimulus/lenses";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "See What Brand Grenade Actually Produces" },
      {
        name: "description",
        content:
          "One real brief, five connected rooms, a complete strategic, creative and activation ecosystem. Request the Brand Grenade walkthrough.",
      },
      { property: "og:title", content: "See What Brand Grenade Actually Produces" },
      {
        property: "og:description",
        content:
          "No pitch deck. No hypothetical mock-up. See the actual system and the outputs it produces.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DemoPage,
});

function DemoPage() {
  const roomWord = ROOM_DEFS.length === 5 ? "five" : String(ROOM_DEFS.length);
  return (
    <MarketingPage>
      <MarketingNav />
      <div className="wrap">
        <section className="hero" style={{ paddingBottom: 48 }}>
          <div className="section-eyebrow">The Demo</div>
          <h1 className="hero-title">
            See what Brand Grenade <em>actually</em> produces.
          </h1>
          <p className="hero-sub">
            One real brief. {roomWord.charAt(0).toUpperCase() + roomWord.slice(1)}{" "}
            connected rooms. A complete strategic, creative and activation
            ecosystem — {STRUCTURED_OUTPUT_COUNT} structured outputs from one
            source of truth, including a {LENS_COUNT}-lens creative exploration.
          </p>
          <p className="hero-weight">
            No pitch deck. No hypothetical mock-up.{" "}
            <span>The actual system and the outputs it produces.</span>
          </p>
        </section>

        <section
          className="section"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0,1fr) minmax(0,420px)",
            gap: 48,
            alignItems: "start",
          }}
        >
          <div>
            <div className="section-eyebrow">What you'll see</div>
            <h2 style={{ fontSize: 26 }}>
              The work, not a walkthrough of a slide about the work.
            </h2>
            <div className="gov-grid cols-2">
              {[
                [
                  "The brief",
                  "A real brief entering the system, interrogated until it names the actual problem and tension.",
                ],
                [
                  "The strategy",
                  "Serious routes explored in parallel, scored, pressure-tested, then shortlisted for human judgement.",
                ],
                [
                  "The creative",
                  `Validated territories explored through ${LENS_COUNT} creative lenses, scored, developed and orchestrated into one campaign.`,
                ],
                [
                  "The outputs",
                  `The board, CMO, strategy, agency, workshop, creative and channel deliverables produced from the same validated intelligence.`,
                ],
              ].map(([t, d]) => (
                <div className="gov-card" key={t}>
                  <div className="g-title">{t}</div>
                  <div className="g-desc">{d}</div>
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              background: "var(--ash)",
              border: "1px solid var(--ash2)",
              borderRadius: 6,
              padding: 28,
            }}
          >
            <DemoRequestForm heading="Request the walkthrough" />
          </div>
        </section>
      </div>
      <MarketingFooter />
    </MarketingPage>
  );
}
