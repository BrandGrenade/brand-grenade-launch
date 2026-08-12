// STEP 3 · The locked winning idea, two artefacts per channel — the content
// creation input prompt and the offline creative brief — and the exports.

import { createFileRoute, Link } from "@tanstack/react-router";
import { ChannelBriefs } from "@/components/creative/ChannelBriefs";
import { useCreativeSession } from "@/routes/creative.$sessionId";

export const Route = createFileRoute("/creative/$sessionId/channels")({
  component: ChannelsStep,
  head: () => ({
    meta: [
      { title: "Step 3 · Content creation input prompts and offline creative briefs — Brand Grenade" },
      {
        name: "description",
        content:
          "Generate a tool-ready content creation input prompt and a human-facing offline creative brief for every channel from the locked winning idea, then export both.",
      },
      { property: "og:title", content: "Step 3 · Content creation input prompts and offline creative briefs — Brand Grenade" },
      {
        property: "og:description",
        content: "Two artefacts per channel from one locked idea: a tool-ready content creation input prompt and an offline creative brief.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function ChannelsStep() {
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
    <>
      <ChannelBriefs
        sessionId={session.id}
        brandName={session.brand_name ?? ""}
        channels={Object.keys(session.stage_21_outputs ?? {})}
        lockedIdea={session.locked_big_idea}
        lockedLine={session.locked_campaign_line}
        lockedLens={session.locked_big_idea_lens}
      />
      <div style={{ maxWidth: 980, margin: "36px auto 0" }}>
        <Link
          to="/creative/$sessionId/shortlist"
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
          ← Back to Step 2 · Shortlist and lock
        </Link>
      </div>
    </>
  );
}
