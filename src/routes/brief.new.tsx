import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { TopNav } from "@/components/TopNav";
import { createSession } from "@/lib/stage1.functions";
import { runLeftOfCentre } from "@/lib/loc.functions";
import {
import { Spinner } from "@/components/ui/busy";
  saveBrief,
  PENDING_BRIEF_STORAGE_KEY,
} from "@/components/SavedBriefsLibrary";

export const Route = createFileRoute("/brief/new")({
  component: NewBriefPage,
  head: () => ({
    meta: [
      { title: "New Brief — Brand Grenade" },
      {
        name: "description",
        content:
          "Prepare a brief. Save it to your library or save and run it through the pipeline immediately.",
      },
    ],
  }),
});

function NewBriefPage() {
  const navigate = useNavigate();
  const createSessionFn = useServerFn(createSession);
  const runLocFn = useServerFn(runLeftOfCentre);

  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [briefText, setBriefText] = useState("");
  const [busy, setBusy] = useState<"none" | "save" | "run">("none");

  const canSubmit =
    brand.trim().length >= 2 &&
    category.trim().length >= 1 &&
    briefText.trim().length >= 20;

  async function handleSave() {
    if (busy !== "none") return;
    if (brand.trim().length < 2) {
      toast.error("Add a brand name");
      return;
    }
    setBusy("save");
    const saved = await saveBrief({
      brandName: brand.trim(),
      category: category.trim() || "Unspecified",
      briefText: briefText.trim(),
    });
    setBusy("none");
    if (saved) {
      toast.success(`Saved "${saved.brand_name}"`);
      navigate({ to: "/dashboard" });
    }
  }

  async function handleSaveAndRun() {
    if (busy !== "none") return;
    if (!canSubmit) {
      toast.error("Add brand, category, and at least 20 characters of brief");
      return;
    }
    setBusy("run");
    const saved = await saveBrief({
      brandName: brand.trim(),
      category: category.trim(),
      briefText: briefText.trim(),
    });
    if (!saved) {
      setBusy("none");
      return;
    }
    // Pre-load Stage 1 with the saved brief.
    if (typeof window !== "undefined") {
      sessionStorage.setItem(PENDING_BRIEF_STORAGE_KEY, JSON.stringify(saved));
    }
    try {
      const { sessionId } = await createSessionFn({
        data: {
          brandName: saved.brand_name,
          category: saved.category,
          briefText: saved.brief_text,
        },
      });
      // Fire the Left-of-Centre engine track in parallel with Stage 1.
      // Do not await — Stage 1 must not wait on LOC, and LOC writes its
      // output to stage_9_leftofcentre_output when it finishes.
      void runLocFn({ data: { sessionId } }).catch((err: unknown) => {
        console.warn("[LOC] parallel run failed at handoff:", err);
      });
      navigate({ to: "/pipeline", search: { session: sessionId } });
    } catch (err) {
      setBusy("none");
      toast.error(err instanceof Error ? err.message : "Failed to start run");
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="mx-auto w-full max-w-[720px] px-5 pb-16 pt-10 sm:px-6">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-body-sm text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft size={14} />
          Back to dashboard
        </Link>

        <header className="mt-6">
          <span className="text-label text-text-secondary">New Brief</span>
          <h1 className="text-h1 mt-3 text-text-primary">Prepare a brief</h1>
          <p className="text-body mt-2 text-text-secondary">
            Save it to your library, or save and run it through the pipeline now.
          </p>
        </header>

        <div className="mt-8 flex flex-col gap-5">
          <Field label="Brand name">
            <input
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="input-base h-11 w-full"
              maxLength={120}
              placeholder="e.g. Patagonia"
            />
          </Field>
          <Field label="Category">
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="input-base h-11 w-full"
              maxLength={120}
              placeholder="e.g. Outdoor apparel"
            />
          </Field>
          <Field label="Brief">
            <textarea
              value={briefText}
              onChange={(e) => setBriefText(e.target.value)}
              className="input-base w-full p-3"
              style={{ minHeight: 320, lineHeight: 1.6 }}
              maxLength={50000}
              placeholder="Write the brief. Challenge, audience, brand truths, category, constraints. At least 20 characters."
            />
            <p className="text-body-sm mt-1.5 text-text-tertiary">
              {briefText.trim().length} characters
            </p>
          </Field>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={busy !== "none" || brand.trim().length < 2}
            className="inline-flex h-10 items-center justify-center rounded-md px-4 text-[13px] font-semibold transition-colors disabled:opacity-50"
            style={{
              border: "1px solid var(--color-border)",
              color: "var(--color-text-primary)",
            }}
          >
            {busy === "save" ? <><Spinner /> Saving…</> : "Save Brief"}
          </button>
          <button
            type="button"
            onClick={handleSaveAndRun}
            disabled={!canSubmit || busy !== "none"}
            className="inline-flex h-10 items-center justify-center rounded-md px-5 text-[13px] font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: "#C81E1E", color: "#0A0908" }}
          >
            {busy === "run" ? <><Spinner /> Starting run…</> : "Save and Run"}
          </button>
        </div>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-label text-text-secondary">{label}</span>
      {children}
    </label>
  );
}
