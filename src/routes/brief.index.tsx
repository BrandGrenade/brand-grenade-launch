import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { TopNav } from "@/components/TopNav";
import { createSession } from "@/lib/stage1.functions";
import { resubmitBriefStructured } from "@/lib/stage1b.functions";
import { Spinner } from "@/components/ui/busy";
import {
  SavedBriefsPicker,
  saveBrief,
  PENDING_BRIEF_STORAGE_KEY,
  type SavedBrief,
} from "@/components/SavedBriefsLibrary";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  BRIEF_SECTIONS as SECTIONS,
  composeBriefText as composeStructuredBriefText,
  briefFieldsFromLegacyText,
  type BriefFields,
  type BriefSection as Section,
} from "@/lib/brief-schema";


export const PENDING_BRIEF_EDIT_STORAGE_KEY = "brand-grenade:pending-brief-edit";

const BriefSearchSchema = z.object({
  edit: z.string().uuid().optional(),
}).partial();

export const Route = createFileRoute("/brief/")({
  component: BriefIntake,
  validateSearch: (search) => BriefSearchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Strategy Pipeline — Brand Grenade" },
      {
        name: "description",
        content:
          "Submit a strategy brief. Nine sections covering challenge, audience, brand truths, category and constraints.",
      },
    ],
  }),
});


const MAX_FILE_BYTES = 50 * 1024 * 1024;
const ACCEPTED_TYPES = [".pdf", ".docx", ".pptx", ".txt"];

// SECTIONS / Section types come from @/lib/brief-schema so the form,
// the saved-brief load path, the pipeline View Brief, and the server-side
// composeBriefText() all share one canonical field definition.



const INSTRUCTION_STYLE: React.CSSProperties = {
  color: "#8B8680",
  fontStyle: "italic",
  fontSize: 13,
  lineHeight: 1.5,
};

