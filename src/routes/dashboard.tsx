import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ChevronRight,
  MoreHorizontal,
  Search,
  Download,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { TopNav } from "@/components/TopNav";
import { RequireAuth } from "@/components/RequireAuth";

import {
  SavedBriefsSection,
  PENDING_BRIEF_STORAGE_KEY,
  type SavedBrief,
} from "@/components/SavedBriefsLibrary";
import { supabase } from "@/integrations/supabase/client";
import { createSession } from "@/lib/stage1.functions";
import { deleteBrandPermanently } from "@/lib/brand-register.functions";
import { useIsAdmin } from "@/lib/dev-mode";
import { unlockRepositoryAdminFromPlatform } from "@/lib/repo-admin.functions";
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
import {
  useBrandRegister,
  formatRelative,
  formatAbsolute,
  type BrandRow,
  type BrandRun,
  type SystemStatus,
  type SystemKey,
} from "@/lib/brand-register";

export const Route = createFileRoute("/dashboard")({
  component: () => (
    <RequireAuth>
      <Dashboard />
    </RequireAuth>
  ),
  head: () => ({
    meta: [
      { title: "Brand Register — Brand Grenade" },
      {
        name: "description",
        content:
          "One row per brand. Every Intelligence Lab analysis, Briefing Room session, Strategy Pipeline, and Phase 2 detonation for that brand, in one register.",
      },
    ],
  }),
});

// ─── Filters ───────────────────────────────────────────────────────

type FilterKey = "all" | "active" | "complete" | "not_started";

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "All" },
  { key: "active", label: "In progress" },
  { key: "complete", label: "Complete" },
  { key: "not_started", label: "Not started" },
];

function rowMatchesFilter(row: BrandRow, filter: FilterKey): boolean {
  const states = [
    row.intelligence.state,
    row.briefingRoom.state,
    row.pipeline.state,
    row.phase2.state,
    row.creative.state,
  ];
  if (filter === "all") return true;
  if (filter === "active") return states.some((s) => s === "in_progress");
  if (filter === "complete") return row.pipeline.state === "complete";
  if (filter === "not_started")
    return states.every((s) => s === "not_started");
  return true;
}

const PAGE_SIZE = 20;
const PAGINATION_THRESHOLD = 50;

// ─── Dashboard ─────────────────────────────────────────────────────

