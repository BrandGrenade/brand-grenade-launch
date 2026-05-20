import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Brand Grenade — Branding that detonates" },
      {
        name: "description",
        content:
          "Brand Grenade is a brutalist branding studio that blows up boring identities. Strategy, identity, and launch campaigns that explode in market.",
      },
      { property: "og:title", content: "Brand Grenade — Branding that detonates" },
      {
        property: "og:description",
        content: "A brutalist branding studio that blows up boring identities.",
      },
    ],
  }),
});

const services = [
  { n: "01", t: "Strategy", d: "Positioning, naming, and narrative that picks a fight worth winning." },
  { n: "02", t: "Identity", d: "Logos, typography, color systems built to be remembered, not approved." },
  { n: "03", t: "Launch", d: "Campaigns, sites, and content engineered for blast radius." },
  { n: "04", t: "Voice", d: "Verbal identity & copy that sounds like a human with a pulse." },
];

const work = [
  { client: "HYPERNOVA", tag: "Fintech rebrand", year: "'26" },
  { client: "GOOD DOG CO.", tag: "Identity + packaging", year: "'25" },
  { client: "RIOT COFFEE", tag: "Naming + launch", year: "'25" },
  { client: "MONOLITH", tag: "Strategy sprint", year: "'24" },
];

function Index() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* NAV */}
      <header className="border-b-2 border-ink">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-4">
          <a href="/" className="flex items-center gap-2 font-display text-lg">
            <span className="inline-block h-3 w-3 bg-blast" />
            BRAND/GRENADE
          </a>
          <nav className="hidden gap-8 font-mono text-xs uppercase md:flex">
            <a href="#work" className="hover:text-blast">Work</a>
            <a href="#services" className="hover:text-blast">Services</a>
            <a href="#manifesto" className="hover:text-blast">Manifesto</a>
            <a href="#contact" className="hover:text-blast">Contact</a>
          </nav>
          <a
            href="#contact"
            className="border-2 border-ink bg-ink px-4 py-2 font-mono text-xs uppercase text-bone shadow-brutal transition-transform hover:-translate-x-1 hover:-translate-y-1 hover:shadow-blast"
          >
            Pull the pin →
          </a>
        </div>
      </header>

      {/* HERO — asymmetric broken grid */}
      <section className="relative overflow-hidden border-b-2 border-ink">
        <div className="mx-auto grid max-w-[1400px] grid-cols-12 gap-4 px-6 py-16 md:py-24">
          <div className="col-span-12 md:col-span-8">
            <div className="mb-6 inline-flex items-center gap-2 border-2 border-ink bg-volt px-3 py-1 font-mono text-xs uppercase">
              <span className="h-2 w-2 animate-pulse bg-blast" />
              Booking Q3 · 2 slots left
            </div>
            <h1 className="font-display text-[14vw] leading-[0.85] md:text-[10rem]">
              BRANDS
              <br />
              THAT <span className="text-stroke">EXPL</span>
              <span className="inline-block text-blast pulse-blast">⊕</span>DE.
            </h1>
          </div>
          <div className="col-span-12 mt-8 md:col-span-4 md:mt-32">
            <p className="font-body text-lg leading-snug md:text-xl">
              We are a four-person branding cell that builds identities loud
              enough to be heard over the algorithm. No decks of mood. No
              committee-safe gradients. Just shrapnel.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="#work"
                className="border-2 border-ink bg-blast px-5 py-3 font-mono text-xs uppercase text-bone shadow-brutal transition-transform hover:-translate-x-1 hover:-translate-y-1"
              >
                See the damage
              </a>
              <a
                href="#contact"
                className="border-2 border-ink bg-bone px-5 py-3 font-mono text-xs uppercase shadow-brutal transition-transform hover:-translate-x-1 hover:-translate-y-1"
              >
                Brief us
              </a>
            </div>
          </div>
        </div>

        {/* Marquee */}
        <div className="overflow-hidden border-y-2 border-ink bg-ink py-3">
          <div className="marquee flex gap-12 whitespace-nowrap font-display text-2xl uppercase text-bone">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex gap-12">
                <span>STRATEGY ✦</span>
                <span className="text-blast">IDENTITY ✦</span>
                <span>LAUNCH ✦</span>
                <span className="text-volt">VOICE ✦</span>
                <span>PACKAGING ✦</span>
                <span className="text-blast">CAMPAIGNS ✦</span>
                <span>NAMING ✦</span>
                <span className="text-volt">WEBSITES ✦</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WORK */}
      <section id="work" className="border-b-2 border-ink">
        <div className="mx-auto max-w-[1400px] px-6 py-20">
          <div className="mb-12 flex items-end justify-between">
            <h2 className="text-5xl md:text-7xl">Recent<br />blasts</h2>
            <span className="font-mono text-xs uppercase">(2024–2026)</span>
          </div>
          <div className="divide-y-2 divide-ink border-y-2 border-ink">
            {work.map((w) => (
              <a
                key={w.client}
                href="#"
                className="group grid grid-cols-12 items-center gap-4 py-6 transition-colors hover:bg-blast hover:text-bone"
              >
                <span className="col-span-1 font-mono text-xs">{w.year}</span>
                <span className="col-span-7 font-display text-3xl md:text-5xl">{w.client}</span>
                <span className="col-span-3 font-mono text-xs uppercase">{w.tag}</span>
                <span className="col-span-1 text-right text-2xl transition-transform group-hover:translate-x-2">→</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* SERVICES — bento-ish asymmetric */}
      <section id="services" className="border-b-2 border-ink bg-ink text-bone">
        <div className="mx-auto max-w-[1400px] px-6 py-20">
          <div className="mb-12 grid grid-cols-12 gap-4">
            <h2 className="col-span-12 text-5xl md:col-span-7 md:text-7xl">
              What we<br />detonate
            </h2>
            <p className="col-span-12 self-end font-body text-lg md:col-span-5">
              Four services. One outcome: a brand the market can't ignore and
              your competitors can't copy without looking like a tribute act.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-0 border-2 border-bone md:grid-cols-2">
            {services.map((s, i) => (
              <div
                key={s.n}
                className={`group relative border-bone p-8 transition-colors hover:bg-blast md:p-12 ${
                  i % 2 === 0 ? "md:border-r-2" : ""
                } ${i < 2 ? "md:border-b-2" : ""} border-b-2 md:border-b-0 ${i < 2 ? "md:border-b-2" : ""}`}
              >
                <div className="mb-6 flex items-center justify-between font-mono text-xs">
                  <span>SVC/{s.n}</span>
                  <span className="opacity-60 group-hover:opacity-100">↗</span>
                </div>
                <h3 className="mb-4 text-4xl md:text-6xl">{s.t}</h3>
                <p className="font-body text-base opacity-80">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MANIFESTO */}
      <section id="manifesto" className="border-b-2 border-ink">
        <div className="mx-auto grid max-w-[1400px] grid-cols-12 gap-4 px-6 py-24">
          <div className="col-span-12 md:col-span-3">
            <span className="font-mono text-xs uppercase">// Manifesto</span>
          </div>
          <div className="col-span-12 md:col-span-9">
            <p className="font-display text-3xl leading-tight md:text-5xl">
              Safe brands die quiet. <span className="text-blast">We don't do quiet.</span>{" "}
              Every identity we ship is a thrown object — engineered to land,
              <span className="bg-volt px-2"> rearrange the room</span>, and make
              the next quarter someone else's problem.
            </p>
            <div className="mt-10 grid grid-cols-2 gap-6 border-t-2 border-ink pt-8 md:grid-cols-4">
              {[
                ["12yr", "Average client tenure"],
                ["47", "Brands launched"],
                ["3x", "Avg. recall lift"],
                ["0", "Stock photos used"],
              ].map(([k, v]) => (
                <div key={k}>
                  <div className="font-display text-4xl md:text-5xl">{k}</div>
                  <div className="mt-2 font-mono text-xs uppercase text-muted-foreground">{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="border-b-2 border-ink bg-blast text-bone">
        <div className="mx-auto max-w-[1400px] px-6 py-24">
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12 md:col-span-8">
              <span className="font-mono text-xs uppercase">// Pull the pin</span>
              <h2 className="mt-4 text-6xl md:text-9xl">
                Let's blow<br />something up.
              </h2>
            </div>
            <div className="col-span-12 mt-8 md:col-span-4 md:mt-12">
              <p className="font-body text-lg">
                Briefs read Mondays. We take three projects a quarter. If we say
                no, we'll tell you who to call.
              </p>
              <a
                href="mailto:fuse@brandgrenade.co"
                className="mt-6 inline-block border-2 border-bone bg-ink px-6 py-4 font-display text-xl uppercase text-bone transition-transform hover:-translate-x-1 hover:-translate-y-1"
              >
                fuse@brandgrenade.co →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-ink text-bone">
        <div className="mx-auto flex max-w-[1400px] flex-col items-start justify-between gap-6 px-6 py-8 md:flex-row md:items-center">
          <div className="font-mono text-xs uppercase">
            © 2026 Brand Grenade · Brooklyn / Lisbon
          </div>
          <div className="flex gap-6 font-mono text-xs uppercase">
            <a href="#" className="hover:text-blast">Instagram</a>
            <a href="#" className="hover:text-blast">Are.na</a>
            <a href="#" className="hover:text-blast">LinkedIn</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
