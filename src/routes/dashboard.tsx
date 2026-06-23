import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MoreHorizontal, Grid2x2, FileText, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";
import { TopNav } from "@/components/TopNav";
import { PreflightStatusBanner } from "@/components/PreflightStatusBanner";
import { PreflightFullCheckPanel } from "@/components/PreflightFullCheckPanel";
import { NewRunGateButton } from "@/components/NewRunGateButton";
import {
  SavedBriefsSection,
  PENDING_BRIEF_STORAGE_KEY,
  type SavedBrief,
} from "@/components/SavedBriefsLibrary";
import { supabase } from "@/integrations/supabase/client";
import { createSession } from "@/lib/stage1.functions";
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
          "Your strategy pipeline runs. Each session is a complete 27-stage pipeline run for one brief — Brand Strategy and Brand Detonation.",
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
  stage_1_output: string | null;
  stage_16_consulting_output: string | null;
  phase_2_status: string | null;
  stage_17_output: string | null;
  stage_22_output: string | null;
};

type UIStatus = "complete" | "in_progress" | "incomplete";
type Phase2ButtonState = "commence" | "in_progress" | "complete";

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

function derivePhase2ButtonState(s: DbSession): Phase2ButtonState {
  if (s.stage_22_output) return "complete";
  if (s.stage_17_output) return "in_progress";
  return "commence";
}

function Dashboard() {
  const navigate = useNavigate();
  const createSessionFn = useServerFn(createSession);
  const [sessions, setSessions] = useState<DbSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<DbSession | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pendingLegacy, setPendingLegacy] = useState<SavedBrief | null>(null);
  const [legacyRunning, setLegacyRunning] = useState(false);

  const handleLoadSavedBrief = (b: SavedBrief) => {
    // Legacy briefs (pre-structured-editor) have no brief_fields — there is
    // nothing to pre-populate the 11-field form with. Route straight to the
    // raw-text pipeline path (the journey these briefs originally ran under),
    // gated by a confirm so a click doesn't silently launch a run.
    if (!b.brief_fields) {
      setPendingLegacy(b);
      return;
    }
    if (typeof window !== "undefined") {
      sessionStorage.setItem(PENDING_BRIEF_STORAGE_KEY, JSON.stringify(b));
    }
    navigate({ to: "/brief" });
  };

  const handleLegacyRun = async () => {
    if (!pendingLegacy || legacyRunning) return;
    setLegacyRunning(true);
    try {
      const { sessionId } = await createSessionFn({
        data: {
          brandName: pendingLegacy.brand_name,
          category: pendingLegacy.category || "Unspecified",
          strategicMode: "Auto",
          briefText: pendingLegacy.brief_text,
          // briefFields intentionally omitted — brief_versions stays [] so the
          // Stage 1B completeness gate is OFF (legacy raw-text path).
        },
      });
      setPendingLegacy(null);
      navigate({ to: "/pipeline", search: { session: sessionId } });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to start run";
      toast.error(msg);
      setLegacyRunning(false);
    }
  };

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
        .select("id,brand_name,category,status,current_stage,created_at,updated_at,stage_1_output,stage_16_consulting_output,phase_2_status,stage_17_output,stage_22_output")
        .eq("is_preflight_test", false)
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
            .select("id,brand_name,category,status,current_stage,created_at,updated_at,stage_1_output,stage_16_consulting_output,phase_2_status,stage_17_output,stage_22_output")
            .eq("is_preflight_test", false)
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
    {
      value: sessions.filter((s) => s.stage_22_output != null).length,
      label: "Completed",
    },
    {
      value: sessions.filter(
        (s) => s.stage_1_output != null && s.stage_22_output == null,
      ).length,
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
          <PreflightFullCheckPanel />
          <PreflightStatusBanner />

          <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <span className="text-label text-primary">Your Pipeline Runs</span>
              <h1 className="text-h2 mt-3 text-text-primary">Strategy Sessions</h1>
              <p className="text-body mt-2 text-text-secondary">
                Each session is a complete 27-stage pipeline run for one brief — Brand Strategy and Brand Detonation.
              </p>
            </div>
            <NewRunGateButton variant="topnav" label="New Run" />
          </header>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {stats.map((s) => (
              <div key={s.label} className="bg-card-surface px-6 py-5">
                <div className="text-h1 text-text-primary">{s.value}</div>
                <div className="text-label mt-1 text-primary">{s.label}</div>
              </div>
            ))}
          </div>

          <div id="completed-sessions" className="mt-8 scroll-mt-24">
            {loading ? (
              <p className="text-body text-text-tertiary">Loading sessions…</p>
            ) : sessions.length === 0 ? (
              <EmptyState />
            ) : (
              <SessionsTable sessions={sessions} onRequestDelete={setPendingDelete} />
            )}
          </div>

          <SavedBriefsSection onLoad={handleLoadSavedBrief} />
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
      <div className="mt-6">
        <NewRunGateButton variant="empty" label="Start New Run" />
      </div>
    </div>
  );
}

