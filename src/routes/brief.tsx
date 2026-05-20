import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState } from "react";
import { TopNav } from "@/components/TopNav";
import { createSession } from "@/lib/stage1.functions";

export const Route = createFileRoute("/brief")({
  component: BriefIntake,
  head: () => ({
    meta: [
      { title: "New Run — Brand Grenade" },
      {
        name: "description",
        content:
          "Submit a brief to start a 20-stage strategy pipeline run. Brand, category, objective and audience required.",
      },
    ],
  }),
});

const STRATEGIC_MODES = [
  "Disruption Mode (Default)",
  "Ogilvy Mode — Clarity and product truth",
  "W+K Mode — Cultural tension and behavioural truth",
  "Stephen King Mode — Deep human psychology",
  "Behavioural Systems Mode — Habit and decision architecture",
  "Product Truth Mode — Function-led meaning",
  "Challenger Brand Mode — Anti-category framing",
  "JWT Mode — Big idea simplicity",
];

const MAX_BRIEF_CHARS = 20000;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES = [".pdf", ".docx", ".txt"];

// Naive heuristic — looks for indicator phrases in the brief text.
const OBJECTIVE_KEYWORDS = [
  "objective", "goal", "challenge", "problem", "task",
  "need to", "want to", "must", "kpi", "outcome",
];
const AUDIENCE_KEYWORDS = [
  "audience", "target", "consumer", "customer", "buyer",
  "demographic", "psychograph", "user", "shopper",
];

function detect(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((k) => lower.includes(k));
}

function BriefIntake() {
  const navigate = useNavigate();
  const createSessionFn = useServerFn(createSession);
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [mode, setMode] = useState(STRATEGIC_MODES[0]);
  const [brief, setBrief] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validation = useMemo(() => {
    const brandOk = brand.trim().length >= 2;
    const categoryOk = category.trim().length >= 2;
    const briefHasObjective = brief.trim().length > 40 && detect(brief, OBJECTIVE_KEYWORDS);
    const briefHasAudience = brief.trim().length > 40 && detect(brief, AUDIENCE_KEYWORDS);
    return {
      brand: brandOk,
      category: categoryOk,
      objective: briefHasObjective,
      audience: briefHasAudience,
    };
  }, [brand, category, brief]);

  const allValid = Object.values(validation).every(Boolean);

  function addFiles(incoming: FileList | File[]) {
    const list = Array.from(incoming).filter((f) => {
      const ext = "." + f.name.split(".").pop()?.toLowerCase();
      if (!ACCEPTED_TYPES.includes(ext)) return false;
      if (f.size > MAX_FILE_BYTES) return false;
      return true;
    });
    setFiles((prev) => [...prev, ...list]);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!allValid || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const { sessionId } = await createSessionFn({
        data: {
          brandName: brand.trim(),
          category: category.trim(),
          strategicMode: mode,
          briefText: brief.trim(),
        },
      });
      navigate({ to: "/pipeline", search: { session: sessionId } });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to start pipeline");
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNav />

      <main className="mx-auto w-full max-w-[720px] px-5 pb-16 pt-12 sm:px-6">
        {/* Header */}
        <header>
          <span className="text-label text-primary">Stage 1 — Brief Intake</span>
          <h1 className="text-h1 mt-3 text-text-primary">Submit your brief</h1>
          <p className="text-body-lg mt-3 text-text-secondary">
            The pipeline requires four elements to proceed: brand context,
            category context, an objective or challenge, and an audience
            reference. Provide as much detail as you have.
          </p>
          <hr className="my-8 h-px border-0 bg-border" />
        </header>

        {/* Form card */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="bg-card-surface p-6 sm:p-10">
            <Field
              id="brand"
              label="Brand / Product Name"
              helper="The brand, product, or company this brief is for."
            >
              <input
                id="brand"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                maxLength={120}
                className="input-base h-11 w-full"
                autoComplete="off"
              />
            </Field>

            <Field
              id="category"
              label="Category"
              helper="The market or competitive space the brand operates in."
            >
              <input
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                maxLength={120}
                className="input-base h-11 w-full"
                autoComplete="off"
              />
            </Field>

            <Field
              id="mode"
              label="Strategic Mode"
              helper="Determines the strategic lens applied to reframing. Leave as Disruption Mode if unsure."
            >
              <div className="relative">
                <select
                  id="mode"
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                  className="input-base h-11 w-full appearance-none pr-10"
                >
                  {STRATEGIC_MODES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary" />
              </div>
            </Field>

            <Field
              id="brief"
              label="Raw Brief"
              helper="Paste your brief here. Include any background documents, research references, or supporting context. The more you provide, the richer the output."
            >
              <div className="relative">
                <textarea
                  id="brief"
                  value={brief}
                  onChange={(e) =>
                    setBrief(e.target.value.slice(0, MAX_BRIEF_CHARS))
                  }
                  className="input-base w-full resize-y"
                  style={{ minHeight: 240, paddingBottom: 28 }}
                />
                <span
                  className="text-body-sm pointer-events-none absolute bottom-2 right-3"
                  style={{ color: "var(--color-text-tertiary)" }}
                >
                  {brief.length.toLocaleString()} character
                  {brief.length === 1 ? "" : "s"}
                </span>
              </div>
            </Field>

            <Field
              id="files"
              label="Supporting Documents (optional)"
              helper={null}
            >
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
                  if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
                }}
                className="flex w-full flex-col items-center justify-center rounded-md px-6 py-8 transition-colors"
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
                <p
                  className="text-body-sm mt-1"
                  style={{ color: "var(--color-text-tertiary)" }}
                >
                  PDF, DOCX, or TXT. Max 10MB per file.
                </p>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ACCEPTED_TYPES.join(",")}
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) addFiles(e.target.files);
                  e.target.value = "";
                }}
              />

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
                        onClick={() => removeFile(i)}
                        aria-label={`Remove ${f.name}`}
                        className="-mr-1 ml-1 inline-flex h-5 w-5 items-center justify-center rounded text-text-secondary transition-colors hover:bg-border hover:text-text-primary"
                      >
                        <CloseX />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Field>
          </div>

          {/* Validation panel */}
          <div
            className="mt-6 rounded-lg p-6"
            style={{
              backgroundColor: "var(--color-surface-2)",
              border: "1px solid var(--color-border)",
            }}
          >
            <span className="text-label text-primary">Brief Requirements</span>
            <ul className="mt-4 flex flex-col gap-2.5">
              <ChecklistItem
                label="Brand / product context"
                state={validation.brand ? "satisfied" : "incomplete"}
              />
              <ChecklistItem
                label="Category context"
                state={validation.category ? "satisfied" : "incomplete"}
              />
              <ChecklistItem
                label="Objective or challenge"
                state={validation.objective ? "satisfied" : "incomplete"}
              />
              <ChecklistItem
                label="Audience reference"
                state={validation.audience ? "satisfied" : "incomplete"}
              />
            </ul>
            <p
              className="text-body-sm mt-4"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              The pipeline gatekeeps on these four elements. Incomplete briefs
              are flagged before processing begins.
            </p>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={!allValid || submitting}
            className="mt-6 inline-flex h-[52px] w-full items-center justify-center rounded-md text-[16px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            style={
              allValid && !submitting
                ? {
                    backgroundColor: "var(--color-primary)",
                    color: "var(--color-primary-foreground)",
                  }
                : {
                    backgroundColor: "var(--color-border)",
                    color: "var(--color-text-tertiary)",
                    cursor: "not-allowed",
                  }
            }
            onMouseEnter={(e) => {
              if (allValid && !submitting)
                e.currentTarget.style.backgroundColor =
                  "var(--color-primary-hover)";
            }}
            onMouseLeave={(e) => {
              if (allValid && !submitting)
                e.currentTarget.style.backgroundColor = "var(--color-primary)";
            }}
          >
            {submitting ? "Starting pipeline…" : "Run Pipeline →"}
          </button>

          {submitError && (
            <p
              className="text-body-sm mt-3 text-center"
              style={{ color: "var(--color-destructive)" }}
            >
              {submitError}
            </p>
          )}

          <p
            className="text-body-sm mt-3 text-center"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            The pipeline runs 20 stages and takes approximately 8–12 minutes to
            complete.
          </p>

          <div className="mt-8 text-center">
            <Link
              to="/dashboard"
              className="text-body-sm text-text-secondary transition-colors hover:text-text-primary"
            >
              ← Back to dashboard
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}

