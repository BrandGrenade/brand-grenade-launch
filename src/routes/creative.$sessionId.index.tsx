// STEP 1 · The 37-lens sweep. Generate and judge — Keep, Keep in play, Kill.
// Locking a winner is deliberately not possible here; that lives on Step 2.

import { createFileRoute, Link } from "@tanstack/react-router";
import { BigIdeaSweep } from "@/components/BigIdeaSweep";

const AMBER = "#F2665F";

export const Route = createFileRoute("/creative/$sessionId/")({
  component: SweepStep,
  head: () => ({
    meta: [
      { title: "Step 1 · 37-lens sweep — Brand Grenade" },
      {
        name: "description",
        content:
          "Run all 37 creative lenses against the proposition and judge each idea: keep, keep in play, or kill.",
      },
      { property: "og:title", content: "Step 1 · 37-lens sweep — Brand Grenade" },
      {
        property: "og:description",
        content: "Generate and triage 37 creative directions against the proposition.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function SweepStep() {
  const { sessionId } = Route.useParams();
  return (
    <>
      <BigIdeaSweep sessionId={sessionId} mode="sweep" />
      <div style={{ maxWidth: 980, margin: "36px auto 0", textAlign: "right" }}>
        <Link
          to="/creative/$sessionId/shortlist"
          params={{ sessionId }}
          className="text-mono"
          style={{
            display: "inline-block",
            border: `1px solid ${AMBER}`,
            backgroundColor: `${AMBER}18`,
            color: AMBER,
            borderRadius: 8,
            padding: "12px 18px",
            fontSize: 11,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            textDecoration: "none",
          }}
        >
          Go to Step 2 · Shortlist the kept ideas →
        </Link>
      </div>
    </>
  );
}
