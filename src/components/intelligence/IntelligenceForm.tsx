// Shared research-input form for the Intelligence Lab.
// Used by /intelligence/new (create) and /intelligence/$id/edit (edit + re-run).

import { useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Circle, FileText, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ACCEPT_ATTR,
  MAX_FILE_BYTES,
  MAX_TOTAL_BYTES,
  detectKind,
  extractFileText,
  type FileKind,
} from "@/lib/intelligence/file-extract";
import { ResearchSynthesiserPanel } from "@/components/intelligence/ResearchSynthesiserPanel";

export type BriefType = "commercial" | "government";

export type SectionKey =
  | "input_primary_consumer"
  | "input_brand_health"
  | "input_competitive_audit"
  | "input_cultural_trends"
  | "input_audience_segmentation"
  | "input_bg_intel_pack";

interface SectionSpec {
  key: SectionKey;
  number: string;
  title: string;
  description: string;
  helper: string;
}

export const SECTIONS: SectionSpec[] = [
  {
    key: "input_primary_consumer",
    number: "01",
    title: "Primary Consumer Research",
    description:
      "Quantitative consumer attitude studies, brand perception surveys, category usage and attitude studies.",
    helper: "Absence reduces confidence in perceptual and emotional white space mapping.",
  },
  {
    key: "input_brand_health",
    number: "02",
    title: "Brand Health Tracking Data",
    description:
      "Longitudinal brand health metrics — awareness, consideration, preference, brand association strength over time.",
    helper: "Absence reduces confidence in hermit crab vulnerability identification.",
  },
  {
    key: "input_competitive_audit",
    number: "03",
    title: "Competitive Communications Audit",
    description:
      "What competitors are currently saying across advertising, PR, social, and owned content.",
    helper: "Absence reduces confidence in competitive vulnerability mapping.",
  },
  {
    key: "input_cultural_trends",
    number: "04",
    title: "Cultural Trend Analysis",
    description:
      "Cultural intelligence reports, social listening data, media trend reporting.",
    helper: "Absence reduces confidence in moment-activated opportunity identification.",
  },
  {
    key: "input_audience_segmentation",
    number: "05",
    title: "Audience Segmentation Research",
    description:
      "Defined audience segments by attitude, behaviour, need state, or cultural identity.",
    helper: "Absence reduces confidence in audience readiness assessment.",
  },
  {
    key: "input_bg_intel_pack",
    number: "06",
    title: "Brand Grenade Intelligence Pack",
    description: "The standard Brand Grenade pre-pipeline intelligence document.",
    helper: "Functions as research substitute when primary research is not available.",
  },
];

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  kind: FileKind;
  text: string;
  status: "processing" | "complete" | "error";
  error?: string;
}

export type InputMap = Record<SectionKey, string>;
type FileMap = Record<SectionKey, UploadedFile[]>;

const EMPTY_INPUTS: InputMap = {
  input_primary_consumer: "",
  input_brand_health: "",
  input_competitive_audit: "",
  input_cultural_trends: "",
  input_audience_segmentation: "",
  input_bg_intel_pack: "",
};

const EMPTY_FILES: FileMap = {
  input_primary_consumer: [],
  input_brand_health: [],
  input_competitive_audit: [],
  input_cultural_trends: [],
  input_audience_segmentation: [],
  input_bg_intel_pack: [],
};

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export interface IntelligenceFormValues {
  brand_name: string;
  category: string;
  brief_type: BriefType;
  markets: string | null;
  audience_context_notes: string | null;
  input_primary_consumer: string | null;
  input_brand_health: string | null;
  input_competitive_audit: string | null;
  input_cultural_trends: string | null;
  input_audience_segmentation: string | null;
  input_bg_intel_pack: string | null;
  input_files: {
    field: SectionKey;
    filename: string;
    extracted_text_preview: string;
    file_type: FileKind;
    upload_status: "complete" | "error";
  }[];
}

export interface IntelligenceFormProps {
  initialBrand?: string;
  initialCategory?: string;
  initialBriefType?: BriefType;
  initialMarkets?: string;
  initialAudienceNotes?: string;
  initialInputs?: Partial<InputMap>;
  submitLabel: string;
  submittingLabel: string;
  cancelHref: string;
  cancelParams?: Record<string, string>;
  cancelLabel?: string;
  onSubmit: (values: IntelligenceFormValues) => Promise<void>;
}