const STATUS_META: Record<UIStatus, { label: string; bg: string; border: string; fg: string }> = {
  complete: { label: "Complete", bg: "#4A7C5915", border: "#4A7C59", fg: "#4A7C59" },
  in_progress: { label: "In Progress", bg: "#D4924A15", border: "#D4924A", fg: "#D4924A" },
  incomplete: { label: "Incomplete", bg: "#3A3A3A", border: "#5A5652", fg: "#5A5652" },
};

function StatusBadge({ status }: { status: UIStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className="inline-flex items-center justify-center font-semibold uppercase"
      style={{
        backgroundColor: meta.bg,
        border: `1px solid ${meta.border}`,
        color: meta.fg,
        height: 28,
        padding: "0 14px",
        borderRadius: 6,
        fontSize: 11,
        letterSpacing: "0.1em",
        whiteSpace: "nowrap",
      }}
    >
      {meta.label}
    </span>
  );
}

const PHASE_2_BUTTON_META: Record<Phase2ButtonState, { label: string; variant: "solid" | "outline" }> = {
  commence: { label: "Commence", variant: "solid" },
  in_progress: { label: "In Progress", variant: "solid" },
  complete: { label: "Complete", variant: "outline" },
};

function Phase2Button({ state, sessionId }: { state: Phase2ButtonState; sessionId: string }) {
  const meta = PHASE_2_BUTTON_META[state];
  const [hover, setHover] = useState(false);
  const solid = meta.variant === "solid";
  const linkStyle = {
    display: "inline-flex" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    height: 28,
    padding: "0 14px",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
    border: "1px solid #D4924A",
    backgroundColor: solid ? "#D4924A" : hover ? "#D4924A15" : "transparent",
    color: solid ? "#0A0A0A" : "#D4924A",
    transition: "background-color 150ms",
    whiteSpace: "nowrap" as const,
  };
  const handlers = {
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
  };
  if (state === "complete") {
    return (
      <Link
        to="/detonation"
        search={{ session: sessionId }}
        {...handlers}
        style={{
          ...linkStyle,
          backgroundColor: "#4A7C5915",
          border: "1px solid #4A7C59",
          color: "#4A7C59",
        }}
      >
        Complete
      </Link>
    );
  }
  if (state === "commence") {
    return (
      <Link to="/detonation/canvas" search={{ session: sessionId }} {...handlers} style={linkStyle}>
        {meta.label}
      </Link>
    );
  }
  return (
    <Link to="/detonation" search={{ session: sessionId }} {...handlers} style={linkStyle}>
      {meta.label}
    </Link>
  );
}





function fmtDate(iso: string) {
  return new Date(iso).toLocaleString();
}

type ActionConfig = {
  key: "engine" | "detonation" | "deliverables" | "continue" | "delete";
  label: string;
  color: string;
  hoverBg: string;
  icon: React.ReactNode;
  onClick?: () => void;
  to?: string;
  search?: Record<string, string>;
};

