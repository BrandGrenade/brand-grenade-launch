import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getRepoSession,
  unlockRepo,
  logRepoVisit,
  listRepoDocuments,
  logoutRepo,
} from "@/lib/repo.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, ExternalLink, Lock, LogOut } from "lucide-react";

type Slug = string;

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
  const logout = useServerFn(logoutRepo);

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

  function handleOpen(doc: Doc, action: "open" | "download") {
    // Proxy route re-serves with correct Content-Type (Supabase Storage
    // force-serves private HTML as text/plain, blocking inline render).
    // The proxy itself writes the access_log entry.
    const proxyUrl = `/api/repo/view/${doc.id}?action=${action}`;
    window.open(proxyUrl, action === "download" ? "_self" : "_blank");
  }

  if (state === "loading") {
    return <div className="min-h-screen bg-card" />;
  }

  if (state === "locked") {
    return (
      <div className="min-h-screen bg-card flex items-center justify-center px-4">
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-6">
          <div className="flex items-center gap-3 text-text-primary">
            <Lock className="h-5 w-5" />
            <span className="text-sm font-medium tracking-wide uppercase">Restricted</span>
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-text-primary">{title}</h1>
            <p className="mt-2 text-sm text-text-secondary">
              Enter your password to access this resource.
            </p>
          </div>
          <Input
            type="password"
            autoFocus
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-card border-border text-text-primary"
            placeholder="Password"
          />
          {error && <p className="text-sm text-primary">{error}</p>}
          <Button
            type="submit"
            disabled={submitting || !password}
            className="w-full bg-card text-text-primary hover:bg-card"
          >
            {submitting ? "Checking…" : "Enter"}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-card text-text-primary">
      <header className="border-b border-border">
        <div className="mx-auto max-w-3xl px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/brand-grenade-icon.png" alt="Brand Grenade" className="h-6 w-6" />
            <span className="text-sm font-semibold tracking-wide">Brand Grenade</span>
          </div>
          <div className="flex items-center gap-4">
            {visitorName && (
              <span className="text-xs text-text-secondary">Signed in as {visitorName}</span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await logout({ data: { slug } });
                setPassword("");
                setDocs([]);
                setVisitorName("");
                setState("locked");
              }}
              className="text-text-secondary hover:text-text-primary"
            >
              <LogOut className="h-4 w-4 mr-1.5" /> Log out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-semibold text-text-primary">{title}</h1>
        <p className="mt-4 text-base leading-relaxed text-text-primary">{intro}</p>

        <section className="mt-12">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
            Documents
          </h2>
          {docs.length === 0 ? (
            <p className="mt-4 text-sm text-text-secondary">
              No documents have been published to this repository yet.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {docs.map((doc) => (
                <li
                  key={doc.id}
                  className="rounded-lg border border-border p-5 flex items-start justify-between gap-4"
                >
                  <div className="min-w-0">
                    <h3 className="text-base font-medium text-text-primary">{doc.title}</h3>
                    {doc.description && (
                      <p className="mt-1 text-sm text-text-secondary">{doc.description}</p>
                    )}
                    <p className="mt-2 text-xs uppercase tracking-wide text-text-secondary">
                      {doc.file_type}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpen(doc, "open")}
                      className="border-border bg-card text-text-primary hover:bg-card hover:text-text-primary"
                    >
                      <ExternalLink className="h-4 w-4 mr-1.5" /> View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpen(doc, "download")}
                      className="border-border bg-card text-text-primary hover:bg-card hover:text-text-primary"
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
