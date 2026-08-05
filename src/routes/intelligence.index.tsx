// Intelligence Engine — session list at /intelligence.
// Lists all intelligence_sessions rows for the signed-in user,
// grouped by created_at desc. Row actions: View, Delete.

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { TopNav } from "@/components/TopNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

export const Route = createFileRoute("/intelligence/")({
  head: () => ({
    meta: [
      { title: "Intelligence Lab — Brand Grenade" },
      {
        name: "description",
        content:
          "All Strategic Territory Intelligence Lab analyses for your account.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: IntelligenceListPage,
});

type SessionRow = {
  id: string;
  brand_name: string | null;
  category: string | null;
  status: string | null;
  created_at: string;
  updated_at: string;
  report_metadata: Record<string, unknown> | null;
};

type BriefType = "commercial" | "government";

function briefTypeOf(row: SessionRow): BriefType {
  const meta = row.report_metadata;
  const raw =
    meta && typeof meta === "object" && !Array.isArray(meta)
      ? (meta as Record<string, unknown>).brief_type
      : null;
  return typeof raw === "string" && raw.toLowerCase() === "government"
    ? "government"
    : "commercial";
}

function confidenceOf(row: SessionRow): "High" | "Moderate" | "Low" | null {
  if (row.status !== "complete") return null;
  const meta = row.report_metadata;
  const ca =
    meta && typeof meta === "object" && !Array.isArray(meta)
      ? (meta as Record<string, unknown>).completeness_assessment
      : null;
  const level =
    ca && typeof ca === "object" && !Array.isArray(ca)
      ? (ca as Record<string, unknown>).confidence_level
      : null;
  if (typeof level === "string") {
    const v = level.toLowerCase();
    if (v.startsWith("high")) return "High";
    if (v.startsWith("mod")) return "Moderate";
    if (v.startsWith("low")) return "Low";
  }
  return "Moderate";
}

function statusMeta(status: string | null): {
  label: string;
  color: string;
  filled: boolean;
} {
  switch (status) {
    case "complete":
      return { label: "Complete", color: "#C81E1E", filled: true };
    case "running":
      return { label: "Running", color: "#C81E1E", filled: true };
    case "failed":
      return { label: "Failed", color: "#B04A4A", filled: true };
    default:
      return { label: "Draft", color: "#8B8680", filled: false };
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function IntelligenceListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [pendingDelete, setPendingDelete] = useState<SessionRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("intelligence_sessions")
      .select(
        "id,brand_name,category,status,created_at,updated_at,report_metadata",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    setRows((data ?? []) as SessionRow[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
    if (!user) return;
    const channel = supabase
      .channel("intelligence-list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "intelligence_sessions" },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load, user]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const hay = `${r.brand_name ?? ""} ${r.category ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query]);

  async function handleDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("intelligence_sessions")
        .delete()
        .eq("id", pendingDelete.id);
      if (error) throw error;
      setRows((prev) => prev.filter((r) => r.id !== pendingDelete.id));
      toast.success("Analysis deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  }

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
        <div className="mx-auto max-w-[1200px]">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="text-label text-primary">Intelligence Lab</span>
              <h1 className="text-h2 mt-2 text-text-primary">
                Strategic Territory Intelligence Lab
              </h1>
              <p className="text-body mt-2 max-w-[720px] text-text-secondary">
                All analyses run against research inputs to identify available
                strategic territory before briefing.
              </p>
            </div>
            <Button
              onClick={() => navigate({ to: "/intelligence/new" })}
              size="lg"
            >
              <Plus className="mr-2 h-4 w-4" />
              Start Intelligence Lab
            </Button>
          </div>

          <div className="mt-8">
            <Input
              placeholder="Search by brand or category…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="max-w-md"
            />
          </div>

          <div className="mt-6">
            {loading ? (
              <div
                className="flex items-center gap-2 text-text-secondary text-sm"
                style={{ padding: "40px 0" }}
              >
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading analyses…
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState hasAny={rows.length > 0} />
            ) : (
              <Card style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 13,
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          borderBottom: "1px solid var(--color-border)",
                          background: "var(--color-surface-2)",
                        }}
                      >
                        <Th>Brand</Th>
                        <Th>Category</Th>
                        <Th>Type</Th>
                        <Th>Confidence</Th>
                        <Th>Status</Th>
                        <Th>Created</Th>
                        <Th align="right">Actions</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((r) => (
                        <SessionRowView
                          key={r.id}
                          row={r}
                          onDelete={() => setPendingDelete(r)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        </div>
      </main>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this analysis?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the Intelligence Lab session for{" "}
              <strong>{pendingDelete?.brand_name ?? "this brand"}</strong>{" "}
              including its report and research inputs. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      style={{
        textAlign: align,
        padding: "12px 16px",
        fontWeight: 500,
        fontSize: 11,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--color-text-tertiary)",
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <td
      style={{
        padding: "14px 16px",
        color: "var(--color-text-primary)",
        verticalAlign: "middle",
        textAlign: align,
      }}
    >
      {children}
    </td>
  );
}

function SessionRowView({
  row,
  onDelete,
}: {
  row: SessionRow;
  onDelete: () => void;
}) {
  const s = statusMeta(row.status);
  const bt = briefTypeOf(row);
  const conf = confidenceOf(row);
  return (
    <tr style={{ borderTop: "1px solid var(--color-border)" }}>
      <Td>
        <Link
          to="/intelligence/$id"
          params={{ id: row.id }}
          style={{ color: "var(--color-text-primary)", fontWeight: 500 }}
        >
          {row.brand_name ?? "Untitled"}
        </Link>
      </Td>
      <Td>
        <span style={{ color: "var(--color-text-secondary)" }}>
          {row.category ?? "—"}
        </span>
      </Td>
      <Td>
        <Badge
          label={bt === "government" ? "Government" : "Commercial"}
          tone={bt === "government" ? "#5A76A8" : "#7C6BAA"}
        />
      </Td>
      <Td>
        {conf ? (
          <Badge
            label={conf}
            tone={
              conf === "High"
                ? "#C81E1E"
                : conf === "Moderate"
                  ? "#C81E1E"
                  : "#8B8680"
            }
          />
        ) : (
          <span style={{ color: "var(--color-text-tertiary)" }}>—</span>
        )}
      </Td>
      <Td>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span
            aria-hidden
            style={{
              display: "inline-block",
              width: 10,
              height: 10,
              borderRadius: 10,
              background: s.filled ? s.color : "transparent",
              border: s.filled ? "none" : `1.5px solid ${s.color}`,
            }}
          />
          <span style={{ color: "var(--color-text-primary)", fontSize: 13 }}>
            {s.label}
          </span>
        </div>
      </Td>
      <Td>
        <span style={{ color: "var(--color-text-secondary)" }}>
          {formatDate(row.created_at)}
        </span>
      </Td>
      <Td align="right">
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 12,
            justifyContent: "flex-end",
          }}
        >
          <Link
            to="/intelligence/$id"
            params={{ id: row.id }}
            style={{ color: "#C81E1E", fontSize: 12, fontWeight: 500 }}
          >
            View
          </Link>
          <button
            type="button"
            onClick={onDelete}
            aria-label="Delete analysis"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--color-text-tertiary)",
              cursor: "pointer",
              padding: 4,
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </Td>
    </tr>
  );
}

function Badge({ label, tone }: { label: string; tone: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        color: tone,
        background: `${tone}18`,
        border: `1px solid ${tone}40`,
      }}
    >
      {label}
    </span>
  );
}

function EmptyState({ hasAny }: { hasAny: boolean }) {
  return (
    <div
      style={{
        padding: "64px 24px",
        textAlign: "center",
        border: "1px dashed var(--color-border)",
        borderRadius: 8,
      }}
    >
      <p className="text-h4 text-text-primary">
        {hasAny ? "No analyses match your search." : "No analyses yet."}
      </p>
      <p className="text-body mt-2 text-text-secondary max-w-[520px] mx-auto">
        {hasAny
          ? "Try a different brand or category."
          : "Run your first Intelligence Lab analysis to identify available strategic territory for a brand."}
      </p>
      {!hasAny ? (
        <div className="mt-6 flex justify-center">
          <Link to="/intelligence/new">
            <Button size="lg">
              <Plus className="mr-2 h-4 w-4" />
              Start Analysis
            </Button>
          </Link>
        </div>
      ) : null}
    </div>
  );
}
