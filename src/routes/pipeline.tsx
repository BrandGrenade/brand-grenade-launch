import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { tokens } from "@/styles/tokens";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { z } from "zod";
import { TopNav } from "@/components/TopNav";
import { LocControls } from "@/components/LocControls";
import { Checkpoint, buildRevisionInstruction } from "@/components/Checkpoint";
import { SelectionRationale } from "@/components/SelectionRationale";
import { BrandIntelligence } from "@/components/BrandIntelligence";
import { SMPSelection, type SMPCard } from "@/components/SMPSelection";
import { supabase } from "@/integrations/supabase/client";
import { runStage1 } from "@/lib/stage1.functions";
import { runStage1b, resubmitBrief } from "@/lib/stage1b.functions";
import { runStage2 } from "@/lib/stage2.functions";
import { runStage3 } from "@/lib/stage3.functions";
import { runStage4 } from "@/lib/stage4.functions";
import { runStage5 } from "@/lib/stage5.functions";
import { runStage4b } from "@/lib/stage4b.functions";
import { runStage6 } from "@/lib/stage6.functions";
import { runStage7 } from "@/lib/stage7.functions";

import { runStage9 } from "@/lib/stage9.functions";
import { runStage10 } from "@/lib/stage10.functions";
import { runStage11 } from "@/lib/stage11.functions";
import { runStage12, saveSelectedSMP, saveSelectionRationale } from "@/lib/stage12.functions";
import { runStage13, saveBrandIntelligence } from "@/lib/stage13.functions";
import { runStage13b } from "@/lib/stage13b.functions";
import { runStage14 } from "@/lib/stage14.functions";
import { runStage14b } from "@/lib/stage14b.functions";
import { runStage14c } from "@/lib/stage14c.functions";
import { runStage15 } from "@/lib/stage15.functions";
import { runStage16 } from "@/lib/stage16.functions";
import { runStage8, confirmCheckpointB, regenerateStage8Selective } from "@/lib/stage8.functions";
import { resetStage, resetStageCascade } from "@/lib/retry.functions";
import { sanitizeStageOutput } from "@/lib/sanitize-output";
import { hasStageOutput, isStageOutputComplete } from "@/lib/stage-completion";
import {
  BRIEF_SECTIONS,
  briefFieldsFromLegacyText,
  type BriefFields,
  type BriefVersion,
} from "@/lib/brief-schema";
import { PENDING_BRIEF_EDIT_STORAGE_KEY } from "@/routes/brief.index";
import { FileText, PencilLine } from "lucide-react";

const CLIENT_STREAM_IDLE_MS = 8 * 60_000;
const DB_COMPLETION_POLL_MS = 5_000;
const DB_COMPLETION_POLL_MAX_MS = 60 * 60_000;
const DB_COMPLETION_GRACE_AFTER_STREAM_FAILURE_MS = 15_000;

type StreamDonePayload = { done: true; output?: string };
type StreamCompletionSource = "stream" | "db-poll";

// Consume an async-generator server function stream: forward delta chunks to a
// setter for live rendering, return the final `done` payload.
async function consumeStream<C extends { delta?: string; done?: true }>(
  gen: AsyncIterable<C> | AsyncIterator<C>,
  onDelta?: (text: string) => void,
): Promise<Extract<C, { done: true }>> {
  // Normalise to a real AsyncIterator. Server-fn generator results are
  // reconstructed by seroval on the client as an AsyncIterable — they expose
  // Symbol.asyncIterator but NOT a top-level .next(). Calling .next()
  // directly on that value throws "t.next is not a function". Grabbing the
  // iterator explicitly makes both shapes (native generator + seroval
  // async-iterable) work through this loop.
  const iter: AsyncIterator<C> =
    typeof (gen as AsyncIterable<C>)[Symbol.asyncIterator] === "function"
      ? (gen as AsyncIterable<C>)[Symbol.asyncIterator]()
      : (gen as AsyncIterator<C>);

  let acc = "";
  let final: Extract<C, { done: true }> | null = null;
  while (true) {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const next = await Promise.race([
      iter.next(),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error("No stream heartbeat for 8 minutes; the stage worker appears stalled. Retry this stage.")),
          CLIENT_STREAM_IDLE_MS,
        );
      }),
    ]).finally(() => {
      if (timeoutId) clearTimeout(timeoutId);
    }).catch(async (error) => {
      try {
        await iter.return?.(undefined as never);
      } catch {
        /* ignore cleanup failure */
      }
      throw error;
    });
    if (next.done) break;
    const chunk = next.value;
    if (typeof chunk.delta === "string") {
      acc += chunk.delta;
      onDelta?.(acc);
    } else if (chunk.done) {
      final = chunk as Extract<C, { done: true }>;
    }
  }
  if (!final) throw new Error("Stream ended without a final payload");
  return final;
}

async function pollForCompletedStageOutput(args: {
  sessionId: string;
  outputColumns: string[];
  stageStatusId: string;
  minChars?: number;
  intervalMs?: number;
  maxMs?: number;
  getOutput?: (row: Record<string, unknown>) => string;
}): Promise<{ output: string; row: Record<string, unknown> }> {
  const intervalMs = args.intervalMs ?? DB_COMPLETION_POLL_MS;
  const maxMs = args.maxMs ?? DB_COMPLETION_POLL_MAX_MS;
  const minChars = args.minChars ?? 1;
  const selectColumns = Array.from(
    new Set([...args.outputColumns, "stage_status", "stage_1_tension_score", "stage_1b_required"]),
  ).join(", ");
  const deadline = Date.now() + maxMs;

  while (Date.now() < deadline) {
    await new Promise((resolve) => window.setTimeout(resolve, intervalMs));
    try {
      const { data } = await supabase
        .from("sessions")
        .select(selectColumns)
        .eq("id", args.sessionId)
        .maybeSingle();
      const row = (data as Record<string, unknown> | null) ?? null;
      if (!row) continue;
      if (row.stage_status !== `complete:${args.stageStatusId}`) continue;
      const output = args.getOutput
        ? args.getOutput(row)
        : args.outputColumns
            .map((column) => (typeof row[column] === "string" ? (row[column] as string) : ""))
            .join("");
      if (output.trim().length >= minChars) return { output, row };
    } catch {
      /* transient read failure — keep polling */
    }
  }

  throw new Error(
    `DB poll timed out after ${Math.round(maxMs / 1000)}s waiting for Stage ${args.stageStatusId} completion`,
  );
}

async function markStageInterrupted(args: {
  sessionId: string;
  stageStatusId: string;
  errorColumn?: string;
  message: string;
}) {
  const update: Record<string, string> = {
    status: "interrupted",
    stage_status: `interrupted:${args.stageStatusId}`,
  };
  if (args.errorColumn) update[args.errorColumn] = args.message;
  try {
    await supabase.from("sessions").update(update as never).eq("id", args.sessionId);
  } catch {
    /* best-effort: UI still surfaces the local error */
  }
}

async function drainStreamOrPollDb<C extends { delta?: string; done?: true; output?: string }>(
  generator:
    | AsyncIterable<C>
    | AsyncIterator<C>
    | Promise<AsyncIterable<C> | AsyncIterator<C>>,
  onDelta: ((text: string) => void) | undefined,
  fallback: {
    sessionId: string;
    outputColumns: string[];
    stageStatusId: string;
    errorColumn?: string;
    minChars?: number;
    intervalMs?: number;
    maxMs?: number;
    getOutput?: (row: Record<string, unknown>) => string;
  },
): Promise<Extract<C, { done: true }> & { output: string; completionSource: StreamCompletionSource }> {
  let settled = false;
  let streamDone = false;
  let streamResult: Extract<C, { done: true }> | null = null;
  let streamError: unknown = null;
  let pollDone = false;
  let pollError: unknown = null;
  // We hold the concrete iterator (with .next/.return) rather than the
  // possibly iterable-only value seroval hands back from a server-fn
  // generator. This is what lets us cancel the stream cleanly when the
  // DB-poll branch wins the race.
  let iteratorRef: AsyncIterator<C> | null = null;
  let streamFailureTimer: number | null = null;

  const settle = (
    resolve: (value: Extract<C, { done: true }> & { output: string; completionSource: StreamCompletionSource }) => void,
    value: Extract<C, { done: true }> & { output: string; completionSource: StreamCompletionSource },
  ) => {
    if (settled) return;
    settled = true;
    if (streamFailureTimer) window.clearTimeout(streamFailureTimer);
    resolve(value);
  };

  return await new Promise<Extract<C, { done: true }> & { output: string; completionSource: StreamCompletionSource }>(
    (resolve, reject) => {
      const maybeReject = () => {
        if (settled) return;
        if (!streamDone || !pollDone) return;
        settled = true;
        reject(streamError ?? pollError ?? new Error("Stage stream ended before a completed DB output was available"));
      };

      (async () => {
        const resolved = await generator;
        const iter: AsyncIterator<C> =
          typeof (resolved as AsyncIterable<C>)[Symbol.asyncIterator] === "function"
            ? (resolved as AsyncIterable<C>)[Symbol.asyncIterator]()
            : (resolved as AsyncIterator<C>);
        iteratorRef = iter;
        return consumeStream(iter, (text) => {
          if (!settled) onDelta?.(text);
        });
      })()
        .then((result) => {
          streamDone = true;
          streamResult = result;
          const output = String((result as StreamDonePayload).output ?? "");
          if (output.trim().length >= (fallback.minChars ?? 1)) {
            settle(resolve, { ...result, output, completionSource: "stream" });
            return;
          }
          maybeReject();
        })
        .catch((error: unknown) => {
          streamDone = true;
          streamError = error;
          if (!settled) {
            streamFailureTimer = window.setTimeout(() => {
              if (settled) return;
              settled = true;
              const error = streamError ?? new Error("Stage stream failed before DB completion was detected");
              const message = error instanceof Error ? error.message : String(error);
              void markStageInterrupted({
                sessionId: fallback.sessionId,
                stageStatusId: fallback.stageStatusId,
                errorColumn: fallback.errorColumn,
                message,
              });
              reject(error);
            }, DB_COMPLETION_GRACE_AFTER_STREAM_FAILURE_MS);
          }
          maybeReject();
        });

      pollForCompletedStageOutput(fallback)
        .then(({ output, row }) => {
          if (settled) return;
          console.info(`[pipeline] Stage ${fallback.stageStatusId} advanced via DB-poll completion fallback`);
          try {
            const returnPromise = iteratorRef?.return?.(undefined as never);
            void (returnPromise as Promise<unknown> | undefined)?.catch?.(() => undefined);
          } catch {
            /* iterator may not implement return() — ignore */
          }
          const dbResult = {
            done: true as const,
            output,
            completionSource: "db-poll" as const,
            tensionScore: row.stage_1_tension_score,
            stage1bRequired: row.stage_1b_required,
          } as unknown as Extract<C, { done: true }> & { output: string; completionSource: StreamCompletionSource };
          settle(resolve, dbResult);
        })
        .catch((error: unknown) => {
          pollDone = true;
          pollError = error;
          if (!settled && streamResult) {
            const output = String((streamResult as StreamDonePayload).output ?? "");
            if (output.trim().length >= (fallback.minChars ?? 1)) {
              settle(resolve, { ...streamResult, output, completionSource: "stream" });
              return;
            }
          }
          if (!settled && streamDone) {
            const finalError = streamError ?? pollError ?? new Error("Stage failed before DB completion was detected");
            const message = finalError instanceof Error ? finalError.message : String(finalError);
            void markStageInterrupted({
              sessionId: fallback.sessionId,
              stageStatusId: fallback.stageStatusId,
              errorColumn: fallback.errorColumn,
              message,
            });
          }
          maybeReject();
        });
    },
  );
}

// Map UI stage id (e.g. "01", "13B") to the DB stage id literal used by resetStage.
const STAGE_ID_TO_DB: Record<
  string,
  | "1"
  | "1b"
  | "2"
  | "3"
  | "4"
  | "4b"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "11"
  | "12"
  | "13"
  | "13b"
  | "14"
  | "14b"
  | "14c"
  | "15"
  | "16"
> = {
  "01": "1",
  "01B": "1b",
  "02": "2",
  "03": "3",
  "04": "4",
  "04B": "4b",
  "05": "5",
  "06": "6",
  "07": "7",
  "08": "8",
  "09": "9",
  "10": "10",
  "11": "11",
  "12": "12",
  "13": "13",
  "13B": "13b",
  "14": "14",
  "14B": "14b",
  "14C": "14c",
  "15": "15",
  "16": "16",
};

const pipelineSearchSchema = z.object({
  session: z.string().uuid().optional(),
});

// P7 cross-session guard: re-key PipelineView on sessionId so every session
// change forces a fresh mount. Without this, navigating between sessions in
// the same tab leaves stale stage outputs (incl. Stage 16) in React state
// from the previous session until the new fetch completes — visible as
// cross-session contamination in deliverables.
function PipelineRoute() {
  const { session: sessionId } = Route.useSearch();
  return <PipelineView key={sessionId ?? "__no_session__"} />;
}

export const Route = createFileRoute("/pipeline")({
  validateSearch: pipelineSearchSchema,
  component: PipelineRoute,
  head: () => ({
    meta: [
      { title: "Strategy Room — Brand Grenade" },
      {
        name: "description",
        content:
          "20-stage strategy room. Track stages, review outputs, and act on human checkpoints.",
      },
    ],
  }),
});

// ────────────────────────────────────────────────────────────────────────────
// Stage model
// ────────────────────────────────────────────────────────────────────────────

type StageStatus = "pending" | "running" | "complete" | "checkpoint" | "error";

interface Stage {
  id: string;
  number: string;
  name: string;
  conditional?: boolean;
  checkpoint?: boolean;
}

const STAGES: Stage[] = [
  { id: "01", number: "01", name: "Brief Analysis", checkpoint: true },
  { id: "01B", number: "01B", name: "Brief Enhancement", conditional: true },
  { id: "02", number: "02", name: "Category Intelligence" },
  { id: "03", number: "03", name: "Strategic Frameworks" },
  { id: "04", number: "04", name: "Strategic Universes" },
  { id: "04B", number: "04B", name: "Asset Mining & Product Facts" },
  { id: "05", number: "05", name: "Insight Generation" },
  { id: "06", number: "06", name: "Insight Validation" },
  { id: "07", number: "07", name: "Territory Synthesis" },
  { id: "08", number: "08", name: "Proposition Generation", checkpoint: true },
  { id: "09", number: "09", name: "Distinctiveness Check" },
  { id: "10", number: "10", name: "Proposition Scoring" },
  { id: "11", number: "11", name: "Integrity Testing" },
  { id: "12", number: "12", name: "Proposition Selection", checkpoint: true },
  { id: "13", number: "13", name: "Brand Fit Validation" },
  { id: "13B", number: "13B", name: "Historical Validation", conditional: true },
  { id: "14", number: "14", name: "Territory Mapping" },
  { id: "14B", number: "14B", name: "Channel Expression", conditional: true },
  { id: "14C", number: "14C", name: "Brand World Definition", conditional: true },
  { id: "15", number: "15", name: "Coherence Audit" },
  // Document Assembly (Stage 16) intentionally runs ONLY after Phase 2 is complete
  // (Stages 17–22 + Checkpoint D territory selection + Checkpoint E detonation
  // selection). It is generated on demand from the deliverables page (`/complete`),
  // never from the Phase 1 strategy pipeline. Adding it back here would
  // re-introduce the fabrication bug where the vision document invented a
  // Detonation section before Phase 2 had run.
];

const CHECKPOINT_LETTERS: Record<string, "A" | "B" | "C"> = {
  "01": "A",
  "08": "B",
  "12": "C",
};

// Demo brand fallback when no session is loaded.
const SAMPLE_BRAND = "Hypernova";

// Per-stage demo output. Replace with real generator output.
const STAGE_OUTPUTS: Record<string, string> = {
  "01": `## Sanitised Brief

The brief has been parsed and structured. Four required elements were detected and locked.

### Brand context
Hypernova is a Series-B fintech building a cross-border payments rail for emerging-market freelancers. Founded 2022, ~140 staff, profitable.

### Category context
Cross-border payments — a category dominated by Wise, Remitly, and Revolut. Margins compressed; trust and speed are commoditised.

> The brief originally conflated "audience" with "ICP". We've separated end-user (freelancer) from buyer (platform partner).

### Objective
Reposition Hypernova so partners (marketplaces, payroll SaaS) integrate it as a default — not a fallback.

### Audience reference
Operations leads at remote-first marketplaces, 50–500 employees, currently paying out via batch ACH or PayPal Mass Payments.

- Tone: confident, technically literate
- Constraints: no fee-led messaging, no comparison tables
- Out of scope: end-user acquisition`,

  "02": `## Category Intelligence

Three structural truths about cross-border payments that constrain any proposition.

### Truth 1 — Trust collapses to integrations
Buyers don't trust brand promises; they trust the SDK that lives in their codebase for 18 months.

### Truth 2 — Speed is a commodity floor, not a ceiling
"Money in minutes" is table stakes. Every competitor claims it. No proposition can lead with speed.

### Truth 3 — The real spend is reconciliation, not transfer
Finance teams spend 4x more on reconciling cross-border payouts than on the fees themselves.

> Most category players sell *transfer*. The opportunity is selling *resolved books*.

### Competitor positioning map
- Wise — consumer trust, B2B as afterthought
- Remitly — corridor specialist, weak partner story
- Revolut — bundling play, partner-hostile
- Airwallex — finance-stack ambition, complex onboarding`,

  "03": `## Constraint Generator

Generating the constraint frame the proposition must satisfy. Loading category, brief, and audience priors…

A proposition for Hypernova must:

- Refuse to compete on fees or speed
- Land with operations leads, not founders
- Imply a finance-stack benefit, not a payments benefit`,
};

function formatSubmittedBriefForStageOutput(text: string): string {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .split("\n");
  const blocks: string[] = [];
  let paragraph: string[] = [];
  const structuralLine = (line: string) =>
    /^#{1,6}\s/.test(line) ||
    /^[-*]\s+/.test(line) ||
    /^\d+[.)]\s+/.test(line) ||
    /^>\s/.test(line) ||
    /^---+\s*$/.test(line) ||
    /^\*\*\*+\s*$/.test(line) ||
    /^(?:\*\*)?[A-Z0-9][A-Z0-9 \-—&/]{2,}:(?:\*\*)?\s*$/.test(line);
  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(paragraph.join(" ").replace(/\s+/g, " ").trim());
    paragraph = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      continue;
    }
    if (structuralLine(line)) {
      flushParagraph();
      blocks.push(line);
      continue;
    }
    paragraph.push(line);
  }
  flushParagraph();
  return blocks.join("\n\n");
}

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

interface SessionData {
  id: string;
  brand_name: string;
  category: string;
  strategic_mode: string;
  brief_text: string | null;
  brief_versions: BriefVersion[] | null;
  stage_1_output: string | null;
  stage_1_tension_score: number | null;
  stage_1b_required: boolean;
  stage_1b_output: string | null;
  stage_1_error: string | null;
  stage_2_output: string | null;
  stage_2_error: string | null;
  stage_3_output: string | null;
  stage_3_error: string | null;
  stage_4_output: string | null;
  stage_4_error: string | null;
  stage_4b_output: string | null;
  stage_4b_error: string | null;
  stage_5_output: string | null;
  stage_5_error: string | null;
  stage_6_output: string | null;
  stage_6_error: string | null;
  stage_7_output: string | null;
  stage_7_error: string | null;
  stage_8_output: string | null;
  stage_8_error: string | null;
  stage_9_output: string | null;
  stage_9_leftofcentre_output: string | null;
  stage_9_error: string | null;
  stage_10_output: string | null;
  stage_10_error: string | null;
  stage_11_output: string | null;
  stage_11_error: string | null;
  stage_12_output: string | null;
  stage_12_error: string | null;
  stage_13_output: string | null;
  stage_13_error: string | null;
  stage_13b_output: string | null;
  stage_13b_error: string | null;
  stage_14_output: string | null;
  stage_14_error: string | null;
  stage_14b_output: string | null;
  stage_14b_error: string | null;
  stage_14c_output: string | null;
  stage_14c_error: string | null;
  stage_15_output: string | null;
  stage_15_error: string | null;
  stage_16_consulting_output: string | null;
  stage_16_error: string | null;
  brand_intelligence: Record<string, string> | null;
  selected_smp: string | null;
  selected_smp_field_name: string | null;
  current_stage: number;
  status: string;
  stage_status: string | null;
  checkpoint_a_confirmed: boolean;
  checkpoint_b_confirmed: boolean;
  checkpoint_c_confirmed: boolean;
  retry_status: string | null;
}

function isPersistedStageComplete(
  row: Pick<SessionData, "current_stage" | "status" | "stage_status">,
  stageStatusId: string,
  numericStage: number,
  output: string | null | undefined,
): boolean {
  if (!hasStageOutput(output)) return false;
  const marker = parsePersistedStageStatus(row.stage_status);
  if (
    marker &&
    marker.id === stageStatusId.toLowerCase() &&
    (marker.state === "running" || marker.state === "interrupted") &&
    row.status !== "complete" &&
    !(typeof row.current_stage === "number" && row.current_stage > numericStage)
  ) {
    return false;
  }
  return isStageOutputComplete(row, stageStatusId, numericStage, output);
}