function Field({
  id,
  label,
  helper,
  children,
}: {
  id: string;
  label: string;
  helper: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-7 last:mb-0">
      <label
        htmlFor={id}
        className="text-body-sm mb-2 block font-medium text-text-secondary"
      >
        {label}
      </label>
      {children}
      {helper && (
        <p
          className="text-body-sm mt-2"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          {helper}
        </p>
      )}
    </div>
  );
}

type ChecklistState = "incomplete" | "satisfied" | "confirmed";

function ChecklistItem({
  label,
  state,
}: {
  label: string;
  state: ChecklistState;
}) {
  const colors = {
    incomplete: "var(--color-border-strong)",
    satisfied: "var(--color-primary)",
    confirmed: "var(--color-success)",
  } as const;
  const textColor =
    state === "incomplete"
      ? "var(--color-text-secondary)"
      : "var(--color-text-primary)";

  return (
    <li className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
        style={{
          border: `1.5px solid ${colors[state]}`,
          backgroundColor:
            state === "incomplete" ? "transparent" : colors[state],
        }}
      >
        {state !== "incomplete" && <CheckIcon />}
      </span>
      <span className="text-body" style={{ color: textColor }}>
        {label}
      </span>
    </li>
  );
}

function ChevronDown(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" {...props}>
      <path
        d="M3.5 5L7 8.5L10.5 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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

function CheckIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
      <path
        d="M2 5L4 7L8 3"
        stroke="var(--color-background)"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseX() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path
        d="M2 2L8 8M8 2L2 8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