function todayISO() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function BriefIntake() {
  const navigate = useNavigate();
  const createSessionFn = useServerFn(createSession);
  const resubmitStructuredFn = useServerFn(resubmitBriefStructured);
  const { edit: editSessionId } = Route.useSearch();
  const isEditMode = !!editSessionId;

  // Header fields
  const [briefTitle, setBriefTitle] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(todayISO());
  const [submittedBy, setSubmittedBy] = useState("");

  // Section field values
  const [values, setValues] = useState<Record<string, string>>({});
  const setValue = (k: string, v: string) =>
    setValues((prev) => ({ ...prev, [k]: v }));

  // Section open state
  const [openMap, setOpenMap] = useState<Record<string, boolean>>(
    Object.fromEntries(SECTIONS.map((s) => [s.num, true])),
  );

  // Section-9 supporting files
  const [files, setFiles] = useState<File[]>([]);
  const [existingFileNames, setExistingFileNames] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Large alt upload zone
  const [altFile, setAltFile] = useState<File | null>(null);
  const [altStatus, setAltStatus] = useState<"idle" | "reading" | "ready">("idle");
  const [altDragging, setAltDragging] = useState(false);
  const altInputRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /** Populate every field from a structured BriefFields object. */
  function applyBriefFields(b: BriefFields) {
    setBriefTitle(b.briefTitle ?? "");
    setBrand(b.brandName ?? "");
    setCategory(b.category ?? "");
    if (b.date) setDate(b.date);
    setSubmittedBy(b.submittedBy ?? "");
    setValues(() => ({ ...b.sections }));
    setExistingFileNames(b.supportingMaterials ?? []);
    setOpenMap(Object.fromEntries(SECTIONS.map((s) => [s.num, true])));
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function loadSavedBrief(b: SavedBrief) {
    if (b.brief_fields) {
      applyBriefFields(b.brief_fields);
      toast.success(`Loaded "${b.brand_name}" — every field pre-populated. Review and click Submit.`);
      return;
    }
    // Legacy text-only brief — drop into the Core Challenge field so the
    // user can review/clean it up rather than losing the content entirely.
    const fallback = briefFieldsFromLegacyText({
      brandName: b.brand_name,
      category: b.category,
      briefText: b.brief_text,
    });
    applyBriefFields(fallback);
    toast.message(`Loaded legacy brief "${b.brand_name}" — content placed in Section 1 for review.`);
  }

  async function runFromBriefingRoom(b: SavedBrief) {
    if (!b.brief_fields) {
      loadSavedBrief(b);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const { sessionId } = await createSessionFn({
        data: {
          brandName: b.brief_fields.brandName || b.brand_name,
          category: b.brief_fields.category || b.category,
          briefText: b.brief_text,
          briefFields: b.brief_fields,
        },
      });
      navigate({ to: "/pipeline", search: { session: sessionId } });
    } catch (err) {
      setSubmitting(false);
      setSubmitError(err instanceof Error ? err.message : "Failed to start");
      applyBriefFields(b.brief_fields);
      toast.error("Briefing Room handoff failed — the brief is pre-loaded for manual review.");
    }
  }

  function currentBriefFields(): BriefFields {
    return {
      briefTitle: briefTitle.trim(),
      brandName: brand.trim(),
      category: category.trim() || "Unspecified",
      date,
      submittedBy: submittedBy.trim(),
      sections: { ...values },
      supportingMaterials: [
        ...existingFileNames,
        ...files.map((f) => f.name),
      ],
    };
  }

  async function handleSaveBrief() {
    if (saving) return;
    if (brand.trim().length < 2) {
      toast.error("Add a brand name before saving");
      return;
    }
    setSaving(true);
    const briefFields = currentBriefFields();
    const briefText = composeStructuredBriefText(briefFields);
    const saved = await saveBrief({
      brandName: brand.trim(),
      category: category.trim() || "Unspecified",
      briefText,
      briefFields,
    });
    setSaving(false);
    if (saved) {
      toast.success(`Saved "${saved.brand_name}" to your brief library`);
    }
  }

  // Consume any brief queued from the dashboard's Saved Briefs library OR
  // any brief queued by the pipeline Edit Brief button.
  useEffect(() => {
    if (typeof window === "undefined") return;
    // 1) Edit-mode prefill — wins over saved-brief queue.
    const editRaw = sessionStorage.getItem(PENDING_BRIEF_EDIT_STORAGE_KEY);
    if (editRaw) {
      sessionStorage.removeItem(PENDING_BRIEF_EDIT_STORAGE_KEY);
      try {
        const f = JSON.parse(editRaw) as BriefFields;
        if (f && typeof f === "object") {
          applyBriefFields(f);
          toast.message("Editing the submitted brief. Resubmit to rerun Stage 1 with the amended brief.");
          return;
        }
      } catch {/* ignore */}
    }
    // 2) Saved-brief / Briefing Room handoff queue — auto-fire Stage 1 when a
    //    structured Briefing Room brief is present.
    const raw = sessionStorage.getItem(PENDING_BRIEF_STORAGE_KEY);
    if (!raw) return;
    sessionStorage.removeItem(PENDING_BRIEF_STORAGE_KEY);
    try {
      const b = JSON.parse(raw) as SavedBrief;
      if (!b || !b.brand_name) return;
      if (b.brief_fields) {
        void runFromBriefingRoom(b);
      } else {
        loadSavedBrief(b);
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);



  // Section completion (any field has 10+ chars, or for select fields, has a value)
  const completion = useMemo(() => {
    const done: Record<string, boolean> = {};
    for (const s of SECTIONS) {
      done[s.num] = s.fields.some((f) => {
        const v = (values[f.key] ?? "").trim();
        if (f.kind === "select") return v.length > 0;
        return v.length >= 10;
      });
    }
    done["files"] = files.length > 0 || existingFileNames.length > 0;
    const count = Object.values(done).filter(Boolean).length;
    return { done, count, total: SECTIONS.length };
  }, [values, files, existingFileNames]);

  const objectiveSelected = (values["f2_objective"] ?? "").trim().length > 0;
  const canSubmitSections = brand.trim().length >= 2 && objectiveSelected;

  const canSubmitAlt = !!altFile && brand.trim().length >= 2;

  function addFiles(incoming: FileList | File[], target: "support" | "alt") {
    const list = Array.from(incoming).filter((f) => {
      const ext = "." + f.name.split(".").pop()?.toLowerCase();
      if (!ACCEPTED_TYPES.includes(ext)) return false;
      if (f.size > MAX_FILE_BYTES) return false;
      return true;
    });
    if (target === "support") {
      setFiles((prev) => [...prev, ...list]);
    } else if (list[0]) {
      setAltFile(list[0]);
      setAltStatus("reading");
      setTimeout(() => setAltStatus("ready"), 1200);
    }
  }


  async function handleSubmitSections(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmitSections || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const briefFields = currentBriefFields();
      const briefText = composeStructuredBriefText(briefFields);
      if (isEditMode && editSessionId) {
        // Resubmit amended brief — server appends Version N, rewrites brief_text,
        // hard-resets every downstream stage so the pipeline reruns from Stage 1.
        await resubmitStructuredFn({
          data: { sessionId: editSessionId, briefFields, briefText },
        });
        toast.success("Brief resubmitted. Rerunning Stage 1 with the amended brief.");
        navigate({ to: "/pipeline", search: { session: editSessionId } });
        return;
      }
      const { sessionId } = await createSessionFn({
        data: {
          brandName: brand.trim(),
          category: category.trim() || "Unspecified",
          briefText,
          briefFields,
        },
      });
      navigate({ to: "/pipeline", search: { session: sessionId } });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to start");
      setSubmitting(false);
    }
  }

  async function handleSubmitAlt() {
    if (!canSubmitAlt || submitting || !altFile) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const briefText = `# ${briefTitle.trim() || altFile.name}\nDate: ${date}\n${submittedBy.trim() ? `Submitted by: ${submittedBy.trim()}\n` : ""}\nUploaded document: ${altFile.name} (${(altFile.size / 1024).toFixed(0)} KB)\n\n[The Strategy Engine will extract strategic inputs from the uploaded document.]`;
      const briefFields: BriefFields = {
        briefTitle: briefTitle.trim() || altFile.name,
        brandName: brand.trim(),
        category: category.trim() || "Unspecified",
        date,
        submittedBy: submittedBy.trim(),
        sections: { f1_brand: `Uploaded document: ${altFile.name}` },
        supportingMaterials: [altFile.name],
      };
      const { sessionId } = await createSessionFn({
        data: {
          brandName: brand.trim(),
          category: category.trim() || "Unspecified",
          briefText,
          briefFields,
        },
      });
      navigate({ to: "/pipeline", search: { session: sessionId } });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to start");
      setSubmitting(false);
    }
  }


  return (
    <div className="min-h-screen bg-background">
      <TopNav />

      <main className="mx-auto w-full max-w-[840px] px-5 pb-16 pt-12 sm:px-6">
        <header>
          <span className="text-label text-text-secondary">
            {isEditMode ? "Edit Submitted Brief" : "Strategy Brief"}
          </span>
          <h1 className="text-h1 mt-3 text-text-primary">
            {isEditMode ? "Edit your brief" : "Submit your brief"}
          </h1>
          <p className="text-body-lg mt-3 text-text-secondary">
            {isEditMode
              ? "Every field is pre-populated from the original submission. Edit any field and click Resubmit — Stage 1 will rerun with the amended brief and every downstream stage will reset. The original version is preserved as Version 1."
              : "Complete the structured brief below, or upload an existing document and the Strategy Engine will extract the strategic inputs."}
          </p>
          <hr className="my-8 h-px border-0 bg-border" />
        </header>


        {/* HEADER FIELDS — 2x2 grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <HeaderField label="Brief Title">
            <input
              value={briefTitle}
              onChange={(e) => setBriefTitle(e.target.value)}
              className="input-base h-11 w-full"
              maxLength={200}
            />
          </HeaderField>
          <HeaderField label="Brand / Company Name">
            <input
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="input-base h-11 w-full"
              maxLength={120}
            />
          </HeaderField>
          <HeaderField label="Category">
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="input-base h-11 w-full"
              maxLength={120}
            />
          </HeaderField>
          <HeaderField label="Date">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input-base h-11 w-full"
            />
          </HeaderField>
          <HeaderField label="Submitted By">
            <input
              value={submittedBy}
              onChange={(e) => setSubmittedBy(e.target.value)}
              className="input-base h-11 w-full"
              maxLength={120}
            />
          </HeaderField>
        </div>

        {/* LOAD SAVED BRIEF */}
        <div className="mt-8">
          <SavedBriefsPicker onSelect={loadSavedBrief} />
        </div>

        {/* SECTION CARDS */}
        <form onSubmit={handleSubmitSections} className="mt-8" noValidate>

          <div className="flex flex-col gap-4">
            {SECTIONS.map((s) => (
              <SectionCard
                key={s.num}
                section={s}
                open={openMap[s.num]}
                onOpenChange={(o) => setOpenMap((m) => ({ ...m, [s.num]: o }))}
                values={values}
                onChange={setValue}
                completed={completion.done[s.num]}
              />
            ))}

            {/* SECTION 9 — uploads */}
            <div
              className="rounded-lg p-6"
              style={{
                backgroundColor: "var(--color-card-surface, var(--color-surface-2))",
                border: "1px solid var(--color-border)",
              }}
            >
              <div className="flex items-center gap-3">
                <h3 className="text-h3 text-text-primary">
                  Supporting Materials
                </h3>
                {completion.done["files"] && <CompletedDot />}
              </div>
              <p className="mt-2" style={INSTRUCTION_STYLE}>
                Upload any existing materials. The Strategy Engine reads and
                integrates all uploaded documents. You do not need to summarise
                them.
              </p>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  if (e.dataTransfer.files) addFiles(e.dataTransfer.files, "support");
                }}
                className="mt-4 flex w-full flex-col items-center justify-center rounded-md px-6 py-8 transition-colors"
                style={{
                  border: "1px dashed var(--color-border)",
                  backgroundColor: dragging
                    ? "var(--color-primary-subtle)"
                    : "transparent",
                }}
              >
                <UploadIcon />
                <p className="text-body mt-3 text-text-secondary">
                  Drop files here or click to upload
                </p>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ACCEPTED_TYPES.join(",")}
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) addFiles(e.target.files, "support");
                  e.target.value = "";
                }}
              />
              <p className="mt-3" style={INSTRUCTION_STYLE}>
                Research decks, brand guidelines, campaign work, competitor
                analysis, sales data, customer interviews, previous briefs,
                marketing plans.
              </p>
              {files.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {files.map((f, i) => (
                    <li
                      key={`${f.name}-${i}`}
                      className="text-body-sm inline-flex items-center gap-2 rounded-md px-3 py-1.5"
                      style={{
                        backgroundColor: "var(--color-surface-2)",
                        border: "1px solid var(--color-border)",
                      }}
                    >
                      <span className="text-text-primary">{f.name}</span>
                      <span style={{ color: "var(--color-text-tertiary)" }}>
                        {(f.size / 1024).toFixed(0)} KB
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setFiles((prev) => prev.filter((_, j) => j !== i))
                        }
                        aria-label={`Remove ${f.name}`}
                        className="-mr-1 ml-1 inline-flex h-5 w-5 items-center justify-center rounded text-text-secondary transition-colors hover:bg-border hover:text-text-primary"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* COMPLETION INDICATOR */}
          <div className="mt-6">
            <div className="flex items-center justify-between">
              <span
                className="text-body-sm"
                style={{ color: "var(--color-text-secondary)" }}
              >
                {completion.count} of {completion.total} sections completed
              </span>
              <Legend />
            </div>
            <div
              className="mt-2 h-1.5 w-full overflow-hidden rounded-full"
              style={{ backgroundColor: "var(--color-border)" }}
            >
              <div
                className="h-full transition-all"
                style={{
                  width: `${(completion.count / completion.total) * 100}%`,
                  backgroundColor: "#C81E1E",
                }}
              />
            </div>
          </div>

          {/* SUBMIT + SAVE */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              disabled={!canSubmitSections || submitting}
              className="inline-flex h-[52px] flex-1 items-center justify-center rounded-md text-[16px] transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              style={{
                backgroundColor: canSubmitSections ? "#C81E1E" : "var(--color-border)",
                color: canSubmitSections ? "#0A0908" : "var(--color-text-tertiary)",
                fontWeight: 600,
                cursor: canSubmitSections && !submitting ? "pointer" : "not-allowed",
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting
                ? (isEditMode ? "Resubmitting…" : "Submitting…")
                : (isEditMode ? "Resubmit Amended Brief →" : "Submit Brief to Strategy Engine →")}
            </button>
            <button
              type="button"
              onClick={handleSaveBrief}
              disabled={!canSubmitSections || saving}
              className="inline-flex h-[52px] items-center justify-center rounded-md px-6 text-[15px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-auto"
              style={{
                border: "1px solid #C81E1E",
                color: canSubmitSections ? "#E5484D" : "var(--color-text-tertiary)",
                backgroundColor: "transparent",
                fontWeight: 600,
                cursor: canSubmitSections && !saving ? "pointer" : "not-allowed",
                opacity: saving ? 0.7 : 1,
              }}
              title="Save this brief to your library without starting a pipeline run"
            >
              {saving ? <><Spinner /> Saving…</> : "Save Brief"}
            </button>
          </div>

          <p
            className="text-body-sm mt-3 text-center"
            style={{ color: "#8B8680" }}
          >
            The Strategy Engine will assess your brief and begin processing. You
            will review the output before each major stage advances.
          </p>
          {submitError && (
            <p
              className="text-body-sm mt-3 text-center"
              style={{ color: "var(--color-destructive)" }}
            >
              {submitError}
            </p>
          )}
        </form>

        {/* OR DIVIDER */}
        <div className="my-10 flex items-center gap-4">
          <hr className="h-px flex-1 border-0 bg-border" />
          <span className="text-body-sm" style={{ color: "#8B8680" }}>
            OR
          </span>
          <hr className="h-px flex-1 border-0 bg-border" />
        </div>

        {/* LARGE UPLOAD ZONE */}
        <div
          onClick={() => altInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setAltDragging(true);
          }}
          onDragLeave={() => setAltDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setAltDragging(false);
            if (e.dataTransfer.files) addFiles(e.dataTransfer.files, "alt");
          }}
          className="flex cursor-pointer flex-col items-center text-center"
          style={{
            border: "2px dashed #1C1A18",
            borderRadius: 12,
            padding: 48,
            backgroundColor: altDragging ? "#0A0908" : "#1C1A18",
          }}
        >
          <BigUploadIcon />
          <h3
            className="text-h3 mt-4"
            style={{ color: "#EDE8E0" }}
          >
            Upload an existing brief, research document, or marketing plan
          </h3>
          <p
            className="mt-2 max-w-[520px]"
            style={{ color: "#8B8680", fontSize: 15, lineHeight: 1.55 }}
          >
            Upload any document and the Strategy Engine will extract the
            strategic inputs it needs. PDF, DOCX, PPTX, or TXT. Up to 50MB.
          </p>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              altInputRef.current?.click();
            }}
            style={{
              marginTop: 16,
              border: "1px solid #1C1A18",
              background: "transparent",
              color: "#EDE8E0",
              borderRadius: 8,
              padding: "10px 20px",
              fontWeight: 500,
              fontSize: 14,
            }}
          >
            Choose File
          </button>

          {altFile && (
            <div className="mt-5 text-center">
              <p
                className="text-body-sm"
                style={{ color: "#EDE8E0", fontWeight: 500 }}
              >
                {altFile.name} · {(altFile.size / 1024).toFixed(0)} KB
              </p>
              {altStatus === "reading" && (
                <p
                  className="text-body-sm mt-1 inline-flex items-center gap-2"
                  style={{ color: "#8B8680" }}
                >
                  <span
                    className="inline-block h-2 w-2 animate-pulse rounded-full"
                    style={{ backgroundColor: "#C81E1E" }}
                  />
                  Reading document…
                </p>
              )}
              {altStatus === "ready" && (
                <p className="text-body-sm mt-1" style={{ color: "#E5484D" }}>
                  Document received. The Strategy Engine will extract the
                  relevant strategic inputs.
                </p>
              )}
            </div>
          )}
        </div>
        <input
          ref={altInputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files, "alt");
            e.target.value = "";
          }}
        />

        <button
          type="button"
          onClick={handleSubmitAlt}
          disabled={!canSubmitAlt || submitting}
          className="mt-6 inline-flex h-[52px] w-full items-center justify-center rounded-md text-[16px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          style={{
            backgroundColor: canSubmitAlt ? "#C81E1E" : "var(--color-border)",
            color: canSubmitAlt ? "#0A0908" : "var(--color-text-tertiary)",
            fontWeight: 600,
            cursor: canSubmitAlt && !submitting ? "pointer" : "not-allowed",
            opacity: submitting ? 0.7 : 1,
          }}
        >
          Submit Document to Strategy Engine →
        </button>

        <div className="mt-8 text-center">
          <Link
            to="/dashboard"
            className="text-body-sm text-text-secondary transition-colors hover:text-text-primary"
          >
            ← Back to dashboard
          </Link>
        </div>
      </main>
    </div>
  );
}

