import { createFileRoute, notFound } from "@tanstack/react-router";
import { RepositoryView } from "@/components/RepositoryView";
import { getRepositoryPublic } from "@/lib/repo.functions";

// Dynamic client repository route. Every repository — including kpmg, ey and
// deck, which used to be hardcoded route files — is resolved from the
// `repositories` table and edited via /admin/repositories.
export const Route = createFileRoute("/$repoSlug")({
  loader: async ({ params }) => {
    const slug = params.repoSlug;
    if (!/^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$/.test(slug)) throw notFound();
    const res = await getRepositoryPublic({ data: { slug } });
    if (!res.found) throw notFound();
    return { repository: res.repository };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData?.repository.title ?? "Repository — Brand Grenade" },
      {
        name: "description",
        content: `Reference resource for ${loaderData?.repository.title ?? "Brand Grenade"}.`,
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  notFoundComponent: () => (
    <div className="min-h-screen bg-card flex items-center justify-center text-text-secondary text-sm">
      Repository not found.
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="min-h-screen bg-card flex items-center justify-center text-text-secondary text-sm">
      Unable to load repository: {error.message}
    </div>
  ),
  component: DynamicRepositoryPage,
});

function DynamicRepositoryPage() {
  const { repository } = Route.useLoaderData();
  return (
    <RepositoryView
      slug={repository.slug}
      title={repository.title}
      intro={repository.intro}
      disclaimer={repository.disclaimer ?? null}
    />
  );
}
