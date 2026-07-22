import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  adminLogin,
  adminLogout,
  adminStatus,
  unlockRepositoryAdminFromPlatform,
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
  listAllVisitorsAccess,
} from "@/lib/repo-admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Lock, Trash2, Download, LogOut, KeyRound, Copy, Check, Power, Eye, EyeOff } from "lucide-react";

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
  const unlockFromPlatform = useServerFn(unlockRepositoryAdminFromPlatform);
  const [state, setState] = useState<"loading" | "locked" | "unlocked">("loading");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const s = await status({});
      if (s.unlocked) {
        setState("unlocked");
        return;
      }
      try {
        const platform = await unlockFromPlatform({});
        setState(platform.ok ? "unlocked" : "locked");
      } catch {
        setState("locked");
      }
    })();
  }, [status, unlockFromPlatform]);

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
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">All Access</TabsTrigger>
            {SLUGS.map((s) => (
              <TabsTrigger key={s} value={s}>
                {SLUG_LABEL[s]}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="all" className="mt-6">
            <AllAccessPanel />
          </TabsContent>
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
  plaintext_password: string | null;
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

interface AllAccessRow {
  id: string;
  name: string;
  organisation: string | null;
  email: string | null;
  is_active: boolean;
  created_at: string;
  repository_slug: Slug;
  last_active_at: string | null;
  plaintext_password: string | null;
}

function AllAccessPanel() {
  const fList = useServerFn(listAllVisitorsAccess);
  const fResetPw = useServerFn(resetVisitorPassword);
  const fSetActive = useServerFn(setVisitorActive);
  const [rows, setRows] = useState<AllAccessRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSlug, setFilterSlug] = useState<"all" | Slug>("all");
  const [query, setQuery] = useState("");
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [showPw, setShowPw] = useState<Record<string, boolean>>({});

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fList({});
      setRows(r.rows as AllAccessRow[]);
    } finally {
      setLoading(false);
    }
  }, [fList]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const now = Date.now();
  const ACTIVE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // last 30 days = "active"

  const filtered = rows.filter((r) => {
    if (filterSlug !== "all" && r.repository_slug !== filterSlug) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      (r.organisation ?? "").toLowerCase().includes(q) ||
      (r.email ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
            All visitors — across every repository
          </h2>
          <p className="mt-1 text-xs text-neutral-500">
            One register of who has access, where, and when they last used it.
            Passwords are one-way hashed — use Reset password to issue a new one.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterSlug}
            onChange={(e) => setFilterSlug(e.target.value as "all" | Slug)}
            className="h-9 rounded-md border border-neutral-300 bg-white px-2 text-sm"
          >
            <option value="all">All repositories</option>
            {SLUGS.map((s) => (
              <option key={s} value={s}>{SLUG_LABEL[s]}</option>
            ))}
          </select>
          <Input
            placeholder="Search name, org, email"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 w-64"
          />
        </div>
      </div>

      <div className="border border-neutral-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500 uppercase text-xs">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Visitor</th>
              <th className="text-left px-3 py-2 font-medium">Repository</th>
              <th className="text-left px-3 py-2 font-medium">Password</th>
              <th className="text-left px-3 py-2 font-medium">Created</th>
              <th className="text-left px-3 py-2 font-medium">Last active</th>
              <th className="text-left px-3 py-2 font-medium">Status</th>
              <th className="text-right px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {loading && (
              <tr><td colSpan={7} className="px-3 py-6 text-neutral-500">Loading…</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-neutral-500">No visitors match.</td></tr>
            )}
            {filtered.map((r) => {
              const lastMs = r.last_active_at ? new Date(r.last_active_at).getTime() : null;
              const isActive = r.is_active && lastMs !== null && now - lastMs < ACTIVE_WINDOW_MS;
              return (
                <tr key={r.id} className="align-top">
                  <td className="px-3 py-3">
                    <div className="font-medium text-neutral-900">{r.name}</div>
                    <div className="text-xs text-neutral-500">
                      {r.organisation ?? ""}{r.email ? ` · ${r.email}` : ""}
                    </div>
                    {revealed[r.id] && (
                      <div className="mt-2">
                        <PasswordReveal
                          password={revealed[r.id]}
                          onDismiss={() =>
                            setRevealed((prev) => {
                              const n = { ...prev };
                              delete n[r.id];
                              return n;
                            })
                          }
                        />
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3 text-neutral-700">{SLUG_LABEL[r.repository_slug]}</td>
                  <td className="px-3 py-3">
                    {r.plaintext_password ? (
                      <div className="flex items-center gap-1.5">
                        <code className="text-xs font-mono bg-neutral-100 border border-neutral-200 rounded px-2 py-1">
                          {showPw[r.id] ? r.plaintext_password : "••••••••"}
                        </code>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2"
                          title={showPw[r.id] ? "Hide password" : "Show password"}
                          onClick={() => setShowPw((p) => ({ ...p, [r.id]: !p[r.id] }))}
                        >
                          {showPw[r.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </Button>
                        {showPw[r.id] && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2"
                            title="Copy password"
                            onClick={async () => {
                              try { await navigator.clipboard.writeText(r.plaintext_password!); } catch { /* ignore */ }
                            }}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-neutral-400 italic">Not stored — reset to view</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-neutral-500 text-xs whitespace-nowrap">
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-3 text-neutral-500 text-xs whitespace-nowrap">
                    {r.last_active_at ? new Date(r.last_active_at).toLocaleString() : "—"}
                  </td>
                  <td className="px-3 py-3">
                    {!r.is_active ? (
                      <span className="text-[10px] uppercase font-semibold text-neutral-600 bg-neutral-100 px-1.5 py-0.5 rounded">Disabled</span>
                    ) : isActive ? (
                      <span className="text-[10px] uppercase font-semibold text-green-700 bg-green-50 px-1.5 py-0.5 rounded">Active</span>
                    ) : (
                      <span className="text-[10px] uppercase font-semibold text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded">Inactive</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          const pw = window.prompt(`New password for ${r.name} (${SLUG_LABEL[r.repository_slug]}) — min 6 characters:`);
                          if (!pw) return;
                          if (pw.length < 6) { alert("Password must be at least 6 characters."); return; }
                          const res = await fResetPw({ data: { id: r.id, password: pw } });
                          setRevealed((prev) => ({ ...prev, [r.id]: res.password }));
                          await refresh();
                        }}
                      >
                        <KeyRound className="h-4 w-4 mr-1.5" /> Set password
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        title={r.is_active ? "Deactivate visitor" : "Reactivate visitor"}
                        onClick={async () => {
                          await fSetActive({ data: { id: r.id, active: !r.is_active } });
                          await refresh();
                        }}
                      >
                        <Power className={`h-4 w-4 mr-1.5 ${r.is_active ? "" : "text-neutral-400"}`} />
                        {r.is_active ? "Deactivate" : "Reactivate"}
                      </Button>
                    </div>
                  </td>

                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
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
        <p className="mt-2 text-xs text-neutral-500">
          Shareable link for this repository: <code className="font-mono">https://brandgrenade.app/{slug}</code>
          {" "}— same URL for every visitor of this repo; each visitor uses their own password.
        </p>

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
                    <div className="mt-2">
                      <VisitorPasswordInline password={v.plaintext_password} />
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <a
                      href={`/admin/preview/${slug}?visitor=${v.id}`}
                      target="_blank"
                      rel="noreferrer"
                      title={`View repository as ${v.name} (no audit log entry)`}
                      className="inline-flex items-center justify-center h-9 px-3 rounded-md border border-neutral-300 text-sm hover:bg-neutral-50"
                    >
                      <Eye className="h-4 w-4 mr-1.5" /> View as
                    </a>
                    <SetPasswordButton
                      visitorName={v.name}
                      onSet={async (password) => {
                        const r = await fResetPw({ data: { id: v.id, password } });
                        setRevealedPasswords((prev) => ({ ...prev, [v.id]: r.password }));
                        await refresh();
                      }}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      title={v.is_active ? "Deactivate visitor" : "Reactivate visitor"}
                      onClick={async () => {
                        await fSetActive({ data: { id: v.id, active: !v.is_active } });
                        await refresh();
                      }}
                    >
                      <Power className={`h-4 w-4 mr-1.5 ${v.is_active ? "" : "text-neutral-400"}`} />
                      {v.is_active ? "Deactivate" : "Reactivate"}
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
                      <Trash2 className="h-4 w-4 mr-1.5" /> Delete
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

function VisitorPasswordInline({ password }: { password: string | null }) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  if (!password) {
    return (
      <span className="text-xs text-neutral-400 italic">
        Password not stored — click Set password to issue a new one you can view.
      </span>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-wide text-neutral-500 mr-1">Password</span>
      <code className="text-xs font-mono bg-neutral-100 border border-neutral-200 rounded px-2 py-1">
        {show ? password : "••••••••"}
      </code>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 px-2"
        title={show ? "Hide password" : "Show password"}
        onClick={() => setShow((s) => !s)}
      >
        {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </Button>
      {show && (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2"
          title="Copy password"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(password);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              /* ignore */
            }
          }}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      )}
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

function SetPasswordButton({
  visitorName,
  onSet,
}: {
  visitorName: string;
  onSet: (password: string | undefined) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        title="Set or reset password"
        onClick={() => setOpen((v) => !v)}
      >
        <KeyRound className="h-4 w-4 mr-1.5" /> Set password
      </Button>
      {open && (
        <div className="absolute z-10 mt-10 bg-white border border-neutral-200 rounded-lg shadow-lg p-3 w-72 space-y-2">
          <p className="text-xs text-neutral-600">Set password for {visitorName}</p>
          <Input
            type="text"
            placeholder="Leave blank to auto-generate"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => { setOpen(false); setPw(""); }}>Cancel</Button>
            <Button
              size="sm"
              disabled={busy || (pw.length > 0 && pw.length < 6)}
              className="bg-neutral-900 text-white hover:bg-neutral-800"
              onClick={async () => {
                setBusy(true);
                try {
                  await onSet(pw.length > 0 ? pw : undefined);
                  setOpen(false);
                  setPw("");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Save
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

function NewVisitorForm({
  onCreate,
}: {
  onCreate: (v: {
    name: string;
    organisation?: string;
    email?: string;
    password: string;
  }) => Promise<string>;
}) {
  const [f, setF] = useState({ name: "", organisation: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [issuedPassword, setIssuedPassword] = useState<string | null>(null);

  return (
    <div className="mt-3 space-y-2">
      <form
        className="grid grid-cols-1 md:grid-cols-5 gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const pw = await onCreate({
              name: f.name,
              organisation: f.organisation || undefined,
              email: f.email || undefined,
              password: f.password,
            });
            setF({ name: "", organisation: "", email: "", password: "" });
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
        <Input
          placeholder="Password (min 6 chars)"
          value={f.password}
          onChange={(e) => setF({ ...f, password: e.target.value })}
          required
          minLength={6}
        />
        <Button
          type="submit"
          disabled={busy || !f.name || f.password.length < 6}
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
          // Chunked base64 encode — spreading a large Uint8Array into
          // String.fromCharCode overflows the call stack for files
          // bigger than ~100KB, which silently failed every upload.
          const bytes = new Uint8Array(buf);
          let binary = "";
          const CHUNK = 0x8000;
          for (let i = 0; i < bytes.length; i += CHUNK) {
            binary += String.fromCharCode.apply(
              null,
              Array.from(bytes.subarray(i, i + CHUNK)),
            );
          }
          const b64 = btoa(binary);
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
        } catch (err) {
          console.error("[repo upload] failed:", err);
          alert(`Upload failed: ${err instanceof Error ? err.message : String(err)}`);
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