function Dashboard() {
  const navigate = useNavigate();
  const createSessionFn = useServerFn(createSession);
  const deleteBrandPermanentlyFn = useServerFn(deleteBrandPermanently);
  const unlockRepoAdminFn = useServerFn(unlockRepositoryAdminFromPlatform);
  const isAdmin = useIsAdmin();
  const { rows, loading, error, refresh } = useBrandRegister();

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [page, setPage] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<BrandRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pendingLegacy, setPendingLegacy] = useState<SavedBrief | null>(null);
  const [legacyRunning, setLegacyRunning] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (!rowMatchesFilter(r, filter)) return false;
      if (!q) return true;
      return (
        r.displayName.toLowerCase().includes(q) ||
        (r.category ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, filter]);

  const paginated = useMemo(() => {
    if (rows.length < PAGINATION_THRESHOLD) return filtered;
    const start = page * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [rows.length, filtered, page]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const toggleExpanded = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const openExpanded = (key: string) => {
    setExpanded((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  };

  const handleLoadSavedBrief = (b: SavedBrief) => {
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
          briefText: pendingLegacy.brief_text,
        },
      });
      setPendingLegacy(null);
      navigate({ to: "/pipeline", search: { session: sessionId } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start run");
      setLegacyRunning(false);
    }
  };

  const handleDeleteBrand = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    const brand = pendingDelete;
    try {
      const result = await deleteBrandPermanentlyFn({
        data: {
          brandKey: brand.key,
          brandName: brand.displayName,
          sessionIds: brand.sessionIds,
          workspaceIds: brand.workspaceIds,
          savedBriefIds: brand.savedBriefIds,
          intelligenceIds: brand.intelligenceIds,
        },
      });
      setPendingDelete(null);
      toast.success(
        `Deleted ${brand.displayName} (${result.totalDeleted} record${result.totalDeleted === 1 ? "" : "s"}).`,
        { duration: 3000, style: { color: "#4A7C59" } },
      );
      void refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenRepositoriesAdmin = async () => {
    try {
      await unlockRepoAdminFn({});
      navigate({ to: "/admin/repositories" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Admin access failed");
    }
  };

  const stats = useMemo(
    () => [
      { value: rows.length, label: "Total Brands" },
      {
        value: rows.filter(
          (r) =>
            r.pipeline.state === "complete" || r.phase2.state === "complete",
        ).length,
        label: "With Completed Runs",
      },
      {
        value: rows.filter(
          (r) =>
            r.intelligence.state === "in_progress" ||
            r.briefingRoom.state === "in_progress" ||
            r.pipeline.state === "in_progress" ||
            r.phase2.state === "in_progress" ||
            r.creative.state === "in_progress",
        ).length,
        label: "In Progress",
      },
    ],
    [rows],
  );

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main
        className="px-5 py-10 sm:px-8 lg:px-8 lg:py-12"
        style={{
          paddingLeft: "max(20px, min(32px, 5vw))",
          paddingRight: "max(20px, min(32px, 5vw))",
        }}
      >
        <div className="mx-auto max-w-[1280px]">
          <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <span className="text-label text-primary">Brand Register</span>
              <h1 className="text-h2 mt-3 text-text-primary">Your Brands</h1>
              <p className="text-body mt-2 text-text-secondary">
                One row per brand. Every Intelligence Lab analysis, Briefing
                Room session, Strategy Pipeline, and Phase 2 detonation lives here.
              </p>
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={handleOpenRepositoriesAdmin}
                className="inline-flex h-10 items-center justify-center self-start rounded-lg px-4 text-[12px] font-semibold uppercase tracking-[0.12em] transition-opacity hover:opacity-90"
                style={{
                  backgroundColor: "#D4924A",
                  color: "#0A0A0A",
                }}
              >
                Admin
              </button>
            )}
          </header>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {stats.map((s) => (
              <div key={s.label} className="bg-card-surface px-6 py-5">
                <div className="text-h1 text-text-primary">{s.value}</div>
                <div className="text-label mt-1 text-primary">{s.label}</div>
              </div>
            ))}
          </div>

          {rows.length > 0 && (
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div
                className="flex items-center gap-2"
                style={{
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  padding: "0 12px",
                  height: 36,
                  minWidth: 240,
                  maxWidth: 360,
                  flex: 1,
                }}
              >
                <Search size={14} style={{ color: "var(--color-text-tertiary)" }} />
                <input
                  type="text"
                  placeholder="Search brand or category"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(0);
                  }}
                  className="w-full bg-transparent text-body outline-none"
                  style={{ color: "var(--color-text-primary)" }}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {FILTERS.map((f) => {
                  const active = filter === f.key;
                  return (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => {
                        setFilter((prev) => (prev === f.key ? "all" : f.key));
                        setPage(0);
                      }}
                      className="inline-flex items-center justify-center font-semibold uppercase"
                      style={{
                        height: 28,
                        padding: "0 12px",
                        borderRadius: 6,
                        fontSize: 11,
                        letterSpacing: "0.1em",
                        border: `1px solid ${active ? "#D4924A" : "var(--color-border)"}`,
                        backgroundColor: active ? "#D4924A15" : "transparent",
                        color: active ? "#D4924A" : "var(--color-text-secondary)",
                      }}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div id="brand-register" className="mt-6 scroll-mt-24">
            {error && (
              <p className="text-body" style={{ color: "#7C3A3A" }}>
                Failed to load register: {error}
              </p>
            )}
            {loading ? (
              <p className="text-body text-text-tertiary">Loading brands…</p>
            ) : rows.length === 0 ? (
              <EmptyState />
            ) : filtered.length === 0 ? (
              <NoMatchesState onClear={() => { setSearch(""); setFilter("all"); }} />
            ) : (
              <>
                <BrandRegisterTable
                  rows={paginated}
                  expanded={expanded}
                  onToggle={toggleExpanded}
                  onOpenExpanded={openExpanded}
                  onRequestDelete={setPendingDelete}
                />
                {rows.length >= PAGINATION_THRESHOLD && (
                  <PaginationBar
                    page={page}
                    pageCount={pageCount}
                    onPage={setPage}
                  />
                )}
              </>
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
          className="border-0 p-0 sm:max-w-[420px]"
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
                Delete {pendingDelete?.displayName ?? "this brand"}?
              </h3>
            </AlertDialogTitle>
            <AlertDialogDescription
              className="text-body"
              style={{ color: "#8A8680", marginTop: 8 }}
            >
              This will permanently delete all records for{" "}
              {pendingDelete?.displayName ?? "this brand"} across the Strategy
              Pipeline, Briefing Room, Saved Briefs, and Intelligence Lab. This
              cannot be undone.
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
              style={{
                border: "1px solid var(--color-border)",
                color: "var(--color-text-primary)",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={handleDeleteBrand}
              className="inline-flex h-9 items-center justify-center rounded-lg px-4 text-[13px] transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{
                backgroundColor: "#7C3A3A",
                color: "#F0EDE8",
                fontWeight: 600,
              }}
            >
              {deleting ? "Deleting…" : "Delete permanently"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={pendingLegacy !== null}
        onOpenChange={(open) => {
          if (!open && !legacyRunning) setPendingLegacy(null);
        }}
      >
        <AlertDialogContent
          className="border-0 p-0 sm:max-w-[440px]"
          style={{
            backgroundColor: "#1C1C1C",
            border: "1px solid var(--color-border)",
            borderRadius: 12,
            padding: 32,
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle asChild>
              <h3 className="text-h3" style={{ color: "#F0EDE8" }}>
                Start a new run from this brief?
              </h3>
            </AlertDialogTitle>
            <AlertDialogDescription
              className="text-body"
              style={{ color: "#8A8680", marginTop: 8 }}
            >
              This will launch a fresh pipeline run for{" "}
              <strong style={{ color: "#F0EDE8" }}>
                {pendingLegacy?.brand_name ?? ""}
              </strong>{" "}
              using the full saved brief text. It consumes a run.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter
            className="flex flex-row justify-end gap-3 sm:space-x-0"
            style={{ marginTop: 24 }}
          >
            <button
              type="button"
              disabled={legacyRunning}
              onClick={() => setPendingLegacy(null)}
              className="inline-flex h-9 items-center justify-center rounded-lg px-4 text-[13px] font-medium transition-colors hover:bg-[var(--color-surface-2)] disabled:opacity-50"
              style={{
                border: "1px solid var(--color-border)",
                color: "var(--color-text-primary)",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={legacyRunning}
              onClick={handleLegacyRun}
              className="inline-flex h-9 items-center justify-center rounded-lg px-4 text-[13px] transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{
                backgroundColor: "#D4924A",
                color: "#0A0A0A",
                fontWeight: 600,
              }}
            >
              {legacyRunning ? "Starting…" : "Run"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Empty / no-match states ───────────────────────────────────────

function EmptyState() {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-lg px-6 py-20 text-center"
      style={{ border: "1px dashed var(--color-border)" }}
    >
      <h3 className="text-h3" style={{ color: "var(--color-text-tertiary)" }}>
        No brands yet
      </h3>
      <p
        className="text-body mt-2"
        style={{ color: "var(--color-text-tertiary)", maxWidth: 480 }}
      >
        Use the launch strip above to start your first Intelligence Lab analysis,
        Briefing Room session, or Strategy Pipeline.
      </p>
    </div>
  );
}

function NoMatchesState({ onClear }: { onClear: () => void }) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-lg px-6 py-16 text-center"
      style={{ border: "1px dashed var(--color-border)" }}
    >
      <p className="text-body" style={{ color: "var(--color-text-tertiary)" }}>
        No brands match your search or filter.
      </p>
      <button
        type="button"
        onClick={onClear}
        className="mt-4 text-label"
        style={{ color: "#D4924A" }}
      >
        Clear filters
      </button>
    </div>
  );
}

function PaginationBar({
  page,
  pageCount,
  onPage,
}: {
  page: number;
  pageCount: number;
  onPage: (p: number) => void;
}) {
  return (
    <div className="mt-4 flex items-center justify-between">
      <span className="text-body" style={{ color: "var(--color-text-tertiary)" }}>
        Page {page + 1} of {pageCount}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page === 0}
          onClick={() => onPage(Math.max(0, page - 1))}
          className="inline-flex h-8 items-center justify-center rounded-md px-3 text-[13px] transition-colors disabled:opacity-40"
          style={{
            border: "1px solid var(--color-border)",
            color: "var(--color-text-primary)",
          }}
        >
          Prev
        </button>
        <button
          type="button"
          disabled={page >= pageCount - 1}
          onClick={() => onPage(Math.min(pageCount - 1, page + 1))}
          className="inline-flex h-8 items-center justify-center rounded-md px-3 text-[13px] transition-colors disabled:opacity-40"
          style={{
            border: "1px solid var(--color-border)",
            color: "var(--color-text-primary)",
          }}
        >
          Next
        </button>
      </div>
    </div>
  );
}

// ─── Register table ────────────────────────────────────────────────

const COLUMN_HEADERS = [
  "Brand",
  "Category",
  "Intelligence",
  "Briefing Room",
  "Strategy Pipeline",
  "Phase 2",
  "Creative Engine",
  "Deliverables",
  "",
];

function BrandRegisterTable({
  rows,
  expanded,
  onToggle,
  onOpenExpanded,
  onRequestDelete,
}: {
  rows: BrandRow[];
  expanded: Set<string>;
  onToggle: (key: string) => void;
  onOpenExpanded: (key: string) => void;
  onRequestDelete: (row: BrandRow) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
            {COLUMN_HEADERS.map((h, i) => (
              <th
                key={i}
                className="text-label px-3 py-3 text-left"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => {
            const isOpen = expanded.has(r.key);
            const rowBg =
              idx % 2 === 0
                ? "var(--color-surface-2)"
                : "var(--color-card)";
            return (
              <BrandRegisterRow
                key={r.key}
                row={r}
                open={isOpen}
                rowBg={rowBg}
                onToggle={onToggle}
                onOpenExpanded={onOpenExpanded}
                onRequestDelete={onRequestDelete}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function BrandRegisterRow({
  row,
  open,
  rowBg,
  onToggle,
  onOpenExpanded,
  onRequestDelete,
}: {
  row: BrandRow;
  open: boolean;
  rowBg: string;
  onToggle: (key: string) => void;
  onOpenExpanded: (key: string) => void;
  onRequestDelete: (row: BrandRow) => void;
}) {
  return (
    <>
      <tr style={{ backgroundColor: rowBg }}>
        <td className="px-3 py-4">
          <button
            type="button"
            onClick={() => onToggle(row.key)}
            aria-label={open ? "Collapse row" : "Expand row"}
            className="inline-flex items-center gap-2 text-left"
            style={{ color: "var(--color-text-primary)" }}
          >
            <ChevronRight
              size={14}
              style={{
                transition: "transform 150ms",
                transform: open ? "rotate(90deg)" : "rotate(0deg)",
                color: "var(--color-text-tertiary)",
              }}
            />
            <span className="text-body font-medium">{row.displayName}</span>
          </button>
        </td>
        <td className="text-body px-3 py-4 text-text-secondary">
          {row.category ?? "—"}
        </td>
        <td className="px-3 py-4">
          <SystemStatusCell
            system="intelligence"
            status={row.intelligence}
            brand={row.displayName}
          />
        </td>
        <td className="px-3 py-4">
          <SystemStatusCell
            system="briefing_room"
            status={row.briefingRoom}
            brand={row.displayName}
          />
        </td>
        <td className="px-3 py-4">
          <SystemStatusCell
            system="pipeline"
            status={row.pipeline}
            brand={row.displayName}
          />
        </td>
        <td className="px-3 py-4">
          <SystemStatusCell
            system="phase_2"
            status={row.phase2}
            brand={row.displayName}
          />
        </td>
        <td className="px-3 py-4">
          <SystemStatusCell
            system="creative"
            status={row.creative}
            brand={row.displayName}
          />
        </td>
        <td className="px-3 py-4">
          <DeliverablesCell
            pipelineComplete={row.pipeline.state === "complete"}
            sessionId={row.pipeline.hrefSearch?.session ?? null}
          />
        </td>
        <td className="px-3 py-4" style={{ whiteSpace: "nowrap" }}>
          <div className="flex items-center justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Brand actions"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-[var(--color-surface-2)] hover:text-text-primary focus:outline-none"
              >
                <MoreHorizontal className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    onOpenExpanded(row.key);
                  }}
                >
                  View all runs
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    toast.info(
                      "Bulk download will connect once the deliverables system is wired.",
                    );
                  }}
                >
                  Download all documents
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    onRequestDelete(row);
                  }}
                  style={{ color: "#7C3A3A" }}
                >
                  Delete brand
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </td>
      </tr>
      {open && (
        <tr style={{ backgroundColor: rowBg }}>
          <td colSpan={COLUMN_HEADERS.length} style={{ padding: 0 }}>
            <BrandRegisterExpanded row={row} />
          </td>
        </tr>
      )}
    </>
  );
}

// ─── System cell ───────────────────────────────────────────────────

const CIRCLE_SIZE = 10;

const STATE_COLOR: Record<SystemStatus["state"], string> = {
  not_started: "var(--color-border-strong)",
  in_progress: "#D4924A",
  complete: "#4A7C59",
  interrupted: "#B4453C",
};

const SYSTEM_LAUNCH_LABEL: Record<SystemKey, string> = {
  intelligence: "Launch",
  briefing_room: "Launch",
  pipeline: "Start",
  phase_2: "Start",
  creative: "Start",
};

function SystemCircle({ state }: { state: SystemStatus["state"] }) {
  const color = STATE_COLOR[state];
  const filled = state !== "not_started";
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: CIRCLE_SIZE,
        height: CIRCLE_SIZE,
        borderRadius: CIRCLE_SIZE,
        border: `1.5px solid ${color}`,
        backgroundColor: filled ? color : "transparent",
        flex: "none",
      }}
    />
  );
}

function SystemStatusCell({
  system,
  status,
  brand,
}: {
  system: SystemKey;
  status: SystemStatus;
  brand: string;
}) {
  return (
    <div className="flex items-center gap-2" style={{ minWidth: 132 }}>
      <SystemCircle state={status.state} />
      <div className="flex min-w-0 flex-col">
        {status.state === "not_started" ? (
          <NotStartedLink system={system} brand={brand} status={status} />
        ) : status.state === "interrupted" ? (
          // Interrupted runs get a resume link, not a "complete" cell —
          // the label carries the stage the run stalled on.
          <InProgressLink system={system} status={status} />
        ) : status.state === "in_progress" ? (
          <InProgressLink system={system} status={status} />
        ) : (
          <CompleteCell system={system} status={status} />
        )}

      </div>
    </div>
  );
}

function NotStartedLink({
  system,
  brand,
  status,
}: {
  system: SystemKey;
  brand: string;
  status: SystemStatus;
}) {
  const brandParam = brand ? { brand } : {};
  const label = SYSTEM_LAUNCH_LABEL[system];
  const style = {
    color: "var(--color-text-secondary)",
    fontSize: 12,
    fontWeight: 500,
    textDecoration: "underline",
  };
  if (system === "intelligence") {
    return (
      <Link to="/intelligence/new" search={brandParam} style={style}>
        {label}
      </Link>
    );
  }
  if (system === "briefing_room") {
    return (
      <Link to="/briefing-room" style={style}>
        {label}
      </Link>
    );
  }
  if (system === "pipeline") {
    return (
      <Link to="/brief" style={style}>
        {label}
      </Link>
    );
  }
  // Creative Stimulus lives inside Stage 21: when the session exists but no
  // creative run has been started, offer the way in rather than a dead dash.
  if (system === "creative" && status.href && status.hrefSearch) {
    return (
      <TextLink href={status.href} search={status.hrefSearch} label="Start" />
    );
  }
  // Phase 2 not started / pipeline incomplete: render a non-clickable dash.
  return (
    <span
      className="text-body"
      style={{ color: "var(--color-text-tertiary)", fontSize: 12 }}
    >
      —
    </span>
  );
}

function CompleteCell({
  system,
  status,
}: {
  system: SystemKey;
  status: SystemStatus;
}) {
  return (
    <div className="flex items-center gap-2">
      {system === "intelligence" ? (
        <a
          href={status.href ?? "#"}
          className="text-body"
          style={{
            color: "var(--color-text-secondary)",
            fontSize: 12,
            fontWeight: 500,
            textDecoration: "underline",
          }}
        >
          View
        </a>
      ) : system === "briefing_room" && status.href ? (
        <a
          href={status.href}
          className="text-body"
          style={{
            color: "var(--color-text-secondary)",
            fontSize: 12,
            fontWeight: 500,
            textDecoration: "underline",
          }}
        >
          Complete
        </a>
      ) : (system === "pipeline" || system === "phase_2" || system === "creative") &&
        status.href &&
        status.hrefSearch ? (
        <TextLink href={status.href} search={status.hrefSearch} label="Complete" />
      ) : (
        <span
          className="text-body"
          style={{ color: "var(--color-text-secondary)", fontSize: 12 }}
        >
          Complete
        </span>
      )}
    </div>
  );
}


function TextLink({
  href,
  search,
  label,
}: {
  href: string;
  search: Record<string, string>;
  label: string;
}) {
  const qs = new URLSearchParams(search).toString();
  return (
    <a
      href={qs ? `${href}?${qs}` : href}
      className="text-body"
      style={{
        color: "var(--color-text-secondary)",
        fontSize: 12,
        fontWeight: 500,
        textDecoration: "underline",
      }}
    >
      {label}
    </a>
  );
}

function InProgressLink({
  system,
  status,
}: {
  system: SystemKey;
  status: SystemStatus;
}) {
  const label = status.label ?? "In progress";
  if (
    (system === "pipeline" || system === "phase_2" || system === "creative") &&
    status.href &&
    status.hrefSearch
  ) {
    return (
      <TextLink href={status.href} search={status.hrefSearch} label={label} />
    );
  }
  if (system === "briefing_room") {
    return (
      <a
        href={status.href ?? "/briefing-room"}
        className="text-body"
        style={{
          color: "var(--color-text-secondary)",
          fontSize: 12,
          fontWeight: 500,
          textDecoration: "underline",
        }}
      >
        {label}
      </a>
    );
  }
  if (system === "intelligence" && status.href) {
    return (
      <a
        href={status.href}
        className="text-body"
        style={{
          color: "var(--color-text-secondary)",
          fontSize: 12,
          fontWeight: 500,
          textDecoration: "underline",
        }}
      >
        {label}
      </a>
    );
  }
  return (
    <span
      className="text-body"
      style={{ color: "var(--color-text-secondary)", fontSize: 12, fontWeight: 500 }}
    >
      {label}
    </span>
  );
}

function DeliverablesCell({
  pipelineComplete,
  sessionId,
}: {
  pipelineComplete: boolean;
  sessionId: string | null;
}) {
  if (!pipelineComplete || !sessionId) {
    return (
      <span
        className="text-body"
        style={{ color: "var(--color-text-tertiary)", fontSize: 12 }}
      >
        —
      </span>
    );
  }
  return (
    <a
      href={`/complete?session=${encodeURIComponent(sessionId)}`}
      className="text-body"
      style={{
        color: "var(--color-text-secondary)",
        fontSize: 12,
        fontWeight: 500,
        textDecoration: "underline",
      }}
    >
      Documents
    </a>
  );
}

// ─── Expanded — historical runs ────────────────────────────────────

const SYSTEM_SECTION_TITLE: Record<SystemKey, string> = {
  intelligence: "Intelligence Lab",
  briefing_room: "Briefing Room",
  pipeline: "Strategy Pipeline",
  phase_2: "Phase 2 — Detonation",
  creative: "Creative Stimulus Engine",
};

function BrandRegisterExpanded({ row }: { row: BrandRow }) {
  const bySystem: Record<SystemKey, BrandRun[]> = {
    intelligence: [],
    briefing_room: [],
    pipeline: [],
    phase_2: [],
    creative: [],
  };
  for (const r of row.runs) bySystem[r.system].push(r);
  return (
    <div
      style={{
        margin: "0 12px 12px 12px",
        padding: 16,
        borderRadius: 8,
        border: "1px solid var(--color-border)",
        backgroundColor: "var(--color-background)",
      }}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {(Object.keys(bySystem) as SystemKey[]).map((sys) => (
          <ExpandedSection
            key={sys}
            system={sys}
            runs={bySystem[sys]}
            brand={row.displayName}
          />
        ))}
      </div>
    </div>
  );
}

function ExpandedSection({
  system,
  runs,
  brand,
}: {
  system: SystemKey;
  runs: BrandRun[];
  brand: string;
}) {
  return (
    <section>
      <div
        className="text-label"
        style={{
          color: "var(--color-text-tertiary)",
          marginBottom: 8,
        }}
      >
        {SYSTEM_SECTION_TITLE[system]}
      </div>
      {runs.length === 0 ? (
        <div
          className="text-body"
          style={{ color: "var(--color-text-tertiary)", fontSize: 13 }}
        >
          No runs yet.{" "}
          <NotStartedLink system={system} brand={brand} status={status} />
        </div>
      ) : (
        <ul style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {runs.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between"
              style={{
                padding: "8px 10px",
                borderRadius: 6,
                border: "1px solid var(--color-border)",
                backgroundColor: "var(--color-card)",
              }}
            >
              <div className="flex min-w-0 items-center gap-3">
                <SystemCircle
                  state={
                    r.status === "complete"
                      ? "complete"
                      : r.status === "error"
                        ? "not_started"
                        : "in_progress"
                  }
                />
                <div className="flex min-w-0 flex-col">
                  <span
                    className="text-body"
                    style={{
                      color: "var(--color-text-primary)",
                      fontSize: 13,
                    }}
                  >
                    {r.label}
                  </span>
                  <span
                    className="text-body"
                    style={{
                      color: "var(--color-text-tertiary)",
                      fontSize: 11,
                    }}
                    title={formatAbsolute(r.date)}
                  >
                    {formatRelative(r.date)}
                  </span>
                </div>
              </div>
              <RunActions run={r} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RunActions({ run }: { run: BrandRun }) {
  const items: React.ReactNode[] = [];
  if (run.href && run.hrefSearch) {
    items.push(
      <TextLink key="view" href={run.href} search={run.hrefSearch} label="View" />,
    );
  }
  if (run.downloadHref) {
    items.push(
      <a
        key="dl"
        href={run.downloadHref}
        className="text-body"
        style={{
          color: "var(--color-text-secondary)",
          fontSize: 12,
          fontWeight: 500,
          textDecoration: "underline",
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        <Download size={12} /> Download
      </a>,
    );
  }
  if (run.system === "briefing_room" && run.status === "complete") {
    items.push(
      <span
        key="use"
        className="text-body"
        style={{ color: "var(--color-text-tertiary)", fontSize: 11 }}
      >
        Handoff written
      </span>,
    );
  }
  if (items.length === 0) return null;
  return <div className="flex items-center gap-3">{items}</div>;
}

// Suppress unused import warning if lint runs — Trash2 is intentionally kept
// available for future row-level destructive UI.
void Trash2;
