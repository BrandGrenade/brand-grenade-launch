import { useEffect, useState } from "react";
import { Trash2, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const PENDING_BRIEF_STORAGE_KEY = "brand-grenade:pending-saved-brief";

export type SavedBrief = {
  brief_id: string;
  brand_name: string;
  category: string;
  brief_text: string;
  created_at: string;
};

export async function fetchSavedBriefs(): Promise<SavedBrief[]> {
  const { data, error } = await supabase
    .from("saved_briefs")
    .select("brief_id,brand_name,category,brief_text,created_at")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[saved_briefs] fetch error", error);
    return [];
  }
  return (data ?? []) as SavedBrief[];
}

export async function saveBrief(input: {
  brandName: string;
  category: string;
  briefText: string;
}): Promise<SavedBrief | null> {
  const { data: userRes } = await supabase.auth.getUser();
  const userId = userRes.user?.id;
  if (!userId) {
    toast.error("You must be signed in to save a brief");
    return null;
  }
  const { data, error } = await supabase
    .from("saved_briefs")
    .insert({
      user_id: userId,
      brand_name: input.brandName,
      category: input.category,
      brief_text: input.briefText,
    })
    .select("brief_id,brand_name,category,brief_text,created_at")
    .single();
  if (error) {
    toast.error("Failed to save brief");
    return null;
  }
  return data as SavedBrief;
}

export async function deleteSavedBrief(briefId: string): Promise<boolean> {
  const { error } = await supabase.from("saved_briefs").delete().eq("brief_id", briefId);
  if (error) {
    toast.error("Failed to delete brief");
    return false;
  }
  return true;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Dashboard variant: full card grid with Load + Delete actions. */
export function SavedBriefsSection({
  onLoad,
}: {
  onLoad: (b: SavedBrief) => void;
}) {
  const [briefs, setBriefs] = useState<SavedBrief[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setBriefs(await fetchSavedBriefs());
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleDelete = async (id: string) => {
    if (!(await deleteSavedBrief(id))) return;
    setBriefs((prev) => prev.filter((b) => b.brief_id !== id));
    toast.success("Brief deleted");
  };

  return (
    <section className="mt-10">
      <div className="flex items-baseline justify-between">
        <div>
          <span className="text-label text-primary">Pre-Written Briefs</span>
          <h2 className="text-h2 mt-2 text-text-primary">Saved Briefs</h2>
          <p className="text-body mt-2 text-text-secondary">
            Pre-written briefs ready to load into a new pipeline run with one click.
          </p>
        </div>
      </div>

      <div className="mt-6">
        {loading ? (
          <p className="text-body text-text-tertiary">Loading saved briefs…</p>
        ) : briefs.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center rounded-lg px-6 py-12 text-center"
            style={{ border: "1px dashed var(--color-border)" }}
          >
            <p className="text-body" style={{ color: "var(--color-text-tertiary)" }}>
              No saved briefs yet. Save a brief from the Stage 1 brief screen to build your library.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {briefs.map((b) => (
              <div
                key={b.brief_id}
                className="flex flex-col rounded-lg p-5"
                style={{
                  backgroundColor: "var(--color-card-surface, var(--color-surface-2))",
                  border: "1px solid var(--color-border)",
                }}
              >
                <h3 className="text-h3 text-text-primary">{b.brand_name}</h3>
                <p className="text-body-sm mt-1 text-text-secondary">
                  {b.category || "—"}
                </p>
                <p className="text-body-sm mt-3" style={{ color: "var(--color-text-tertiary)" }}>
                  Saved {fmt(b.created_at)}
                </p>
                <div className="mt-5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onLoad(b)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium transition-opacity hover:opacity-90"
                    style={{ backgroundColor: "#D4924A", color: "#0A0A0A" }}
                  >
                    <FolderOpen size={14} />
                    Load Brief
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(b.brief_id)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium transition-colors hover:bg-[#7C3A3A15]"
                    style={{ border: "1px solid #7C3A3A66", color: "#7C3A3A" }}
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/** Stage 1 variant: collapsible picker that calls onSelect when a brief is chosen. */
export function SavedBriefsPicker({
  onSelect,
}: {
  onSelect: (b: SavedBrief) => void;
}) {
  const [open, setOpen] = useState(false);
  const [briefs, setBriefs] = useState<SavedBrief[]>([]);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && briefs.length === 0) {
      setLoading(true);
      setBriefs(await fetchSavedBriefs());
      setLoading(false);
    }
  };

  return (
    <div
      className="rounded-lg"
      style={{
        backgroundColor: "var(--color-card-surface, var(--color-surface-2))",
        border: "1px solid var(--color-border)",
      }}
    >
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center justify-between gap-3 p-5 text-left"
      >
        <div className="flex items-center gap-3">
          <FolderOpen size={18} style={{ color: "#D4924A" }} />
          <div>
            <h3 className="text-h3 text-text-primary">Load a Saved Brief</h3>
            <p className="text-body-sm mt-0.5 text-text-secondary">
              Skip the form. Pre-populate Stage 1 from your saved briefs library.
            </p>
          </div>
        </div>
        <span className="text-body-sm text-text-secondary">
          {open ? "Hide" : "Show"}
        </span>
      </button>

      {open && (
        <div className="px-5 pb-5">
          {loading ? (
            <p className="text-body-sm text-text-tertiary">Loading…</p>
          ) : briefs.length === 0 ? (
            <p className="text-body-sm" style={{ color: "var(--color-text-tertiary)" }}>
              No saved briefs yet. Fill out a brief below and click <strong>Save Brief</strong> to add one to your library.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {briefs.map((b) => (
                <li
                  key={b.brief_id}
                  className="flex items-center justify-between gap-3 rounded-md px-3 py-2.5"
                  style={{
                    backgroundColor: "var(--color-surface-2)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-body text-text-primary truncate">
                      {b.brand_name}
                      <span className="text-text-tertiary"> · {b.category || "—"}</span>
                    </p>
                    <p className="text-body-sm text-text-tertiary">Saved {fmt(b.created_at)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(b);
                      setOpen(false);
                    }}
                    className="inline-flex h-8 shrink-0 items-center rounded-md px-3 text-[12px] font-semibold transition-opacity hover:opacity-90"
                    style={{ backgroundColor: "#D4924A", color: "#0A0A0A" }}
                  >
                    Load
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
