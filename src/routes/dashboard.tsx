import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MoreHorizontal, Grid2x2, FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { TopNav } from "@/components/TopNav";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { useIsMobile } from "@/hooks/use-mobile";


export const Route = createFileRoute("/dashboard")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "Sessions — Brand Grenade" },
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
  stage_16_consulting_output: string | null;
};

type UIStatus = "complete" | "in_progress" | "incomplete";

function deriveStatus(s: DbSession): UIStatus {
  if (
    (s.current_stage === 20 && s.status === "complete") ||
    s.stage_16_consulting_output != null
  ) {
    return "complete";
  }
  if (s.status === "running" || s.status === "pending") return "in_progress";
  return "incomplete";
}

function Dashboard() {
  const [sessions, setSessions] = useState<DbSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<DbSession | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    const id = pendingDelete.id;
    const { error } = await supabase.from("sessions").delete().eq("id", id);
    setDeleting(false);
    if (error) {
      toast.error("Failed to delete session");
      return;
    }
    setSessions((prev) => prev.filter((s) => s.id !== id));
    setPendingDelete(null);
    toast.success("Session deleted", {
      duration: 3000,
      style: { color: "#4A7C59" },
    });
  };


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
          <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <span className="text-label text-primary">Your Pipeline Runs</span>
              <h1 className="text-h2 mt-3 text-text-primary">Strategy Sessions</h1>
              <p className="text-body mt-2 text-text-secondary">
                Each session is a complete 20-stage pipeline run for one brief.
              </p>
            </div>
            <Link
              to="/brief"
              className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg px-4 text-[13px] font-semibold transition-colors hover:opacity-90"
              style={{ backgroundColor: "#C8873A", color: "#0A0A0A" }}
            >
              New Run
            </Link>
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
              <SessionsTable sessions={sessions} onRequestDelete={setPendingDelete} />
            )}
          </div>
        </div>
      </main>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setPendingDelete(null);
        }}
      >
        <AlertDialogContent
          className="border-0 p-0 sm:max-w-[400px]"
          style={{
            backgroundColor: "#1C1C1C",
            border: "1px solid #7C3A3A",
            borderRadius: 12,
            padding: 32,
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle asChild>
              <h3 className="text-h3" style={{ color: "#F0EDE8" }}>
                Delete this session?
              </h3>
            </AlertDialogTitle>
            <AlertDialogDescription
              className="text-body"
              style={{ color: "#8A8680", marginTop: 8 }}
            >
              This will permanently delete the {pendingDelete?.brand_name ?? ""} session and all
              its pipeline outputs. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter
            className="flex flex-row justify-end gap-3 sm:space-x-0"
            style={{ marginTop: 24 }}
          >
            <button
              type="button"
              disabled={deleting}
              onClick={() => setPendingDelete(null)}
              className="inline-flex h-9 items-center justify-center rounded-lg px-4 text-[13px] font-medium transition-colors hover:bg-[var(--color-surface-2)] disabled:opacity-50"
              style={{ border: "1px solid var(--color-border)", color: "var(--color-text-primary)" }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={handleDelete}
              className="inline-flex h-9 items-center justify-center rounded-lg px-4 text-[13px] transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "#7C3A3A", color: "#F0EDE8", fontWeight: 600 }}
            >
              {deleting ? "Deleting…" : "Delete permanently"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
        className="mt-6 inline-flex items-center rounded-lg bg-transparent px-5 py-2.5 text-[13px] font-medium transition-colors hover:bg-primary-subtle"
        style={{ border: "1px solid #C8873A", color: "#C8873A" }}
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

function SessionsTable({
  sessions,
  onRequestDelete,
}: {
  sessions: DbSession[];
  onRequestDelete: (s: DbSession) => void;
}) {
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
                  <div className="flex items-center justify-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        aria-label="Session actions"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-[var(--color-surface-2)] hover:text-text-primary focus:outline-none"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem asChild>
                          <Link to="/pipeline" search={{ session: s.id }}>
                            {ui === "complete" ? "View" : "Continue"}
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={(e) => {
                            e.preventDefault();
                            onRequestDelete(s);
                          }}
                          style={{ color: "#7C3A3A" }}
                        >
                          Delete session
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </td>
              </tr>
            );
          })}

        </tbody>
      </table>
    </div>
  );
}
