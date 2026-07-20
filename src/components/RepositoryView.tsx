import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getRepoSession,
  unlockRepo,
  logRepoVisit,
  listRepoDocuments,
  openRepoDocument,
} from "@/lib/repo.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, ExternalLink, Lock } from "lucide-react";

type Slug = "ey" | "kpmg" | "deck";

interface Props {
  slug: Slug;
  title: string;
  intro: string;
}

interface Doc {
  id: string;
  title: string;
  description: string | null;
  file_type: string;
  storage_path: string;
  display_order: number;
  created_at: string;
}

export function RepositoryView({ slug, title, intro }: Props) {
  const getSession = useServerFn(getRepoSession);
  const unlock = useServerFn(unlockRepo);
  const logVisit = useServerFn(logRepoVisit);
  const listDocs = useServerFn(listRepoDocuments);
  const openDoc = useServerFn(openRepoDocument);

  const [state, setState] = useState<"loading" | "locked" | "unlocked">("loading");
  const [visitorName, setVisitorName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [docs, setDocs] = useState<Doc[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const s = await getSession({ data: { slug } });
      if (!mounted) return;
      if (s.unlocked) {
        setVisitorName(s.visitorName ?? "");
        setState("unlocked");
        await logVisit({ data: { slug } });
        const { documents } = await listDocs({ data: { slug } });
        if (mounted) setDocs(documents as Doc[]);
      } else {
        setState("locked");
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const r = await unlock({ data: { slug, password } });
      if (!r.ok) {
        setError("Access denied.");
        setSubmitting(false);
        return;
      }
      setVisitorName(r.visitorName);
      setState("unlocked");
      await logVisit({ data: { slug } });
      const { documents } = await listDocs({ data: { slug } });
      setDocs(documents as Doc[]);
    } catch {
      setError("Access denied.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleOpen(doc: Doc, action: "open" | "download") {
    // Proxy route re-serves with correct Content-Type (Supabase Storage
    // force-serves private HTML as text/plain, blocking inline render).
    const proxyUrl = `/api/repo/view/${doc.id}?action=${action}`;
    window.open(proxyUrl, action === "download" ? "_self" : "_blank");
    // openRepoDocument is still called to preserve any server-side
    // side-effects for non-html flows we haven't migrated; ignore errors.
    void openDoc({ data: { slug, documentId: doc.id, action } }).catch(() => {});
  }

  if (state === "loading") {
    return <div className="min-h-screen bg-white" />;
  }

  if (state === "locked") {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-6">
          <div className="flex items-center gap-3 text-neutral-900">
            <Lock className="h-5 w-5" />
            <span className="text-sm font-medium tracking-wide uppercase">Restricted</span>
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900">{title}</h1>
            <p className="mt-2 text-sm text-neutral-600">
              Enter your password to access this resource.
            </p>
          </div>
          <Input
            type="password"
            autoFocus
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-white border-neutral-300 text-neutral-900"
            placeholder="Password"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button
            type="submit"
            disabled={submitting || !password}
            className="w-full bg-neutral-900 text-white hover:bg-neutral-800"
          >
            {submitting ? "Checking…" : "Enter"}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <header className="border-b border-neutral-200">
        <div className="mx-auto max-w-3xl px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/brand-grenade-icon.png" alt="Brand Grenade" className="h-6 w-6" />
            <span className="text-sm font-semibold tracking-wide">Brand Grenade</span>
          </div>
          {visitorName && (
            <span className="text-xs text-neutral-500">Signed in as {visitorName}</span>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-semibold text-neutral-900">{title}</h1>
        <p className="mt-4 text-base leading-relaxed text-neutral-700">{intro}</p>

        <section className="mt-12">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Documents
          </h2>
          {docs.length === 0 ? (
            <p className="mt-4 text-sm text-neutral-500">
              No documents have been published to this repository yet.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {docs.map((doc) => (
                <li
                  key={doc.id}
                  className="rounded-lg border border-neutral-200 p-5 flex items-start justify-between gap-4"
                >
                  <div className="min-w-0">
                    <h3 className="text-base font-medium text-neutral-900">{doc.title}</h3>
                    {doc.description && (
                      <p className="mt-1 text-sm text-neutral-600">{doc.description}</p>
                    )}
                    <p className="mt-2 text-xs uppercase tracking-wide text-neutral-400">
                      {doc.file_type}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpen(doc, "open")}
                      className="border-neutral-300"
                    >
                      <ExternalLink className="h-4 w-4 mr-1.5" /> View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpen(doc, "download")}
                      className="border-neutral-300"
                    >
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
