import { createFileRoute, notFound } from "@tanstack/react-router";
import { RepositoryView } from "@/components/RepositoryView";
import { getRepositoryPublic } from "@/lib/repo.functions";

// Dynamic client repository route. Static routes (kpmg/ey/deck) take precedence
// so nothing changes for existing repositories; any other slug is resolved
// from the `repositories` table (created via /admin/repositories).
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
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  notFoundComponent: () => (
    <div className="min-h-screen bg-white flex items-center justify-center text-neutral-500 text-sm">
      Repository not found.
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="min-h-screen bg-white flex items-center justify-center text-neutral-500 text-sm">
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
    />
  );
}
