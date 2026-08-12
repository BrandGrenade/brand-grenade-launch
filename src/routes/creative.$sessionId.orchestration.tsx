// STEP 4 · Orchestration Engine, the Campaign Signature Registry and Gate Two.
//
// Deliberately its own step: Step 3 ends at Gate One confirmation per channel.
// Everything that judges the set as a whole lives here.

import { createFileRoute, Link } from "@tanstack/react-router";
import { StimulusOrchestration } from "@/components/StimulusOrchestration";
import { useCreativeSession } from "@/routes/creative.$sessionId";

export const Route = createFileRoute("/creative/$sessionId/orchestration")({
  component: OrchestrationStep,
  head: () => ({
    meta: [
      { title: "Step 4 · Orchestration, Campaign Signature Registry and Gate Two — Brand Grenade" },
      {
        name: "description",
        content:
          "Run the Orchestration Engine across every Gate One-confirmed channel prompt at once: build the Campaign Signature Registry, cross-reference, craft pass, Creative Director judgment and Gate Two sign-off.",
      },
      {
        property: "og:title",
        content: "Step 4 · Orchestration, Campaign Signature Registry and Gate Two — Brand Grenade",
      },
      {
        property: "og:description",
        content:
          "One coherent campaign, judged as a whole: registry, cross-references, craft pass, CD verdict, Gate Two.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function OrchestrationStep() {
  const { sessionId } = Route.useParams();
  const { session, loading } = useCreativeSession(sessionId);

  if (loading || !session) {
    return (
      <div className="text-body-sm" style={{ color: "#A8A29A", maxWidth: 980, margin: "0 auto" }}>
        {loading ? "Loading the session…" : "Session not found."}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 980, margin: "0 auto" }}>
      <StimulusOrchestration
        sessionId={session.id}
        brandName={session.brand_name ?? ""}
        defaultOpen
      />
      <div style={{ marginTop: 36 }}>
        <Link
          to="/creative/$sessionId/channels"
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
          ← Back to Step 3 · Channels
        </Link>
      </div>
    </div>
  );
}