function HeaderField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-body-sm mb-2 block font-medium text-text-secondary">
        {label}
      </label>
      {children}
    </div>
  );
}

function SectionCard({
  section,
  open,
  onOpenChange,
  values,
  onChange,
  completed,
}: {
  section: Section;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  values: Record<string, string>;
  onChange: (k: string, v: string) => void;
  completed: boolean;
}) {
  return (
    <Collapsible
      open={open}
      onOpenChange={onOpenChange}
      className="rounded-lg"
      style={
        {
          backgroundColor: "var(--color-card-surface, var(--color-surface-2))",
          border: "1px solid var(--color-border)",
        } as React.CSSProperties
      }
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 p-6 text-left"
        >
          <div className="flex items-center gap-3">
            {section.tag === "essential" && <EssentialDot />}
            <h3 className="text-h3 text-text-primary">
              {section.num}. {section.title}
            </h3>
            {section.tag === "optional" && (
              <span
                className="rounded px-2 py-0.5 text-[11px] uppercase tracking-wide"
                style={{
                  backgroundColor: "var(--color-border)",
                  color: "var(--color-text-secondary)",
                }}
              >
                Optional
              </span>
            )}
            {completed && <CompletedDot />}
          </div>
          <ChevronDown
            size={18}
            className="shrink-0 text-text-secondary transition-transform"
            style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-6 pb-6">
          {section.fields.map((f, idx) => (
            <div key={f.key} className={idx === 0 ? "" : "mt-5"}>
              {f.label && (
                <label className="text-body-sm mb-1 block font-medium text-text-primary">
                  {f.label}
                </label>
              )}
              {(f.instruction || section.instruction) && (
                <p
                  className="mb-2"
                  style={INSTRUCTION_STYLE}
                >
                  {f.instruction || section.instruction}
                </p>
              )}
              {f.kind === "select" && f.options ? (
                <div
                  className="flex flex-col gap-2"
                  role="radiogroup"
                  aria-label={section.title}
                >
                  {f.options.map((opt) => {
                    const checked = values[f.key] === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={checked}
                        onClick={() => onChange(f.key, opt.value)}
                        className="flex w-full cursor-pointer items-start gap-3 rounded-md p-3 text-left transition-colors"
                        style={{
                          border: checked
                            ? "1px solid var(--color-primary)"
                            : "1px solid var(--color-border)",
                          backgroundColor: checked
                            ? "var(--color-primary-subtle)"
                            : "transparent",
                          boxShadow: checked
                            ? "0 0 0 1px var(--color-primary)"
                            : "none",
                        }}
                      >
                        <span
                          aria-hidden="true"
                          className="mt-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                          style={{
                            border: checked
                              ? "2px solid var(--color-primary)"
                              : "2px solid var(--color-border-strong)",
                            backgroundColor: "transparent",
                          }}
                        >
                          {checked && (
                            <span
                              className="block h-2 w-2 rounded-full"
                              style={{ backgroundColor: "var(--color-primary)" }}
                            />
                          )}
                        </span>
                        <span className="flex-1">
                          <span className="text-body-sm block font-medium text-text-primary">
                            {opt.label}
                          </span>
                          <span
                            className="text-body-sm block"
                            style={{ color: "var(--color-text-secondary)" }}
                          >
                            {opt.description}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <textarea
                  value={values[f.key] ?? ""}
                  onChange={(e) => onChange(f.key, e.target.value)}
                  className="input-base w-full resize-y"
                  style={{ minHeight: f.minHeight }}
                />
              )}
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function EssentialDot() {
  return (
    <span
      aria-label="Essential"
      title="Essential"
      className="inline-block h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: "#C81E1E" }}
    />
  );
}

function CompletedDot() {
  return (
    <span
      aria-label="Completed"
      className="inline-block h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: "#C81E1E" }}
    />
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-4">
      <span
        className="text-body-sm inline-flex items-center gap-1.5"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        <EssentialDot /> Essential
      </span>
      <span
        className="text-body-sm inline-flex items-center gap-1.5"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        <CompletedDot /> Completed
      </span>
    </div>
  );
}

function UploadIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      style={{ color: "var(--color-text-tertiary)" }}
    >
      <path
        d="M10 13V3M10 3L6 7M10 3L14 7M3 14V16C3 16.5523 3.44772 17 4 17H16C16.5523 17 17 16.5523 17 16V14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BigUploadIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <path
        d="M16 21V5M16 5L9 12M16 5L23 12M5 23V26C5 26.8 5.7 27.5 6.5 27.5H25.5C26.3 27.5 27 26.8 27 26V23"
        stroke="#C81E1E"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
