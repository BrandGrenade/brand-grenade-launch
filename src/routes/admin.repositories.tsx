import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  adminLogin,
  adminLogout,
  adminStatus,
  listVisitors,
  createVisitor,
  deleteVisitor,
  resetVisitorPassword,
  setVisitorActive,
  listDocuments,
  uploadDocument,
  deleteDocument,
  getRepoStats,
  exportRepoLogCsv,
} from "@/lib/repo-admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Lock, Trash2, Download, LogOut, RotateCcw, Copy, Check, Power } from "lucide-react";

const SLUGS = ["ey", "kpmg", "deck"] as const;
type Slug = (typeof SLUGS)[number];
const SLUG_LABEL: Record<Slug, string> = { ey: "EY", kpmg: "KPMG", deck: "Deck" };

export const Route = createFileRoute("/admin/repositories")({
  head: () => ({
    meta: [
      { title: "Repositories Admin — Brand Grenade" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminRepositoriesPage,
});

function AdminRepositoriesPage() {
  const status = useServerFn(adminStatus);
  const login = useServerFn(adminLogin);
  const logout = useServerFn(adminLogout);
  const [state, setState] = useState<"loading" | "locked" | "unlocked">("loading");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const s = await status({});
      setState(s.unlocked ? "unlocked" : "locked");
    })();
  }, [status]);

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const r = await login({ data: { password } });
    if (!r.ok) {
      setError("Access denied.");
      return;
    }
    setState("unlocked");
  }

  if (state === "loading") return <div className="min-h-screen bg-white" />;

  if (state === "locked") {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <form onSubmit={onLogin} className="w-full max-w-sm space-y-6">
          <div className="flex items-center gap-3 text-neutral-900">
            <Lock className="h-5 w-5" />
            <span className="text-sm font-medium tracking-wide uppercase">Admin</span>
          </div>
          <h1 className="text-2xl font-semibold">Repositories Admin</h1>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Admin password"
            autoFocus
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full bg-neutral-900 text-white hover:bg-neutral-800">
            Enter
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <header className="border-b border-neutral-200">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/brand-grenade-icon.png" alt="Brand Grenade" className="h-6 w-6" />
            <span className="text-sm font-semibold">Repositories Admin</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await logout({});
              setState("locked");
            }}
          >
            <LogOut className="h-4 w-4 mr-1.5" /> Log out
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Tabs defaultValue="ey">
          <TabsList>
            {SLUGS.map((s) => (
              <TabsTrigger key={s} value={s}>
                {SLUG_LABEL[s]}
              </TabsTrigger>
            ))}
          </TabsList>
          {SLUGS.map((s) => (
            <TabsContent key={s} value={s} className="mt-6">
              <RepositoryAdminPanel slug={s} />
            </TabsContent>
          ))}
        </Tabs>
      </main>
    </div>
  );
}

interface Visitor {
  id: string;
  name: string;
  organisation: string | null;
  email: string | null;
  is_active: boolean;
}

interface Doc {
  id: string;
  title: string;
  description: string | null;
  file_type: string;
  storage_path: string;
  display_order: number;
}

interface Stats {
  visits: { week: number; month: number; all: number };
  visitors: Array<{
    id: string;
    name: string;
    organisation: string | null;
    email: string | null;
    visits: number;
    opens: number;
    downloads: number;
    lastAt: string | null;
  }>;
  recentLog: Array<{
    id: string;
    visitor_id: string | null;
    visitor_name: string | null;
    event_type: string;
    document_title: string | null;
    ip_address: string | null;
    created_at: string;
  }>;
}

