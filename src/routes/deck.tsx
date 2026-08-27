import { createFileRoute } from "@tanstack/react-router";
import { RepositoryView } from "@/components/RepositoryView";

export const Route = createFileRoute("/deck")({
  head: () => ({
    meta: [
      { title: "Brand Grenade — Platform Overview" },
      { name: "description", content: "Complete Brand Grenade platform overview." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: () => (
    <RepositoryView
      slug="deck"
      title="Brand Grenade — Platform Overview"
      intro="This is the complete Brand Grenade platform overview — the world's first complete brand strategy, creative development, and campaign execution system. Four connected rooms. One AI-governed methodology. One audit trail from research to execution."
    />
  ),
});