function parsePersistedStageStatus(
  value: string | null | undefined,
): { state: "complete" | "running" | "interrupted"; id: string } | null {
  const match = /^(complete|running|interrupted):([0-9]+[a-z]?)$/i.exec(value ?? "");
  if (!match) return null;
  return {
    state: match[1].toLowerCase() as "complete" | "running" | "interrupted",
    id: match[2].toLowerCase(),
  };
}

const DB_STAGE_ID_TO_UI: Record<string, string> = {
  "1": "01",
  "1b": "01B",
  "2": "02",
  "3": "03",
  "4": "04",
  "4b": "04B",
  "5": "05",
  "6": "06",
  "7": "07",
  "8": "08",
  "9": "09",
  "10": "10",
  "11": "11",
  "12": "12",
  "13": "13",
  "13b": "13B",
  "14": "14",
  "14b": "14B",
  "14c": "14C",
  "15": "15",
  "16": "16",
};

function PipelineView() {
  const { session: sessionId } = Route.useSearch();
  const navigate = useNavigate();
  const runStage1Fn = useServerFn(runStage1);
  const runStage1bFn = useServerFn(runStage1b);
  const resubmitBriefFn = useServerFn(resubmitBrief);
  const runStage2Fn = useServerFn(runStage2);
  const runStage3Fn = useServerFn(runStage3);
  const runStage4Fn = useServerFn(runStage4);
  const runStage4bFn = useServerFn(runStage4b);
  const runStage5Fn = useServerFn(runStage5);
  const runStage6Fn = useServerFn(runStage6);
  const runStage7Fn = useServerFn(runStage7);
  const runStage8Fn = useServerFn(runStage8);
  const confirmCheckpointBFn = useServerFn(confirmCheckpointB);
  const regenerateStage8SelectiveFn = useServerFn(regenerateStage8Selective);
  const runStage9Fn = useServerFn(runStage9);
  const runStage10Fn = useServerFn(runStage10);
  const runStage11Fn = useServerFn(runStage11);
  const runStage12Fn = useServerFn(runStage12);
  const saveSelectedSMPFn = useServerFn(saveSelectedSMP);
  const saveSelectionRationaleFn = useServerFn(saveSelectionRationale);
  const saveBrandIntelligenceFn = useServerFn(saveBrandIntelligence);
  const runStage13Fn = useServerFn(runStage13);
  const runStage13bFn = useServerFn(runStage13b);
  const runStage14Fn = useServerFn(runStage14);
  const runStage14bFn = useServerFn(runStage14b);
  const runStage14cFn = useServerFn(runStage14c);
  const runStage15Fn = useServerFn(runStage15);
  const runStage16Fn = useServerFn(runStage16);
  const resetStageFn = useServerFn(resetStage);
  const resetStageCascadeFn = useServerFn(resetStageCascade);

  const [session, setSession] = useState<SessionData | null>(null);
  const [stage1Output, setStage1Output] = useState<string | null>(null);
  const [stage1bOutput, setStage1bOutput] = useState<string | null>(null);
  const [stage1Error, setStage1Error] = useState<string | null>(null);
  const [stage2Output, setStage2Output] = useState<string | null>(null);
  const [stage2Error, setStage2Error] = useState<string | null>(null);
  const [stage3Output, setStage3Output] = useState<string | null>(null);
  const [stage3Error, setStage3Error] = useState<string | null>(null);
  const [stage4Output, setStage4Output] = useState<string | null>(null);
  const [stage4Error, setStage4Error] = useState<string | null>(null);
  const [stage4bOutput, setStage4bOutput] = useState<string | null>(null);
  const [stage4bError, setStage4bError] = useState<string | null>(null);
  const [stage5Output, setStage5Output] = useState<string | null>(null);
  const [stage5Error, setStage5Error] = useState<string | null>(null);
  const [stage6Output, setStage6Output] = useState<string | null>(null);
  const [stage6Error, setStage6Error] = useState<string | null>(null);
  const [stage7Output, setStage7Output] = useState<string | null>(null);
  const [stage7Error, setStage7Error] = useState<string | null>(null);
  const [stage8Output, setStage8Output] = useState<string | null>(null);
  const [stage8Error, setStage8Error] = useState<string | null>(null);
  const [stage9Output, setStage9Output] = useState<string | null>(null);
  const [stage9Error, setStage9Error] = useState<string | null>(null);
  const [stage10Output, setStage10Output] = useState<string | null>(null);
  const [stage10Error, setStage10Error] = useState<string | null>(null);
  const [stage11Output, setStage11Output] = useState<string | null>(null);
  const [stage11Error, setStage11Error] = useState<string | null>(null);
  const [stage12Output, setStage12Output] = useState<string | null>(null);
  const [stage12Error, setStage12Error] = useState<string | null>(null);
  const [stage13Output, setStage13Output] = useState<string | null>(null);
  const [stage13Error, setStage13Error] = useState<string | null>(null);
  const [stage13bOutput, setStage13bOutput] = useState<string | null>(null);
  const [stage13bError, setStage13bError] = useState<string | null>(null);
  const [stage14Output, setStage14Output] = useState<string | null>(null);
  const [stage14Error, setStage14Error] = useState<string | null>(null);
  const [stage14bOutput, setStage14bOutput] = useState<string | null>(null);
  const [stage14bError, setStage14bError] = useState<string | null>(null);
  const [stage14cOutput, setStage14cOutput] = useState<string | null>(null);
  const [stage14cError, setStage14cError] = useState<string | null>(null);
  const [stage15Output, setStage15Output] = useState<string | null>(null);
  const [stage15Error, setStage15Error] = useState<string | null>(null);
  const [stage16Output, setStage16Output] = useState<string | null>(null);
  const [stage16Error, setStage16Error] = useState<string | null>(null);
  const [selectedSMP, setSelectedSMP] = useState<SMPCard | null>(null);
  const [stage1Loading, setStage1Loading] = useState(false);
  const [stage1bLoading, setStage1bLoading] = useState(false);
  const [stage2Loading, setStage2Loading] = useState(false);
  const [stage3Loading, setStage3Loading] = useState(false);
  const [stage4Loading, setStage4Loading] = useState(false);
  const [stage4bLoading, setStage4bLoading] = useState(false);
  const [stage5Loading, setStage5Loading] = useState(false);
  const [stage6Loading, setStage6Loading] = useState(false);
  const [stage7Loading, setStage7Loading] = useState(false);
  const [stage8Loading, setStage8Loading] = useState(false);
  const [stage9Loading, setStage9Loading] = useState(false);
  const [stage10Loading, setStage10Loading] = useState(false);
  const [stage11Loading, setStage11Loading] = useState(false);
  const [stage12Loading, setStage12Loading] = useState(false);
  const [stage13Loading, setStage13Loading] = useState(false);
  const [stage13bLoading, setStage13bLoading] = useState(false);
  const [stage14Loading, setStage14Loading] = useState(false);
  const [stage14bLoading, setStage14bLoading] = useState(false);
  const [stage14cLoading, setStage14cLoading] = useState(false);
  const [stage15Loading, setStage15Loading] = useState(false);
  const [stage16Loading, setStage16Loading] = useState(false);
  const [resubmitting, setResubmitting] = useState(false);
  const [savingRationale, setSavingRationale] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const [stageRunNonce, setStageRunNonce] = useState<Record<string, number>>({});
  const bumpStageRunNonce = (stageId: string) => {
    setStageRunNonce((prev) => ({ ...prev, [stageId]: (prev[stageId] ?? 0) + 1 }));
  };
  const [pendingFeedback, setPendingFeedback] = useState<Record<string, string>>({});
  const [pendingPreviousOutput, setPendingPreviousOutput] = useState<Record<string, string>>({});
  const [amendmentNotes, setAmendmentNotes] = useState<Record<string, string>>({});
  // Review-question field notes from the inline Checkpoint UI, keyed by stage id.
  // Lifted up so "Retry This Stage" can inject them into the regeneration prompt
  // even when the user has not also typed into the bottom-bar amendment input.
  const [checkpointFieldNotes, setCheckpointFieldNotes] = useState<Record<string, string[]>>({});
  // Stage 8 selective regenerate — set of territory names the user wants to KEEP
  // (checkbox = checked). Defaults to all-checked whenever the underlying
  // proposition set changes.
  const [stage8KeepNames, setStage8KeepNames] = useState<Set<string>>(new Set());

  // Whenever Stage 8's set of proposition names changes (new generation,
  // selective regenerate finished, etc.), default every proposition to
  // checked = keep. We only react to the *name set* so toggling a checkbox
  // does not reset the user's selection.
  const stage8NamesKey = useMemo(() => {
    if (!stage8Output) return "";
    return splitStage8Propositions(stage8Output)
      .map((b) => b.name)
      .join("|");
  }, [stage8Output]);
  useEffect(() => {
    if (!stage8NamesKey) {
      setStage8KeepNames(new Set());
      return;
    }
    setStage8KeepNames(new Set(stage8NamesKey.split("|").filter(Boolean)));
  }, [stage8NamesKey]);

  const resetLocalFromStage = (stageId: string) => {
    const clearFrom = (startId: string) => {
      const order = STAGES.map((s) => s.id);
      const start = order.indexOf(startId);
      const shouldClear = (id: string) => start >= 0 && order.indexOf(id) >= start;
      if (shouldClear("01")) setStage1Output(null);
      if (shouldClear("01B")) setStage1bOutput(null);
      if (shouldClear("02")) setStage2Output(null);
      if (shouldClear("03")) setStage3Output(null);
      if (shouldClear("04")) setStage4Output(null);
      if (shouldClear("04B")) setStage4bOutput(null);
      if (shouldClear("05")) setStage5Output(null);
      if (shouldClear("06")) setStage6Output(null);
      if (shouldClear("07")) setStage7Output(null);
      if (shouldClear("08")) setStage8Output(null);
      if (shouldClear("09")) setStage9Output(null);
      if (shouldClear("10")) setStage10Output(null);
      if (shouldClear("11")) setStage11Output(null);
      if (shouldClear("12")) setStage12Output(null);
      if (shouldClear("13")) setStage13Output(null);
      if (shouldClear("13B")) setStage13bOutput(null);
      if (shouldClear("14")) setStage14Output(null);
      if (shouldClear("14B")) setStage14bOutput(null);
      if (shouldClear("14C")) setStage14cOutput(null);
      if (shouldClear("15")) setStage15Output(null);
      if (shouldClear("16")) setStage16Output(null);
      if (shouldClear("01")) setStage1Error(null);
      if (shouldClear("02")) setStage2Error(null);
      if (shouldClear("03")) setStage3Error(null);
      if (shouldClear("04")) setStage4Error(null);
      if (shouldClear("04B")) setStage4bError(null);
      if (shouldClear("05")) setStage5Error(null);
      if (shouldClear("06")) setStage6Error(null);
      if (shouldClear("07")) setStage7Error(null);
      if (shouldClear("08")) setStage8Error(null);
      if (shouldClear("09")) setStage9Error(null);
      if (shouldClear("10")) setStage10Error(null);
      if (shouldClear("11")) setStage11Error(null);
      if (shouldClear("12")) setStage12Error(null);
      if (shouldClear("13")) setStage13Error(null);
      if (shouldClear("13B")) setStage13bError(null);
      if (shouldClear("14")) setStage14Error(null);
      if (shouldClear("14B")) setStage14bError(null);
      if (shouldClear("14C")) setStage14cError(null);
      if (shouldClear("15")) setStage15Error(null);
      if (shouldClear("16")) setStage16Error(null);
      if (shouldClear("12")) {
        setSelectedSMP(null);
        setRationaleForId(null);
        setIntelSubmitted(false);
      }
    };

    clearFrom(stageId);
    if (stageId === "01") {
      setStage1Output(null);
      setStage1bOutput(null);
      setStage2Output(null);
      setStage3Output(null);
      setStage4Output(null);
      setStage4bOutput(null);
      setStage5Output(null);
      setStage6Output(null);
      setStage7Output(null);
      setStage8Output(null);
      setStage9Output(null);
      setStage10Output(null);
      setStage11Output(null);
      setStage12Output(null);
      setStage13Output(null);
      setStage13bOutput(null);
      setStage14Output(null);
      setStage14bOutput(null);
      setStage14cOutput(null);
      setStage15Output(null);
      setStage16Output(null);
      setStage1Error(null);
      setStage2Error(null);
      setStage3Error(null);
      setStage4Error(null);
      setStage4bError(null);
      setStage5Error(null);
      setStage6Error(null);
      setStage7Error(null);
      setStage8Error(null);
      setStage9Error(null);
      setStage10Error(null);
      setStage11Error(null);
      setStage12Error(null);
      setStage13Error(null);
      setStage13bError(null);
      setStage14Error(null);
      setStage14bError(null);
      setStage14cError(null);
      setStage15Error(null);
      setStage16Error(null);
      return;
    }
    if (stageId === "08") {
      setStage8Output(null);
      setStage9Output(null);
      setStage10Output(null);
      setStage11Output(null);
      setStage12Output(null);
      setStage13Output(null);
      setStage13bOutput(null);
      setStage14Output(null);
      setStage14bOutput(null);
      setStage14cOutput(null);
      setStage15Output(null);
      setStage16Output(null);
      setStage8Error(null);
      setStage9Error(null);
      setStage10Error(null);
      setStage11Error(null);
      setStage12Error(null);
      setStage13Error(null);
      setStage13bError(null);
      setStage14Error(null);
      setStage14bError(null);
      setStage14cError(null);
      setStage15Error(null);
      setStage16Error(null);
      return;
    }
    if (stageId === "12") {
      setStage12Output(null);
      setStage13Output(null);
      setStage13bOutput(null);
      setStage14Output(null);
      setStage14bOutput(null);
      setStage14cOutput(null);
      setStage15Output(null);
      setStage16Output(null);
      setStage12Error(null);
      setStage13Error(null);
      setStage13bError(null);
      setStage14Error(null);
      setStage14bError(null);
      setStage14cError(null);
      setStage15Error(null);
      setStage16Error(null);
      setSelectedSMP(null);
      setRationaleForId(null);
      setIntelSubmitted(false);
    }
  };

  // Elapsed timer
  const [startTime] = useState(() => Date.now());
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const elapsed = formatElapsed(now - startTime);

  // Initial statuses — Stage 01 is running while Claude works, then transitions to checkpoint.
  const initialStatuses = useMemo<Record<string, StageStatus>>(() => {
    const map: Record<string, StageStatus> = {};
    STAGES.forEach((s) => {
      map[s.id] = "pending";
    });
    map["01"] = sessionId ? "running" : "checkpoint";
    return map;
  }, [sessionId]);

  const [statuses, setStatuses] = useState(initialStatuses);
  const [selectedId, setSelectedId] = useState("01");
  const hydratedSessionRef = useRef<string | null>(null);
  const selectedIdRef = useRef("01");
  const contentScrollRef = useRef<HTMLDivElement | null>(null);

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
    contentScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }

  useEffect(() => {
    selectedIdRef.current = selectedId;
    scrollToTop();
  }, [selectedId]);
  const [rationaleForId, setRationaleForId] = useState<string | null>(null);
  const [intelSubmitted, setIntelSubmitted] = useState(false);
  // Defensive: selectedId may be a sentinel like "BRIEF" (View Brief panel) or
  // any value not present in STAGES. STAGES.find then returns undefined, and
  // downstream code (e.g. `selected.id === "01"`) would crash the entire
  // pipeline page. Fall back to the first stage so the page keeps rendering;
  // the BRIEF-specific branch is handled separately below.
  const selectedStageMatch = STAGES.find((s) => s.id === selectedId);
  if (!selectedStageMatch && selectedId !== "BRIEF") {
    // eslint-disable-next-line no-console
    console.warn("[pipeline] selectedId not in STAGES, falling back to first stage", { selectedId });
  }
  const selected = selectedStageMatch ?? STAGES[0];
  const selectedStatus = statuses[selectedId];

  // Load session metadata from DB.
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    supabase
      .from("sessions")
      .select(
        "id, brand_name, category, strategic_mode, brief_text, brief_versions, current_stage, status, stage_status, stage_1_output, stage_1_tension_score, stage_1b_required, stage_1b_output, stage_1_error, stage_2_output, stage_2_error, stage_3_output, stage_3_error, stage_4_output, stage_4_error, stage_4b_output, stage_4b_error, stage_5_output, stage_5_error, stage_6_output, stage_6_error, stage_7_output, stage_7_error, stage_8_output, stage_8_error, stage_9_output, stage_9_leftofcentre_output, stage_9_error, stage_10_output, stage_10_error, stage_11_output, stage_11_error, stage_12_output, stage_12_error, stage_13_output, stage_13_error, stage_13b_output, stage_13b_error, stage_14_output, stage_14_error, stage_14b_output, stage_14b_error, stage_14c_output, stage_14c_error, stage_15_output, stage_15_error, stage_16_consulting_output, stage_16_error, brand_intelligence, selected_smp, selected_smp_field_name, checkpoint_a_confirmed, checkpoint_b_confirmed, checkpoint_c_confirmed, retry_status",
      )

      .eq("id", sessionId)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setStage1Error(error?.message ?? "Session not found");
          setStatuses((p) => ({ ...p, "01": "error" }));
          return;
        }
        setSession(data as unknown as SessionData);
        if (data.brand_intelligence) setIntelSubmitted(true);
        if (isPersistedStageComplete(data as unknown as SessionData, "1", 1, data.stage_1_output)) {
          setStage1Output(data.stage_1_output);
          setStatuses((p) => ({
            ...p,
            "01": data.checkpoint_a_confirmed ? "complete" : "checkpoint",
          }));
        }
        if (isPersistedStageComplete(data as unknown as SessionData, "1b", 1, data.stage_1b_output)) {
          setStage1bOutput(data.stage_1b_output);
          setStatuses((p) => ({ ...p, "01B": "complete" }));
        }
        if (isPersistedStageComplete(data as unknown as SessionData, "2", 2, data.stage_2_output)) {
          setStage2Output(data.stage_2_output);
          setStatuses((p) => ({ ...p, "02": "complete" }));
        }
        if (isPersistedStageComplete(data as unknown as SessionData, "3", 3, data.stage_3_output)) {
          setStage3Output(data.stage_3_output);
          setStatuses((p) => ({ ...p, "03": "complete" }));
        }
        if (isPersistedStageComplete(data as unknown as SessionData, "4", 4, data.stage_4_output)) {
          setStage4Output(data.stage_4_output);
          setStatuses((p) => ({ ...p, "04": "complete" }));
        }
        if (isPersistedStageComplete(data as unknown as SessionData, "4b", 4, data.stage_4b_output)) {
          setStage4bOutput(data.stage_4b_output);
          setStatuses((p) => ({ ...p, "04B": "complete" }));
        }
        if (isPersistedStageComplete(data as unknown as SessionData, "5", 5, data.stage_5_output)) {
          setStage5Output(data.stage_5_output);
          setStatuses((p) => ({ ...p, "05": "complete" }));
        }
        if (isPersistedStageComplete(data as unknown as SessionData, "6", 6, data.stage_6_output)) {
          setStage6Output(data.stage_6_output);
          setStatuses((p) => ({ ...p, "06": "complete" }));
        }
        if (isPersistedStageComplete(data as unknown as SessionData, "7", 7, data.stage_7_output)) {
          setStage7Output(data.stage_7_output);
          setStatuses((p) => ({ ...p, "07": "complete" }));
        }
        if (isPersistedStageComplete(data as unknown as SessionData, "8", 8, data.stage_8_output)) {
          setStage8Output(data.stage_8_output);
          setStatuses((p) => ({
            ...p,
            "08": data.checkpoint_b_confirmed ? "complete" : "checkpoint",
          }));
        }
        if (isPersistedStageComplete(data as unknown as SessionData, "9", 9, data.stage_9_output)) {
          setStage9Output(`${data.stage_9_output}${(data as unknown as SessionData).stage_9_leftofcentre_output ?? ""}`);
          setStatuses((p) => ({ ...p, "09": "complete" }));
        }
        if (isPersistedStageComplete(data as unknown as SessionData, "10", 10, data.stage_10_output)) {
          setStage10Output(data.stage_10_output);
          setStatuses((p) => ({ ...p, "10": "complete" }));
        }
        if (isPersistedStageComplete(data as unknown as SessionData, "11", 11, data.stage_11_output)) {
          setStage11Output(data.stage_11_output);
          setStatuses((p) => ({ ...p, "11": "complete" }));
        }
        if (isPersistedStageComplete(data as unknown as SessionData, "12", 12, data.stage_12_output)) {
          setStage12Output(data.stage_12_output);
          setStatuses((p) => ({
            ...p,
            "12": data.checkpoint_c_confirmed ? "complete" : "checkpoint",
          }));
        }
        if (
          data.current_stage === 12 &&
          data.status === "running" &&
          data.stage_11_output &&
          !data.stage_12_output &&
          !data.checkpoint_c_confirmed
        ) {
          setStatuses((p) => ({ ...p, "12": "running" }));
          setSelectedId("12");
        }
        if (isPersistedStageComplete(data as unknown as SessionData, "13", 13, data.stage_13_output)) {
          setStage13Output(data.stage_13_output);
          setStatuses((p) => ({ ...p, "13": "complete" }));
          setIntelSubmitted(true);
        }
        if (isPersistedStageComplete(data as unknown as SessionData, "13b", 13, data.stage_13b_output)) {
          setStage13bOutput(data.stage_13b_output);
          setStatuses((p) => ({ ...p, "13B": "complete" }));
        }
        if (isPersistedStageComplete(data as unknown as SessionData, "14", 14, data.stage_14_output)) {
          setStage14Output(data.stage_14_output);
          setStatuses((p) => ({ ...p, "14": "complete" }));
        }
        if (isPersistedStageComplete(data as unknown as SessionData, "14b", 14, data.stage_14b_output)) {
          setStage14bOutput(data.stage_14b_output);
          setStatuses((p) => ({ ...p, "14B": "complete" }));
        }
        if (isPersistedStageComplete(data as unknown as SessionData, "14c", 14, data.stage_14c_output)) {
          setStage14cOutput(data.stage_14c_output);
          setStatuses((p) => ({ ...p, "14C": "complete" }));
        }
        if (isPersistedStageComplete(data as unknown as SessionData, "15", 15, data.stage_15_output)) {
          setStage15Output(data.stage_15_output);
          setStatuses((p) => ({ ...p, "15": "complete" }));
        }
        if (isPersistedStageComplete(data as unknown as SessionData, "16", 16, data.stage_16_consulting_output)) {
          setStage16Output(data.stage_16_consulting_output);
          setStatuses((p) => ({ ...p, "16": "complete" }));
        }
        const errorStatuses: Record<string, StageStatus> = {};
        if (data.stage_1_error) {
          setStage1Error(data.stage_1_error);
          errorStatuses["01"] = "error";
        }
        if (data.stage_2_error) {
          setStage2Error(data.stage_2_error);
          errorStatuses["02"] = "error";
        }
        if (data.stage_3_error) {
          setStage3Error(data.stage_3_error);
          errorStatuses["03"] = "error";
        }
        if (data.stage_4_error) {
          setStage4Error(data.stage_4_error);
          errorStatuses["04"] = "error";
        }
        if (data.stage_4b_error) {
          setStage4bError(data.stage_4b_error);
          errorStatuses["04B"] = "error";
        }
        if (data.stage_5_error) {
          setStage5Error(data.stage_5_error);
          errorStatuses["05"] = "error";
        }
        if (data.stage_6_error) {
          setStage6Error(data.stage_6_error);
          errorStatuses["06"] = "error";
        }
        if (data.stage_7_error) {
          setStage7Error(data.stage_7_error);
          errorStatuses["07"] = "error";
        }
        if (data.stage_8_error) {
          setStage8Error(data.stage_8_error);
          errorStatuses["08"] = "error";
        }
        if (data.stage_9_error) {
          setStage9Error(data.stage_9_error);
          errorStatuses["09"] = "error";
        }
        if (data.stage_10_error) {
          setStage10Error(data.stage_10_error);
          errorStatuses["10"] = "error";
        }
        if (data.stage_11_error) {
          setStage11Error(data.stage_11_error);
          errorStatuses["11"] = "error";
        }
        if (data.stage_12_error) {
          setStage12Error(data.stage_12_error);
          errorStatuses["12"] = "error";
        }
        if (data.stage_13_error) {
          setStage13Error(data.stage_13_error);
          errorStatuses["13"] = "error";
        }
        if (data.stage_13b_error) {
          setStage13bError(data.stage_13b_error);
          errorStatuses["13B"] = "error";
        }
        if (data.stage_14_error) {
          setStage14Error(data.stage_14_error);
          errorStatuses["14"] = "error";
        }
        if (data.stage_14b_error) {
          setStage14bError(data.stage_14b_error);
          errorStatuses["14B"] = "error";
        }
        if (data.stage_14c_error) {
          setStage14cError(data.stage_14c_error);
          errorStatuses["14C"] = "error";
        }
        if (data.stage_15_error) {
          setStage15Error(data.stage_15_error);
          errorStatuses["15"] = "error";
        }
        if (data.stage_16_error) {
          setStage16Error(data.stage_16_error);
          errorStatuses["16"] = "error";
        }
        if (Object.keys(errorStatuses).length > 0) {
          setStatuses((p) => ({ ...p, ...errorStatuses }));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId, retryNonce]);

  // ── Source-of-truth sync ───────────────────────────────────────────────
  // Supabase is the source of truth for all stage outputs. Display state
  // re-syncs whenever the session row changes (via initial load, retry,
  // realtime UPDATE, or manual refresh). The `if (value)` guard ensures we
  // never clobber a streaming buffer with a null DB value mid-stream; once
  // the streamer saves to Supabase, the session updates and local state
  // converges to the final saved value.
  useEffect(() => {
    if (session?.stage_1_output) setStage1Output(session.stage_1_output);
  }, [session?.stage_1_output]);
  useEffect(() => {
    if (session?.stage_1b_output) setStage1bOutput(session.stage_1b_output);
  }, [session?.stage_1b_output]);
  useEffect(() => {
    if (session?.stage_2_output) setStage2Output(session.stage_2_output);
  }, [session?.stage_2_output]);
  useEffect(() => {
    if (session?.stage_3_output) setStage3Output(session.stage_3_output);
  }, [session?.stage_3_output]);
  useEffect(() => {
    if (session?.stage_4_output) setStage4Output(session.stage_4_output);
  }, [session?.stage_4_output]);
  useEffect(() => {
    if (session?.stage_4b_output) setStage4bOutput(session.stage_4b_output);
  }, [session?.stage_4b_output]);
  useEffect(() => {
    if (session?.stage_5_output) setStage5Output(session.stage_5_output);
  }, [session?.stage_5_output]);
  useEffect(() => {
    if (session?.stage_6_output) setStage6Output(session.stage_6_output);
  }, [session?.stage_6_output]);
  useEffect(() => {
    if (session?.stage_6_error) {
      setStage6Error(session.stage_6_error);
      setStatuses((p) => ({ ...p, "06": "error" }));
    }
  }, [session?.stage_6_error]);
  useEffect(() => {
    if (session?.stage_7_output) setStage7Output(session.stage_7_output);
  }, [session?.stage_7_output]);
  useEffect(() => {
    if (session?.stage_8_output) setStage8Output(session.stage_8_output);
  }, [session?.stage_8_output]);
  useEffect(() => {
    if (session?.stage_9_output) setStage9Output(`${session.stage_9_output}${session.stage_9_leftofcentre_output ?? ""}`);
  }, [session?.stage_9_output, session?.stage_9_leftofcentre_output]);
  useEffect(() => {
    if (session?.stage_10_output) setStage10Output(session.stage_10_output);
  }, [session?.stage_10_output]);
  useEffect(() => {
    if (session?.stage_11_output) setStage11Output(session.stage_11_output);
  }, [session?.stage_11_output]);
  useEffect(() => {
    if (session?.stage_12_output) setStage12Output(session.stage_12_output);
  }, [session?.stage_12_output]);
  useEffect(() => {
    if (session?.stage_13_output) setStage13Output(session.stage_13_output);
  }, [session?.stage_13_output]);
  useEffect(() => {
    if (session?.stage_13b_output) setStage13bOutput(session.stage_13b_output);
  }, [session?.stage_13b_output]);
  useEffect(() => {
    if (session && isPersistedStageComplete(session, "14", 14, session.stage_14_output)) {
      setStage14Output(session.stage_14_output);
    }
  }, [session]);
  useEffect(() => {
    if (session && isPersistedStageComplete(session, "14b", 14, session.stage_14b_output)) {
      setStage14bOutput(session.stage_14b_output);
    }
  }, [session]);
  useEffect(() => {
    if (session && isPersistedStageComplete(session, "14c", 14, session.stage_14c_output)) {
      setStage14cOutput(session.stage_14c_output);
    }
  }, [session]);
  useEffect(() => {
    if (session && isPersistedStageComplete(session, "15", 15, session.stage_15_output)) {
      setStage15Output(session.stage_15_output);
    }
  }, [session]);
  useEffect(() => {
    if (session?.stage_16_consulting_output) setStage16Output(session.stage_16_consulting_output);
  }, [session?.stage_16_consulting_output]);

  // Realtime: any server-side write to this session row triggers a fresh
  // SELECT, which updates `session`, which fires the sync effects above so
  // display reflects Supabase.
  useEffect(() => {
    if (!sessionId) return;
    const refetch = async () => {
      const { data } = await supabase
        .from("sessions")
        .select(
          "id, brand_name, category, strategic_mode, brief_text, brief_versions, current_stage, status, stage_status, stage_1_output, stage_1_tension_score, stage_1b_required, stage_1b_output, stage_1_error, stage_2_output, stage_2_error, stage_3_output, stage_3_error, stage_4_output, stage_4_error, stage_4b_output, stage_4b_error, stage_5_output, stage_5_error, stage_6_output, stage_6_error, stage_7_output, stage_7_error, stage_8_output, stage_8_error, stage_9_output, stage_9_leftofcentre_output, stage_9_error, stage_10_output, stage_10_error, stage_11_output, stage_11_error, stage_12_output, stage_12_error, stage_13_output, stage_13_error, stage_13b_output, stage_13b_error, stage_14_output, stage_14_error, stage_14b_output, stage_14b_error, stage_14c_output, stage_14c_error, stage_15_output, stage_15_error, stage_16_consulting_output, stage_16_error, brand_intelligence, selected_smp, selected_smp_field_name, checkpoint_a_confirmed, checkpoint_b_confirmed, checkpoint_c_confirmed, retry_status",
        )
        .eq("id", sessionId)
        .single();
      if (data) setSession(data as unknown as SessionData);
    };
    const channel = supabase
      .channel(`pipeline-session:${sessionId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "sessions", filter: `id=eq.${sessionId}` },
        () => {
          void refetch();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [sessionId]);

  // Rebuild the visible pipeline state from the persisted session row.
  // This is the reload recovery path: saved outputs are authoritative, so a
  // stage must not appear blank/pending just because this React mount has no
  // in-memory stream buffer yet, or because a legacy row has a stale marker.
  useEffect(() => {
    if (!session) return;

    const nextStatuses: Record<string, StageStatus> = { ...initialStatuses };
    const complete = (stageStatusId: string, numericStage: number, output: string | null | undefined) =>
      isPersistedStageComplete(session, stageStatusId, numericStage, output);

    const setActiveFromMarker = () => {
      const marker = parsePersistedStageStatus(session.stage_status);
      if (!marker) return;
      const uiId = DB_STAGE_ID_TO_UI[marker.id];
      if (!uiId) return;
      if (nextStatuses[uiId] === "complete" || nextStatuses[uiId] === "checkpoint") return;
      if (marker.state === "running") nextStatuses[uiId] = "running";
      if (marker.state === "interrupted") nextStatuses[uiId] = "error";
    };

    if (complete("1", 1, session.stage_1_output)) {
      setStage1Output(session.stage_1_output);
      setStage1Error(null);
      nextStatuses["01"] = session.checkpoint_a_confirmed ? "complete" : "checkpoint";
    }
    if (session.stage_1b_required) nextStatuses["01B"] = "pending";
    if (complete("1b", 1, session.stage_1b_output)) {
      setStage1bOutput(session.stage_1b_output);
      nextStatuses["01B"] = "complete";
    }
    if (complete("2", 2, session.stage_2_output)) {
      setStage2Output(session.stage_2_output);
      setStage2Error(null);
      nextStatuses["02"] = "complete";
    }
    if (complete("3", 3, session.stage_3_output)) {
      setStage3Output(session.stage_3_output);
      setStage3Error(null);
      nextStatuses["03"] = "complete";
    }
    if (complete("4", 4, session.stage_4_output)) {
      setStage4Output(session.stage_4_output);
      setStage4Error(null);
      nextStatuses["04"] = "complete";
    }
    if (complete("4b", 4, session.stage_4b_output)) {
      setStage4bOutput(session.stage_4b_output);
      setStage4bError(null);
      nextStatuses["04B"] = "complete";
    }
    if (complete("5", 5, session.stage_5_output)) {
      setStage5Output(session.stage_5_output);
      setStage5Error(null);
      nextStatuses["05"] = "complete";
    }
    if (complete("6", 6, session.stage_6_output)) {
      setStage6Output(session.stage_6_output);
      setStage6Error(null);
      nextStatuses["06"] = "complete";
    }
    if (complete("7", 7, session.stage_7_output)) {
      setStage7Output(session.stage_7_output);
      setStage7Error(null);
      nextStatuses["07"] = "complete";
    }
    if (complete("8", 8, session.stage_8_output)) {
      setStage8Output(session.stage_8_output);
      setStage8Error(null);
      nextStatuses["08"] = session.checkpoint_b_confirmed ? "complete" : "checkpoint";
    }
    if (complete("9", 9, session.stage_9_output)) {
      setStage9Output(`${session.stage_9_output}${session.stage_9_leftofcentre_output ?? ""}`);
      setStage9Error(null);
      nextStatuses["09"] = "complete";
    }
    if (complete("10", 10, session.stage_10_output)) {
      setStage10Output(session.stage_10_output);
      setStage10Error(null);
      nextStatuses["10"] = "complete";
    }
    if (complete("11", 11, session.stage_11_output)) {
      setStage11Output(session.stage_11_output);
      setStage11Error(null);
      nextStatuses["11"] = "complete";
    }
    if (complete("12", 12, session.stage_12_output)) {
      setStage12Output(session.stage_12_output);
      setStage12Error(null);
      nextStatuses["12"] = session.checkpoint_c_confirmed ? "complete" : "checkpoint";
    }
    if (complete("13", 13, session.stage_13_output)) {
      setStage13Output(session.stage_13_output);
      setStage13Error(null);
      setIntelSubmitted(true);
      nextStatuses["13"] = "complete";
    }
    if (complete("13b", 13, session.stage_13b_output)) {
      setStage13bOutput(session.stage_13b_output);
      setStage13bError(null);
      nextStatuses["13B"] = "complete";
    }
    if (complete("14", 14, session.stage_14_output)) {
      setStage14Output(session.stage_14_output);
      setStage14Error(null);
      setStage14Loading(false);
      nextStatuses["14"] = "complete";
    }
    if (complete("14b", 14, session.stage_14b_output)) {
      setStage14bOutput(session.stage_14b_output);
      setStage14bError(null);
      setStage14bLoading(false);
      nextStatuses["14B"] = "complete";
    }
    if (complete("14c", 14, session.stage_14c_output)) {
      setStage14cOutput(session.stage_14c_output);
      setStage14cError(null);
      setStage14cLoading(false);
      nextStatuses["14C"] = "complete";
    }
    if (complete("15", 15, session.stage_15_output)) {
      setStage15Output(session.stage_15_output);
      setStage15Error(null);
      setStage15Loading(false);
      nextStatuses["15"] = "complete";
    }
    if (complete("16", 16, session.stage_16_consulting_output)) {
      setStage16Output(session.stage_16_consulting_output);
      setStage16Error(null);
      nextStatuses["16"] = "complete";
    }

    setActiveFromMarker();

    const errorIfNoComplete = (
      uiId: string,
      error: string | null,
      setError: (message: string) => void,
    ) => {
      if (!error || nextStatuses[uiId] === "complete" || nextStatuses[uiId] === "checkpoint") return;
      setError(error);
      nextStatuses[uiId] = "error";
    };
    errorIfNoComplete("01", session.stage_1_error, setStage1Error);
    errorIfNoComplete("02", session.stage_2_error, setStage2Error);
    errorIfNoComplete("03", session.stage_3_error, setStage3Error);
    errorIfNoComplete("04", session.stage_4_error, setStage4Error);
    errorIfNoComplete("04B", session.stage_4b_error, setStage4bError);
    errorIfNoComplete("05", session.stage_5_error, setStage5Error);
    errorIfNoComplete("06", session.stage_6_error, setStage6Error);
    errorIfNoComplete("07", session.stage_7_error, setStage7Error);
    errorIfNoComplete("08", session.stage_8_error, setStage8Error);
    errorIfNoComplete("09", session.stage_9_error, setStage9Error);
    errorIfNoComplete("10", session.stage_10_error, setStage10Error);
    errorIfNoComplete("11", session.stage_11_error, setStage11Error);
    errorIfNoComplete("12", session.stage_12_error, setStage12Error);
    errorIfNoComplete("13", session.stage_13_error, setStage13Error);
    errorIfNoComplete("13B", session.stage_13b_error, setStage13bError);
    errorIfNoComplete("14", session.stage_14_error, setStage14Error);
    errorIfNoComplete("14B", session.stage_14b_error, setStage14bError);
    errorIfNoComplete("14C", session.stage_14c_error, setStage14cError);
    errorIfNoComplete("15", session.stage_15_error, setStage15Error);
    errorIfNoComplete("16", session.stage_16_error, setStage16Error);

    if (
      session.current_stage === 12 &&
      session.status === "running" &&
      session.stage_11_output &&
      !session.stage_12_output &&
      !session.checkpoint_c_confirmed
    ) {
      nextStatuses["12"] = "running";
    }

    setStatuses(nextStatuses);

    if (hydratedSessionRef.current !== session.id && selectedIdRef.current !== "BRIEF") {
      hydratedSessionRef.current = session.id;
      const activeStage = (() => {
        for (let i = STAGES.length - 1; i >= 0; i--) {
          const state = nextStatuses[STAGES[i].id];
          if (state === "running" || state === "checkpoint" || state === "error") return STAGES[i].id;
        }
        for (let i = STAGES.length - 1; i >= 0; i--) {
          if (nextStatuses[STAGES[i].id] === "complete") return STAGES[i].id;
        }
        return "01";
      })();
      setSelectedId(activeStage);
    }
  }, [initialStatuses, session]);

  // Trigger Stage 1 when session loads (or on retry).
  useEffect(() => {
    if (!sessionId || !session) return;
    if (session.stage_1_output && retryNonce === 0) {
      // Already complete — hydrate.
      setStage1Output(session.stage_1_output);
      setStatuses((p) => ({
        ...p,
        "01": session.checkpoint_a_confirmed ? "complete" : "checkpoint",
        "01B": session.stage_1b_required
            ? session.stage_1b_output
              ? "complete"
              : "pending"
          : p["01B"],
      }));
      return;
    }
    if (statuses["01"] !== "running" && retryNonce === 0) return;
    let cancelled = false;
    setStage1Loading(true);
    setStage1Error(null);
    setStatuses((p) => ({ ...p, "01": "running" }));

    const fb1 = pendingFeedback["01"];
    (async () =>
      drainStreamOrPollDb(
        await runStage1Fn({
          data: { sessionId, feedback: fb1, previousOutput: pendingPreviousOutput["01"] },
        }),
        setStage1Output,
        { sessionId, outputColumns: ["stage_1_output"], stageStatusId: "1" },
      ))()
      .then((result) => {
        if (cancelled) return;
        setStage1Output(result.output);
        setStage1Loading(false);
        if (fb1)
          setPendingFeedback((p) => {
            const n = { ...p };
            delete n["01"];
            return n;
          });
        if (fb1)
          setPendingPreviousOutput((p) => {
            const n = { ...p };
            delete n["01"];
            return n;
          });
        setStatuses((p) => {
          const next: Record<string, StageStatus> = { ...p, "01": "checkpoint" };
          if (result.stage1bRequired) next["01B"] = "pending";
          return next;
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStage1Loading(false);
        setStage1Error(err instanceof Error ? err.message : "Stage 1 failed");
        setStatuses((p) => ({ ...p, "01": "error" }));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, session?.id, retryNonce]);

  // Trigger Stage 1B when required and not yet generated.
  useEffect(() => {
    if (!sessionId || !session) return;
    if (!session.stage_1b_required) return;
    if (stage1bOutput) return;
    if (statuses["01B"] !== "running") return;
    let cancelled = false;
    setStage1bLoading(true);
    (async () =>
      drainStreamOrPollDb(await runStage1bFn({ data: { sessionId } }), setStage1bOutput, {
        sessionId,
        outputColumns: ["stage_1b_output"],
        stageStatusId: "1b",
      }))()
      .then((result) => {
        if (cancelled) return;
        setStage1bOutput(result.output);
        setStage1bLoading(false);
        setStatuses((p) => ({ ...p, "01B": "checkpoint" }));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStage1bLoading(false);
        setStage1Error(err instanceof Error ? err.message : "Stage 1B failed");
        setStatuses((p) => ({ ...p, "01B": "error" }));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, session?.stage_1b_required, statuses["01B"]]);

  // Trigger Stage 2 when its status flips to "running".
  useEffect(() => {
    if (!sessionId || !session) return;
    if (statuses["02"] !== "running") return;
    if (stage2Output) return;
    let cancelled = false;
    setStage2Loading(true);
    setStage2Error(null);
    (async () =>
      drainStreamOrPollDb(await runStage2Fn({ data: { sessionId } }), setStage2Output, {
        sessionId,
        outputColumns: ["stage_2_output"],
        stageStatusId: "2",
      }))()
      .then((result) => {
        if (cancelled) return;
        setStage2Output(result.output);
        setStage2Loading(false);
        setStatuses((p) => ({ ...p, "02": "complete" }));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStage2Loading(false);
        setStage2Error(err instanceof Error ? err.message : "Stage 2 failed");
        setStatuses((p) => ({ ...p, "02": "error" }));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, session?.id, statuses["02"], stageRunNonce["02"]]);

  // Trigger Stage 3 when its status flips to "running".
  useEffect(() => {
    if (!sessionId || !session) return;
    if (statuses["03"] !== "running") return;
    if (stage3Output) return;
    let cancelled = false;
    setStage3Loading(true);
    setStage3Error(null);
    (async () =>
      drainStreamOrPollDb(await runStage3Fn({ data: { sessionId } }), setStage3Output, {
        sessionId,
        outputColumns: ["stage_3_output"],
        stageStatusId: "3",
      }))()
      .then((result) => {
        if (cancelled) return;
        setStage3Output(result.output);
        setStage3Loading(false);
        setStatuses((p) => ({ ...p, "03": "complete" }));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStage3Loading(false);
        setStage3Error(err instanceof Error ? err.message : "Stage 3 failed");
        setStatuses((p) => ({ ...p, "03": "error" }));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, session?.id, statuses["03"], stageRunNonce["03"]]);

  // Trigger Stage 4 when its status flips to "running".
  useEffect(() => {
    if (!sessionId || !session) return;
    if (statuses["04"] !== "running") return;
    if (stage4Output) return;
    let cancelled = false;
    setStage4Loading(true);
    setStage4Error(null);
    (async () =>
      drainStreamOrPollDb(await runStage4Fn({ data: { sessionId } }), setStage4Output, {
        sessionId,
        outputColumns: ["stage_4_output"],
        stageStatusId: "4",
      }))()
      .then((result) => {
        if (cancelled) return;
        setStage4Output(result.output);
        setStage4Loading(false);
        setStatuses((p) => ({ ...p, "04": "complete" }));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStage4Loading(false);
        setStage4Error(err instanceof Error ? err.message : "Stage 4 failed");
        setStatuses((p) => ({ ...p, "04": "error" }));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, session?.id, statuses["04"], stageRunNonce["04"]]);

  // Trigger Stage 4B when its status flips to "running".
  useEffect(() => {
    if (!sessionId || !session) return;
    if (statuses["04B"] !== "running") return;
    if (stage4bOutput) return;
    let cancelled = false;
    setStage4bLoading(true);
    setStage4bError(null);
    (async () =>
      drainStreamOrPollDb(await runStage4bFn({ data: { sessionId } }), setStage4bOutput, {
        sessionId,
        outputColumns: ["stage_4b_output"],
        stageStatusId: "4b",
      }))()
      .then((result) => {
        if (cancelled) return;
        setStage4bOutput(result.output);
        setStage4bLoading(false);
        setStatuses((p) => ({ ...p, "04B": "complete" }));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStage4bLoading(false);
        setStage4bError(err instanceof Error ? err.message : "Stage 4B failed");
        setStatuses((p) => ({ ...p, "04B": "error" }));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, session?.id, statuses["04B"], stageRunNonce["04B"]]);


  // Trigger Stage 5 when its status flips to "running".
  useEffect(() => {
    if (!sessionId || !session) return;
    if (statuses["05"] !== "running") return;
    if (stage5Output) return;
    let cancelled = false;
    setStage5Loading(true);
    setStage5Error(null);
    (async () =>
      drainStreamOrPollDb(await runStage5Fn({ data: { sessionId } }), setStage5Output, {
        sessionId,
        outputColumns: ["stage_5_output"],
        stageStatusId: "5",
      }))()
      .then((result) => {
        if (cancelled) return;
        setStage5Output(result.output);
        setStage5Loading(false);
        setStatuses((p) => ({ ...p, "05": "complete" }));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStage5Loading(false);
        setStage5Error(err instanceof Error ? err.message : "Stage 5 failed");
        setStatuses((p) => ({ ...p, "05": "error" }));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, session?.id, statuses["05"], stageRunNonce["05"]]);

  // Trigger Stage 6 when its status flips to "running".
  useEffect(() => {
    if (!sessionId || !session) return;
    if (statuses["06"] !== "running") return;
    if (stage6Output) return;
    let cancelled = false;
    setStage6Loading(true);
    setStage6Error(null);
    (async () =>
      drainStreamOrPollDb(await runStage6Fn({ data: { sessionId } }), setStage6Output, {
        sessionId,
        outputColumns: ["stage_6_output"],
        stageStatusId: "6",
      }))()
      .then((result) => {
        if (cancelled) return;
        setStage6Output(result.output);
        setStage6Loading(false);
        setStatuses((p) => ({ ...p, "06": "complete" }));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStage6Loading(false);
        setStage6Error(err instanceof Error ? err.message : "Stage 6 failed");
        setStatuses((p) => ({ ...p, "06": "error" }));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, session?.id, statuses["06"], stageRunNonce["06"]]);

  // Trigger Stage 7 when its status flips to "running".
  useEffect(() => {
    if (!sessionId || !session) return;
    if (statuses["07"] !== "running") return;
    if (stage7Output) return;
    let cancelled = false;
    setStage7Loading(true);
    setStage7Error(null);
    (async () =>
      drainStreamOrPollDb(await runStage7Fn({ data: { sessionId } }), setStage7Output, {
        sessionId,
        outputColumns: ["stage_7_output"],
        stageStatusId: "7",
      }))()
      .then((result) => {
        if (cancelled) return;
        setStage7Output(result.output);
        setStage7Loading(false);
        setStatuses((p) => ({ ...p, "07": "complete" }));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStage7Loading(false);
        setStage7Error(err instanceof Error ? err.message : "Stage 7 failed");
        setStatuses((p) => ({ ...p, "07": "error" }));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, session?.id, statuses["07"], stageRunNonce["07"]]);

  // Stage 8 — SMP Generation, ends at Checkpoint B.
  useEffect(() => {
    if (!sessionId || !session) return;
    if (statuses["08"] !== "running") return;
    const fb8 = pendingFeedback["08"];
    if (stage8Output && !fb8) return;
    let cancelled = false;
    setStage8Loading(true);
    setStage8Error(null);
    (async () =>
      drainStreamOrPollDb(
        await runStage8Fn({
          data: { sessionId, feedback: fb8, previousOutput: pendingPreviousOutput["08"] },
        }),
        setStage8Output,
        { sessionId, outputColumns: ["stage_8_output"], stageStatusId: "8" },
      ))()
      .then((result) => {
        if (cancelled) return;
        setStage8Output(result.output);
        setStage8Loading(false);
        if (fb8)
          setPendingFeedback((p) => {
            const n = { ...p };
            delete n["08"];
            return n;
          });
        if (fb8)
          setPendingPreviousOutput((p) => {
            const n = { ...p };
            delete n["08"];
            return n;
          });
        setStatuses((p) => ({ ...p, "08": "checkpoint" }));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStage8Loading(false);
        setStage8Error(err instanceof Error ? err.message : "Stage 8 failed");
        setStatuses((p) => ({ ...p, "08": "error" }));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, session?.id, statuses["08"], stageRunNonce["08"]]);

  // Stage 9 — Divergence Validation.
  useEffect(() => {
    if (!sessionId || !session) return;
    if (statuses["09"] !== "running") return;
    if (stage9Output) return;
    let cancelled = false;
    setStage9Loading(true);
    setStage9Error(null);
    (async () =>
      drainStreamOrPollDb(await runStage9Fn({ data: { sessionId } }), setStage9Output, {
        sessionId,
        outputColumns: ["stage_9_output", "stage_9_leftofcentre_output"],
        stageStatusId: "9",
      }))()
      .then((result) => {
        if (cancelled) return;
        setStage9Output(result.output);
        setStage9Loading(false);
        setStatuses((p) => ({ ...p, "09": "complete" }));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStage9Loading(false);
        setStage9Error(err instanceof Error ? err.message : "Stage 9 failed");
        setStatuses((p) => ({ ...p, "09": "error" }));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, session?.id, statuses["09"], stageRunNonce["09"]]);

  // Stage 10 — Scoring.
  useEffect(() => {
    if (!sessionId || !session) return;
    if (statuses["10"] !== "running") return;
    if (stage10Output) return;
    let cancelled = false;
    setStage10Loading(true);
    setStage10Error(null);
    (async () =>
      drainStreamOrPollDb(await runStage10Fn({ data: { sessionId } }), setStage10Output, {
        sessionId,
        outputColumns: ["stage_10_output"],
        stageStatusId: "10",
      }))()
      .then((result) => {
        if (cancelled) return;
        setStage10Output(result.output);
        setStage10Loading(false);
        setStatuses((p) => ({ ...p, "10": "complete" }));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStage10Loading(false);
        setStage10Error(err instanceof Error ? err.message : "Stage 10 failed");
        setStatuses((p) => ({ ...p, "10": "error" }));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, session?.id, statuses["10"], stageRunNonce["10"]]);

  // Stage 11 — Pressure Test.
  useEffect(() => {
    if (!sessionId || !session) return;
    if (statuses["11"] !== "running") return;
    if (stage11Output) return;
    let cancelled = false;
    setStage11Loading(true);
    setStage11Error(null);
    (async () =>
      drainStreamOrPollDb(await runStage11Fn({ data: { sessionId } }), setStage11Output, {
        sessionId,
        outputColumns: ["stage_11_output"],
        stageStatusId: "11",
      }))()
      .then((result) => {
        if (cancelled) return;
        setStage11Output(result.output);
        setStage11Loading(false);
        setStatuses((p) => ({ ...p, "11": "complete" }));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStage11Loading(false);
        setStage11Error(err instanceof Error ? err.message : "Stage 11 failed");
        setStatuses((p) => ({ ...p, "11": "error" }));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, session?.id, statuses["11"], stageRunNonce["11"]]);

  // Stage 12 — TYPE 1 (Display & Select).
  // Stage 12 must actually execute before the human selection UI appears.
  // Keep the stage in `running` while Claude composes the presentation cards;
  // only enter Checkpoint C after the Stage 12 stream has completed.
  useEffect(() => {
    if (!sessionId || !session) return;
    if (statuses["12"] !== "running") return;

    const fb12 = pendingFeedback["12"];
    const hasStage11 = !!(stage11Output ?? session.stage_11_output);
    if (!hasStage11) return;

    // If we already have Stage 12 output and no feedback, no Claude work to do.
    if (stage12Output && !fb12) {
      setStatuses((p) => (p["12"] === "checkpoint" ? p : { ...p, "12": "checkpoint" }));
      return;
    }

    let cancelled = false;
    setStage12Loading(true);
    setStage12Error(null);
    (async () =>
      drainStreamOrPollDb(
        await runStage12Fn({
          data: { sessionId, feedback: fb12, previousOutput: pendingPreviousOutput["12"] },
        }),
        setStage12Output,
        { sessionId, outputColumns: ["stage_12_output"], stageStatusId: "12" },
      ))()
      .then((result) => {
        if (cancelled) return;
        setStage12Output(result.output);
        setStage12Loading(false);
        if (fb12) {
          setPendingFeedback((p) => {
            const n = { ...p };
            delete n["12"];
            return n;
          });
          setPendingPreviousOutput((p) => {
            const n = { ...p };
            delete n["12"];
            return n;
          });
        }
        // Only now should Checkpoint C render the card-selection interface.
        setStatuses((p) =>
          p["12"] === "complete" || p["12"] === "checkpoint" ? p : { ...p, "12": "checkpoint" },
        );
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStage12Loading(false);
        setStage12Error(err instanceof Error ? err.message : "Stage 12 failed");
        setStatuses((p) => ({ ...p, "12": "error" }));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, session?.id, statuses["12"], stageRunNonce["12"]]);

  // Stages 13–16 — post-selection validation, territory mapping, audit, and assembly.
  useEffect(() => {
    if (!sessionId || !session || statuses["13"] !== "running" || stage13Output || !intelSubmitted)
      return;
    let cancelled = false;
    setStage13Loading(true);
    setStage13Error(null);
    (async () =>
      drainStreamOrPollDb(await runStage13Fn({ data: { sessionId } }), setStage13Output, {
        sessionId,
        outputColumns: ["stage_13_output"],
        stageStatusId: "13",
      }))()
      .then((result) => {
        if (cancelled) return;
        setStage13Output(result.output);
        setStage13Loading(false);
        setStatuses((p) => ({ ...p, "13": "complete" }));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStage13Loading(false);
        setStage13Error(err instanceof Error ? err.message : "Stage 13 failed");
        setStatuses((p) => ({ ...p, "13": "error" }));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, session?.id, statuses["13"], intelSubmitted, stageRunNonce["13"]]);

  useEffect(() => {
    if (!sessionId || !session || statuses["13B"] !== "running" || stage13bOutput) return;
    let cancelled = false;
    setStage13bLoading(true);
    setStage13bError(null);
    (async () =>
      drainStreamOrPollDb(await runStage13bFn({ data: { sessionId } }), setStage13bOutput, {
        sessionId,
        outputColumns: ["stage_13b_output"],
        stageStatusId: "13b",
      }))()
      .then((result) => {
        if (cancelled) return;
        setStage13bOutput(result.output);
        setStage13bLoading(false);
        setStatuses((p) => ({ ...p, "13B": "complete" }));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStage13bLoading(false);
        setStage13bError(err instanceof Error ? err.message : "Stage 13B failed");
        setStatuses((p) => ({ ...p, "13B": "error" }));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, session?.id, statuses["13B"], stageRunNonce["13B"]]);

  useEffect(() => {
    if (!sessionId || !session || statuses["14"] !== "running" || stage14Output) return;
    let cancelled = false;
    setStage14Loading(true);
    setStage14Error(null);
    (async () =>
      drainStreamOrPollDb(await runStage14Fn({ data: { sessionId } }), setStage14Output, {
        sessionId,
        outputColumns: ["stage_14_output"],
        stageStatusId: "14",
        errorColumn: "stage_14_error",
      }))()
      .then((result) => {
        if (cancelled) return;
        setStage14Output(result.output);
        setStage14Loading(false);
        setStatuses((p) => ({ ...p, "14": "complete" }));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStage14Loading(false);
        setStage14Error(err instanceof Error ? err.message : "Stage 14 failed");
        setStatuses((p) => ({ ...p, "14": "error" }));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, session?.id, statuses["14"], stageRunNonce["14"]]);

  useEffect(() => {
    if (!sessionId || !session || statuses["14B"] !== "running" || stage14bOutput) return;
    let cancelled = false;
    setStage14bLoading(true);
    setStage14bError(null);
    (async () =>
      drainStreamOrPollDb(await runStage14bFn({ data: { sessionId } }), setStage14bOutput, {
        sessionId,
        outputColumns: ["stage_14b_output"],
        stageStatusId: "14b",
        errorColumn: "stage_14b_error",
      }))()
      .then((result) => {
        if (cancelled) return;
        setStage14bOutput(result.output);
        setStage14bLoading(false);
        setStatuses((p) => ({ ...p, "14B": "complete" }));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStage14bLoading(false);
        setStage14bError(err instanceof Error ? err.message : "Stage 14B failed");
        setStatuses((p) => ({ ...p, "14B": "error" }));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, session?.id, statuses["14B"], stageRunNonce["14B"]]);

  useEffect(() => {
    if (!sessionId || !session || statuses["14C"] !== "running" || stage14cOutput) return;
    let cancelled = false;
    setStage14cLoading(true);
    setStage14cError(null);
    (async () =>
      drainStreamOrPollDb(await runStage14cFn({ data: { sessionId } }), setStage14cOutput, {
        sessionId,
        outputColumns: ["stage_14c_output"],
        stageStatusId: "14c",
        errorColumn: "stage_14c_error",
      }))()
      .then((result) => {
        if (cancelled) return;
        setStage14cOutput(result.output);
        setStage14cLoading(false);
        setStatuses((p) => ({ ...p, "14C": "complete" }));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStage14cLoading(false);
        setStage14cError(err instanceof Error ? err.message : "Stage 14C failed");
        setStatuses((p) => ({ ...p, "14C": "error" }));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, session?.id, statuses["14C"], stageRunNonce["14C"]]);

  useEffect(() => {
    if (!sessionId || !session || statuses["15"] !== "running" || stage15Output) return;
    let cancelled = false;
    setStage15Loading(true);
    setStage15Error(null);
    (async () =>
      drainStreamOrPollDb(await runStage15Fn({ data: { sessionId } }), setStage15Output, {
        sessionId,
        outputColumns: ["stage_15_output"],
        stageStatusId: "15",
        errorColumn: "stage_15_error",
      }))()
      .then((result) => {
        if (cancelled) return;
        setStage15Output(result.output);
        setStage15Loading(false);
        setStatuses((p) => ({ ...p, "15": "complete" }));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStage15Loading(false);
        setStage15Error(err instanceof Error ? err.message : "Stage 15 failed");
        setStatuses((p) => ({ ...p, "15": "error" }));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, session?.id, statuses["15"], stageRunNonce["15"]]);

  // Stage 16 (Document Assembly) is NOT auto-triggered from the Phase 1
  // pipeline. It must run only after Phase 2 (Stages 17–22) plus the
  // Checkpoint D (territory) and Checkpoint E (detonation) selections are
  // complete, otherwise the vision document fabricates a Detonation section
  // from data that does not yet exist. Generation happens on demand from
  // the `/complete` deliverables page once the full pipeline has finished.

  const selectedError =
    selected.id === "01" || selected.id === "01B"
      ? stage1Error
      : selected.id === "02"
        ? stage2Error
        : selected.id === "03"
          ? stage3Error
          : selected.id === "04"
            ? stage4Error
            : selected.id === "04B"
              ? stage4bError
            : selected.id === "05"
              ? stage5Error
              : selected.id === "06"
                ? stage6Error
                : selected.id === "07"
                  ? stage7Error
                  : selected.id === "08"
                    ? stage8Error
                    : selected.id === "09"
                      ? stage9Error
                      : selected.id === "10"
                        ? stage10Error
                        : selected.id === "11"
                          ? stage11Error
                          : selected.id === "12"
                            ? stage12Error
                            : selected.id === "13"
                              ? stage13Error
                              : selected.id === "13B"
                                ? stage13bError
                                : selected.id === "14"
                                  ? stage14Error
                                  : selected.id === "14B"
                                    ? stage14bError
                                    : selected.id === "14C"
                                      ? stage14cError
                                      : selected.id === "15"
                                        ? stage15Error
                                        : selected.id === "16"
                                          ? stage16Error
                                          : null;

  // Per-stage output: use live Stage 1 / 1B / 2 / 3 output, demo stubs for others.
  const stageOutputs = useMemo<Record<string, string>>(() => {
    const sanitize = (s: string) => sanitizeStageOutput(s);
    if (!sessionId) return STAGE_OUTPUTS;
    return {
      ...STAGE_OUTPUTS,
      "01":
        (stage1Output && sanitize(stage1Output)) ??
        (stage1Loading ? "Analysing brief — this can take 20–60 seconds…" : "Awaiting output."),
      "01B":
        (stage1bOutput && sanitize(stage1bOutput)) ??
        (stage1bLoading
          ? "Generating brief enhancement questions — this can take 20–60 seconds…"
          : "Awaiting output."),
      "02":
        (stage2Output && sanitize(stage2Output)) ??
        (stage2Loading
          ? "Building Category Intelligence — this can take 30–90 seconds…"
          : "Awaiting output."),
      "03":
        (stage3Output && sanitize(stage3Output)) ??
        (stage3Loading
          ? "Generating the Strategic Framework — this can take 30–90 seconds…"
          : "Awaiting output."),
      "04":
        (stage4Output && sanitize(stage4Output)) ??
        (stage4Loading
          ? "Mapping the Strategic Universes — this can take 30–90 seconds…"
          : "Awaiting output."),
      "04B":
        (stage4bOutput && sanitize(stage4bOutput)) ??
        (stage4bLoading
          ? "Mining distinctive assets and product facts — this can take 30–90 seconds…"
          : "Awaiting output."),
      "05":
        (stage5Output && sanitize(stage5Output)) ??
        (stage5Loading
          ? "Generating key insights — this can take 60–120 seconds…"
          : "Awaiting output."),
      "06":
        (stage6Output && sanitize(stage6Output)) ??
        (stage6Loading
          ? "Validating insights — this can take 60–120 seconds…"
          : "Awaiting output."),
      "07":
        (stage7Output && sanitize(stage7Output)) ??
        (stage7Loading
          ? "Synthesising Strategic Territories — this can take 60–120 seconds…"
          : "Awaiting output."),
      "08":
        (stage8Output && sanitize(stage8Output)) ??
        (stage8Loading
          ? "Generating Strategic Propositions — this can take 60–120 seconds…"
          : "Awaiting output."),
      "09":
        (stage9Output && sanitize(stage9Output)) ??
        (stage9Loading
          ? "Auditing proposition distinctiveness — this can take 30–90 seconds…"
          : "Awaiting output."),
      "10":
        (stage10Output && sanitize(stage10Output)) ??
        (stage10Loading
          ? "Scoring propositions across six dimensions — this can take 60–120 seconds…"
          : "Awaiting output."),
      "11":
        (stage11Output && sanitize(stage11Output)) ??
        (stage11Loading
          ? "Running integrity tests on shortlisted propositions — this can take 60–120 seconds…"
          : "Awaiting output."),
      "12":
        (stage12Output && sanitize(stage12Output)) ??
        (stage12Loading
          ? "Composing proposition cards for review — this can take 30–60 seconds…"
          : "Awaiting output."),
      "13":
        (stage13Output && sanitize(stage13Output)) ??
        (stage13Loading
          ? "Validating brand fit — this can take 30–90 seconds…"
          : "Awaiting output."),
      "13B":
        (stage13bOutput && sanitize(stage13bOutput)) ??
        (stage13bLoading
          ? "Checking historical territory references — this can take 30–90 seconds…"
          : "Awaiting output."),
      "14":
        (stage14Output && sanitize(stage14Output)) ??
        (stage14Loading
          ? "Mapping the creative territory — this can take 60–120 seconds…"
          : "Awaiting output."),
      "14B":
        (stage14bOutput && sanitize(stage14bOutput)) ??
        (stage14bLoading
          ? "Mapping channel expression — this can take 60–120 seconds…"
          : "Awaiting output."),
      "14C":
        (stage14cOutput && sanitize(stage14cOutput)) ??
        (stage14cLoading
          ? "Defining the brand world — this can take 60–120 seconds…"
          : "Awaiting output."),
      "15":
        (stage15Output && sanitize(stage15Output)) ??
        (stage15Loading
          ? "Running final coherence audit — this can take 30–90 seconds…"
          : "Awaiting output."),
      "16":
        (stage16Output && sanitize(stage16Output)) ??
        (stage16Loading
          ? "Assembling the consulting output — this can take 60–120 seconds…"
          : "Awaiting output."),
    };
  }, [
    sessionId,
    stage1Output,
    stage1Loading,
    stage1bOutput,
    stage1bLoading,
    stage2Output,
    stage2Loading,
    stage3Output,
    stage3Loading,
    stage4Output,
    stage4Loading,
    stage4bOutput,
    stage4bLoading,
    stage5Output,
    stage5Loading,
    stage6Output,
    stage6Loading,
    stage7Output,
    stage7Loading,
    stage8Output,
    stage8Loading,
    stage9Output,
    stage9Loading,
    stage10Output,
    stage10Loading,
    stage11Output,
    stage11Loading,
    stage12Output,
    stage12Loading,
    stage13Output,
    stage13Loading,
    stage13bOutput,
    stage13bLoading,
    stage14Output,
    stage14Loading,
    stage14bOutput,
    stage14bLoading,
    stage14cOutput,
    stage14cLoading,
    stage15Output,
    stage15Loading,
    stage16Output,
    stage16Loading,
  ]);

  // Progress — count main (non-conditional) stages.
  const mainStages = STAGES.filter((s) => !s.conditional);
  const completedMain = mainStages.filter((s) => statuses[s.id] === "complete").length;
  const runningMain = mainStages.find((s) => statuses[s.id] === "running");
  const currentMainNumber = runningMain
    ? mainStages.findIndex((s) => s.id === runningMain.id) + 1
    : completedMain;
  const progressPct = (completedMain / mainStages.length) * 100;

  const brandLabel = session?.brand_name ?? SAMPLE_BRAND;
  const pipelineStatus = stage1Loading
    ? "Running"
    : stage1Error
      ? "Error"
      : statuses["01"] === "checkpoint"
        ? "Review Needed"
        : "In Progress";

  // Current active stage = the running/checkpoint stage furthest into the pipeline.
  const currentActiveId = (() => {
    for (let i = STAGES.length - 1; i >= 0; i--) {
      const st = statuses[STAGES[i].id];
      if (st === "running" || st === "checkpoint" || st === "error") return STAGES[i].id;
    }
    for (let i = STAGES.length - 1; i >= 0; i--) {
      if (statuses[STAGES[i].id] === "complete") return STAGES[i].id;
    }
    return STAGES[0].id;
  })();
  const isViewingHistorical = false;
  const pipelineIsRunning =
    Object.values(statuses).some((s) => s === "running") ||
    stage1Loading ||
    stage1bLoading ||
    stage2Loading ||
    stage3Loading ||
    stage4Loading ||
    stage4bLoading ||
    stage5Loading ||
    stage6Loading ||
    stage7Loading ||
    stage8Loading ||
    stage9Loading ||
    stage10Loading ||
    stage11Loading ||
    stage12Loading ||
    stage13Loading ||
    stage13bLoading ||
    stage14Loading ||
    stage14bLoading ||
    stage14cLoading ||
    stage15Loading ||
    stage16Loading;

  // Compute prev/next visible stages relative to the currently-viewed stage.
  const selectedIdx = STAGES.findIndex((s) => s.id === selectedId);
  const prevStage = (() => {
    for (let i = selectedIdx - 1; i >= 0; i--) {
      const st = statuses[STAGES[i].id];
      if (st === "complete" || st === "checkpoint") return STAGES[i];
    }
    return null;
  })();
  const nextStage = (() => {
    for (let i = selectedIdx + 1; i < STAGES.length; i++) {
      if (STAGES[i].id === "01B" && !session?.stage_1b_required) continue;
      return STAGES[i];
    }
    return null;
  })();
  const nextStageStatus: StageStatus | null = nextStage ? statuses[nextStage.id] : null;
  const pipelineComplete = mainStages.every((s) => statuses[s.id] === "complete");

  // Dynamic document title: "[Brand] — Stage X — Brand Grenade"
  useEffect(() => {
    document.title = `${brandLabel} Strategy Room — Stage ${Math.max(1, currentMainNumber)} — Brand Grenade`;
  }, [brandLabel, currentMainNumber]);

  // Keyboard shortcut: Cmd/Ctrl+Enter confirms standard checkpoints.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.key === "Enter" && (e.metaKey || e.ctrlKey))) return;
      const st = statuses[selectedId];
      const letter = CHECKPOINT_LETTERS[selectedId];
      if (st !== "checkpoint" || !letter) return;
      // Skip when custom checkpoint UIs are active — they have their own submit.
      if (selectedId === "12") return;
      if (selectedId === "13" && !intelSubmitted) return;
      if (selectedId === "01B") return;
      e.preventDefault();
      // Re-derive via DOM click on confirm button if present, else dispatch event.
      const btn = document.querySelector<HTMLButtonElement>("[data-checkpoint-confirm='true']");
      btn?.click();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedId, statuses, intelSubmitted]);

  const handleResubmitCheckpoint = async (stageId: string, feedback: string) => {
    console.log(`[Checkpoint Resubmit] stage=${stageId} feedback=${feedback}`);
    const fb = (feedback ?? "").trim();
    const dbId = STAGE_ID_TO_DB[stageId];
    if (!sessionId || !dbId || !fb) return;
    const rejectedOutput =
      stageId === "08"
        ? stage8Output?.trim()
        : stageId === "12"
          ? stage12Output?.trim()
          : stageId === "01"
            ? stage1Output?.trim()
            : null;

    setResubmitting(true);
    try {
      await resetStageCascadeFn({
        data: {
          sessionId,
          stageId: dbId,
          feedback: fb,
          previousOutput: rejectedOutput || undefined,
        },
      });
      resetLocalFromStage(stageId);
      setPendingFeedback((p) => ({ ...p, [stageId]: fb }));
      if (rejectedOutput) {
        setPendingPreviousOutput((p) => ({ ...p, [stageId]: rejectedOutput }));
      }
      setStatuses((p) => {
        const next: Record<string, StageStatus> = { ...p, [stageId]: "running" };
        const idx = STAGES.findIndex((s) => s.id === stageId);
        for (let i = idx + 1; i < STAGES.length; i++) next[STAGES[i].id] = "pending";
        return next;
      });
      setSelectedId(stageId);
      if (stageId === "01") setRetryNonce((n) => n + 1);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Feedback resubmit failed";
      if (stageId === "01") setStage1Error(message);
      if (stageId === "08") setStage8Error(message);
      if (stageId === "12") setStage12Error(message);
      setStatuses((p) => ({ ...p, [stageId]: "error" }));
    } finally {
      setResubmitting(false);
    }
  };

  const getRawStageOutput = (stageId: string): string | null => {
    const outputs: Record<string, string | null> = {
      "01": stage1Output,
      "01B": stage1bOutput,
      "02": stage2Output,
      "03": stage3Output,
      "04": stage4Output,
      "04B": stage4bOutput,
      "05": stage5Output,
      "06": stage6Output,
      "07": stage7Output,
      "08": stage8Output,
      "09": stage9Output,
      "10": stage10Output,
      "11": stage11Output,
      "12": stage12Output,
      "13": stage13Output,
      "13B": stage13bOutput,
      "14": stage14Output,
      "14B": stage14bOutput,
      "14C": stage14cOutput,
      "15": stage15Output,
      "16": stage16Output,
    };
    return outputs[stageId] ?? null;
  };

  const advanceFromStage8 = async () => {
    if (!sessionId) return false;
    const currentStage8 = stage8Output ?? session?.stage_8_output ?? "";
    const blocks = splitStage8Propositions(currentStage8);
    const kept = blocks.filter((b) => stage8KeepNames.has(b.name));
    if (kept.length === 0) {
      alert("At least one proposition must be checked before moving to Stage 9.");
      return false;
    }

    const filtered = kept.map((b) => b.markdown).join("\n\n");
    const { error: filterErr } = await supabase
      .from("sessions")
      .update({ stage_8_output: filtered })
      .eq("id", sessionId);
    if (filterErr) {
      console.error("[Checkpoint B] failed to filter Stage 8 output", filterErr);
      return false;
    }

    await resetStageCascadeFn({ data: { sessionId, stageId: "9" } });
    await confirmCheckpointBFn({ data: { sessionId } });
    setSession((prev) =>
      prev
        ? ({
            ...prev,
            stage_8_output: filtered,
            stage_9_output: null,
            stage_9_leftofcentre_output: null,
            stage_10_output: null,
            stage_11_output: null,
            stage_12_output: null,
            stage_13_output: null,
            stage_13b_output: null,
            stage_14_output: null,
            stage_14b_output: null,
            stage_14c_output: null,
            stage_15_output: null,
            stage_16_consulting_output: null,
            checkpoint_b_confirmed: true,
          } as SessionData)
        : prev,
    );
    setStage8Output(filtered);
    resetLocalFromStage("09");
    return true;
  };

  const markFollowingPending = (stageId: string, activeStatus: StageStatus = "running") => {
    setStatuses((prev) => {
      const next: Record<string, StageStatus> = { ...prev, [stageId]: activeStatus };
      const idx = STAGES.findIndex((s) => s.id === stageId);
      for (let i = idx + 1; i < STAGES.length; i++) next[STAGES[i].id] = "pending";
      return next;
    });
  };

  const handleRetryStage = async (stageId: string) => {
    if (!sessionId) return;
    const dbId = STAGE_ID_TO_DB[stageId];
    if (!dbId) return;
    const amendment = amendmentNotes[stageId]?.trim() ?? "";
    const fieldNotes = checkpointFieldNotes[stageId] ?? [];
    const note = buildRevisionInstruction(fieldNotes, amendment).trim();
    const previousOutput = getRawStageOutput(stageId)?.trim();
    try {
      if (note) setPendingFeedback((p) => ({ ...p, [stageId]: note }));
      if (previousOutput) setPendingPreviousOutput((p) => ({ ...p, [stageId]: previousOutput }));
      await resetStageCascadeFn({
        data: {
          sessionId,
          stageId: dbId,
          feedback: note || undefined,
          previousOutput: previousOutput || undefined,
        },
      });
      resetLocalFromStage(stageId);
      markFollowingPending(stageId, "running");
      bumpStageRunNonce(stageId);
      setSelectedId(stageId);
      if (stageId === "01") setRetryNonce((n) => n + 1);
    } catch (e) {
      console.error("retry cascade failed", e);
      setStatuses((p) => ({ ...p, [stageId]: "error" }));
    }
  };

  const handleContinueStage = async () => {
    const stageId = selected.id;
    if (stageId === "01" && selectedStatus === "checkpoint") {
      if (sessionId) {
        const { error } = await supabase
          .from("sessions")
          .update({ checkpoint_a_confirmed: true, checkpoint_a_confirmed_at: new Date().toISOString() })
          .eq("id", sessionId);
        if (error) {
          console.error("[Checkpoint A] failed to persist", error);
          return;
        }
      }
      if (session?.stage_1b_required && !stage1bOutput) {
        setStatuses((p) => ({ ...p, "01": "complete", "01B": "running" }));
        setSelectedId("01B");
        return;
      }
    }
    if (stageId === "08") {
      const ok = await advanceFromStage8();
      if (!ok) return;
      markFollowingPending("09", "running");
      setStatuses((p) => ({ ...p, "08": "complete", "09": "running" }));
      setSelectedId("09");
      return;
    }
    if (stageId === "12" && selectedStatus === "checkpoint") return;
    if (stageId === "13" && !intelSubmitted) return;
    if (!nextStage) return;
    if (statuses[nextStage.id] === "running") {
      await handleRetryStage(nextStage.id);
      return;
    }
    setStatuses((p) => ({ ...p, [stageId]: "complete", [nextStage.id]: "running" }));
    setSelectedId(nextStage.id);
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      <TopNav
        session={{
          brand: brandLabel,
          currentStage: Math.max(1, currentMainNumber),
          totalStages: 27,
          isRunning: pipelineIsRunning,
        }}
      />
      <Breadcrumb
        brand={brandLabel}
        elapsed={elapsed}
        status={pipelineStatus}
        hasBrief={Boolean(session?.brief_text || (session?.brief_versions?.length ?? 0) > 0)}
        briefVersionCount={session?.brief_versions?.length ?? 0}
        onViewBrief={() => {
          scrollToTop();
          setSelectedId("BRIEF");
        }}
        onEditBrief={() => {
          if (!sessionId) return;
          const latest =
            (session?.brief_versions && session.brief_versions.length > 0
              ? session.brief_versions[session.brief_versions.length - 1].fields
              : null) ??
            briefFieldsFromLegacyText({
              brandName: session?.brand_name ?? "",
              category: session?.category ?? "",
              briefText: session?.brief_text ?? null,
            });
          try {
            sessionStorage.setItem(
              PENDING_BRIEF_EDIT_STORAGE_KEY,
              JSON.stringify(latest),
            );
          } catch {/* ignore */}
          navigate({ to: "/brief", search: { edit: sessionId } });
        }}
      />

      <div className="flex flex-1 overflow-hidden">
        <LeftPanel
          stages={STAGES}
          statuses={statuses}
          selectedId={selectedId}
          onSelect={(id) => {
            if (id === "BRIEF") {
              scrollToTop();
              setSelectedId("BRIEF");
              return;
            }
            const st = statuses[id];
            if (st === "complete" || st === "running" || st === "checkpoint" || st === "error") {
              scrollToTop();
              setSelectedId(id);
            }
          }}
          progressPct={progressPct}
          currentMainNumber={Math.max(1, currentMainNumber)}
          totalMain={mainStages.length}
          hasBrief={Boolean(session?.brief_text || (session?.brief_versions?.length ?? 0) > 0)}
        />
        {selectedId === "BRIEF" ? (
          <section className="relative flex min-w-0 flex-1 flex-col bg-background">
            <div
              ref={contentScrollRef}
              className="flex-1 overflow-y-auto px-6 py-10 sm:px-12 sm:py-10"
            >
              <StructuredBriefView
                brandName={session?.brand_name ?? ""}
                category={session?.category ?? ""}
                briefVersions={session?.brief_versions ?? null}
                legacyBriefText={session?.brief_text ?? null}
                onEdit={() => {
                  if (!sessionId) return;
                  const latest =
                    (session?.brief_versions && session.brief_versions.length > 0
                      ? session.brief_versions[session.brief_versions.length - 1].fields
                      : null) ??
                    briefFieldsFromLegacyText({
                      brandName: session?.brand_name ?? "",
                      category: session?.category ?? "",
                      briefText: session?.brief_text ?? null,
                    });
                  try {
                    sessionStorage.setItem(
                      PENDING_BRIEF_EDIT_STORAGE_KEY,
                      JSON.stringify(latest),
                    );
                  } catch {/* ignore */}
                  navigate({ to: "/brief", search: { edit: sessionId } });
                }}
              />
            </div>
          </section>
        ) : (

          <RightPanel
            stage={selected}
            status={selectedStatus}
            stage8KeepNames={stage8KeepNames}
            onToggleStage8Keep={(name, keep) =>
              setStage8KeepNames((prev) => {
                const next = new Set(prev);
                if (keep) next.add(name);
                else next.delete(name);
                return next;
              })
            }
            onManualStage8Submit={async (line, label) => {
              if (!sessionId) return;
              const safeText = line.trim();
              if (!safeText) return;
              const safeLabel = (label.trim() || "Manual Proposition").slice(0, 80);
              const block = `## ${safeLabel}\n\n> **${safeText}**\n`;
              const { error } = await supabase
                .from("sessions")
                .update({ stage_8_output: block })
                .eq("id", sessionId);
              if (error) {
                console.error("[Stage 8 manual] failed to persist", error);
                return;
              }
              await resetStageCascadeFn({ data: { sessionId, stageId: "9" } });
              await confirmCheckpointBFn({ data: { sessionId } });
              setStage8Output(block);
              setStage8KeepNames(new Set([safeLabel]));
              setSession((prev) =>
                prev
                  ? ({
                      ...prev,
                      stage_8_output: block,
                      stage_9_output: null,
                      stage_9_leftofcentre_output: null,
                      stage_10_output: null,
                      stage_11_output: null,
                      stage_12_output: null,
                      stage_13_output: null,
                      stage_13b_output: null,
                      stage_14_output: null,
                      stage_14b_output: null,
                      stage_14c_output: null,
                      stage_15_output: null,
                      stage_16_consulting_output: null,
                      checkpoint_b_confirmed: true,
                    } as SessionData)
                  : prev,
              );
              resetLocalFromStage("09");
              setStatuses((prev) => {
                const next: Record<string, StageStatus> = {
                  ...prev,
                  "08": "complete",
                  "09": "running",
                };
                const idx = STAGES.findIndex((s) => s.id === "09");
                for (let i = idx + 1; i < STAGES.length; i++)
                  next[STAGES[i].id] = "pending";
                return next;
              });
              setSelectedId("09");
            }}
            fullOutput={stageOutputs[selected.id] ?? "Output pending."}
            contentScrollRef={contentScrollRef}
            isViewingHistorical={isViewingHistorical}
            onBackToCurrent={() => setSelectedId(currentActiveId)}
            stage1Error={selectedError}
            tensionScore={selected.id === "01" ? (session?.stage_1_tension_score ?? null) : null}
            stage1bRequired={selected.id === "01" ? (session?.stage_1b_required ?? false) : false}
            amendmentNote={amendmentNotes[selected.id] ?? ""}
            onCheckpointNotesChange={(notes) =>
              setCheckpointFieldNotes((prev) => ({ ...prev, [selected.id]: notes }))
            }
            onAmendmentChange={(value: string) =>
              setAmendmentNotes((prev) => ({ ...prev, [selected.id]: value }))
            }
            onRetry={async () => {
              const id = selected.id;
              // Stage 8 selective regenerate: if the user unchecked any
              // proposition, regenerate only those instead of the full stage.
              if (id === "08" && stage8Output && sessionId) {
                const allBlocks = splitStage8Propositions(stage8Output);
                const allNames = allBlocks.map((b) => b.name);
                const allChecked = allNames.every((n) => stage8KeepNames.has(n));
                if (!allChecked) {
                  // Pull amendment notes + checkpoint field notes the same way
                  // handleRetryStage does, so feedback typed into the bottom
                  // bar is actually injected into the regeneration prompt.
                  const amendment = amendmentNotes[id]?.trim() ?? "";
                  const fieldNotes = checkpointFieldNotes[id] ?? [];
                  const note = buildRevisionInstruction(fieldNotes, amendment).trim();
                  const previousOutput = getRawStageOutput(id)?.trim();
                  setStage8Error(null);
                  setStage8Loading(true);
                  setStatuses((p) => ({ ...p, "08": "running" }));
                  try {
                    const result = await drainStreamOrPollDb(
                      await regenerateStage8SelectiveFn({
                        data: {
                          sessionId,
                          keepTerritories: allNames.filter((n) => stage8KeepNames.has(n)),
                          feedback: note || undefined,
                          previousOutput: previousOutput || undefined,
                        },
                      }),
                      setStage8Output,
                      { sessionId, outputColumns: ["stage_8_output"], stageStatusId: "8" },
                    );
                    setStage8Output(result.output);
                    setStage8Loading(false);
                    setStatuses((p) => ({ ...p, "08": "checkpoint" }));
                  } catch (err) {
                    setStage8Loading(false);
                    setStage8Error(
                      err instanceof Error ? err.message : "Stage 8 selective regenerate failed",
                    );
                    setStatuses((p) => ({ ...p, "08": "error" }));
                  }
                  return;
                }
                // all checked → fall through to the normal full-retry path
              }
              await handleRetryStage(id);
            }}
            showRationale={rationaleForId === selectedId}
            showBrandIntel={selectedId === "13" && !intelSubmitted && selectedStatus === "running"}
            showStage1bResubmit={
              selectedId === "01B" &&
              !!stage1bOutput &&
              !stage1bLoading &&
              selectedStatus !== "complete"
            }
            resubmitting={resubmitting}
            checkpointResubmitting={resubmitting}
            onResubmitBrief={async (additionalBrief) => {
              if (!sessionId) return;
              setResubmitting(true);
              try {
                await resubmitBriefFn({ data: { sessionId, additionalBrief } });
                // Reset local state and re-run Stage 1.
                setStage1Output(null);
                setStage1bOutput(null);
                setStage1Error(null);
                setStatuses((p) => ({
                  ...p,
                  "01": "running",
                  "01B": "pending",
                }));
                setSelectedId("01");
                setRetryNonce((n) => n + 1);
              } catch (err) {
                setStage1Error(err instanceof Error ? err.message : "Resubmit failed");
              } finally {
                setResubmitting(false);
              }
            }}
            onSubmitBrandIntel={async (values) => {
              if (!sessionId) {
                console.log("[Submit Brand Intelligence] clicked — no session id");
                return;
              }
              try {
                await saveBrandIntelligenceFn({ data: { sessionId, brandIntelligence: values } });
                setIntelSubmitted(true);
                setStatuses((p) => ({ ...p, "13": "running" }));
                setSelectedId("13");
              } catch (err) {
                console.error("[Save Brand Intelligence] failed", err);
              }
            }}
            prevStage={prevStage}
            nextStage={nextStage}
            nextStageStatus={nextStageStatus}
            pipelineComplete={pipelineComplete}
            onBack={() => {
              if (prevStage) setSelectedId(prevStage.id);
            }}
            onContinue={handleContinueStage}
            onViewFinal={() => {
              if (sessionId) {
                window.location.href = `/detonation?session=${sessionId}`;
              }
            }}
            onConfirmCheckpoint={async (stageId, notes) => {
              if (stageId === "08") {
                const ok = await advanceFromStage8();
                if (!ok) return;
                setStatuses((prev) => {
                  const next: Record<string, StageStatus> = {
                    ...prev,
                    "08": "complete",
                    "09": "running",
                  };
                  const idx = STAGES.findIndex((s) => s.id === "09");
                  for (let i = idx + 1; i < STAGES.length; i++) next[STAGES[i].id] = "pending";
                  return next;
                });
                setSelectedId("09");
                return;
              }

              // Persist notes + timestamp for the relevant checkpoint.
              const letter = CHECKPOINT_LETTERS[stageId];
              if (sessionId && letter) {
                const notesText = (notes ?? [])
                  .map((n) => n.trim())
                  .filter(Boolean)
                  .join("\n\n");
                const nowIso = new Date().toISOString();
                const update: Partial<{
                  checkpoint_a_confirmed: boolean;
                  checkpoint_a_confirmed_at: string;
                  checkpoint_a_notes: string;
                  checkpoint_b_confirmed: boolean;
                  checkpoint_b_confirmed_at: string;
                  checkpoint_b_notes: string;
                  checkpoint_c_confirmed: boolean;
                  checkpoint_c_confirmed_at: string;
                  checkpoint_c_notes: string;
                }> = {};
                if (letter === "A") {
                  update.checkpoint_a_confirmed = true;
                  update.checkpoint_a_confirmed_at = nowIso;
                  if (notesText) update.checkpoint_a_notes = notesText;
                } else if (letter === "B") {
                  update.checkpoint_b_confirmed = true;
                  update.checkpoint_b_confirmed_at = nowIso;
                  if (notesText) update.checkpoint_b_notes = notesText;
                } else if (letter === "C") {
                  update.checkpoint_c_confirmed = true;
                  update.checkpoint_c_confirmed_at = nowIso;
                  if (notesText) update.checkpoint_c_notes = notesText;
                }
                const { error } = await supabase
                  .from("sessions")
                  .update(update)
                  .eq("id", sessionId);
                if (error) {
                  console.error("[Checkpoint] failed to persist", error);
                  return;
                }
                setSession((prev) => (prev ? ({ ...prev, ...update } as SessionData) : prev));
              }
              // Checkpoint A with 1B required → route to Stage 1B instead of Stage 2.
              if (stageId === "01" && session?.stage_1b_required && !stage1bOutput) {
                setStatuses((prev) => ({
                  ...prev,
                  "01": "complete",
                  "01B": "pending",
                }));
                return;
              }
              setRationaleForId(null);
              setStatuses((prev) => ({ ...prev, [stageId]: "complete" as StageStatus }));
            }}
            onResubmitCheckpoint={handleResubmitCheckpoint}
            onEscalateCheckpoint={(stageId, reason) => {
              console.log(`[Checkpoint Escalate] stage=${stageId} reason=${reason}`);
            }}
            customCheckpoint={
              selectedId === "12" && selectedStatus === "checkpoint" && rationaleForId !== "12" ? (
                <SMPSelection
                  stage12Output={stage12Output ?? ""}
                  stage11Output={stage11Output ?? undefined}
                  stage10Output={stage10Output ?? undefined}
                  onResubmit={(feedback) => handleResubmitCheckpoint("12", feedback)}
                  resubmitting={resubmitting}
                  enhancing={stage12Loading}


                  onSelect={async (card) => {
                    if (!sessionId) return;
                    setSelectedSMP(card);
                    try {
                      await saveSelectedSMPFn({
                        data: {
                          sessionId,
                          smpLine: card.smpLine || `Proposition ${card.cardNumber}`,
                          fieldName: card.fieldName || `Field ${card.cardNumber}`,
                        },
                      });
                    } catch (err) {
                      setStage12Error(
                        err instanceof Error ? err.message : "Failed to save selection",
                      );
                      return;
                    }
                    setRationaleForId("12");
                  }}
                />
              ) : selectedId === "12" && rationaleForId === "12" ? (
                <SelectionRationale
                  selectedSMP={selectedSMP?.smpLine ?? session?.selected_smp ?? ""}
                  submitting={savingRationale}
                  onConfirm={async (values) => {
                    if (!sessionId) return;
                    setSavingRationale(true);
                    try {
                      await saveSelectionRationaleFn({
                        data: { sessionId, rationale: values },
                      });
                      setRationaleForId(null);
                      setStatuses((prev) => ({ ...prev, "12": "complete" }));
                    } catch (err) {
                      setStage12Error(
                        err instanceof Error ? err.message : "Failed to save rationale",
                      );
                    } finally {
                      setSavingRationale(false);
                    }
                  }}
                />
              ) : null
            }
            retryStatus={session?.retry_status ?? null}
          />
        )}
      </div>
    </div>
  );
}

