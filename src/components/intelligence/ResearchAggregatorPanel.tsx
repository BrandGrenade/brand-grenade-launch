// Research Aggregator panel — a second, additional intake path for the
// Intelligence Lab. Users dump messy, unsorted research here and the system
// extracts claims, classifies them into the six real categories, splits
// externally-verifiable from client-proprietary, verifies the former, and
// proposes structured, attributed entries for the six existing fields.
//
// Nothing is written until the user clicks Apply — the six textareas below
// remain the human checkpoint and stay fully editable.

import { useRef, useState } from "react";
import { FileText, Loader2, Sparkles, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { aggregateResearch } from "@/lib/aggregator.functions";
import {
  AGGREGATOR_CATEGORIES,
  type AggregatorCategory,
  type AggregatorResult,
} from "@/lib/aggregator/types";
import {
  ACCEPT_ATTR,
  MAX_FILE_BYTES,
  detectKind,
  extractFileText,
  type FileKind,
} from "@/lib/intelligence/file-extract";

interface RawDoc {
  id: string;
  name: string;
  size: number;
  kind: FileKind;
  text: string;
  status: "processing" | "complete" | "error";
  error?: string;
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export interface ResearchAggregatorPanelProps {
  brand: string;
  category: string;
  onApply: (fields: Record<AggregatorCategory, string>) => void;
}

export function ResearchAggregatorPanel({
  brand,
  category,
  onApply,
}: ResearchAggregatorPanelProps) {
  const runAggregate = useServerFn(aggregateResearch);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [docs, setDocs] = useState<RawDoc[]>([]);
  const [pasted, setPasted] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AggregatorResult | null>(null);
  const [applied, setApplied] = useState(false);

  async function handleFiles(list: FileList | File[]) {
    const arr = Array.from(list);
    const valid: File[] = [];
    for (const f of arr) {
      if (!detectKind(f)) {
        toast.error(`${f.name} — unsupported type`);
        continue;
      }
      if (f.size > MAX_FILE_BYTES) {
        toast.error(`${f.name} — exceeds 10MB per-file limit`);
        continue;
      }
      valid.push(f);
    }
    if (valid.length === 0) return;

    const placeholders: RawDoc[] = valid.map((f) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: f.name,
      size: f.size,
      kind: detectKind(f)!,
      text: "",
      status: "processing",
    }));
    setDocs((prev) => [...prev, ...placeholders]);

    for (let i = 0; i < valid.length; i++) {
      try {
        const text = await extractFileText(valid[i]);
        setDocs((prev) =>
          prev.map((d) =>
            d.id === placeholders[i].id
              ? { ...d, text, status: "complete" as const }
              : d,
          ),
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Extraction failed";
        setDocs((prev) =>
          prev.map((d) =>
            d.id === placeholders[i].id
              ? { ...d, status: "error" as const, error: msg }
              : d,
          ),
        );
        toast.error(`${valid[i].name}: ${msg}`);
      }
    }
  }

  async function handleRun() {
    if (running) return;
    if (!brand.trim() || !category.trim()) {
      toast.error("Enter brand name and category above first.");
      return;
    }
    if (docs.some((d) => d.status === "processing")) {
      toast.error("Wait for file extraction to finish.");
      return;
    }
    const documents = [
      ...docs
        .filter((d) => d.status === "complete" && d.text.trim().length > 0)
        .map((d) => ({ name: d.name, text: d.text })),
      ...(pasted.trim().length > 0
        ? [{ name: "Pasted raw research", text: pasted.trim() }]
        : []),
    ];
    if (documents.length === 0) {
      toast.error("Add at least one file or paste some raw research.");
      return;
    }

    setRunning(true);
    setResult(null);
    setApplied(false);
    try {
      const res = await runAggregate({
        data: { brandName: brand.trim(), category: category.trim(), documents },
      });
      setResult(res);
      if (res.stats.totalClaims === 0) {
        toast.error("No classifiable claims were found in that material.");
      } else {
        toast.success(
          `${res.stats.totalClaims} claims extracted and classified. Review before applying.`,
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Aggregation failed";
      toast.error(msg);
    } finally {
      setRunning(false);
    }
  }

  function handleApply() {
    if (!result) return;
    onApply(result.fields);
    setApplied(true);
    toast.success("Applied to the six research fields below. Review and edit before running.");
  }

  const perCategory = AGGREGATOR_CATEGORIES.map((c) => ({
    ...c,
    count: result ? result.claims.filter((cl) => cl.categories.includes(c.key)).length : 0,
  }));

  return (
    <Card className="p-6">
      <div className="flex items-baseline gap-3">
        <Sparkles className="h-4 w-4 flex-shrink-0" style={{ color: "#C81E1E" }} />
        <div className="flex-1">
          <h2 className="text-h4 text-text-primary">Upload raw, unsorted research</h2>
          <p className="text-sm mt-1 text-text-secondary">
            Optional. Dump messy, uncategorised material here and the Aggregator
            extracts individual claims, files each one under the right heading(s),
            separates client-proprietary data from publicly checkable claims, and
            fact-checks only the latter. Nothing is written to the six fields below
            until you apply it.
          </p>
          <p className="text-[13px] mt-1 italic text-text-secondary/80">
            Extraction is plain text only — table structure and page/slide
            provenance are not preserved. Scanned/image-only PDFs and web links are
            not supported.
          </p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT_ATTR}
        style={{ display: "none" }}
        onChange={(e) => {
          if (e.target.files) void handleFiles(e.target.files);
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
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files) void handleFiles(e.dataTransfer.files);
        }}
        className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed p-5 text-[13px] text-text-secondary hover:text-text-primary"
        style={{ borderColor: "rgba(139,134,128,0.35)" }}
      >
        <Upload className="h-4 w-4" />
        Drop mixed research files here, or click to browse (PDF, DOCX, PPTX, XLSX, CSV, TXT)
      </div>

      {docs.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {docs.map((d) => (
            <li
              key={d.id}
              className="flex items-center gap-2 text-[13px] text-text-secondary"
            >
              {d.status === "processing" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileText className="h-3.5 w-3.5" />
              )}
              <span className="text-text-primary">{d.name}</span>
              <span>{fmtBytes(d.size)}</span>
              {d.status === "error" ? (
                <span className="text-destructive">{d.error}</span>
              ) : null}
              <button
                type="button"
                aria-label={`Remove ${d.name}`}
                className="ml-auto hover:text-text-primary"
                onClick={() => setDocs((prev) => prev.filter((x) => x.id !== d.id))}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <Textarea
        value={pasted}
        onChange={(e) => setPasted(e.target.value)}
        placeholder="…or paste raw, unsorted research here"
        className="mt-4 min-h-[120px] font-mono text-[13px]"
        maxLength={400_000}
      />

      <div className="mt-4 flex items-center gap-3">
        <Button type="button" onClick={() => void handleRun()} disabled={running}>
          {running ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sorting and verifying…
            </>
          ) : (
            "Sort and verify"
          )}
        </Button>
        {running ? (
          <span className="text-[13px] text-text-secondary">
            Live web search runs on publicly checkable claims only — this can take
            a few minutes.
          </span>
        ) : null}
      </div>

      {result ? (
        <div
          className="mt-5 border-t pt-4"
          style={{ borderColor: "rgba(139,134,128,0.15)" }}
        >
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-text-secondary">
            <span>
              <strong className="text-text-primary">{result.stats.totalClaims}</strong>{" "}
              claims
            </span>
            <span>
              {result.stats.externallyVerifiable} externally verifiable ·{" "}
              {result.stats.clientProprietary} client-proprietary
            </span>
            <span>
              {result.stats.verified} verified · {result.stats.flagged} flagged
            </span>
          </div>

          <div className="mt-3 space-y-1.5">
            {perCategory.map((c) => (
              <div key={c.key} className="flex items-baseline gap-2 text-[13px]">
                <span
                  style={{ color: c.count > 0 ? "#C81E1E" : "#8B8680" }}
                  className="w-8"
                >
                  {c.count}
                </span>
                <span
                  className={
                    c.count > 0 ? "text-text-primary" : "text-text-secondary"
                  }
                >
                  {c.title}
                </span>
              </div>
            ))}
          </div>

          {result.warnings.length > 0 ? (
            <ul className="mt-3 space-y-1 text-[13px] text-destructive">
              {result.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          ) : null}

          <div className="mt-4 flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleApply}
              disabled={result.stats.totalClaims === 0}
            >
              {applied ? "Apply again" : "Apply to the six fields below"}
            </Button>
            <span className="text-[13px] text-text-secondary">
              Human checkpoint — applied entries stay editable below.
            </span>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
