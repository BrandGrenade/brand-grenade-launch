import { createFileRoute } from "@tanstack/react-router";
import { RepositoryView } from "@/components/RepositoryView";

export const Route = createFileRoute("/kpmg")({
  head: () => ({
    meta: [
      { title: "Brand Grenade — KPMG" },
      { name: "description", content: "Reference resource for Brand Grenade at KPMG Customer." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: () => (
    <RepositoryView
      slug="kpmg"
      title="Brand Grenade — KPMG"
      intro="This is your reference resource for Brand Grenade — what it is, what it does, and what it makes possible for KPMG Customer specifically. Everything here is built around KPMG Customer's specific commercial opportunity. Share it with anyone inside KPMG who needs to understand what Brand Grenade is and why it matters for your practice."
    />
  ),
});