function formatElapsed(ms: number) {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ────────────────────────────────────────────────────────────────────────────
// Breadcrumb bar
// ────────────────────────────────────────────────────────────────────────────

function Breadcrumb({
  brand,
  elapsed,
  status,
  hasBrief,
  briefVersionCount,
  onViewBrief,
  onEditBrief,
}: {
  brand: string;
  elapsed: string;
  status: string;
  hasBrief: boolean;
  briefVersionCount: number;
  onViewBrief: () => void;
  onEditBrief: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border bg-background px-5 py-3 sm:px-8">
      <nav
        className="text-body-sm flex min-w-0 items-center gap-1.5 truncate"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        <Link to="/dashboard" className="transition-colors hover:text-text-secondary">
          Sessions
        </Link>
        <span>→</span>
        <span className="text-text-secondary truncate">{brand}</span>
        <span>→</span>
        <span>Strategy Room</span>
      </nav>

      <div className="ml-4 flex shrink-0 items-center gap-2">
        {hasBrief && (
          <>
            <button
              type="button"
              onClick={onViewBrief}
              className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-semibold transition-colors hover:bg-[#D4924A15]"
              style={{ border: "1px solid #D4924A66", color: "#D4924A", backgroundColor: "transparent" }}
              title="View the submitted brief in full"
            >
              <FileText size={13} />
              View Brief
              {briefVersionCount > 1 ? (
                <span
                  className="ml-1 rounded-sm px-1 text-[10px]"
                  style={{ backgroundColor: "#D4924A33" }}
                >
                  v{briefVersionCount}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={onEditBrief}
              className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-semibold transition-opacity hover:opacity-90"
              style={{ backgroundColor: "#D4924A", color: "#0A0A0A" }}
              title="Edit the brief and rerun Stage 1 — downstream stages will reset"
            >
              <PencilLine size={13} />
              Edit Brief
            </button>
          </>
        )}
        <span
          className="text-label inline-flex items-center rounded-sm px-2 py-0.5"
          style={{
            backgroundColor: "var(--color-primary-subtle)",
            color: "var(--color-primary)",
          }}
        >
          {status}
        </span>
        <span className="text-mono" style={{ color: "var(--color-text-tertiary)" }}>
          {elapsed}
        </span>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Left panel — pipeline tracker
// ────────────────────────────────────────────────────────────────────────────

function LeftPanel({
  stages,
  statuses,
  selectedId,
  onSelect,
  progressPct,
  currentMainNumber,
  totalMain,
  hasBrief,
}: {
  stages: Stage[];
  statuses: Record<string, StageStatus>;
  selectedId: string;
  onSelect: (id: string) => void;
  progressPct: number;
  currentMainNumber: number;
  totalMain: number;
  hasBrief: boolean;
}) {
  const briefSelected = selectedId === "BRIEF";
  return (
    <aside className="hidden w-[280px] shrink-0 overflow-y-auto border-r border-border bg-background py-6 md:block">
      <header className="px-5 pb-5">
        <span className="text-label text-primary">Strategy Process</span>
        <div
          className="mt-3 h-1 w-full overflow-hidden rounded-sm"
          style={{ backgroundColor: "var(--color-border)" }}
        >
          <div
            className="h-full rounded-sm transition-all duration-500"
            style={{
              width: `${progressPct}%`,
              backgroundColor: "var(--color-primary)",
            }}
          />
        </div>
        <p className="text-body-sm mt-2" style={{ color: "var(--color-text-tertiary)" }}>
          Stage {currentMainNumber} of 27
        </p>
      </header>

      {hasBrief && (
        <div
          style={{
            borderTop: "1px solid var(--color-surface-3)",
            borderBottom: "1px solid var(--color-surface-3)",
          }}
        >
          <button
            type="button"
            onClick={() => onSelect("BRIEF")}
            className="flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors"
            style={{
              backgroundColor: briefSelected ? tokens.bgTertiary : "transparent",
              borderLeft: `2px solid ${briefSelected ? tokens.amber : "transparent"}`,
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              if (!briefSelected) e.currentTarget.style.backgroundColor = tokens.bgSecondary;
            }}
            onMouseLeave={(e) => {
              if (!briefSelected) e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: tokens.amber, flexShrink: 0 }}
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="8" y1="13" x2="16" y2="13" />
              <line x1="8" y1="17" x2="16" y2="17" />
            </svg>
            <span
              className="shrink-0"
              style={{
                fontFamily: `'${tokens.fontMono}', monospace`,
                color: tokens.muted,
                minWidth: 28,
                fontSize: 12,
              }}
            >
              —
            </span>
            <span
              className="flex-1 truncate"
              style={{
                fontFamily: `'${tokens.fontBody}', sans-serif`,
                color: tokens.white,
                fontWeight: 400,
              }}
            >
              Brief
            </span>
            <span
              className="text-label shrink-0 rounded-sm px-1.5 py-0.5"
              style={{
                backgroundColor: "oklch(0.5 0.09 70 / 0.10)",
                color: "var(--color-warning)",
                fontSize: 9,
              }}
            >
              Source
            </span>
          </button>
        </div>
      )}

      <ul>
        {stages.map((s) => {
          const status = statuses[s.id];
          const selected = s.id === selectedId;
          const interactive =
            status === "complete" || status === "running" || status === "checkpoint";
          return (
            <li key={s.id} style={{ borderTop: "1px solid var(--color-surface-3)" }}>
              <button
                type="button"
                disabled={!interactive}
                onClick={() => onSelect(s.id)}
                className="flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors"
                style={{
                  backgroundColor: selected ? tokens.bgTertiary : "transparent",
                  borderLeft: `2px solid ${selected ? tokens.amber : "transparent"}`,
                  cursor: interactive ? "pointer" : "default",
                }}
                onMouseEnter={(e) => {
                  if (interactive && !selected)
                    e.currentTarget.style.backgroundColor = tokens.bgSecondary;
                }}
                onMouseLeave={(e) => {
                  if (!selected) e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <StageIndicator
                  status={s.conditional && status === "pending" ? "pending" : status}
                  conditional={s.conditional}
                  checkpoint={s.checkpoint}
                />
                <span
                  className="shrink-0"
                  style={{
                    fontFamily: `'${tokens.fontMono}', monospace`,
                    color: tokens.muted,
                    minWidth: 28,
                    fontSize: 12,
                  }}
                >
                  {s.number}
                </span>
                <span
                  className="flex-1 truncate"
                  style={{
                    fontFamily: `'${tokens.fontBody}', sans-serif`,
                    color: tokens.white,
                    fontWeight: 400,
                  }}
                >
                  {s.name}
                </span>
                <StageRowStatusLabel
                  checkpoint={!!s.checkpoint}
                  conditional={!!s.conditional}
                  status={status}
                  selected={selected}
                />
                {s.conditional && status === "pending" && (
                  <span
                    className="text-label shrink-0"
                    style={{
                      color: tokens.muted,
                      fontSize: 10,
                    }}
                  >
                    Skipped
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

function StageRowStatusLabel({
  checkpoint,
  conditional,
  status,
  selected,
}: {
  checkpoint: boolean;
  conditional: boolean;
  status: StageStatus;
  selected: boolean;
}) {
  if (conditional && status === "pending") return null;

  // Checkpoint stages (1, 8, 12): special handling
  if (checkpoint && status === "checkpoint") {
    return (
      <span
        className="text-label shrink-0 rounded-sm px-1.5 py-0.5"
        style={{
          backgroundColor: "oklch(0.5 0.09 70 / 0.10)",
          color: "var(--color-warning)",
          fontSize: 9,
        }}
      >
        Review
      </span>
    );
  }
  if (checkpoint && status === "complete") {
    return (
      <span className="text-label shrink-0" style={{ color: "var(--color-success)", fontSize: 10 }}>
        Confirmed
      </span>
    );
  }

  if (status === "running") {
    return (
      <span className="text-label shrink-0" style={{ color: "var(--color-primary)", fontSize: 10 }}>
        Running…
      </span>
    );
  }
  if (status === "complete") {
    return (
      <span className="text-label shrink-0" style={{ color: "var(--color-success)", fontSize: 10 }}>
        Done
      </span>
    );
  }
  if (status === "error") {
    return (
      <span
        className="text-label shrink-0"
        style={{ color: "var(--color-destructive)", fontSize: 10 }}
      >
        Error
      </span>
    );
  }
  if (selected && status === "pending") {
    return (
      <span
        className="text-label shrink-0"
        style={{ color: "var(--color-text-tertiary)", fontSize: 10 }}
      >
        Viewing
      </span>
    );
  }
  return null;
}

function stageNameStyle(
  status: StageStatus,
  selected: boolean,
  conditional?: boolean,
): React.CSSProperties {
  if (conditional) return { color: "var(--color-text-tertiary)" };
  if (selected) return { color: "var(--color-text-primary)", fontWeight: 600 };
  switch (status) {
    case "running":
      return { color: "var(--color-text-primary)", fontWeight: 500 };
    case "complete":
      return { color: "var(--color-text-secondary)" };
    case "checkpoint":
      return { color: "var(--color-text-primary)", fontWeight: 500 };
    case "error":
      return { color: "var(--color-destructive)" };
    default:
      return { color: "var(--color-text-tertiary)" };
  }
}

function StageIndicator({
  status,
  checkpoint,
}: {
  status: StageStatus;
  conditional?: boolean;
  checkpoint?: boolean;
}) {
  const base: React.CSSProperties = {
    width: 24,
    height: 24,
    borderRadius: "50%",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  };

  if (status === "complete") {
    return (
      <span style={{ ...base, backgroundColor: "var(--color-primary)" }}>
        <CheckIcon color="var(--color-background)" />
      </span>
    );
  }
  if (status === "running") {
    return (
      <span
        className="animate-pulse"
        style={{
          ...base,
          border: "1px solid var(--color-primary)",
          backgroundColor: "var(--color-primary-subtle)",
        }}
      />
    );
  }
  if (status === "checkpoint" || (checkpoint && status !== "pending")) {
    return (
      <span
        style={{
          ...base,
          border: "1px solid var(--color-warning)",
          backgroundColor: "oklch(0.5 0.09 70 / 0.10)",
        }}
      >
        <PauseIcon color="var(--color-warning)" />
      </span>
    );
  }
  if (status === "error") {
    return (
      <span style={{ ...base, backgroundColor: "var(--color-destructive)" }}>
        <XIcon color="var(--color-destructive-foreground)" />
      </span>
    );
  }
  // pending
  return (
    <span
      style={{
        ...base,
        border: "1px solid var(--color-border)",
        backgroundColor: "transparent",
      }}
    />
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Right panel — output display
// ────────────────────────────────────────────────────────────────────────────

function RightPanel({
  stage,
  status,
  fullOutput,
  isViewingHistorical,
  onBackToCurrent,
  stage1Error,
  tensionScore,
  stage1bRequired,
  amendmentNote,
  onAmendmentChange,
  onRetry,
  showRationale,
  showBrandIntel,
  showStage1bResubmit,
  resubmitting,
  onResubmitBrief,
  onSubmitBrandIntel,
  prevStage,
  nextStage,
  nextStageStatus,
  pipelineComplete,
  onContinue,
  onBack,
  onViewFinal,
  onConfirmCheckpoint,
  onResubmitCheckpoint,
  onEscalateCheckpoint,
  checkpointResubmitting,
  customCheckpoint,
  retryStatus,
  stage8KeepNames,
  onToggleStage8Keep,
  onManualStage8Submit,
  onCheckpointNotesChange,
  contentScrollRef,
}: {
  stage: Stage;
  status: StageStatus;
  fullOutput: string;
  contentScrollRef: RefObject<HTMLDivElement | null>;
  isViewingHistorical?: boolean;
  onBackToCurrent?: () => void;
  stage1Error: string | null;
  tensionScore: number | null;
  stage1bRequired: boolean;
  amendmentNote: string;
  onAmendmentChange: (value: string) => void;
  onRetry: () => void;
  showRationale: boolean;
  showBrandIntel: boolean;
  showStage1bResubmit: boolean;
  resubmitting: boolean;
  onResubmitBrief: (additionalBrief: string) => void | Promise<void>;
  onSubmitBrandIntel: (values: Record<string, string>) => void | Promise<void>;
  onResubmitCheckpoint?: (stageId: string, feedback: string) => void | Promise<void>;
  onEscalateCheckpoint?: (stageId: string, reason: string) => void | Promise<void>;
  checkpointResubmitting?: boolean;
  prevStage: Stage | null;
  nextStage: Stage | null;
  nextStageStatus: StageStatus | null;
  pipelineComplete: boolean;
  onContinue: () => void;
  onBack: () => void;
  onViewFinal: () => void;
  onConfirmCheckpoint: (stageId: string, notes?: string[]) => void;
  customCheckpoint?: ReactNode;
  retryStatus?: string | null;
  stage8KeepNames: Set<string>;
  onToggleStage8Keep: (name: string, keep: boolean) => void;
  onManualStage8Submit?: (line: string, label: string) => void | Promise<void>;
  onCheckpointNotesChange?: (notes: string[]) => void;
}) {
  const isRunning = status === "running";
  const isCheckpoint = status === "checkpoint";
  const isError = status === "error";
  const text = useStreamingText(fullOutput, isRunning);
  const letter = CHECKPOINT_LETTERS[stage.id];

  return (
    <section className="relative flex min-w-0 flex-1 flex-col bg-background">
      {isViewingHistorical && (
        <div
          className="flex items-center justify-between border-b px-6 py-2.5 sm:px-12"
          style={{
            backgroundColor: "var(--color-surface-2)",
            borderColor: "var(--color-border)",
          }}
        >
          <span className="text-body-sm" style={{ color: "var(--color-text-tertiary)" }}>
            Viewing completed stage:{" "}
            <span style={{ color: "var(--color-text-secondary)" }}>
              {stage.number} — {stage.name}
            </span>
          </span>
          <button
            type="button"
            onClick={onBackToCurrent}
            className="text-body-sm font-medium transition-colors"
            style={{ color: "var(--color-primary)" }}
          >
            Back to current stage →
          </button>
        </div>
      )}
      <div ref={contentScrollRef} className="flex-1 overflow-y-auto px-6 py-10 sm:px-12 sm:py-10">
        {isError &&
        [
          "01",
          "02",
          "03",
          "04",
          "04B",
          "05",
          "06",
          "07",
          "08",
          "09",
          "10",
          "11",
          "12",
          "13",
          "13B",
          "14",
          "14B",
          "14C",
          "15",
          "16",
        ].includes(stage.id) ? (
          <ErrorStateCard
            stage={stage}
            errorMessage={stage1Error}
            onRetry={onRetry}
            onBack={prevStage ? onBack : undefined}
            prevStageNumber={prevStage?.number}
          />
        ) : showStage1bResubmit ? (
          <Stage1bResubmitView
            output={fullOutput}
            resubmitting={resubmitting}
            onResubmit={onResubmitBrief}
          />
        ) : showRationale ? (
          <div style={{ paddingBottom: 80 }}>
            <SelectionRationale onConfirm={() => onConfirmCheckpoint(stage.id)} />
          </div>
        ) : showBrandIntel ? (
          <div style={{ paddingBottom: 80 }}>
            <BrandIntelligence onSubmit={onSubmitBrandIntel} />
          </div>
        ) : customCheckpoint ? (
          <div style={{ paddingBottom: 80 }}>{customCheckpoint}</div>
        ) : isCheckpoint && letter ? (
          <div style={{ paddingBottom: 80 }}>
            <Checkpoint
              letter={letter}
              confirmLabel={stage.id === "08" ? "Move selected propositions to Stage 9 →" : undefined}
              showLowScoreAlert={letter === "A" && stage1bRequired}
              onConfirm={(notes) => onConfirmCheckpoint(stage.id, notes)}
              onResubmit={
                onResubmitCheckpoint ? (fb) => onResubmitCheckpoint(stage.id, fb) : undefined
              }
              onEscalate={
                onEscalateCheckpoint ? (r) => onEscalateCheckpoint(stage.id, r) : undefined
              }
              resubmitting={checkpointResubmitting}
              onNotesChange={onCheckpointNotesChange}
              reviewContent={
                <>
                  {letter === "A" && tensionScore !== null && (
                    <p
                      className="text-body-sm mb-3"
                      style={{ color: "var(--color-text-tertiary)" }}
                    >
                      Strategic Tension Score:{" "}
                      <strong
                        style={{
                          color:
                            tensionScore >= 7 ? "var(--color-success)" : "var(--color-warning)",
                        }}
                      >
                        {tensionScore}/10
                      </strong>
                    </p>
                  )}
                  {stage.id === "08" ? (
                    <Stage8PropositionsView
                      text={fullOutput}
                      streaming={false}
                      keepNames={stage8KeepNames}
                      onToggle={onToggleStage8Keep}
                      onManualSubmit={onManualStage8Submit}
                    />
                  ) : (
                    <StreamedOutput text={fullOutput} streaming={false} />
                  )}
                </>
              }
            />
          </div>
        ) : (
          <>
            <header>
              <span className="text-label text-primary">
                Stage {stage.number} — {stage.name}
              </span>
              <h1 className="text-h2 mt-3 text-text-primary">{stage.name}</h1>
              <StatusLine status={status} />
              {isRunning && retryStatus ? (
                <p className="text-body-sm mt-2" style={{ color: "#8A8680" }}>
                  {retryStatus}
                </p>
              ) : null}
              <hr className="my-6 h-px border-0 bg-border" />
            </header>

            <article style={{ paddingBottom: 80 }}>
              {isRunning && !text ? <ProgressMessages stageName={stage.name} /> : null}
              {stage.id === "08" && !isRunning && text ? (
                <Stage8PropositionsView
                  text={text}
                  streaming={isRunning}
                  keepNames={stage8KeepNames}
                  onToggle={onToggleStage8Keep}
                  onManualSubmit={onManualStage8Submit}
                />
              ) : (
                <StreamedOutput text={text} streaming={isRunning} />
              )}
              {isRunning ? <StallWatcher stageKey={stage.id} onRetry={onRetry} /> : null}
            </article>
          </>
        )}
      </div>

      <StageControlBar
        stage={stage}
        status={status}
        amendmentNote={amendmentNote}
        onAmendmentChange={onAmendmentChange}
        onRetry={onRetry}
      />

      <BottomBar
        stage={stage}
        status={status}
        prevStage={prevStage}
        nextStage={nextStage}
        nextStageStatus={nextStageStatus}
        isViewingHistorical={!!isViewingHistorical}
        pipelineComplete={pipelineComplete}
        onContinue={onContinue}
        onBack={onBack}
        onRetry={onRetry}
        onReturnToCurrent={onBackToCurrent ?? (() => {})}
        onViewFinal={onViewFinal}
      />
    </section>
  );
}

function StatusLine({ status }: { status: StageStatus }) {
  if (status === "running") {
    return (
      <p className="text-body-sm mt-3 flex items-center gap-2 text-text-secondary">
        <span
          className="inline-block rounded-full bg-primary"
          style={{
            width: 6,
            height: 6,
            animation: "bg-pulse 1.2s ease-in-out infinite",
          }}
        />
        Running — generating output…
        <style>{`
          @keyframes bg-pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
          }
        `}</style>
      </p>
    );
  }
  if (status === "complete") {
    return (
      <p className="text-body-sm mt-3 flex items-center gap-2 text-text-secondary">
        <span
          className="inline-flex h-4 w-4 items-center justify-center rounded-full"
          style={{ backgroundColor: "var(--color-success)" }}
        >
          <CheckIcon color="var(--color-background)" />
        </span>
        Complete
      </p>
    );
  }
  if (status === "checkpoint") {
    return (
      <p className="text-body-sm mt-3 flex items-center gap-2 text-text-secondary">
        <span
          className="inline-flex h-4 w-4 items-center justify-center rounded-full"
          style={{
            border: "1px solid var(--color-warning)",
            backgroundColor: "oklch(0.5 0.09 70 / 0.10)",
          }}
        />
        Awaiting review
      </p>
    );
  }
  if (status === "error") {
    return (
      <p className="text-body-sm mt-3" style={{ color: "var(--color-destructive)" }}>
        Stage held — see errors below
      </p>
    );
  }
  return (
    <p className="text-body-sm mt-3" style={{ color: "var(--color-text-tertiary)" }}>
      Pending — not yet started
    </p>
  );
}

// Simple typewriter — reveals N chars/tick while streaming, full text otherwise.
function useStreamingText(full: string, streaming: boolean) {
  const [shown, setShown] = useState(streaming ? "" : full);
  const fullRef = useRef(full);
  fullRef.current = full;

  useEffect(() => {
    if (!streaming) {
      setShown(fullRef.current);
      return;
    }
    setShown("");
    let i = 0;
    const id = window.setInterval(() => {
      const len = fullRef.current.length;
      if (i < len) {
        i = Math.min(i + 6, len);
        setShown(fullRef.current.slice(0, i));
      }
    }, 24);
    return () => window.clearInterval(id);
    // Intentionally only depend on `streaming`. `full` is read via ref to
    // avoid resetting the typewriter on every delta (causes a visible loop).
  }, [streaming]);

  // Flush full text whenever it changes while not streaming (e.g. hydrate).
  useEffect(() => {
    if (!streaming) setShown(full);
  }, [full, streaming]);

  return shown;
}

// Render a minimal subset of markdown-like blocks per the spec.
function StreamedOutput({ text, streaming }: { text: string; streaming: boolean }) {
  const blocks = parseBlocks(text);
  const tailRef = useRef<HTMLDivElement | null>(null);
  // Auto-scroll: when streaming, keep the latest line visible.
  useEffect(() => {
    if (!streaming) return;
    tailRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [text, streaming]);

  return (
    <div style={{ color: "#8A8680", lineHeight: 1.8 }}>
      {blocks.map((b, i) => {
        const isLast = i === blocks.length - 1;
        const cursor = streaming && isLast ? <Caret /> : null;
        switch (b.kind) {
          case "h1":
            return (
              <h2
                key={i}
                className="text-h2"
                style={{ color: "#F0EDE8", fontWeight: 600, marginTop: 32, marginBottom: 12 }}
              >
                <Inline text={b.text} />
                {cursor}
              </h2>
            );
          case "h2":
            return (
              <h2
                key={i}
                className="text-h2"
                style={{ color: "#F0EDE8", fontWeight: 600, marginTop: 32, marginBottom: 12 }}
              >
                <Inline text={b.text} />
                {cursor}
              </h2>
            );
          case "h3":
            return (
              <h3
                key={i}
                className="text-h3"
                style={{ color: "#F0EDE8", fontWeight: 600, marginTop: 24, marginBottom: 8 }}
              >
                <Inline text={b.text} />
                {cursor}
              </h3>
            );
          case "subhead":
            return (
              <p
                key={i}
                className="text-body"
                style={{
                  color: "#F0EDE8",
                  fontWeight: 600,
                  marginTop: 16,
                  marginBottom: 6,
                }}
              >
                <Inline text={b.text} />
                {cursor}
              </p>
            );
          case "label":
            return (
              <p
                key={i}
                className="text-label"
                style={{
                  color: "#D4924A",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  marginTop: 24,
                  marginBottom: 8,
                }}
              >
                <Inline text={b.text} />
                {cursor}
              </p>
            );
          case "hr":
            return (
              <hr
                key={i}
                style={{
                  border: 0,
                  borderTop: "1px solid #2A2A2A",
                  margin: "24px 0",
                }}
              />
            );
          case "callout":
            return (
              <p
                key={i}
                className="text-body"
                style={{
                  borderLeft: "3px solid #D4924A",
                  paddingLeft: 16,
                  color: "#8A8680",
                  fontStyle: "italic",
                  margin: "12px 0",
                }}
              >
                <Inline text={b.text} />
                {cursor}
              </p>
            );
          case "bullets":
            return (
              <ul key={i} style={{ paddingLeft: 20, margin: "8px 0", listStyle: "none" }}>
                {b.items.map((item, j) => (
                  <li
                    key={j}
                    className="text-body"
                    style={{
                      position: "relative",
                      margin: "4px 0",
                      color: "#8A8680",
                      lineHeight: 1.8,
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        position: "absolute",
                        left: -16,
                        top: "0.7em",
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        backgroundColor: "#D4924A",
                      }}
                    />
                    <Inline text={item} />
                    {j === b.items.length - 1 ? cursor : null}
                  </li>
                ))}
              </ul>
            );
          case "para":
          default:
            return (
              <p
                key={i}
                className="text-body"
                style={{ color: "#8A8680", lineHeight: 1.8, marginBottom: 12 }}
              >
                <Inline text={b.text} />
                {cursor}
              </p>
            );
        }
      })}
      <div ref={tailRef} aria-hidden="true" />
    </div>
  );
}

// Inline parser: **bold** / __bold__ + *em* segments
function Inline({ text }: { text: string }) {
  const parts: Array<{ kind: "t" | "b" | "i"; v: string }> = [];
  const re = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ kind: "t", v: text.slice(last, m.index) });
    const tok = m[0];
    if (tok.startsWith("**")) parts.push({ kind: "b", v: tok.slice(2, -2) });
    else if (tok.startsWith("__")) parts.push({ kind: "b", v: tok.slice(2, -2) });
    else parts.push({ kind: "i", v: tok.slice(1, -1) });
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push({ kind: "t", v: text.slice(last) });
  return (
    <>
      {parts.map((p, i) =>
        p.kind === "b" ? (
          <strong key={i} style={{ color: "#F0EDE8", fontWeight: 600 }}>
            {p.v}
          </strong>
        ) : p.kind === "i" ? (
          <em key={i}>{p.v}</em>
        ) : (
          <span key={i}>{p.v}</span>
        ),
      )}
    </>
  );
}

type Block =
  | { kind: "h1"; text: string }
  | { kind: "h2"; text: string }
  | { kind: "h3"; text: string }
  | { kind: "subhead"; text: string }
  | { kind: "label"; text: string }
  | { kind: "para"; text: string }
  | { kind: "callout"; text: string }
  | { kind: "hr" }
  | { kind: "bullets"; items: string[] };

function parseBlocks(text: string): Block[] {
  const lines = text.split("\n");
  const blocks: Block[] = [];
  let bulletBuf: string[] = [];
  const flush = () => {
    if (bulletBuf.length) {
      blocks.push({ kind: "bullets", items: [...bulletBuf] });
      bulletBuf = [];
    }
  };
  // ALL CAPS LABEL followed by colon, optionally inside ** **
  const labelRe = /^(?:\*\*)?([A-Z0-9][A-Z0-9 \-—&/]{2,}):(?:\*\*)?\s*$/;
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flush();
      continue;
    }
    if (line.startsWith("- ") || line.startsWith("* ")) {
      bulletBuf.push(line.slice(2));
      continue;
    }
    flush();
    if (/^---+\s*$/.test(line) || /^\*\*\*+\s*$/.test(line)) {
      blocks.push({ kind: "hr" });
    } else if (line.startsWith("#### ")) {
      blocks.push({ kind: "subhead", text: line.slice(5) });
    } else if (line.startsWith("### ")) {
      blocks.push({ kind: "h3", text: line.slice(4) });
    } else if (line.startsWith("## ")) {
      blocks.push({ kind: "h2", text: line.slice(3) });
    } else if (line.startsWith("# ")) {
      blocks.push({ kind: "h1", text: line.slice(2) });
    } else if (line.startsWith("> ")) {
      blocks.push({ kind: "callout", text: line.slice(2) });
    } else if (labelRe.test(line)) {
      const m = line.match(labelRe);
      blocks.push({ kind: "label", text: m ? m[1] : line });
    } else {
      blocks.push({ kind: "para", text: line });
    }
  }
  flush();
  return blocks;
}

// Split a Stage 8 markdown output into per-proposition blocks, keyed by
// territory name (the text following `## `). Used to render checkboxes
// per-proposition so the user can pick which ones to regenerate on Retry.
export function splitStage8Propositions(text: string): Array<{ name: string; markdown: string }> {
  if (!text || !text.trim()) return [];

  const cleanName = (raw: string): string =>
    raw
      .replace(/^\*+|\*+$/g, "")
      .replace(/^FIELD\s*\d+\s*[—\-:]\s*/i, "")
      .replace(/^(?:PROPOSITION|TERRITORY)\s*\d+\s*[—\-:]?\s*/i, "")
      .trim();

  // A "header" line opens a new proposition block. Accept any of:
  //   - markdown headings (#, ##, ###, ####)
  //   - bold-only label lines like "**Proposition 1 — Name**" / "**Territory 2: …**"
  const isHeader = (raw: string): { name: string } | null => {
    const h = raw.match(/^\s*#{1,4}\s+(.+?)\s*$/);
    if (h) {
      const name = cleanName(h[1]);
      if (name) return { name };
    }
    const b = raw.match(/^\s*\*\*\s*((?:PROPOSITION|TERRITORY|FIELD)\s*\d+[^*]*)\*\*\s*$/i);
    if (b) {
      const name = cleanName(b[1]);
      if (name) return { name };
    }
    return null;
  };

  const lines = text.split("\n");
  const blocks: Array<{ name: string; markdown: string[] }> = [];
  let current: { name: string; markdown: string[] } | null = null;
  for (const raw of lines) {
    const header = isHeader(raw);
    if (header) {
      if (current) blocks.push(current);
      current = { name: header.name, markdown: [raw] };
    } else if (current) {
      current.markdown.push(raw);
    }
  }
  if (current) blocks.push(current);

  // Fallback 1: split on horizontal-rule dividers (---, ***, ___).
  if (blocks.length <= 1) {
    const parts = text
      .split(/\n\s*(?:[-*_]\s*){3,}\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    if (parts.length > 1) {
      return parts.map((md, i) => {
        const firstLine = md.split("\n").find((l) => l.trim()) ?? "";
        const name =
          cleanName(firstLine.replace(/^#+\s*/, "").replace(/^>\s*/, "")) ||
          `Proposition ${i + 1}`;
        return { name, markdown: md };
      });
    }
  }

  // Fallback 2: split on blockquote proposition anchors like `> **...**`.
  if (blocks.length <= 1) {
    const anchorRe = /^\s*>\s*\*\*[^*\n]+\*\*\s*$/gm;
    const starts: number[] = [];
    let m: RegExpExecArray | null;
    while ((m = anchorRe.exec(text)) !== null) starts.push(m.index);
    if (starts.length > 1) {
      const parts: Array<{ name: string; markdown: string }> = [];
      for (let i = 0; i < starts.length; i++) {
        const end = i + 1 < starts.length ? starts[i + 1] : text.length;
        const slice = text.slice(starts[i], end).trim();
        const nameMatch = slice.match(/>\s*\*\*([^*\n]+)\*\*/);
        const name =
          (nameMatch ? cleanName(nameMatch[1]) : "") || `Proposition ${i + 1}`;
        parts.push({ name, markdown: slice });
      }
      return parts;
    }
  }

  return blocks.map((b) => ({
    name: b.name,
    markdown: b.markdown.join("\n").replace(/\s+$/g, ""),
  }));
}

// Renders Stage 8 output as a list of proposition cards with a checkbox
// per card. Checked = keep on next Retry. Unchecked = regenerate on next Retry.
function Stage8PropositionsView({
  text,
  streaming,
  keepNames,
  onToggle,
  onManualSubmit,
}: {
  text: string;
  streaming: boolean;
  keepNames: Set<string>;
  onToggle: (name: string, keep: boolean) => void;
  onManualSubmit?: (line: string, label: string) => void | Promise<void>;
}) {
  const blocks = splitStage8Propositions(text);
  const [manualLine, setManualLine] = useState("");
  const [manualLabel, setManualLabel] = useState("");
  const [manualSubmitting, setManualSubmitting] = useState(false);

  const handleManualSubmit = async () => {
    const line = manualLine.trim();
    if (!line || !onManualSubmit || manualSubmitting) return;
    setManualSubmitting(true);
    try {
      await onManualSubmit(line, manualLabel.trim());
    } finally {
      setManualSubmitting(false);
    }
  };

  const ManualPanel = onManualSubmit ? (
    <div
      style={{
        marginTop: 32,
        padding: 20,
        border: "1px solid #2A2A2A",
        borderRadius: 8,
        backgroundColor: "#141414",
      }}
    >
      <p className="text-label" style={{ color: "#8A8680", marginBottom: 8 }}>
        MANUAL SELECTION — OVERRIDE
      </p>
      <p className="text-body-sm" style={{ color: "#8A8680", marginBottom: 12 }}>
        Type or paste any proposition line to use as the selected SMP. This bypasses card
        selection and advances directly to Stage 9.
      </p>
      <textarea
        value={manualLine}
        onChange={(e) => setManualLine(e.target.value)}
        placeholder="Paste proposition line here…"
        rows={2}
        disabled={streaming || manualSubmitting}
        style={{
          width: "100%",
          padding: 10,
          borderRadius: 8,
          border: "1px solid #2A2A2A",
          background: "#0A0A0A",
          color: "#E8E4DE",
          fontFamily: "inherit",
          fontSize: 14,
          lineHeight: 1.5,
        }}
      />
      <input
        type="text"
        value={manualLabel}
        onChange={(e) => setManualLabel(e.target.value)}
        placeholder="Optional: short label / territory name"
        disabled={streaming || manualSubmitting}
        style={{
          marginTop: 8,
          width: "100%",
          padding: 10,
          borderRadius: 8,
          border: "1px solid #2A2A2A",
          background: "#0A0A0A",
          color: "#E8E4DE",
          fontSize: 14,
        }}
      />
      <button
        type="button"
        disabled={!manualLine.trim() || streaming || manualSubmitting}
        onClick={handleManualSubmit}
        className="mt-3 inline-flex h-10 items-center justify-center rounded-md px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
        style={{ backgroundColor: "#D4924A", color: "#0A0A0A" }}
      >
        {manualSubmitting ? "Submitting…" : "Use manual proposition →"}
      </button>
    </div>
  ) : null;

  // While streaming with no complete blocks yet, fall back to the live stream.
  if (blocks.length === 0) {
    return (
      <div>
        <StreamedOutput text={text} streaming={streaming} />
        {ManualPanel}
      </div>
    );
  }
  return (
    <div>
      <p className="text-body-sm" style={{ color: "#8A8680", marginBottom: 16 }}>
        Uncheck any proposition to exclude it from Stage 9 and all downstream stages. Only
        checked propositions advance past Checkpoint B. Use Retry this stage to regenerate
        unchecked propositions instead of excluding them.
      </p>
      {blocks.map((b, i) => {
        const checked = keepNames.has(b.name);
        const inputId = `stage8-keep-${i}`;
        return (
          <div
            key={`${b.name}-${i}`}
            style={{
              display: "flex",
              gap: 16,
              alignItems: "flex-start",
              borderTop: i === 0 ? "none" : "1px solid #2A2A2A",
              paddingTop: i === 0 ? 0 : 24,
              marginTop: i === 0 ? 0 : 8,
            }}
          >
            <label
              htmlFor={inputId}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginTop: 36,
                cursor: streaming ? "not-allowed" : "pointer",
                opacity: streaming ? 0.5 : 1,
              }}
            >
              <input
                id={inputId}
                type="checkbox"
                checked={checked}
                disabled={streaming}
                onChange={(e) => onToggle(b.name, e.target.checked)}
                style={{
                  width: 18,
                  height: 18,
                  accentColor: "#D4924A",
                  cursor: streaming ? "not-allowed" : "pointer",
                }}
                aria-label={`Keep "${b.name}" on next retry`}
              />
            </label>
            <div style={{ flex: 1, minWidth: 0 }}>
              <StreamedOutput text={b.markdown} streaming={false} />
            </div>
          </div>
        );
      })}
      {ManualPanel}
    </div>
  );
}

// Styled API-error card per spec.
export function ErrorCard({
  stageNumber,
  message,
  onRetry,
}: {
  stageNumber: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="animate-fade-in"
      style={{
        backgroundColor: "#7C3A3A12",
        border: "1px solid #7C3A3A",
        borderRadius: 8,
        padding: 24,
        marginTop: 16,
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 3L22 20H2L12 3Z"
            stroke="#7C3A3A"
            strokeWidth="1.75"
            strokeLinejoin="round"
          />
          <path d="M12 10v5" stroke="#7C3A3A" strokeWidth="1.75" strokeLinecap="round" />
          <circle cx="12" cy="17.5" r="0.9" fill="#7C3A3A" />
        </svg>
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 600, color: "#F0EDE8", fontSize: 14 }}>
            Stage {stageNumber} encountered an error
          </p>
          <p className="text-body-sm" style={{ color: "#8A8680", marginTop: 6 }}>
            {message}
          </p>
          <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
            <button
              type="button"
              onClick={onRetry}
              style={{
                height: 36,
                padding: "0 16px",
                borderRadius: 6,
                border: "none",
                backgroundColor: "#D4924A",
                color: "var(--color-background)",
                fontSize: 13,
                fontWeight: 600,
                cursor: onRetry ? "pointer" : "not-allowed",
              }}
            >
              Retry this stage
            </button>
            <a
              href="mailto:support@brandgrenade.com"
              style={{
                height: 36,
                padding: "0 16px",
                borderRadius: 6,
                border: "1px solid #2A2A2A",
                color: "#F0EDE8",
                fontSize: 13,
                fontWeight: 500,
                display: "inline-flex",
                alignItems: "center",
                textDecoration: "none",
              }}
            >
              Contact support
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// Subtle inter-stage handoff message.
export function NextStageHint({ name }: { name: string }) {
  return (
    <p
      className="text-body-sm animate-fade-in"
      style={{
        color: "#5A5652",
        textAlign: "center",
        padding: "16px 0 8px",
      }}
    >
      Next: {name} beginning…
    </p>
  );
}

function Caret() {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: 2,
        height: "1.05em",
        marginLeft: 2,
        verticalAlign: "text-bottom",
        backgroundColor: "var(--color-primary)",
        animation: "bg-blink 1s steps(2) infinite",
      }}
    >
      <style>{`@keyframes bg-blink { 50% { opacity: 0; } }`}</style>
    </span>
  );
}

function BottomBar({
  stage,
  status,
  prevStage,
  nextStage,
  isViewingHistorical,
  pipelineComplete,
  onContinue,
  onBack,
  onRetry,
  onReturnToCurrent,
  onViewFinal,
}: {
  stage: Stage;
  status: StageStatus;
  prevStage: Stage | null;
  nextStage: Stage | null;
  nextStageStatus: StageStatus | null;
  isViewingHistorical: boolean;
  pipelineComplete: boolean;
  onContinue: () => void;
  onBack: () => void;
  onRetry: () => void;
  onReturnToCurrent: () => void;
  onViewFinal: () => void;
}) {
  const continueLabel = pipelineComplete
    ? "Begin Phase 2 →"
    : nextStage
      ? `Continue to Stage ${nextStage.number} →`
      : "Continue →";
  const continueDisabled = status === "running" || (!pipelineComplete && !nextStage);

  return (
    <div
      className="flex h-[60px] shrink-0 items-center justify-between gap-4 border-t bg-background"
      style={{
        borderColor: "#2A2A2A",
        backgroundColor: "#0A0A0A",
        padding: "0 48px",
      }}
    >
      <button
        type="button"
        onClick={isViewingHistorical ? onReturnToCurrent : onBack}
        disabled={!isViewingHistorical && !prevStage}
        className="inline-flex h-10 items-center rounded-md px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        style={{
          border: "1px solid var(--color-border)",
          color: "var(--color-text-primary)",
          backgroundColor: "transparent",
        }}
      >
        {isViewingHistorical ? "Return to current stage" : prevStage ? `← Go Back to Stage ${prevStage.number}` : "← Go Back"}
      </button>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex h-10 items-center rounded-md px-4 text-sm font-semibold transition-colors"
          style={{
            border: "1px solid var(--color-primary)",
            color: "var(--color-primary)",
            backgroundColor: "transparent",
          }}
        >
          ↺ Retry This Stage
        </button>
        <button
          type="button"
          onClick={pipelineComplete ? onViewFinal : onContinue}
          disabled={continueDisabled}
          className="inline-flex h-10 items-center rounded-md px-5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            border: "none",
            backgroundColor: "var(--color-success)",
            color: "var(--color-background)",
          }}
        >
          {continueLabel}
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Stage control bar — persistent status + retry, always visible
// ────────────────────────────────────────────────────────────────────────────

function StageControlBar({
  stage,
  status,
  amendmentNote,
  onAmendmentChange,
  onRetry,
}: {
  stage: Stage;
  status: StageStatus;
  amendmentNote: string;
  onAmendmentChange: (value: string) => void;
  onRetry: () => void;
}) {
  let leftEl: ReactNode;
  if (status === "running") {
    leftEl = (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#5A5652" }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            backgroundColor: "#D4924A",
            animation: "bg-pulse 1.2s ease-in-out infinite",
          }}
        />
        Generating {stage.name}…
      </span>
    );
  } else if (status === "complete") {
    leftEl = <span style={{ color: "#4A7C59" }}>✓ {stage.name} complete</span>;
  } else if (status === "error") {
    leftEl = <span style={{ color: "#8A6A2A" }}>⚠ Stage stalled</span>;
  } else if (status === "checkpoint") {
    leftEl = <span style={{ color: "#5A5652" }}>● Awaiting review</span>;
  } else {
    leftEl = <span style={{ color: "#5A5652" }}>Stage {stage.number} — pending</span>;
  }

  return (
    <div
      className="grid shrink-0 grid-cols-[minmax(160px,240px)_1fr] items-center gap-4 border-t"
      style={{
        minHeight: 58,
        padding: "0 48px",
        backgroundColor: "#0A0A0A",
        borderColor: "#1C1C1C",
      }}
    >
      <div className="text-body-sm">{leftEl}</div>
      <input
        type="text"
        value={amendmentNote}
        onChange={(e) => onAmendmentChange(e.target.value.slice(0, 2000))}
        placeholder="Optional amendment notes for Retry This Stage"
        className="input-base h-9 w-full"
        aria-label="Amendment notes for retry"
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Stall watcher — warns after a pause, but never auto-retries without a user click.
// ────────────────────────────────────────────────────────────────────────────

function StallWatcher({ stageKey, onRetry }: { stageKey: string; onRetry: () => void }) {
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    setShowWarning(false);
    const warnTimer = window.setTimeout(() => setShowWarning(true), 45_000);
    return () => {
      window.clearTimeout(warnTimer);
    };
  }, [stageKey]);

  if (!showWarning) return null;

  return (
    <div
      role="status"
      style={{
        marginTop: 16,
        padding: "12px 16px",
        borderRadius: 8,
        border: "1px solid #8A6A2A",
        backgroundColor: "rgba(138, 106, 42, 0.07)",
      }}
    >
      <p className="text-body-sm" style={{ color: "#8A6A2A" }}>
        Generation has paused. This sometimes happens with longer outputs.
      </p>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button
          type="button"
          onClick={() => setShowWarning(false)}
          style={{
            height: 32,
            padding: "0 14px",
            borderRadius: 6,
            background: "transparent",
            border: "1px solid #2A2A2A",
            color: "#8A8680",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Wait
        </button>
        <button
          type="button"
          onClick={onRetry}
          style={{
            height: 32,
            padding: "0 14px",
            borderRadius: 6,
            background: "#D4924A",
            border: "none",
            color: "var(--color-background)",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Retry this stage
        </button>
      </div>
    </div>
  );
}

function ProgressMessages({ stageName }: { stageName: string }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t1 = window.setTimeout(() => setTick(1), 3_000);
    const t2 = window.setTimeout(() => setTick(2), 8_000);
    const t3 = window.setTimeout(() => setTick(3), 15_000);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, []);
  if (tick === 0) return null;
  const msg =
    tick === 1
      ? "Analysing brief…"
      : tick === 2
        ? `Building ${stageName}…`
        : "This stage takes a little longer for complex briefs…";
  const color = tick === 3 ? "#5A5652" : "#8A8680";
  return (
    <div style={{ padding: "32px 0", textAlign: "center" }}>
      <p className={tick === 3 ? "text-body-sm" : "text-body"} style={{ color }}>
        {msg}
      </p>
    </div>
  );
}

function ErrorStateCard({
  stage,
  errorMessage,
  onRetry,
  onBack,
  prevStageNumber,
}: {
  stage: Stage;
  errorMessage: string | null;
  onRetry: () => void;
  onBack?: () => void;
  prevStageNumber?: string;
}) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div style={{ margin: "40px 48px", paddingBottom: 80 }}>
      <div
        style={{
          background: "#1C1C1C",
          border: "1px solid #7C3A3A",
          borderRadius: 12,
          padding: 32,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 32, color: "#7C3A3A", lineHeight: 1 }}>⚠</div>
        <h3 className="text-h3" style={{ color: "#F0EDE8", marginTop: 16 }}>
          Stage {stage.number} didn't complete
        </h3>
        <p className="text-body" style={{ color: "#8A8680", marginTop: 8 }}>
          The generation was interrupted. This is usually a temporary issue.
        </p>
        {errorMessage ? (
          <div style={{ marginTop: 16 }}>
            <button
              type="button"
              onClick={() => setShowDetails((s) => !s)}
              className="text-body-sm"
              style={{
                background: "transparent",
                border: "none",
                color: "#5A5652",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              {showDetails ? "Hide error details" : "Show error details"}
            </button>
            {showDetails ? (
              <pre
                style={{
                  marginTop: 8,
                  padding: 12,
                  fontFamily: "ui-monospace, SFMono-Regular, monospace",
                  fontSize: 12,
                  color: "#5A5652",
                  background: "#0A0A0A",
                  border: "1px solid #2A2A2A",
                  borderRadius: 6,
                  whiteSpace: "pre-wrap",
                  textAlign: "left",
                }}
              >
                {errorMessage}
              </pre>
            ) : null}
          </div>
        ) : null}
        <div
          style={{
            marginTop: 24,
            display: "flex",
            gap: 12,
            justifyContent: "center",
          }}
        >
          <button
            type="button"
            onClick={onRetry}
            style={{
              height: 40,
              padding: "0 20px",
              borderRadius: 8,
              background: "#D4924A",
              color: "#0A0A0A",
              border: "none",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            ↺ Retry Stage {stage.number}
          </button>
          {onBack && prevStageNumber ? (
            <button
              type="button"
              onClick={onBack}
              style={{
                height: 40,
                padding: "0 20px",
                borderRadius: 8,
                background: "transparent",
                color: "#8A8680",
                border: "1px solid #2A2A2A",
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              ← Go back to Stage {prevStageNumber}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PrimaryActionButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 items-center rounded-md px-4 text-sm font-semibold transition-colors"
      style={{
        backgroundColor: "#D4924A",
        color: "var(--color-background)",
        border: "none",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Icons
// ────────────────────────────────────────────────────────────────────────────

function CheckIcon({ color = "currentColor" }: { color?: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path
        d="M2.5 6.2L4.8 8.5L9.5 3.5"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PauseIcon({ color = "currentColor" }: { color?: string }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <rect x="2.5" y="2" width="1.5" height="6" rx="0.5" fill={color} />
      <rect x="6" y="2" width="1.5" height="6" rx="0.5" fill={color} />
    </svg>
  );
}

function XIcon({ color = "currentColor" }: { color?: string }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path
        d="M2.5 2.5L7.5 7.5M7.5 2.5L2.5 7.5"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Stage 1B — diagnostic output + brief-resubmission form
// ────────────────────────────────────────────────────────────────────────────

function Stage1bResubmitView({
  output,
  resubmitting,
  onResubmit,
}: {
  output: string;
  resubmitting: boolean;
  onResubmit: (additionalBrief: string) => void | Promise<void>;
}) {
  const [text, setText] = useState("");
  const canSubmit = text.trim().length >= 20 && !resubmitting;
  return (
    <div style={{ paddingBottom: 80 }}>
      <header>
        <span className="text-label text-primary">Brief Enhancement</span>
        <h1 className="text-h2 mt-3 text-text-primary">Additional brief information required</h1>
        <p className="text-body-sm mt-3 text-text-secondary">
          The brief did not meet the threshold required to proceed. Please respond in writing to the
          questions below — Brief Analysis will be re-run with the enriched brief before moving
          forward.
        </p>
        <hr className="my-6 h-px border-0 bg-border" />
      </header>

      <article
        style={{
          marginBottom: 32,
          maxHeight: "min(45vh, 460px)",
          overflowY: "auto",
          overflowX: "hidden",
          padding: "20px 24px",
          border: "1px solid var(--color-border)",
          borderRadius: 12,
          backgroundColor: "var(--color-surface-2)",
          position: "relative",
          zIndex: 1,
          boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
        }}
      >
        <StreamedOutput text={output} streaming={false} />
      </article>

      <hr className="my-6 h-px border-0 bg-border" />

      <div
        className="rounded-md p-5"
        style={{
          border: "1px solid var(--color-border)",
          backgroundColor: "var(--color-surface)",
        }}
      >
        <label htmlFor="stage1b-response" className="text-label text-text-secondary">
          Your responses
        </label>
        <textarea
          id="stage1b-response"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Answer each diagnostic question above. Paragraph answers are fine — no need to repeat the questions."
          rows={10}
          className="text-body mt-2 w-full rounded-md p-3 outline-none"
          style={{
            border: "1px solid var(--color-border)",
            backgroundColor: "var(--color-background)",
            color: "var(--color-text-primary)",
            resize: "vertical",
            minHeight: 200,
          }}
        />
        <div className="mt-4 flex items-center justify-between">
          <span className="text-body-sm" style={{ color: "var(--color-text-tertiary)" }}>
            Minimum 20 characters. {text.trim().length} entered.
          </span>
          <button
            type="button"
            onClick={() => canSubmit && onResubmit(text.trim())}
            disabled={!canSubmit}
            className="inline-flex h-10 items-center justify-center rounded-md px-5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              backgroundColor: "var(--color-primary)",
              color: "var(--color-primary-foreground)",
            }}
          >
            {resubmitting ? "Resubmitting…" : "Resubmit Brief & Re-run Analysis"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Structured Brief View — renders the submitted brief in nine-section format.
// Reads from sessions.brief_versions (preferred) and falls back to brief_text
// for legacy sessions submitted before structured briefs existed.
// ────────────────────────────────────────────────────────────────────────────

function StructuredBriefView({
  brandName,
  category,
  briefVersions,
  legacyBriefText,
  onEdit,
}: {
  brandName: string;
  category: string;
  briefVersions: BriefVersion[] | null;
  legacyBriefText: string | null;
  onEdit: () => void;
}) {
  // brief_versions is JSONB — defensively normalise every entry so a
  // legacy/partial row never crashes the read-only viewer.
  const versions: BriefVersion[] = Array.isArray(briefVersions)
    ? briefVersions
        .filter((v): v is BriefVersion => !!v && typeof v === "object" && !!(v as BriefVersion).fields)
        .map((v) => ({
          version: typeof v.version === "number" ? v.version : 0,
          submitted_at: typeof v.submitted_at === "string" ? v.submitted_at : "",
          fields: {
            briefTitle: v.fields?.briefTitle ?? "",
            brandName: v.fields?.brandName ?? "",
            category: v.fields?.category ?? "",
            date: v.fields?.date ?? "",
            submittedBy: v.fields?.submittedBy ?? "",
            sections:
              v.fields?.sections && typeof v.fields.sections === "object"
                ? (v.fields.sections as Record<string, string>)
                : {},
            supportingMaterials: Array.isArray(v.fields?.supportingMaterials)
              ? v.fields!.supportingMaterials
              : [],
          },
        }))
    : [];
  const latest = versions.length > 0 ? versions[versions.length - 1] : null;
  const [selectedVersion, setSelectedVersion] = useState<number>(latest?.version ?? 0);
  const active = versions.find((v) => v.version === selectedVersion) ?? latest;
  const fields: BriefFields | null = active ? active.fields : null;

  const hasStructured = !!fields;

  return (
    <>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <span className="text-label text-primary">Source Document</span>
          <h1 className="text-h2 mt-3 text-text-primary">Submitted Brief</h1>
          <p className="text-body-sm mt-3 flex items-center gap-2 text-text-secondary">
            <span
              className="inline-flex h-4 w-4 items-center justify-center rounded-full"
              style={{ backgroundColor: "var(--color-success)" }}
            >
              <CheckIcon color="var(--color-background)" />
            </span>
            On file{versions.length > 1 ? ` · ${versions.length} versions` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {versions.length > 1 && (
            <select
              value={selectedVersion}
              onChange={(e) => setSelectedVersion(Number(e.target.value))}
              className="input-base h-9 px-2 text-[13px]"
              aria-label="Brief version"
            >
              {versions.map((v) => (
                <option key={v.version} value={v.version}>
                  Version {v.version}
                  {v.version === versions[versions.length - 1].version ? " (current)" : ""}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-[13px] font-semibold transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#D4924A", color: "#0A0A0A" }}
          >
            <PencilLine size={14} />
            Edit Brief
          </button>
        </div>
      </header>
      <hr className="my-6 h-px border-0 bg-border" />

      <article style={{ paddingBottom: 80 }}>
        {hasStructured ? (
          <StructuredBriefBody brandName={brandName} category={category} fields={fields!} />
        ) : (
          <>
            <p className="text-body-sm mb-4" style={{ color: "var(--color-text-tertiary)" }}>
              This session was submitted before structured briefs were introduced.
              Showing the original brief text. Click <strong>Edit Brief</strong> to
              upgrade it to the structured format.
            </p>
            <StreamedOutput
              text={formatSubmittedBriefForStageOutput(
                legacyBriefText ?? "No brief text on file for this session.",
              )}
              streaming={false}
            />
          </>
        )}
      </article>
    </>
  );
}

function StructuredBriefBody({
  brandName,
  category,
  fields,
}: {
  brandName: string;
  category: string;
  fields: BriefFields;
}) {
  return (
    <div className="flex flex-col gap-6">
      {/* Header block */}
      <div
        className="rounded-lg p-5"
        style={{
          backgroundColor: "var(--color-card-surface, var(--color-surface-2))",
          border: "1px solid var(--color-border)",
        }}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <BriefHeaderRow label="Brief Title" value={fields.briefTitle} />
          <BriefHeaderRow label="Brand Name" value={fields.brandName || brandName} />
          <BriefHeaderRow label="Category" value={fields.category || category} />
          <BriefHeaderRow label="Date" value={fields.date} />
          <BriefHeaderRow label="Submitted By" value={fields.submittedBy} />
        </div>
      </div>

      {BRIEF_SECTIONS.map((s) => {
        const hasAny = s.fields.some((f) => (fields.sections[f.key] ?? "").trim().length > 0);
        if (!hasAny) return null;
        return (
          <div
            key={s.num}
            className="rounded-lg p-5"
            style={{
              backgroundColor: "var(--color-card-surface, var(--color-surface-2))",
              border: "1px solid var(--color-border)",
            }}
          >
            <h3 className="text-h3 text-text-primary">
              {s.num}. {s.title}
            </h3>
            <div className="mt-4 flex flex-col gap-4">
              {s.fields.map((f) => {
                const v = (fields.sections[f.key] ?? "").trim();
                if (!v) return null;
                return (
                  <div key={f.key}>
                    {f.label && (
                      <p
                        className="text-body-sm mb-1 font-medium"
                        style={{ color: "var(--color-text-secondary)" }}
                      >
                        {f.label}
                      </p>
                    )}
                    <p className="text-body whitespace-pre-wrap text-text-primary">{v}</p>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {fields.supportingMaterials.length > 0 && (
        <div
          className="rounded-lg p-5"
          style={{
            backgroundColor: "var(--color-card-surface, var(--color-surface-2))",
            border: "1px solid var(--color-border)",
          }}
        >
          <h3 className="text-h3 text-text-primary">9. Supporting Materials</h3>
          <ul className="mt-3 flex flex-wrap gap-2">
            {fields.supportingMaterials.map((name, i) => (
              <li
                key={`${name}-${i}`}
                className="text-body-sm inline-flex items-center gap-2 rounded-md px-3 py-1.5"
                style={{
                  backgroundColor: "var(--color-surface-2)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <FileText size={14} />
                <span className="text-text-primary">{name}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function BriefHeaderRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p
        className="text-body-sm mb-1 font-medium"
        style={{ color: "var(--color-text-secondary)" }}
      >
        {label}
      </p>
      <p className="text-body text-text-primary">{value || "—"}</p>
    </div>
  );
}
