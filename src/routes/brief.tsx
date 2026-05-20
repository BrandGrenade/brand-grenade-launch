import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { createSession } from "@/lib/stage1.functions";
import { getDevModeFromStorage } from "@/lib/dev-mode";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export const Route = createFileRoute("/brief")({
  component: BriefIntake,
  head: () => ({
    meta: [
      { title: "New Run — Brand Grenade" },
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

type SubField = {
  key: string;
  label: string;
  instruction: string;
  minHeight: number;
};

type Section = {
  num: string;
  title: string;
  instruction?: string;
  fields: SubField[];
  tag?: "essential" | "optional";
};

const SECTIONS: Section[] = [
  {
    num: "1",
    title: "The Core Challenge",
    instruction:
      "What is the real problem or opportunity beneath the stated brief? 1–3 sentences. Be brutal. The most useful briefs name the uncomfortable truth the organisation is not saying out loud.",
    tag: "essential",
    fields: [{ key: "s1_core", label: "", instruction: "", minHeight: 120 }],
  },
  {
    num: "2",
    title: "What Success Requires",
    tag: "essential",
    fields: [
      {
        key: "s2_business",
        label: "Business objective",
        instruction: "What commercial outcome must this strategy produce? Be specific.",
        minHeight: 80,
      },
      {
        key: "s2_comms",
        label: "Communication objective",
        instruction: "What must shift in how the audience thinks, feels, or behaves?",
        minHeight: 80,
      },
      {
        key: "s2_strategic",
        label: "Strategic objective",
        instruction: "What position must the brand own that it does not currently own?",
        minHeight: 80,
      },
    ],
  },
  {
    num: "3",
    title: "Who We Are Talking To",
    tag: "essential",
    fields: [
      {
        key: "s3_behaviour",
        label: "Behavioural description",
        instruction:
          "How do these people actually behave in this category — including contradictions between what they say and what they do. Avoid age ranges. Describe behaviour.",
        minHeight: 100,
      },
      {
        key: "s3_tension",
        label: "The tension",
        instruction:
          "What is the specific gap between what this audience wants to believe about themselves and how they actually behave in this category?",
        minHeight: 100,
      },
      {
        key: "s3_relationship",
        label: "Current relationship with the brand",
        instruction: "How does this audience currently see, use, or ignore the brand?",
        minHeight: 80,
      },
    ],
  },
  {
    num: "4",
    title: "What Is Genuinely True About This Brand",
    tag: "essential",
    fields: [
      {
        key: "s4_provable",
        label: "Provable truths",
        instruction:
          "What does this brand or product do that no competitor can honestly claim? Hard facts, performance data, structural advantages.",
        minHeight: 100,
      },
      {
        key: "s4_believed",
        label: "Believed but unproven truths",
        instruction:
          "What do you believe is true about the brand that you cannot yet demonstrate with evidence?",
        minHeight: 80,
      },
    ],
  },
  {
    num: "5",
    title: "The Category This Brand Operates In",
    fields: [
      {
        key: "s5_believes",
        label: "What does the category currently believe?",
        instruction:
          "The dominant assumption every competitor is making — the thing every brand in this space says or implies.",
        minHeight: 80,
      },
      {
        key: "s5_changing",
        label: "What is changing?",
        instruction:
          "The behavioural, cultural, or structural shift that makes now a different moment. What has the category not yet caught up with?",
        minHeight: 80,
      },
      {
        key: "s5_unsaid",
        label: "What has the category never been willing to say?",
        instruction:
          "The uncomfortable truth no established player has named — possibly because naming it would implicate their own model.",
        minHeight: 100,
      },
    ],
  },
  {
    num: "6",
    title: "The Competitive Landscape",
    fields: [
      {
        key: "s6_competitors",
        label: "Primary competitors and what they own",
        instruction:
          "For each main competitor — what is the one thing they stand for in the audience's mind? Not their tagline. What they actually mean.",
        minHeight: 120,
      },
      {
        key: "s6_territory",
        label: "Territory no competitor credibly occupies",
        instruction:
          "Where is the gap? What is available that no one has claimed or been willing to claim?",
        minHeight: 80,
      },
    ],
  },
  {
    num: "7",
    title: "Constraints and Commitments",
    fields: [
      {
        key: "s7_never",
        label: "What the brand must never say or imply",
        instruction:
          "Specific language, claims, associations, or tonal territories that are off-limits and why.",
        minHeight: 80,
      },
      {
        key: "s7_commit",
        label: "What the brand must commit to beyond communications",
        instruction:
          "If this strategy works, what will the brand need to actually do in its product, pricing, or behaviour to make the positioning credible?",
        minHeight: 80,
      },
      {
        key: "s7_equities",
        label: "Existing equities to protect",
        instruction:
          "What has the brand built that any new strategy must not contradict or abandon?",
        minHeight: 80,
      },
    ],
  },
  {
    num: "8",
    title: "How We Will Know It Worked",
    tag: "optional",
    fields: [
      {
        key: "s8_measure",
        label: "",
        instruction:
          "Specific measurable outcomes that would confirm the strategy has succeeded. Commercial, perceptual, or behavioural.",
        minHeight: 80,
      },
    ],
  },
];

const INSTRUCTION_STYLE: React.CSSProperties = {
  color: "#8A8680",
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
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Large alt upload zone
  const [altFile, setAltFile] = useState<File | null>(null);
  const [altStatus, setAltStatus] = useState<"idle" | "reading" | "ready">("idle");
  const [altDragging, setAltDragging] = useState(false);
  const altInputRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Section completion (any field has 10+ chars)
  const completion = useMemo(() => {
    const done: Record<string, boolean> = {};
    for (const s of SECTIONS) {
      done[s.num] = s.fields.some((f) => (values[f.key] ?? "").trim().length >= 10);
    }
    done["9"] = files.length > 0;
    const count = Object.values(done).filter(Boolean).length;
    return { done, count, total: 9 };
  }, [values, files]);

  const canSubmitSections =
    brand.trim().length >= 2 &&
    completion.done["1"] &&
    completion.done["2"] &&
    completion.done["3"];

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

  function composeBriefText(): string {
    const parts: string[] = [];
    if (briefTitle.trim()) parts.push(`# ${briefTitle.trim()}`);
    parts.push(`Date: ${date}`);
    if (submittedBy.trim()) parts.push(`Submitted by: ${submittedBy.trim()}`);
    parts.push("");
    for (const s of SECTIONS) {
      const lines: string[] = [];
      for (const f of s.fields) {
        const v = (values[f.key] ?? "").trim();
        if (!v) continue;
        if (f.label) lines.push(`**${f.label}**`);
        lines.push(v);
        lines.push("");
      }
      if (lines.length === 0) continue;
      parts.push(`## ${s.num}. ${s.title}`);
      parts.push(...lines);
    }
    if (files.length > 0) {
      parts.push(`## 9. Supporting Materials`);
      parts.push(files.map((f) => `- ${f.name}`).join("\n"));
    }
    return parts.join("\n");
  }

  async function handleSubmitSections(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmitSections || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const briefText = composeBriefText();
      const { sessionId } = await createSessionFn({
        data: {
          brandName: brand.trim(),
          category: category.trim() || "Unspecified",
          strategicMode: "Auto",
          briefText,
          devMode: getDevModeFromStorage(),
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
      const { sessionId } = await createSessionFn({
        data: {
          brandName: brand.trim(),
          category: category.trim() || "Unspecified",
          strategicMode: "Auto",
          briefText,
          devMode: getDevModeFromStorage(),
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
          <span className="text-label text-primary">Strategy Brief</span>
          <h1 className="text-h1 mt-3 text-text-primary">Submit your brief</h1>
          <p className="text-body-lg mt-3 text-text-secondary">
            Complete the structured brief below, or upload an existing document
            and the Strategy Engine will extract the strategic inputs.
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
                  9. Supporting Materials
                </h3>
                {completion.done["9"] && <CompletedDot />}
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
                  backgroundColor: "#C8873A",
                }}
              />
            </div>
          </div>

          {/* SUBMIT */}
          <button
            type="submit"
            disabled={!canSubmitSections || submitting}
            className="mt-6 inline-flex h-[52px] w-full items-center justify-center rounded-md text-[16px] transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            style={{
              backgroundColor: canSubmitSections ? "#C8873A" : "var(--color-border)",
              color: canSubmitSections ? "#0A0A0A" : "var(--color-text-tertiary)",
              fontWeight: 600,
              cursor: canSubmitSections && !submitting ? "pointer" : "not-allowed",
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? "Submitting…" : "Submit Brief to Strategy Engine →"}
          </button>
          <p
            className="text-body-sm mt-3 text-center"
            style={{ color: "#5A5652" }}
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
          <span className="text-body-sm" style={{ color: "#5A5652" }}>
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
            border: "2px dashed #2A2A2A",
            borderRadius: 12,
            padding: 48,
            backgroundColor: altDragging ? "#1a1a1a" : "#141414",
          }}
        >
          <BigUploadIcon />
          <h3
            className="text-h3 mt-4"
            style={{ color: "#F0EDE8" }}
          >
            Upload an existing brief, research document, or marketing plan
          </h3>
          <p
            className="mt-2 max-w-[520px]"
            style={{ color: "#8A8680", fontSize: 15, lineHeight: 1.55 }}
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
              border: "1px solid #2A2A2A",
              background: "transparent",
              color: "#F0EDE8",
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
                style={{ color: "#F0EDE8", fontWeight: 500 }}
              >
                {altFile.name} · {(altFile.size / 1024).toFixed(0)} KB
              </p>
              {altStatus === "reading" && (
                <p
                  className="text-body-sm mt-1 inline-flex items-center gap-2"
                  style={{ color: "#8A8680" }}
                >
                  <span
                    className="inline-block h-2 w-2 animate-pulse rounded-full"
                    style={{ backgroundColor: "#C8873A" }}
                  />
                  Reading document…
                </p>
              )}
              {altStatus === "ready" && (
                <p className="text-body-sm mt-1" style={{ color: "#4A7C59" }}>
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
            backgroundColor: canSubmitAlt ? "#C8873A" : "var(--color-border)",
            color: canSubmitAlt ? "#0A0A0A" : "var(--color-text-tertiary)",
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
              <textarea
                value={values[f.key] ?? ""}
                onChange={(e) => onChange(f.key, e.target.value)}
                className="input-base w-full resize-y"
                style={{ minHeight: f.minHeight }}
              />
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
      style={{ backgroundColor: "#C8873A" }}
    />
  );
}

function CompletedDot() {
  return (
    <span
      aria-label="Completed"
      className="inline-block h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: "#4A7C59" }}
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
        stroke="#C8873A"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