export function IntelligenceForm({
  initialBrand = "",
  initialCategory = "",
  initialBriefType = "commercial",
  initialMarkets = "",
  initialAudienceNotes = "",
  initialInputs,
  submitLabel,
  submittingLabel,
  cancelHref,
  cancelParams,
  cancelLabel = "Cancel",
  onSubmit,
}: IntelligenceFormProps) {
  const [brand, setBrand] = useState(initialBrand);
  const [category, setCategory] = useState(initialCategory);
  const [briefType, setBriefType] = useState<BriefType>(initialBriefType);
  const [markets, setMarkets] = useState(initialMarkets);
  const [audienceNotes, setAudienceNotes] = useState(initialAudienceNotes);
  const [inputs, setInputs] = useState<InputMap>({
    ...EMPTY_INPUTS,
    ...initialInputs,
  });
  const [files, setFiles] = useState<FileMap>(EMPTY_FILES);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{
    brand?: string;
    category?: string;
    inputs?: string;
  }>({});

  const totalBytes = useMemo(
    () =>
      Object.values(files).reduce(
        (sum, list) => sum + list.reduce((s, f) => s + f.size, 0),
        0,
      ),
    [files],
  );

  const sectionHasContent = (key: SectionKey) =>
    inputs[key].trim().length > 0 ||
    files[key].some((f) => f.status === "complete");

  const presentCount = useMemo(
    () => SECTIONS.filter((s) => sectionHasContent(s.key)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inputs, files],
  );

  const confidence: "High" | "Moderate" | "Low" =
    presentCount >= 4 ? "High" : presentCount >= 2 ? "Moderate" : "Low";

  const confidenceColor =
    confidence === "High"
      ? "#C81E1E"
      : confidence === "Moderate"
        ? "#C81E1E"
        : "#8B8680";

  async function handleFilesAdded(key: SectionKey, list: FileList | File[]) {
    const arr = Array.from(list);
    if (arr.length === 0) return;

    const rejected: string[] = [];
    const valid: File[] = [];
    for (const f of arr) {
      const kind = detectKind(f);
      if (!kind) {
        rejected.push(`${f.name} — unsupported type`);
        continue;
      }
      if (f.size > MAX_FILE_BYTES) {
        rejected.push(`${f.name} — exceeds 10MB per-file limit`);
        continue;
      }
      valid.push(f);
    }
    if (rejected.length > 0) {
      toast.error(rejected.join(" · "));
    }
    if (valid.length === 0) return;

    const incoming = valid.reduce((s, f) => s + f.size, 0);
    if (totalBytes + incoming > MAX_TOTAL_BYTES) {
      toast.error(
        `Total upload exceeds 50MB session limit (current ${fmtBytes(
          totalBytes,
        )}, adding ${fmtBytes(incoming)}).`,
      );
      return;
    }

    const placeholders: UploadedFile[] = valid.map((f) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: f.name,
      size: f.size,
      kind: detectKind(f)!,
      text: "",
      status: "processing",
    }));
    setFiles((prev) => ({ ...prev, [key]: [...prev[key], ...placeholders] }));

    for (let i = 0; i < valid.length; i++) {
      const file = valid[i];
      const placeholder = placeholders[i];
      try {
        const text = await extractFileText(file);
        setFiles((prev) => ({
          ...prev,
          [key]: prev[key].map((it) =>
            it.id === placeholder.id
              ? { ...it, text, status: "complete" as const }
              : it,
          ),
        }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Extraction failed";
        setFiles((prev) => ({
          ...prev,
          [key]: prev[key].map((it) =>
            it.id === placeholder.id
              ? { ...it, status: "error" as const, error: msg }
              : it,
          ),
        }));
        toast.error(`${file.name}: ${msg}`);
      }
    }
  }

  function removeFile(key: SectionKey, id: string) {
    setFiles((prev) => ({
      ...prev,
      [key]: prev[key].filter((f) => f.id !== id),
    }));
  }

  function combinedText(key: SectionKey): string | null {
    const pasted = inputs[key].trim();
    const extracted = files[key]
      .filter((f) => f.status === "complete" && f.text.trim().length > 0)
      .map((f) => `[FILE: ${f.name}]\n${f.text.trim()}`)
      .join("\n\n");
    const combined = [pasted, extracted].filter(Boolean).join("\n\n");
    return combined.length > 0 ? combined : null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    const stillProcessing = Object.values(files).some((list) =>
      list.some((f) => f.status === "processing"),
    );
    if (stillProcessing) {
      toast.error("Please wait for all file uploads to finish processing.");
      return;
    }

    const nextErrors: typeof errors = {};
    if (brand.trim().length < 1) nextErrors.brand = "Brand name is required";
    if (category.trim().length < 1) nextErrors.category = "Category is required";
    if (presentCount < 1)
      nextErrors.inputs = "Provide at least one research input below";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast.error("Please complete the required fields");
      return;
    }

    const inputFilesMeta = SECTIONS.flatMap((s) =>
      files[s.key].map((f) => ({
        field: s.key,
        filename: f.name,
        extracted_text_preview: (f.text ?? "").slice(0, 200),
        file_type: f.kind,
        upload_status: f.status === "complete" ? ("complete" as const) : ("error" as const),
      })),
    );

    setBusy(true);
    try {
      await onSubmit({
        brand_name: brand.trim(),
        category: category.trim(),
        brief_type: briefType,
        markets: markets.trim() || null,
        audience_context_notes: audienceNotes.trim() || null,
        input_primary_consumer: combinedText("input_primary_consumer"),
        input_brand_health: combinedText("input_brand_health"),
        input_competitive_audit: combinedText("input_competitive_audit"),
        input_cultural_trends: combinedText("input_cultural_trends"),
        input_audience_segmentation: combinedText("input_audience_segmentation"),
        input_bg_intel_pack: combinedText("input_bg_intel_pack"),
        input_files: inputFilesMeta,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Submission failed";
      toast.error(msg);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-10 grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="space-y-8">
        <Card className="p-6">
          <h2 className="text-h4 text-text-primary">Brief framing</h2>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <div>
              <Label htmlFor="brand">Brand name *</Label>
              <Input
                id="brand"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                maxLength={200}
                className="mt-1.5"
              />
              {errors.brand ? (
                <p className="mt-1.5 text-[13px] text-destructive">{errors.brand}</p>
              ) : null}
            </div>
            <div>
              <Label htmlFor="category">Category *</Label>
              <Input
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                maxLength={200}
                className="mt-1.5"
              />
              {errors.category ? (
                <p className="mt-1.5 text-[13px] text-destructive">{errors.category}</p>
              ) : null}
            </div>
            <div>
              <Label htmlFor="briefType">Brief type</Label>
              <Select
                value={briefType}
                onValueChange={(v) => setBriefType(v as BriefType)}
              >
                <SelectTrigger id="briefType" className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="commercial">Commercial</SelectItem>
                  <SelectItem value="government">Government</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="markets">Markets</Label>
              <Input
                id="markets"
                value={markets}
                onChange={(e) => setMarkets(e.target.value)}
                placeholder="e.g. Australia, United Kingdom"
                maxLength={500}
                className="mt-1.5"
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="audience">Audience context notes</Label>
              <Input
                id="audience"
                value={audienceNotes}
                onChange={(e) => setAudienceNotes(e.target.value)}
                placeholder="e.g. Multicultural focus, CALD communities, specific demographic segments"
                maxLength={2000}
                className="mt-1.5"
              />
            </div>
          </div>
        </Card>


        {SECTIONS.map((s) => (

          <ResearchSection
            key={s.key}
            spec={s}
            value={inputs[s.key]}
            files={files[s.key]}
            present={sectionHasContent(s.key)}
            onChange={(v) =>
              setInputs((prev) => ({ ...prev, [s.key]: v }))
            }
            onFilesAdded={(list) => handleFilesAdded(s.key, list)}
            onRemoveFile={(id) => removeFile(s.key, id)}
          />
        ))}

        {errors.inputs ? (
          <p className="text-sm text-destructive">{errors.inputs}</p>
        ) : null}

        <div className="flex items-center justify-end gap-3">
          <Link
            to={cancelHref}
            params={cancelParams as never}
            className="text-label text-text-secondary hover:text-text-primary"
          >
            {cancelLabel}
          </Link>
          <Button type="submit" disabled={busy} size="lg">
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {submittingLabel}
              </>
            ) : (
              submitLabel
            )}
          </Button>
        </div>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <Card className="p-5">
          <h2 className="text-h5 text-text-primary">Completeness preview</h2>
          <p className="text-[13px] text-text-secondary mt-1">
            Updates live as you fill in sections.
          </p>

          <div className="mt-4 space-y-2">
            {SECTIONS.map((s) => {
              const present = sectionHasContent(s.key);
              return (
                <div key={s.key} className="flex items-start gap-2.5 text-[13px]">
                  {present ? (
                    <Check
                      className="h-4 w-4 flex-shrink-0 mt-0.5"
                      style={{ color: "#C81E1E" }}
                    />
                  ) : (
                    <Circle
                      className="h-4 w-4 flex-shrink-0 mt-0.5"
                      style={{ color: "#1C1A18" }}
                    />
                  )}
                  <span
                    className={present ? "text-text-primary" : "text-text-secondary"}
                  >
                    {s.number} · {s.title}
                  </span>
                </div>
              );
            })}
          </div>

          <div
            className="mt-5 pt-4 border-t"
            style={{ borderColor: "rgba(139, 134, 128,0.15)" }}
          >
            <div className="flex items-baseline justify-between">
              <span className="text-label text-text-secondary">
                Predicted confidence
              </span>
              <span
                className="text-h4 font-semibold"
                style={{ color: confidenceColor }}
              >
                {confidence}
              </span>
            </div>
            <p className="text-[13px] text-text-secondary mt-1.5">
              {presentCount} of 6 inputs present
            </p>
            <p className="text-[13px] text-text-secondary mt-1">
              {fmtBytes(totalBytes)} / 50 MB uploaded
            </p>
          </div>
        </Card>
      </aside>
    </form>
  );
}

