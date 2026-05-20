import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TopNav } from "@/components/TopNav";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/dashboard")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "Dashboard — Brand Grenade" },
      {
        name: "description",
        content:
          "Your strategy pipeline runs. Each session is a complete 20-stage pipeline run for one brief.",
      },
    ],
  }),
});

type DbSession = {
  id: string;
  brand_name: string;
  category: string | null;
  status: string;
  current_stage: number;
  created_at: string;
  updated_at: string;
};

type UIStatus = "in_progress" | "complete" | "awaiting_review" | "held" | "error" | "interrupted";

function mapStatus(s: string): UIStatus {
  switch (s) {
    case "complete":
      return "complete";
    case "awaiting_checkpoint":
      return "awaiting_review";
    case "held":
      return "held";
    case "error":
      return "error";
    case "interrupted":
      return "interrupted";
    default:
      return "in_progress";
  }
}

function Dashboard() {
  const [sessions, setSessions] = useState<DbSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("sessions")
        .select("id,brand_name,category,status,current_stage,created_at,updated_at")
        .order("updated_at", { ascending: false })
        .limit(100);
      if (!active) return;
      setSessions((data ?? []) as DbSession[]);
      setLoading(false);
    })();

    const channel = supabase
      .channel("sessions:dashboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sessions" },
        async () => {
          const { data } = await supabase
            .from("sessions")
            .select("id,brand_name,category,status,current_stage,created_at,updated_at")
            .order("updated_at", { ascending: false })
            .limit(100);
          if (active) setSessions((data ?? []) as DbSession[]);
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const stats = [
    { value: sessions.length, label: "Total Runs" },
    { value: sessions.filter((s) => s.status === "complete").length, label: "Completed" },
    {
      value: sessions.filter((s) => s.status === "running" || s.status === "pending").length,
      label: "In Progress",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main
        className="px-5 py-10 sm:px-8 lg:px-8 lg:py-12"
        style={{ paddingLeft: "max(20px, min(32px, 5vw))", paddingRight: "max(20px, min(32px, 5vw))" }}
      >
        <div className="mx-auto max-w-[1280px]">
          <header>
            <span className="text-label text-primary">Your Pipeline Runs</span>
            <h1 className="text-h2 mt-3 text-text-primary">Strategy Sessions</h1>
            <p className="text-body mt-2 text-text-secondary">
              Each session is a complete 20-stage pipeline run for one brief.
            </p>
          </header>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {stats.map((s) => (
              <div key={s.label} className="bg-card-surface px-6 py-5">
                <div className="text-h1 text-text-primary">{s.value}</div>
                <div className="text-label mt-1 text-primary">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="mt-8">
            {loading ? (
              <p className="text-body text-text-tertiary">Loading sessions…</p>
            ) : sessions.length === 0 ? (
              <EmptyState />
            ) : (
              <SessionsTable sessions={sessions} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function GridIcon() {
  return (
    <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="2" width="9" height="9" rx="1.5" fill="var(--color-border-strong)" />
      <rect x="13" y="2" width="9" height="9" rx="1.5" fill="var(--color-border-strong)" />
      <rect x="2" y="13" width="9" height="9" rx="1.5" fill="var(--color-border-strong)" />
      <rect x="13" y="13" width="9" height="9" rx="1.5" fill="var(--color-border-strong)" />
    </svg>
  );
}

function EmptyState() {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-lg px-6 py-20 text-center"
      style={{ border: "1px dashed var(--color-border)" }}
    >
      <GridIcon />
      <h3 className="text-h3 mt-5" style={{ color: "var(--color-text-tertiary)" }}>
        No sessions yet
      </h3>
      <p className="text-body mt-2" style={{ color: "var(--color-text-tertiary)" }}>
        Start a new pipeline run to begin.
      </p>
      <Link
        to="/brief"
        className="mt-6 inline-flex items-center rounded-md bg-transparent px-5 py-2.5 text-[13px] font-medium text-primary transition-colors hover:bg-primary-subtle"
        style={{ border: "1px solid var(--color-primary)" }}
      >
        Start New Run
      </Link>
    </div>
  );
}

const STATUS_META: Record<UIStatus, { label: string; bg: string; fg: string }> = {
  in_progress: { label: "In Progress", bg: "var(--color-primary-subtle)", fg: "var(--color-primary)" },
  complete: { label: "Complete", bg: "oklch(0.55 0.08 150 / 0.10)", fg: "var(--color-success)" },
  awaiting_review: { label: "Awaiting Review", bg: "oklch(0.5 0.09 70 / 0.10)", fg: "var(--color-warning)" },
  held: { label: "Held", bg: "oklch(0.45 0.12 25 / 0.10)", fg: "var(--color-destructive)" },
  error: { label: "Error", bg: "oklch(0.45 0.12 25 / 0.10)", fg: "var(--color-destructive)" },
  interrupted: { label: "Interrupted", bg: "oklch(0.5 0.09 70 / 0.10)", fg: "var(--color-warning)" },
};

function StatusBadge({ status }: { status: UIStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className="text-label inline-flex items-center rounded-sm px-2 py-0.5"
      style={{ backgroundColor: meta.bg, color: meta.fg }}
    >
      {meta.label}
    </span>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString();
}

function SessionsTable({ sessions }: { sessions: DbSession[] }) {
  const headers = ["Brand", "Category", "Status", "Stage", "Updated", "Actions"];
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
            {headers.map((h) => (
              <th
                key={h}
                className="text-label px-4 py-3 text-left"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sessions.map((s, i) => {
            const ui = mapStatus(s.status);
            return (
              <tr
                key={s.id}
                style={{
                  backgroundColor: i % 2 === 0 ? "var(--color-surface-2)" : "var(--color-card)",
                }}
              >
                <td className="text-body px-4 py-4 text-text-primary">{s.brand_name}</td>
                <td className="text-body px-4 py-4 text-text-secondary">{s.category ?? "—"}</td>
                <td className="px-4 py-4">
                  <StatusBadge status={ui} />
                </td>
                <td className="text-body px-4 py-4 text-text-secondary">
                  Stage {s.current_stage} of 20
                </td>
                <td className="text-body px-4 py-4 text-text-secondary">{fmtDate(s.updated_at)}</td>
                <td className="px-4 py-4">
                  <Link
                    to={ui === "complete" ? "/complete" : "/pipeline"}
                    search={ui === "complete" ? undefined : { session: s.id }}
                    className="text-body font-medium text-primary transition-colors hover:text-primary-hover"
                  >
                    {ui === "complete" ? "View" : "Continue"}
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
