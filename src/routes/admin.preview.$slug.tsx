import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { adminPreviewRepo } from "@/lib/repo-admin.functions";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, Eye, ArrowLeft } from "lucide-react";

type Slug = string;

export const Route = createFileRoute("/admin/preview/$slug")({
  head: () => ({
    meta: [
      { title: "Admin preview — Brand Grenade" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    visitor: typeof s.visitor === "string" ? s.visitor : undefined,
  }),
  component: AdminPreviewPage,
});

interface Doc {
  id: string;
  title: string;
  description: string | null;
  file_type: string;
  storage_path: string;
  display_order: number;
  created_at: string;
}

function AdminPreviewPage() {
  const { slug } = Route.useParams() as { slug: Slug };
  const { visitor: visitorId } = Route.useSearch();
  const load = useServerFn(adminPreviewRepo);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [visitorName, setVisitorName] = useState<string | null>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await load({ data: { slug, visitorId } });
        setDocs(r.documents as Doc[]);
        setVisitorName(r.visitor?.name ?? null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [slug, visitorId, load]);

  function handleOpen(doc: Doc, action: "open" | "download") {
    // Use the proxy route with admin=1 so HTML renders correctly and
    // no visitor access_log row is written.
    const proxyUrl = `/api/repo/view/${doc.id}?action=${action}&admin=1`;
    window.open(proxyUrl, action === "download" ? "_self" : "_blank");
  }

  if (loading) return <div className="min-h-screen bg-card" />;

  if (error) {
    return (
      <div className="min-h-screen bg-card flex items-center justify-center px-4">
        <div className="max-w-sm space-y-3 text-center">
          <p className="text-sm text-primary">{error}</p>
          <Link to="/admin/repositories" className="text-sm underline">Back to admin</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-card text-text-primary">
      <div className="bg-primary border-b border-primary">
        <div className="mx-auto max-w-3xl px-6 py-2 flex items-center justify-between text-[13px] text-primary">
          <div className="flex items-center gap-2">
            <Eye className="h-3.5 w-3.5" />
            <span>
              Admin preview{visitorName ? ` — viewing as ${visitorName}` : ""} · not logged to visitor audit trail
            </span>
          </div>
          <Link to="/admin/repositories" className="flex items-center gap-1 underline">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to admin
          </Link>
        </div>
      </div>
      <header className="border-b border-border">
        <div className="mx-auto max-w-3xl px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/brand-grenade-icon.png" alt="Brand Grenade" className="h-6 w-6" />
            <span className="text-sm font-semibold tracking-wide">Brand Grenade</span>
          </div>
          {visitorName && (
            <span className="text-[13px] text-text-secondary">Signed in as {visitorName}</span>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-semibold text-text-primary">Brand Grenade — {slug.toUpperCase()}</h1>
        <section className="mt-12">
          <h2 className="text-[13px] font-semibold uppercase tracking-wider text-text-secondary">Documents</h2>
          {docs.length === 0 ? (
            <p className="mt-4 text-sm text-text-secondary">No documents have been published to this repository yet.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {docs.map((doc) => (
                <li key={doc.id} className="rounded-lg border border-border p-5 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="text-base font-medium text-text-primary">{doc.title}</h3>
                    {doc.description && <p className="mt-1 text-sm text-text-secondary">{doc.description}</p>}
                    <p className="mt-2 text-[13px] uppercase tracking-wide text-text-secondary">{doc.file_type}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => handleOpen(doc, "open")} className="border-border">
                      <ExternalLink className="h-4 w-4 mr-1.5" /> View
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleOpen(doc, "download")} className="border-border">
                      <Download className="h-4 w-4 mr-1.5" /> Download
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