interface ResearchSectionProps {
  spec: SectionSpec;
  value: string;
  files: UploadedFile[];
  present: boolean;
  onChange: (v: string) => void;
  onFilesAdded: (list: FileList | File[]) => void;
  onRemoveFile: (id: string) => void;
}

function ResearchSection({
  spec,
  value,
  files,
  present,
  onChange,
  onFilesAdded,
  onRemoveFile,
}: ResearchSectionProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);

  return (
    <Card className="p-6">
      <div className="flex items-baseline gap-3">
        <span
          className="text-label"
          style={{ color: present ? "#C81E1E" : "#8B8680" }}
        >
          {spec.number}
        </span>
        <div className="flex-1">
          <h3 className="text-h4 text-text-primary">{spec.title}</h3>
          <p className="text-sm mt-1 text-text-secondary">{spec.description}</p>
          <p className="text-[13px] mt-1 italic text-text-secondary/80">
            {spec.helper}
          </p>
        </div>
      </div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Paste content here…"
        className="mt-4 min-h-[160px] font-mono text-[13px]"
        maxLength={400_000}
      />

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT_ATTR}
        style={{ display: "none" }}
        onChange={(e) => {
          if (e.target.files) onFilesAdded(e.target.files);
          e.target.value = "";
        }}
      />
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files) onFilesAdded(e.dataTransfer.files);
        }}
        className="mt-3 flex flex-col items-center justify-center rounded-md px-4 py-6 text-center transition-colors cursor-pointer"
        style={{
          border: `1px dashed ${dragOver ? "#C81E1E" : "rgba(139, 134, 128,0.35)"}`,
          backgroundColor: dragOver ? "rgba(200, 30, 30,0.06)" : "transparent",
        }}
      >
        <Upload className="h-4 w-4 text-text-secondary" />
        <p className="text-[13px] mt-2 text-text-secondary">
          Drop files here or click to upload
        </p>
        <p className="text-[11px] mt-1 text-text-secondary/70">
          PDF, DOCX, PPTX, XLSX, CSV, TXT · up to 10 MB per file
        </p>
      </div>

      {files.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {files.map((f) => (
            <li
              key={f.id}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-[13px]"
              style={{
                border: "1px solid rgba(139, 134, 128,0.2)",
                backgroundColor: "rgba(139, 134, 128,0.05)",
              }}
            >
              {f.status === "processing" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              ) : f.status === "error" ? (
                <X className="h-3.5 w-3.5 text-destructive" />
              ) : (
                <FileText className="h-3.5 w-3.5 text-text-secondary" />
              )}
              <span className="flex-1 truncate text-text-primary">{f.name}</span>
              <span className="text-text-secondary">{fmtBytes(f.size)}</span>
              {f.status === "processing" ? (
                <span className="text-text-secondary">extracting…</span>
              ) : f.status === "error" ? (
                <span className="text-destructive">{f.error ?? "error"}</span>
              ) : (
                <span className="text-text-secondary">
                  {f.text.length.toLocaleString()} chars
                </span>
              )}
              <button
                type="button"
                onClick={() => onRemoveFile(f.id)}
                className="ml-1 text-text-secondary hover:text-text-primary"
                aria-label={`Remove ${f.name}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
