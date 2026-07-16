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
import { Lock, Trash2, Upload, Download, LogOut, RotateCcw } from "lucide-react";

const SLUGS = ["ey", "kpmg", "deck"] as const;
type Slug = (typeof SLUGS)[number];

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
              <TabsTrigger key={s} value={s} className="uppercase">
                {s}
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
  const fListDocs = useServerFn(listDocuments);
  const fUpload = useServerFn(uploadDocument);
  const fDeleteDoc = useServerFn(deleteDocument);
  const fStats = useServerFn(getRepoStats);
  const fExport = useServerFn(exportRepoLogCsv);

  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);

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
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
            Visitors
          </h2>
        </div>
        <NewVisitorForm
          slug={slug}
          onCreate={async (input) => {
            await fCreateVisitor({ data: { slug, ...input } });
            await refresh();
          }}
        />
        <div className="mt-4 border border-neutral-200 rounded-lg divide-y divide-neutral-200">
          {stats?.visitors.length === 0 && (
            <div className="p-4 text-sm text-neutral-500">No visitors yet.</div>
          )}
          {stats?.visitors.map((v) => (
            <div key={v.id} className="p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{v.name}</p>
                  {v.visits > 1 && (
                    <span className="text-[10px] uppercase font-semibold text-green-700 bg-green-50 px-1.5 py-0.5 rounded">
                      Returning
                    </span>
                  )}
                </div>
                <p className="text-xs text-neutral-500">
                  {v.organisation ?? ""} {v.email ? `· ${v.email}` : ""}
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  {v.visits} visit{v.visits === 1 ? "" : "s"} · {v.opens} open · {v.downloads} download ·{" "}
                  {v.lastAt ? `last ${new Date(v.lastAt).toLocaleString()}` : "never visited"}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <ResetPwButton
                  onReset={async (pw) => {
                    await fResetPw({ data: { id: v.id, password: pw } });
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    if (!confirm(`Delete ${v.name}?`)) return;
                    await fDeleteVisitor({ data: { id: v.id } });
                    await refresh();
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
          Documents
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
                <p className="text-sm font-medium">{d.title}</p>
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
            Recent activity
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
        <div className="mt-4 border border-neutral-200 rounded-lg divide-y divide-neutral-200 max-h-96 overflow-auto">
          {stats?.recentLog.map((l) => (
            <div key={l.id} className="p-3 text-xs text-neutral-700 flex gap-3">
              <span className="text-neutral-400 w-40 shrink-0">
                {new Date(l.created_at).toLocaleString()}
              </span>
              <span className="w-28 shrink-0 uppercase text-neutral-500">{l.event_type}</span>
              <span className="w-40 shrink-0 truncate">{l.visitor_name ?? "—"}</span>
              <span className="flex-1 truncate">{l.document_title ?? ""}</span>
              <span className="text-neutral-400 truncate">{l.ip_address ?? ""}</span>
            </div>
          ))}
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

function NewVisitorForm({
  slug: _slug,
  onCreate,
}: {
  slug: Slug;
  onCreate: (v: {
    name: string;
    organisation?: string;
    email?: string;
    password: string;
  }) => Promise<void>;
}) {
  const [f, setF] = useState({ name: "", organisation: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="mt-3 grid grid-cols-1 md:grid-cols-5 gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await onCreate({
            name: f.name,
            organisation: f.organisation || undefined,
            email: f.email || undefined,
            password: f.password,
          });
          setF({ name: "", organisation: "", email: "", password: "" });
        } finally {
          setBusy(false);
        }
      }}
    >
      <Input placeholder="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
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
      <Input
        placeholder="Password (min 6)"
        value={f.password}
        onChange={(e) => setF({ ...f, password: e.target.value })}
        required
      />
      <Button
        type="submit"
        disabled={busy || !f.name || f.password.length < 6}
        className="bg-neutral-900 text-white hover:bg-neutral-800"
      >
        Add visitor
      </Button>
    </form>
  );
}

function ResetPwButton({ onReset }: { onReset: (pw: string) => Promise<void> }) {
  const [pw, setPw] = useState("");
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <RotateCcw className="h-4 w-4" />
      </Button>
    );
  }
  return (
    <div className="flex gap-1">
      <Input
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        placeholder="New password"
        className="h-8 w-40"
      />
      <Button
        size="sm"
        onClick={async () => {
          if (pw.length < 6) return;
          await onReset(pw);
          setPw("");
          setOpen(false);
        }}
      >
        Save
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
        ×
      </Button>
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <Input
          type="number"
          placeholder="Display order"
          value={order}
          onChange={(e) => setOrder(parseInt(e.target.value, 10) || 0)}
        />
      </div>
      <Textarea
        placeholder="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <Input
        type="file"
        accept=".pdf,.html,.htm"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        required
      />
      <Button
        type="submit"
        disabled={busy || !title || !file}
        className="bg-neutral-900 text-white hover:bg-neutral-800"
      >
        <Upload className="h-4 w-4 mr-1.5" /> {busy ? "Uploading…" : "Upload document"}
      </Button>
    </form>
  );
}
