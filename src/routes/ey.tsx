import { createFileRoute } from "@tanstack/react-router";
import { RepositoryView } from "@/components/RepositoryView";

export const Route = createFileRoute("/ey")({
  head: () => ({
    meta: [
      { title: "Brand Grenade — EY" },
      { name: "description", content: "Reference resource for Brand Grenade at EY." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: () => (
    <RepositoryView
      slug="ey"
      title="Brand Grenade — EY"
      intro="This is your reference resource for Brand Grenade — what it is, what it does, and what it makes possible for EY specifically. Everything here is built around EY's specific commercial opportunity. Share it with anyone inside EY who needs to understand what Brand Grenade is and why it matters for your practice."
    />
  ),
});
