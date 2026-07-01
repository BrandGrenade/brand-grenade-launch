import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { TopNav } from "@/components/TopNav";
import {
  listBriefingWorkspaces,
  createBriefingWorkspace,
  deleteBriefingWorkspace,
} from "@/lib/briefing-room.functions";

export const Route = createFileRoute("/briefing-room/")({
  component: BriefingRoomIndex,
  head: () => ({
    meta: [
      { title: "Briefing Room — Brand Grenade" },
      {
        name: "description",
        content:
          "Diagnose the real problem, categorise the truths, and find the tension before the brief enters the pipeline.",
      },
    ],
  }),
});

type Row = Awaited<ReturnType<typeof listBriefingWorkspaces>>[number];

function BriefingRoomIndex() {
  const navigate = useNavigate();
  const list = useServerFn(listBriefingWorkspaces);
  const create = useServerFn(createBriefingWorkspace);
  const del = useServerFn(deleteBriefingWorkspace);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void list().then((r) => {
      setRows(r);
      setLoading(false);
    });
  }, [list]);

  async function onCreate() {
    if (busy) return;
    if (brand.trim().length < 2) {
      toast.error("Add a brand name");
      return;
    }
    setBusy(true);
    try {
      const { id } = await create({
        data: { brandName: brand.trim(), category: category.trim() },
      });
      navigate({ to: "/briefing-room/$id", params: { id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create workspace");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this briefing workspace? This cannot be undone.")) return;
    try {
      await del({ data: { id } });
      setRows((r) => r.filter((x) => x.id !== id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="mx-auto w-full max-w-[960px] px-5 pb-16 pt-10 sm:px-6">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-body-sm text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft size={14} />
          Back to dashboard
        </Link>

        <header className="mt-6">
          <span className="text-label text-primary">Briefing Room</span>
          <h1 className="text-h1 mt-3 text-text-primary">Prepare the brief</h1>
          <p className="text-body mt-2 max-w-[640px] text-text-secondary">
            Aggregate and interrogate before the pipeline runs. Diagnose the real problem, categorise
            source-tagged truths, and surface candidate tensions. This section does not generate
            strategy — the pipeline does. Missing evidence is flagged, never invented.
          </p>
        </header>

        {!creating ? (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="mt-8 inline-flex h-10 items-center gap-2 rounded-md px-4 text-[13px] font-semibold"
            style={{ backgroundColor: "#D4924A", color: "#0A0A0A" }}
          >
            <Plus size={14} /> New Briefing Workspace
          </button>
        ) : (
          <div
            className="mt-8 rounded-md p-5"
            style={{ backgroundColor: "#141414", border: "1px solid #2A2A2A" }}
          >
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-label text-text-secondary">Brand</span>
                <input
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  className="input-base h-10 w-full"
                  placeholder="e.g. Patagonia"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-label text-text-secondary">Category (optional)</span>
                <input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="input-base h-10 w-full"
                  placeholder="e.g. Outdoor apparel"
                />
              </label>
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={onCreate}
                  disabled={busy}
                  className="inline-flex h-10 items-center rounded-md px-4 text-[13px] font-semibold disabled:opacity-50"
                  style={{ backgroundColor: "#D4924A", color: "#0A0A0A" }}
                >
                  {busy ? "Creating…" : "Create workspace"}
                </button>
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  className="text-body-sm text-text-secondary hover:text-text-primary"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <section className="mt-10">
          <h2 className="text-h3 text-text-primary">Your workspaces</h2>
          {loading ? (
            <p className="text-body-sm mt-3 text-text-tertiary">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-body-sm mt-3 text-text-tertiary">
              No workspaces yet. Start a new one above.
            </p>
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {rows.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between rounded-md p-4"
                  style={{ backgroundColor: "#141414", border: "1px solid #2A2A2A" }}
                >
                  <Link
                    to="/briefing-room/$id"
                    params={{ id: r.id }}
                    className="flex-1"
                  >
                    <div className="text-body font-semibold text-text-primary">
                      {r.brand_name || "(untitled)"}
                    </div>
                    <div className="text-body-sm text-text-tertiary">
                      {r.category || "—"} · updated {new Date(r.updated_at).toLocaleString()} ·{" "}
                      {r.tensions ? "tensions surfaced" : "in progress"}
                    </div>
                  </Link>
                  <button
                    type="button"
                    onClick={() => onDelete(r.id)}
                    className="text-text-tertiary hover:text-red-400"
                    aria-label="Delete workspace"
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
