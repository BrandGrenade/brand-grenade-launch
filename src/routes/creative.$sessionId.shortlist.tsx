// STEP 2 · The shortlist. Only ideas kept on Step 1 appear here, and this is
// the only screen where a winning idea and a winning line can be locked.

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { BigIdeaSweep } from "@/components/BigIdeaSweep";

const AMBER = "#F2665F";

export const Route = createFileRoute("/creative/$sessionId/shortlist")({
  component: ShortlistStep,
  head: () => ({
    meta: [
      { title: "Step 2 · Shortlist and lock — Brand Grenade" },
      {
        name: "description",
        content:
          "Review the ideas kept from the sweep, rate them at Gate One, and lock one winning idea and one winning line.",
      },
      { property: "og:title", content: "Step 2 · Shortlist and lock — Brand Grenade" },
      {
        property: "og:description",
        content: "Lock one winning idea and one winning line before any channel work begins.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function ShortlistStep() {
  const { sessionId } = Route.useParams();
  const navigate = useNavigate();
  return (
    <>
      <BigIdeaSweep
        sessionId={sessionId}
        mode="shortlist"
        onLocked={() => {
          void navigate({ to: "/creative/$sessionId/channels", params: { sessionId } });
        }}
      />
      <div
        style={{
          maxWidth: 980,
          margin: "36px auto 0",
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <Link
          to="/creative/$sessionId"
          params={{ sessionId }}
          className="text-mono"
          style={{
            border: "1px solid #2A2724",
            color: "#EDE8E0",
            borderRadius: 8,
            padding: "12px 18px",
            fontSize: 11,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            textDecoration: "none",
          }}
        >
          ← Back to Step 1 · Sweep
        </Link>
        <Link
          to="/creative/$sessionId/channels"
          params={{ sessionId }}
          className="text-mono"
          style={{
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
          Go to Step 3 · Channel briefs and export →
        </Link>
      </div>
    </>
  );
}