function ActionButton({ action }: { action: ActionConfig }) {
  const [hover, setHover] = useState(false);
  const baseStyle: React.CSSProperties = {
    height: 28,
    padding: "0 12px",
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 500,
    border: `1px solid ${action.color}66`,
    color: action.color,
    backgroundColor: hover ? action.hoverBg : "transparent",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    transition: "background-color 150ms",
    whiteSpace: "nowrap",
  };
  const inner = (
    <>
      {action.icon}
      <span>{action.label}</span>
    </>
  );
  if (action.to) {
    return (
      <Link
        to={action.to}
        search={action.search as never}
        style={baseStyle}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        {inner}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={action.onClick}
      style={baseStyle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {inner}
    </button>
  );
}

function buildActions(s: DbSession, status: UIStatus, onDelete: () => void): ActionConfig[] {
  const deleteAction: ActionConfig = {
    key: "delete",
    label: "Delete",
    color: "#7C3A3A",
    hoverBg: "#7C3A3A15",
    icon: <Trash2 size={14} />,
    onClick: onDelete,
  };
  // Strategy Room (Phase 1 pipeline) — always available for any session row.
  const strategyAction: ActionConfig = {
    key: "engine",
    label: "Strategy Room",
    color: "#8A8680",
    hoverBg: "#1C1C1C",
    icon: <Grid2x2 size={14} />,
    to: "/pipeline",
    search: { session: s.id },
  };
  // Detonation Room (Phase 2) — always available; destination depends on
  // whether Stage 17 has produced output yet. NOT gated on stage_16, which
  // is the post-Phase-2 document assembly step.
  const detonationAction: ActionConfig = {
    key: "detonation",
    label: "Detonation Room",
    color: "#D4924A",
    hoverBg: "#D4924A15",
    icon: <Zap size={14} />,
    to: s.stage_17_output != null ? "/detonation" : "/detonation/canvas",
    search: { session: s.id },
  };
  if (status === "complete") {
    return [
      strategyAction,
      detonationAction,
      {
        key: "deliverables",
        label: "Deliverables",
        color: "#D4924A",
        hoverBg: "#D4924A15",
        icon: <FileText size={14} />,
        to: "/complete",
        search: { session: s.id },
      },
      deleteAction,
    ];
  }
  return [strategyAction, detonationAction, deleteAction];
}

function SessionsTable({
  sessions,
  onRequestDelete,
}: {
  sessions: DbSession[];
  onRequestDelete: (s: DbSession) => void;
}) {
  const isMobile = useIsMobile();
  const headers = ["Brand", "Category", "Stage", "Updated", "Brand Strategy", "Detonation", "Actions"];

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
            const status = deriveStatus(s);
            const actions = buildActions(s, status, () => onRequestDelete(s));
            return (
              <tr
                key={s.id}
                style={{
                  backgroundColor: i % 2 === 0 ? "var(--color-surface-2)" : "var(--color-card)",
                }}
              >
                <td className="text-body px-4 py-4 text-text-primary">{s.brand_name}</td>
                <td className="text-body px-4 py-4 text-text-secondary">{s.category ?? "—"}</td>
                <td className="text-body px-4 py-4 text-text-secondary">
                  Stage {s.current_stage} of 23
                </td>
                <td className="text-body px-4 py-4 text-text-secondary">{fmtDate(s.updated_at)}</td>
                <td className="px-4 py-4">
                  <StatusBadge status={status} />
                </td>
                <td className="px-4 py-4">
                  <Phase2Button state={derivePhase2ButtonState(s)} sessionId={s.id} />
                </td>
                <td className="px-4 py-4" style={{ minWidth: 280, whiteSpace: "nowrap" }}>
                  <div className="flex items-center justify-end gap-2">
                    {isMobile ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          aria-label="Session actions"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-[var(--color-surface-2)] hover:text-text-primary focus:outline-none"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          {actions.map((a) =>
                            a.to ? (
                              <DropdownMenuItem key={a.key} asChild>
                                <Link to={a.to} search={a.search as never} style={{ color: a.color }}>
                                  {a.label}
                                </Link>
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                key={a.key}
                                onSelect={(e) => {
                                  e.preventDefault();
                                  a.onClick?.();
                                }}
                                style={{ color: a.color }}
                              >
                                {a.label}
                              </DropdownMenuItem>
                            ),
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      actions.map((a) => <ActionButton key={a.key} action={a} />)
                    )}
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