function RepositoryAdminPanel({ slug }: { slug: Slug }) {
  const fListVisitors = useServerFn(listVisitors);
  const fCreateVisitor = useServerFn(createVisitor);
  const fDeleteVisitor = useServerFn(deleteVisitor);
  const fResetPw = useServerFn(resetVisitorPassword);
  const fSetActive = useServerFn(setVisitorActive);
  const fListDocs = useServerFn(listDocuments);
  const fUpload = useServerFn(uploadDocument);
  const fDeleteDoc = useServerFn(deleteDocument);
  const fStats = useServerFn(getRepoStats);
  const fExport = useServerFn(exportRepoLogCsv);

  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    const [v, d, s] = await Promise.all([
      fListVisitors({ data: { slug } }),
      fListDocs({ data: { slug } }),
      fStats({ data: { slug } }),
    ]);
    setVisitors(v.visitors as Visitor[]);
    setDocs(d.documents as Doc[]);
    setStats(s as Stats);
  }, [slug, fListVisitors, fListDocs, fStats]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Map visitor id -> visit count from stats
  const visitCountById = new Map<string, number>();
  stats?.visitors.forEach((v) => visitCountById.set(v.id, v.visits));

  return (
    <div className="space-y-10">
      {stats && (
        <section className="grid grid-cols-3 gap-4">
          <StatCard label="Visits this week" value={stats.visits.week} />
          <StatCard label="Visits this month" value={stats.visits.month} />
          <StatCard label="All-time visits" value={stats.visits.all} />
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
          Visitors — {SLUG_LABEL[slug]}
        </h2>
        <NewVisitorForm
          onCreate={async (input) => {
            const r = await fCreateVisitor({ data: { slug, ...input } });
            await refresh();
            return r.password;
          }}
        />
        <div className="mt-4 border border-neutral-200 rounded-lg divide-y divide-neutral-200">
          {visitors.length === 0 && (
            <div className="p-4 text-sm text-neutral-500">No visitors yet.</div>
          )}
          {visitors.map((v) => {
            const visits = visitCountById.get(v.id) ?? 0;
            const revealed = revealedPasswords[v.id];
            return (
              <div key={v.id} className="p-4 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{v.name}</p>
                      {!v.is_active && (
                        <span className="text-[10px] uppercase font-semibold text-neutral-600 bg-neutral-100 px-1.5 py-0.5 rounded">
                          Inactive
                        </span>
                      )}
                      {visits > 1 && (
                        <span className="text-[10px] uppercase font-semibold text-green-700 bg-green-50 px-1.5 py-0.5 rounded">
                          Returning
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500">
                      {v.organisation ?? ""} {v.email ? `· ${v.email}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      title="Reset password (auto-generate)"
                      onClick={async () => {
                        if (!confirm(`Reset password for ${v.name}? The new password will be shown once.`)) return;
                        const r = await fResetPw({ data: { id: v.id } });
                        setRevealedPasswords((prev) => ({ ...prev, [v.id]: r.password }));
                      }}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      title={v.is_active ? "Deactivate" : "Reactivate"}
                      onClick={async () => {
                        await fSetActive({ data: { id: v.id, active: !v.is_active } });
                        await refresh();
                      }}
                    >
                      <Power className={`h-4 w-4 ${v.is_active ? "" : "text-neutral-400"}`} />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      title="Delete permanently"
                      onClick={async () => {
                        if (!confirm(`Delete ${v.name} permanently? Prefer Deactivate to preserve history.`)) return;
                        await fDeleteVisitor({ data: { id: v.id } });
                        await refresh();
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {revealed && (
                  <PasswordReveal
                    password={revealed}
                    onDismiss={() =>
                      setRevealedPasswords((prev) => {
                        const n = { ...prev };
                        delete n[v.id];
                        return n;
                      })
                    }
                  />
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
          Documents — {SLUG_LABEL[slug]}
        </h2>
        <UploadDocForm
          onUpload={async (input) => {
            await fUpload({ data: { slug, ...input } });
            await refresh();
          }}
        />
        <div className="mt-4 border border-neutral-200 rounded-lg divide-y divide-neutral-200">
          {docs.length === 0 && (
            <div className="p-4 text-sm text-neutral-500">No documents uploaded.</div>
          )}
          {docs.map((d) => (
            <div key={d.id} className="p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  <span className="text-xs text-neutral-400 mr-2">#{d.display_order}</span>
                  {d.title}
                </p>
                {d.description && <p className="text-xs text-neutral-500">{d.description}</p>}
                <p className="text-xs text-neutral-400 uppercase">{d.file_type}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  if (!confirm(`Delete ${d.title}?`)) return;
                  await fDeleteDoc({ data: { id: d.id } });
                  await refresh();
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
            Access log — {SLUG_LABEL[slug]}
          </h2>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              const { csv } = await fExport({ data: { slug } });
              const blob = new Blob([csv], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `${slug}-access-log.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download className="h-4 w-4 mr-1.5" /> Export CSV
          </Button>
        </div>
        <div className="mt-4 border border-neutral-200 rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-neutral-50 text-neutral-500 uppercase">
              <tr>
                <th className="text-left px-3 py-2 font-medium">When</th>
                <th className="text-left px-3 py-2 font-medium">Visitor</th>
                <th className="text-left px-3 py-2 font-medium">Event</th>
                <th className="text-left px-3 py-2 font-medium">Document</th>
                <th className="text-left px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {(!stats || stats.recentLog.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-neutral-500">
                    No activity yet.
                  </td>
                </tr>
              )}
              {stats?.recentLog.map((l) => {
                const returning = l.visitor_id && (visitCountById.get(l.visitor_id) ?? 0) > 1;
                return (
                  <tr key={l.id} className="text-neutral-700">
                    <td className="px-3 py-2 text-neutral-500 whitespace-nowrap">
                      {new Date(l.created_at).toLocaleString()}
                    </td>
                    <td className="px-3 py-2">{l.visitor_name ?? "—"}</td>
                    <td className="px-3 py-2 uppercase text-neutral-500">{l.event_type}</td>
                    <td className="px-3 py-2 truncate max-w-xs">{l.document_title ?? ""}</td>
                    <td className="px-3 py-2">
                      {returning ? (
                        <span className="text-[10px] uppercase font-semibold text-green-700 bg-green-50 px-1.5 py-0.5 rounded">
                          Returning
                        </span>
                      ) : (
                        <span className="text-[10px] uppercase font-semibold text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded">
                          First visit
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-neutral-200 rounded-lg p-4">
      <p className="text-xs uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function PasswordReveal({ password, onDismiss }: { password: string; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-1 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded px-3 py-2">
      <span className="text-xs text-amber-900 shrink-0">New password (shown once):</span>
      <code className="text-xs font-mono bg-white border border-amber-200 rounded px-2 py-1 flex-1 truncate">
        {password}
      </code>
      <Button
        size="sm"
        variant="outline"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(password);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            // ignore
          }
        }}
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </Button>
      <Button size="sm" variant="ghost" onClick={onDismiss}>
        Dismiss
      </Button>
    </div>
  );
}

function NewVisitorForm({
  onCreate,
}: {
  onCreate: (v: {
    name: string;
    organisation?: string;
    email?: string;
  }) => Promise<string>;
}) {
  const [f, setF] = useState({ name: "", organisation: "", email: "" });
  const [busy, setBusy] = useState(false);
  const [issuedPassword, setIssuedPassword] = useState<string | null>(null);

  return (
    <div className="mt-3 space-y-2">
      <form
        className="grid grid-cols-1 md:grid-cols-4 gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const pw = await onCreate({
              name: f.name,
              organisation: f.organisation || undefined,
              email: f.email || undefined,
            });
            setF({ name: "", organisation: "", email: "" });
            setIssuedPassword(pw);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Input
          placeholder="Name"
          value={f.name}
          onChange={(e) => setF({ ...f, name: e.target.value })}
          required
        />
        <Input
          placeholder="Organisation"
          value={f.organisation}
          onChange={(e) => setF({ ...f, organisation: e.target.value })}
        />
        <Input
          placeholder="Email"
          type="email"
          value={f.email}
          onChange={(e) => setF({ ...f, email: e.target.value })}
        />
        <Button
          type="submit"
          disabled={busy || !f.name}
          className="bg-neutral-900 text-white hover:bg-neutral-800"
        >
          {busy ? "Adding…" : "Add visitor"}
        </Button>
      </form>
      {issuedPassword && (
        <PasswordReveal password={issuedPassword} onDismiss={() => setIssuedPassword(null)} />
      )}
    </div>
  );
}

function UploadDocForm({
  onUpload,
}: {
  onUpload: (v: {
    title: string;
    description?: string;
    fileName: string;
    fileType: "pdf" | "html" | "other";
    fileBase64: string;
    contentType: string;
    displayOrder?: number;
  }) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [order, setOrder] = useState(0);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="mt-3 space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!file) return;
        setBusy(true);
        try {
          const buf = await file.arrayBuffer();
          const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
          const ext = file.name.toLowerCase().split(".").pop() ?? "";
          const fileType: "pdf" | "html" | "other" =
            ext === "pdf" ? "pdf" : ext === "html" || ext === "htm" ? "html" : "other";
          await onUpload({
            title,
            description: description || undefined,
            fileName: file.name,
            fileType,
            fileBase64: b64,
            contentType: file.type || "application/octet-stream",
            displayOrder: order,
          });
          setTitle("");
          setDescription("");
          setFile(null);
          setOrder(0);
          (e.target as HTMLFormElement).reset();
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <Input
          placeholder="Document title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <Input
          type="number"
          placeholder="Display order"
          value={order}
          onChange={(e) => setOrder(Number(e.target.value) || 0)}
        />
        <Input
          type="file"
          accept=".pdf,.html,.htm,application/pdf,text/html"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          required
        />
      </div>
      <Textarea
        placeholder="Short description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
      />
      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={busy || !title || !file}
          className="bg-neutral-900 text-white hover:bg-neutral-800"
        >
          {busy ? "Uploading…" : "Upload document"}
        </Button>
      </div>
    </form>
  );
}
