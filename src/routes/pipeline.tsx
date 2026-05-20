import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { z } from "zod";
import { TopNav } from "@/components/TopNav";
import { Checkpoint } from "@/components/Checkpoint";
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
import { runStage6 } from "@/lib/stage6.functions";
import { runStage7 } from "@/lib/stage7.functions";
import { runStage8, confirmCheckpointB } from "@/lib/stage8.functions";
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
import { sanitizeStageOutput } from "@/lib/sanitize-output";

const pipelineSearchSchema = z.object({
  session: z.string().uuid().optional(),
});

export const Route = createFileRoute("/pipeline")({
  validateSearch: pipelineSearchSchema,
  component: PipelineView,
  head: () => ({
    meta: [
      { title: "Pipeline — Brand Grenade" },
      {
        name: "description",
        content:
          "20-stage strategy pipeline view. Track stages, review outputs, and act on human checkpoints.",
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
  { id: "16", number: "16", name: "Document Assembly" },
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

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

interface SessionData {
  id: string;
  brand_name: string;
  category: string;
  strategic_mode: string;
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
  stage_5_output: string | null;
  stage_5_error: string | null;
  stage_6_output: string | null;
  stage_6_error: string | null;
  stage_7_output: string | null;
  stage_7_error: string | null;
  stage_8_output: string | null;
  stage_8_error: string | null;
  stage_9_output: string | null;
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
  selected_smp: string | null;
  selected_smp_field_name: string | null;
  current_stage: number;
  status: string;
  checkpoint_b_confirmed: boolean;
  checkpoint_c_confirmed: boolean;
  retry_status: string | null;
}

function PipelineView() {
  const { session: sessionId } = Route.useSearch();
  const runStage1Fn = useServerFn(runStage1);
  const runStage1bFn = useServerFn(runStage1b);
  const resubmitBriefFn = useServerFn(resubmitBrief);
  const runStage2Fn = useServerFn(runStage2);
  const runStage3Fn = useServerFn(runStage3);
  const runStage4Fn = useServerFn(runStage4);
  const runStage5Fn = useServerFn(runStage5);
  const runStage6Fn = useServerFn(runStage6);
  const runStage7Fn = useServerFn(runStage7);
  const runStage8Fn = useServerFn(runStage8);
  const confirmCheckpointBFn = useServerFn(confirmCheckpointB);
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
  const [rationaleForId, setRationaleForId] = useState<string | null>(null);
  const [intelSubmitted, setIntelSubmitted] = useState(false);
  const selected = STAGES.find((s) => s.id === selectedId)!;
  const selectedStatus = statuses[selectedId];

  // Load session metadata from DB.
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    supabase
      .from("sessions")
      .select(
        "id, brand_name, category, strategic_mode, current_stage, status, stage_1_output, stage_1_tension_score, stage_1b_required, stage_1b_output, stage_1_error, stage_2_output, stage_2_error, stage_3_output, stage_3_error, stage_4_output, stage_4_error, stage_5_output, stage_5_error, stage_6_output, stage_6_error, stage_7_output, stage_7_error, stage_8_output, stage_8_error, stage_9_output, stage_9_error, stage_10_output, stage_10_error, stage_11_output, stage_11_error, stage_12_output, stage_12_error, stage_13_output, stage_13_error, stage_13b_output, stage_13b_error, stage_14_output, stage_14_error, stage_14b_output, stage_14b_error, stage_14c_output, stage_14c_error, stage_15_output, stage_15_error, stage_16_consulting_output, stage_16_error, selected_smp, selected_smp_field_name, checkpoint_b_confirmed, checkpoint_c_confirmed, retry_status"
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
        setSession(data as SessionData);
        if (data.stage_1b_output) setStage1bOutput(data.stage_1b_output);
        if (data.stage_2_output) {
          setStage2Output(data.stage_2_output);
          setStatuses((p) => ({ ...p, "02": "complete" }));
        }
        if (data.stage_3_output) {
          setStage3Output(data.stage_3_output);
          setStatuses((p) => ({ ...p, "03": "complete" }));
        }
        if (data.stage_4_output) {
          setStage4Output(data.stage_4_output);
          setStatuses((p) => ({ ...p, "04": "complete" }));
        }
        if (data.stage_5_output) {
          setStage5Output(data.stage_5_output);
          setStatuses((p) => ({ ...p, "05": "complete" }));
        }
        if (data.stage_6_output) {
          setStage6Output(data.stage_6_output);
          setStatuses((p) => ({ ...p, "06": "complete" }));
        }
        if (data.stage_7_output) {
          setStage7Output(data.stage_7_output);
          setStatuses((p) => ({ ...p, "07": "complete" }));
        }
        if (data.stage_8_output) {
          setStage8Output(data.stage_8_output);
          setStatuses((p) => ({ ...p, "08": data.checkpoint_b_confirmed ? "complete" : "checkpoint" }));
        }
        if (data.stage_9_output) {
          setStage9Output(data.stage_9_output);
          setStatuses((p) => ({ ...p, "09": "complete" }));
        }
        if (data.stage_10_output) {
          setStage10Output(data.stage_10_output);
          setStatuses((p) => ({ ...p, "10": "complete" }));
        }
        if (data.stage_11_output) {
          setStage11Output(data.stage_11_output);
          setStatuses((p) => ({ ...p, "11": "complete" }));
        }
        if (data.stage_12_output) {
          setStage12Output(data.stage_12_output);
          setStatuses((p) => ({ ...p, "12": data.checkpoint_c_confirmed ? "complete" : "checkpoint" }));
        }
        if (data.stage_13_output) {
          setStage13Output(data.stage_13_output);
          setStatuses((p) => ({ ...p, "13": "complete" }));
          setIntelSubmitted(true);
        }
        if (data.stage_13b_output) {
          setStage13bOutput(data.stage_13b_output);
          setStatuses((p) => ({ ...p, "13B": "complete" }));
        }
        if (data.stage_14_output) {
          setStage14Output(data.stage_14_output);
          setStatuses((p) => ({ ...p, "14": "complete" }));
        }
        if (data.stage_14b_output) {
          setStage14bOutput(data.stage_14b_output);
          setStatuses((p) => ({ ...p, "14B": "complete" }));
        }
        if (data.stage_14c_output) {
          setStage14cOutput(data.stage_14c_output);
          setStatuses((p) => ({ ...p, "14C": "complete" }));
        }
        if (data.stage_15_output) {
          setStage15Output(data.stage_15_output);
          setStatuses((p) => ({ ...p, "15": "complete" }));
        }
        if (data.stage_16_consulting_output) {
          setStage16Output(data.stage_16_consulting_output);
          setStatuses((p) => ({ ...p, "16": "complete" }));
        }
        if (data.status === "running") {
          // Resume: find the first stage that should be running.
          // Walk the linear sequence honoring human checkpoints (8 -> 9 needs
          // checkpoint_b_confirmed; 12 -> 13 needs checkpoint_c_confirmed).
          const seq: Array<{ id: string; out: unknown; gate?: boolean }> = [
            { id: "02", out: data.stage_2_output },
            { id: "03", out: data.stage_3_output },
            { id: "04", out: data.stage_4_output },
            { id: "05", out: data.stage_5_output },
            { id: "06", out: data.stage_6_output },
            { id: "07", out: data.stage_7_output },
            { id: "08", out: data.stage_8_output },
            { id: "09", out: data.stage_9_output, gate: !data.checkpoint_b_confirmed && !!data.stage_8_output },
            { id: "10", out: data.stage_10_output },
            { id: "11", out: data.stage_11_output },
            { id: "12", out: data.stage_12_output },
            { id: "13", out: data.stage_13_output, gate: !data.checkpoint_c_confirmed && !!data.stage_12_output },
            { id: "13B", out: data.stage_13b_output },
            { id: "14", out: data.stage_14_output },
            { id: "14B", out: data.stage_14b_output },
            { id: "14C", out: data.stage_14c_output },
            { id: "15", out: data.stage_15_output },
            { id: "16", out: data.stage_16_consulting_output },
          ];
          for (const step of seq) {
            if (step.out) continue;
            if (step.gate) break; // waiting on human checkpoint
            setStatuses((p) => ({ ...p, [step.id]: "running" }));
            setSelectedId(step.id);
            break;
          }
        }
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId, retryNonce]);

  // Trigger Stage 1 when session loads (or on retry).
  useEffect(() => {
    if (!sessionId || !session) return;
    if (session.stage_1_output && retryNonce === 0) {
      // Already complete — hydrate.
      setStage1Output(session.stage_1_output);
      setStatuses((p) => ({
        ...p,
        "01": "checkpoint",
        "01B": session.stage_1b_required ? "running" : p["01B"],
      }));
      return;
    }
    let cancelled = false;
    setStage1Loading(true);
    setStage1Error(null);
    setStatuses((p) => ({ ...p, "01": "running" }));

    runStage1Fn({ data: { sessionId } })
      .then((result) => {
        if (cancelled) return;
        setStage1Output(result.output);
        setStage1Loading(false);
        setStatuses((p) => {
          const next: Record<string, StageStatus> = { ...p, "01": "checkpoint" };
          if (result.stage1bRequired) next["01B"] = "running";
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
    runStage1bFn({ data: { sessionId } })
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
  }, [sessionId, session?.stage_1b_required, statuses["01B"], stage1bOutput]);

  // Trigger Stage 2 when its status flips to "running".
  useEffect(() => {
    if (!sessionId || !session) return;
    if (statuses["02"] !== "running") return;
    if (stage2Output) return;
    let cancelled = false;
    setStage2Loading(true);
    setStage2Error(null);
    runStage2Fn({ data: { sessionId } })
      .then((result) => {
        if (cancelled) return;
        setStage2Output(result.output);
        setStage2Loading(false);
        // Auto-advance: kick Stage 3 into "running" as soon as Stage 2 finishes.
        setStatuses((p) => ({ ...p, "02": "complete", "03": "running" }));
        setSelectedId("03");
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
  }, [sessionId, session?.id, statuses["02"], stage2Output]);

  // Trigger Stage 3 when its status flips to "running".
  useEffect(() => {
    if (!sessionId || !session) return;
    if (statuses["03"] !== "running") return;
    if (stage3Output) return;
    let cancelled = false;
    setStage3Loading(true);
    setStage3Error(null);
    runStage3Fn({ data: { sessionId } })
      .then((result) => {
        if (cancelled) return;
        setStage3Output(result.output);
        setStage3Loading(false);
        // Auto-advance to Stage 4.
        setStatuses((p) => ({ ...p, "03": "complete", "04": "running" }));
        setSelectedId("04");
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
  }, [sessionId, session?.id, statuses["03"], stage3Output]);

  // Trigger Stage 4 when its status flips to "running".
  useEffect(() => {
    if (!sessionId || !session) return;
    if (statuses["04"] !== "running") return;
    if (stage4Output) return;
    let cancelled = false;
    setStage4Loading(true);
    setStage4Error(null);
    runStage4Fn({ data: { sessionId } })
      .then((result) => {
        if (cancelled) return;
        setStage4Output(result.output);
        setStage4Loading(false);
        // Auto-advance to Stage 5.
        setStatuses((p) => ({ ...p, "04": "complete", "05": "running" }));
        setSelectedId("05");
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
  }, [sessionId, session?.id, statuses["04"], stage4Output]);

  // Trigger Stage 5 when its status flips to "running".
  useEffect(() => {
    if (!sessionId || !session) return;
    if (statuses["05"] !== "running") return;
    if (stage5Output) return;
    let cancelled = false;
    setStage5Loading(true);
    setStage5Error(null);
    runStage5Fn({ data: { sessionId } })
      .then((result) => {
        if (cancelled) return;
        setStage5Output(result.output);
        setStage5Loading(false);
        setStatuses((p) => ({ ...p, "05": "complete", "06": "running" }));
        setSelectedId("06");
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
  }, [sessionId, session?.id, statuses["05"], stage5Output]);

  // Trigger Stage 6 when its status flips to "running".
  useEffect(() => {
    if (!sessionId || !session) return;
    if (statuses["06"] !== "running") return;
    if (stage6Output) return;
    let cancelled = false;
    setStage6Loading(true);
    setStage6Error(null);
    runStage6Fn({ data: { sessionId } })
      .then((result) => {
        if (cancelled) return;
        setStage6Output(result.output);
        setStage6Loading(false);
        setStatuses((p) => ({ ...p, "06": "complete", "07": "running" }));
        setSelectedId("07");
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
  }, [sessionId, session?.id, statuses["06"], stage6Output]);

  // Trigger Stage 7 when its status flips to "running".
  useEffect(() => {
    if (!sessionId || !session) return;
    if (statuses["07"] !== "running") return;
    if (stage7Output) return;
    let cancelled = false;
    setStage7Loading(true);
    setStage7Error(null);
    runStage7Fn({ data: { sessionId } })
      .then((result) => {
        if (cancelled) return;
        setStage7Output(result.output);
        setStage7Loading(false);
        setStatuses((p) => ({ ...p, "07": "complete", "08": "running" }));
        setSelectedId("08");
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
  }, [sessionId, session?.id, statuses["07"], stage7Output]);

  // Stage 8 — SMP Generation, ends at Checkpoint B.
  useEffect(() => {
    if (!sessionId || !session) return;
    if (statuses["08"] !== "running") return;
    if (stage8Output) return;
    let cancelled = false;
    setStage8Loading(true);
    setStage8Error(null);
    runStage8Fn({ data: { sessionId } })
      .then((result) => {
        if (cancelled) return;
        setStage8Output(result.output);
        setStage8Loading(false);
        setStatuses((p) => ({ ...p, "08": "checkpoint" }));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStage8Loading(false);
        setStage8Error(err instanceof Error ? err.message : "Stage 8 failed");
        setStatuses((p) => ({ ...p, "08": "error" }));
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, session?.id, statuses["08"], stage8Output]);

  // Stage 9 — Divergence Validation.
  useEffect(() => {
    if (!sessionId || !session) return;
    if (statuses["09"] !== "running") return;
    if (stage9Output) return;
    let cancelled = false;
    setStage9Loading(true);
    setStage9Error(null);
    runStage9Fn({ data: { sessionId } })
      .then((result) => {
        if (cancelled) return;
        setStage9Output(result.output);
        setStage9Loading(false);
        setStatuses((p) => ({ ...p, "09": "complete", "10": "running" }));
        setSelectedId("10");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStage9Loading(false);
        setStage9Error(err instanceof Error ? err.message : "Stage 9 failed");
        setStatuses((p) => ({ ...p, "09": "error" }));
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, session?.id, statuses["09"], stage9Output]);

  // Stage 10 — Scoring.
  useEffect(() => {
    if (!sessionId || !session) return;
    if (statuses["10"] !== "running") return;
    if (stage10Output) return;
    let cancelled = false;
    setStage10Loading(true);
    setStage10Error(null);
    runStage10Fn({ data: { sessionId } })
      .then((result) => {
        if (cancelled) return;
        setStage10Output(result.output);
        setStage10Loading(false);
        setStatuses((p) => ({ ...p, "10": "complete", "11": "running" }));
        setSelectedId("11");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStage10Loading(false);
        setStage10Error(err instanceof Error ? err.message : "Stage 10 failed");
        setStatuses((p) => ({ ...p, "10": "error" }));
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, session?.id, statuses["10"], stage10Output]);

  // Stage 11 — Pressure Test.
  useEffect(() => {
    if (!sessionId || !session) return;
    if (statuses["11"] !== "running") return;
    if (stage11Output) return;
    let cancelled = false;
    setStage11Loading(true);
    setStage11Error(null);
    runStage11Fn({ data: { sessionId } })
      .then((result) => {
        if (cancelled) return;
        setStage11Output(result.output);
        setStage11Loading(false);
        setStatuses((p) => ({ ...p, "11": "complete", "12": "running" }));
        setSelectedId("12");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStage11Loading(false);
        setStage11Error(err instanceof Error ? err.message : "Stage 11 failed");
        setStatuses((p) => ({ ...p, "11": "error" }));
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, session?.id, statuses["11"], stage11Output]);

  // Stage 12 — SMP Selection presentation. Ends at Checkpoint C (human selects).
  useEffect(() => {
    if (!sessionId || !session) return;
    if (statuses["12"] !== "running") return;
    if (stage12Output) return;
    let cancelled = false;
    setStage12Loading(true);
    setStage12Error(null);
    runStage12Fn({ data: { sessionId } })
      .then((result) => {
        if (cancelled) return;
        setStage12Output(result.output);
        setStage12Loading(false);
        setStatuses((p) => ({ ...p, "12": "checkpoint" }));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStage12Loading(false);
        setStage12Error(err instanceof Error ? err.message : "Stage 12 failed");
        setStatuses((p) => ({ ...p, "12": "error" }));
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, session?.id, statuses["12"], stage12Output]);

  // Stages 13–16 — post-selection validation, territory mapping, audit, and assembly.
  useEffect(() => {
    if (!sessionId || !session || statuses["13"] !== "running" || stage13Output || !intelSubmitted) return;
    let cancelled = false;
    setStage13Loading(true);
    setStage13Error(null);
    runStage13Fn({ data: { sessionId } })
      .then((result) => {
        if (cancelled) return;
        setStage13Output(result.output);
        setStage13Loading(false);
        setStatuses((p) => ({ ...p, "13": "complete", "13B": "running" }));
        setSelectedId("13B");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStage13Loading(false);
        setStage13Error(err instanceof Error ? err.message : "Stage 13 failed");
        setStatuses((p) => ({ ...p, "13": "error" }));
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, session?.id, statuses["13"], stage13Output, intelSubmitted]);

  useEffect(() => {
    if (!sessionId || !session || statuses["13B"] !== "running" || stage13bOutput) return;
    let cancelled = false;
    setStage13bLoading(true);
    setStage13bError(null);
    runStage13bFn({ data: { sessionId } })
      .then((result) => {
        if (cancelled) return;
        setStage13bOutput(result.output);
        setStage13bLoading(false);
        setStatuses((p) => ({ ...p, "13B": "complete", "14": "running" }));
        setSelectedId("14");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStage13bLoading(false);
        setStage13bError(err instanceof Error ? err.message : "Stage 13B failed");
        setStatuses((p) => ({ ...p, "13B": "error" }));
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, session?.id, statuses["13B"], stage13bOutput]);

  useEffect(() => {
    if (!sessionId || !session || statuses["14"] !== "running" || stage14Output) return;
    let cancelled = false;
    setStage14Loading(true);
    setStage14Error(null);
    runStage14Fn({ data: { sessionId } })
      .then((result) => {
        if (cancelled) return;
        setStage14Output(result.output);
        setStage14Loading(false);
        setStatuses((p) => ({ ...p, "14": "complete", "14B": "running" }));
        setSelectedId("14B");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStage14Loading(false);
        setStage14Error(err instanceof Error ? err.message : "Stage 14 failed");
        setStatuses((p) => ({ ...p, "14": "error" }));
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, session?.id, statuses["14"], stage14Output]);

  useEffect(() => {
    if (!sessionId || !session || statuses["14B"] !== "running" || stage14bOutput) return;
    let cancelled = false;
    setStage14bLoading(true);
    setStage14bError(null);
    runStage14bFn({ data: { sessionId } })
      .then((result) => {
        if (cancelled) return;
        setStage14bOutput(result.output);
        setStage14bLoading(false);
        setStatuses((p) => ({ ...p, "14B": "complete", "14C": "running" }));
        setSelectedId("14C");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStage14bLoading(false);
        setStage14bError(err instanceof Error ? err.message : "Stage 14B failed");
        setStatuses((p) => ({ ...p, "14B": "error" }));
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, session?.id, statuses["14B"], stage14bOutput]);

  useEffect(() => {
    if (!sessionId || !session || statuses["14C"] !== "running" || stage14cOutput) return;
    let cancelled = false;
    setStage14cLoading(true);
    setStage14cError(null);
    runStage14cFn({ data: { sessionId } })
      .then((result) => {
        if (cancelled) return;
        setStage14cOutput(result.output);
        setStage14cLoading(false);
        setStatuses((p) => ({ ...p, "14C": "complete", "15": "running" }));
        setSelectedId("15");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStage14cLoading(false);
        setStage14cError(err instanceof Error ? err.message : "Stage 14C failed");
        setStatuses((p) => ({ ...p, "14C": "error" }));
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, session?.id, statuses["14C"], stage14cOutput]);

  useEffect(() => {
    if (!sessionId || !session || statuses["15"] !== "running" || stage15Output) return;
    let cancelled = false;
    setStage15Loading(true);
    setStage15Error(null);
    runStage15Fn({ data: { sessionId } })
      .then((result) => {
        if (cancelled) return;
        setStage15Output(result.output);
        setStage15Loading(false);
        setStatuses((p) => ({ ...p, "15": "complete", "16": "running" }));
        setSelectedId("16");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStage15Loading(false);
        setStage15Error(err instanceof Error ? err.message : "Stage 15 failed");
        setStatuses((p) => ({ ...p, "15": "error" }));
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, session?.id, statuses["15"], stage15Output]);

  useEffect(() => {
    if (!sessionId || !session || statuses["16"] !== "running" || stage16Output) return;
    let cancelled = false;
    setStage16Loading(true);
    setStage16Error(null);
    runStage16Fn({ data: { sessionId, format: "consulting" } })
      .then((result) => {
        if (cancelled) return;
        setStage16Output(result.output);
        setStage16Loading(false);
        setStatuses((p) => ({ ...p, "16": "complete" }));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStage16Loading(false);
        setStage16Error(err instanceof Error ? err.message : "Stage 16 failed");
        setStatuses((p) => ({ ...p, "16": "error" }));
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, session?.id, statuses["16"], stage16Output]);


  // Per-stage output: use live Stage 1 / 1B / 2 / 3 output, demo stubs for others.
  const stageOutputs = useMemo<Record<string, string>>(() => {
    const sanitize = (s: string) => sanitizeStageOutput(s);
    if (!sessionId) return STAGE_OUTPUTS;
    return {
      ...STAGE_OUTPUTS,
      "01":
        (stage1Output && sanitize(stage1Output)) ??
        (stage1Loading
          ? "Analysing brief — this can take 20–60 seconds…"
          : "Awaiting output."),
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
    stage1Output, stage1Loading,
    stage1bOutput, stage1bLoading,
    stage2Output, stage2Loading,
    stage3Output, stage3Loading,
    stage4Output, stage4Loading,
    stage5Output, stage5Loading,
    stage6Output, stage6Loading,
    stage7Output, stage7Loading,
    stage8Output, stage8Loading,
    stage9Output, stage9Loading,
    stage10Output, stage10Loading,
    stage11Output, stage11Loading,
    stage12Output, stage12Loading,
    stage13Output, stage13Loading,
    stage13bOutput, stage13bLoading,
    stage14Output, stage14Loading,
    stage14bOutput, stage14bLoading,
    stage14cOutput, stage14cLoading,
    stage15Output, stage15Loading,
    stage16Output, stage16Loading,
  ]);


  // Progress — count main (non-conditional) stages.
  const mainStages = STAGES.filter((s) => !s.conditional);
  const completedMain = mainStages.filter(
    (s) => statuses[s.id] === "complete"
  ).length;
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
    return STAGES[0].id;
  })();
  const isViewingHistorical = selectedId !== currentActiveId && statuses[selectedId] === "complete";
  const pipelineIsRunning =
    Object.values(statuses).some((s) => s === "running") ||
    stage1Loading || stage1bLoading || stage2Loading || stage3Loading ||
    stage4Loading || stage5Loading || stage6Loading || stage7Loading ||
    stage8Loading || stage9Loading || stage10Loading || stage11Loading ||
    stage12Loading || stage13Loading || stage13bLoading || stage14Loading ||
    stage14bLoading || stage14cLoading || stage15Loading || stage16Loading;

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
      // skip conditional stages that aren't relevant
      if (STAGES[i].conditional && statuses[STAGES[i].id] === "pending") continue;
      return STAGES[i];
    }
    return null;
  })();
  const nextStageStatus: StageStatus | null = nextStage ? statuses[nextStage.id] : null;
  const pipelineComplete = mainStages.every((s) => statuses[s.id] === "complete");

  // Dynamic document title: "[Brand] — Stage X — Brand Grenade"
  useEffect(() => {
    document.title = `${brandLabel} — Stage ${Math.max(1, currentMainNumber)} — Brand Grenade`;
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
      const btn = document.querySelector<HTMLButtonElement>(
        "[data-checkpoint-confirm='true']",
      );
      btn?.click();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedId, statuses, intelSubmitted]);

  return (
    <div className="flex h-screen flex-col bg-background">
      <TopNav
        session={{
          brand: brandLabel,
          currentStage: Math.max(1, currentMainNumber),
          totalStages: mainStages.length,
          isRunning: pipelineIsRunning,
        }}
      />
      <Breadcrumb brand={brandLabel} elapsed={elapsed} status={pipelineStatus} />


      <div className="flex flex-1 overflow-hidden">
        <LeftPanel
          stages={STAGES}
          statuses={statuses}
          selectedId={selectedId}
          onSelect={(id) => {
            const st = statuses[id];
            if (st === "complete" || st === "running" || st === "checkpoint" || st === "error") {
              setSelectedId(id);
            }
          }}
          progressPct={progressPct}
          currentMainNumber={Math.max(1, currentMainNumber)}
          totalMain={mainStages.length}
        />
        <RightPanel
          stage={selected}
          status={selectedStatus}
          fullOutput={stageOutputs[selected.id] ?? "Output pending."}
          isViewingHistorical={isViewingHistorical}
          onBackToCurrent={() => setSelectedId(currentActiveId)}

          stage1Error={
            selected.id === "01" || selected.id === "01B"
              ? stage1Error
              : selected.id === "02" ? stage2Error
              : selected.id === "03" ? stage3Error
              : selected.id === "04" ? stage4Error
              : selected.id === "05" ? stage5Error
              : selected.id === "06" ? stage6Error
              : selected.id === "07" ? stage7Error
              : selected.id === "08" ? stage8Error
              : selected.id === "09" ? stage9Error
              : selected.id === "10" ? stage10Error
              : selected.id === "11" ? stage11Error
              : selected.id === "12" ? stage12Error
              : selected.id === "13" ? stage13Error
              : selected.id === "13B" ? stage13bError
              : selected.id === "14" ? stage14Error
              : selected.id === "14B" ? stage14bError
              : selected.id === "14C" ? stage14cError
              : selected.id === "15" ? stage15Error
              : selected.id === "16" ? stage16Error
              : null
          }

          tensionScore={selected.id === "01" ? session?.stage_1_tension_score ?? null : null}
          stage1bRequired={selected.id === "01" ? session?.stage_1b_required ?? false : false}
          onRetry={() => {
            const id = selected.id;
            const map: Record<string, () => void> = {
              "02": () => { setStage2Error(null); setStage2Output(null); },
              "03": () => { setStage3Error(null); setStage3Output(null); },
              "04": () => { setStage4Error(null); setStage4Output(null); },
              "05": () => { setStage5Error(null); setStage5Output(null); },
              "06": () => { setStage6Error(null); setStage6Output(null); },
              "07": () => { setStage7Error(null); setStage7Output(null); },
              "08": () => { setStage8Error(null); setStage8Output(null); },
              "09": () => { setStage9Error(null); setStage9Output(null); },
              "10": () => { setStage10Error(null); setStage10Output(null); },
              "11": () => { setStage11Error(null); setStage11Output(null); },
              "12": () => { setStage12Error(null); setStage12Output(null); },
              "13": () => { setStage13Error(null); setStage13Output(null); },
              "13B": () => { setStage13bError(null); setStage13bOutput(null); },
              "14": () => { setStage14Error(null); setStage14Output(null); },
              "14B": () => { setStage14bError(null); setStage14bOutput(null); },
              "14C": () => { setStage14cError(null); setStage14cOutput(null); },
              "15": () => { setStage15Error(null); setStage15Output(null); },
              "16": () => { setStage16Error(null); setStage16Output(null); },
            };
            if (map[id]) {
              map[id]();
              setStatuses((p) => ({ ...p, [id]: "running" }));
            } else {
              setRetryNonce((n) => n + 1);
            }
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
          onContinue={() => {
            if (!nextStage) return;
            const st = statuses[nextStage.id];
            if (st === "pending") {
              setStatuses((p) => ({ ...p, [nextStage.id]: "running" }));
            }
            setSelectedId(nextStage.id);
          }}
          onViewFinal={() => {
            if (sessionId) {
              window.location.href = `/complete?session=${sessionId}`;
            }
          }}
          onConfirmCheckpoint={(stageId, notes) => {
            // Persist notes + timestamp for the relevant checkpoint.
            const letter = CHECKPOINT_LETTERS[stageId];
            if (sessionId && letter) {
              const notesText = (notes ?? []).map((n) => n.trim()).filter(Boolean).join("\n\n");
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
              void supabase.from("sessions").update(update).eq("id", sessionId).then(({ error }) => {
                if (error) console.error("[Checkpoint] failed to persist", error);
              });
            }
            // Checkpoint A with 1B required → route to Stage 1B instead of Stage 2.
            if (stageId === "01" && session?.stage_1b_required && !stage1bOutput) {
              setStatuses((prev) => ({
                ...prev,
                "01": "complete",
                "01B": "running",
              }));
              setSelectedId("01B");
              return;
            }
            // Checkpoint B (Stage 8) → persist confirmation then advance to Stage 9.
            if (stageId === "08") {
              if (sessionId) {
                confirmCheckpointBFn({ data: { sessionId } }).catch(() => {});
              }
              setStatuses((prev) => ({ ...prev, "08": "complete", "09": "running" }));
              setSelectedId("09");
              return;
            }
            setRationaleForId(null);
            setStatuses((prev) => {
              const next = { ...prev, [stageId]: "complete" as StageStatus };
              const idx = STAGES.findIndex((s) => s.id === stageId);
              for (let i = idx + 1; i < STAGES.length; i++) {
                if (!STAGES[i].conditional) {
                  next[STAGES[i].id] = "running";
                  break;
                }
              }
              return next;
            });
          }}
          onResubmitCheckpoint={async (stageId, feedback) => {
            console.log(`[Checkpoint Resubmit] stage=${stageId} feedback=${feedback}`);
            // Clear the relevant stage output and re-run it.
            const resetMap: Record<string, () => void> = {
              "01": () => { setStage1Output(null); setStage1Error(null); },
              "08": () => { setStage8Output(null); setStage8Error(null); },
              "12": () => { setStage12Output(null); setStage12Error(null); },
            };
            if (resetMap[stageId]) {
              resetMap[stageId]();
              if (stageId === "01") {
                setRetryNonce((n) => n + 1);
              } else {
                setStatuses((p) => ({ ...p, [stageId]: "running" }));
              }
            }
          }}
          onEscalateCheckpoint={(stageId, reason) => {
            console.log(`[Checkpoint Escalate] stage=${stageId} reason=${reason}`);
          }}
          customCheckpoint={
            selectedId === "12" && selectedStatus === "checkpoint" && rationaleForId !== "12" ? (
              <SMPSelection
                stage12Output={stage12Output ?? ""}
                stage8Output={stage8Output ?? ""}
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
                    setStage12Error(err instanceof Error ? err.message : "Failed to save selection");
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
                    setStatuses((prev) => ({ ...prev, "12": "complete", "13": "running" }));
                    setSelectedId("13");
                  } catch (err) {
                    setStage12Error(err instanceof Error ? err.message : "Failed to save rationale");
                  } finally {
                    setSavingRationale(false);
                  }
                }}
              />
            ) : null
          }
          retryStatus={session?.retry_status ?? null}
        />


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
}: {
  brand: string;
  elapsed: string;
  status: string;
}) {
  return (
    <div
      className="flex items-center justify-between border-b border-border bg-background px-5 py-3 sm:px-8"
    >
      <nav className="text-body-sm flex items-center gap-1.5 truncate" style={{ color: "var(--color-text-tertiary)" }}>
        <Link to="/dashboard" className="transition-colors hover:text-text-secondary">
          Sessions
        </Link>
        <span>→</span>
        <span className="text-text-secondary truncate">{brand}</span>
        <span>→</span>
        <span>Strategy Process</span>
      </nav>

      <div className="ml-4 flex shrink-0 items-center gap-3">
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
}: {
  stages: Stage[];
  statuses: Record<string, StageStatus>;
  selectedId: string;
  onSelect: (id: string) => void;
  progressPct: number;
  currentMainNumber: number;
  totalMain: number;
}) {
  return (
    <aside
      className="hidden w-[280px] shrink-0 overflow-y-auto border-r border-border bg-background py-6 md:block"
    >
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
        <p
          className="text-body-sm mt-2"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          Stage {currentMainNumber} of {totalMain}
        </p>
      </header>

      <ul>
        {stages.map((s) => {
          const status = statuses[s.id];
          const selected = s.id === selectedId;
          const interactive =
            status === "complete" ||
            status === "running" ||
            status === "checkpoint";
          return (
            <li
              key={s.id}
              style={{ borderTop: "1px solid var(--color-surface-3)" }}
            >
              <button
                type="button"
                disabled={!interactive}
                onClick={() => onSelect(s.id)}
                className="flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors"
                style={{
                  backgroundColor: selected
                    ? "var(--color-primary-subtle)"
                    : "transparent",
                  cursor: interactive ? "pointer" : "default",
                }}
                onMouseEnter={(e) => {
                  if (interactive && !selected)
                    e.currentTarget.style.backgroundColor =
                      "var(--color-surface-2)";
                }}
                onMouseLeave={(e) => {
                  if (!selected)
                    e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <StageIndicator
                  status={s.conditional && status === "pending" ? "pending" : status}
                  conditional={s.conditional}
                  checkpoint={s.checkpoint}
                />
                <span
                  className="text-mono shrink-0"
                  style={{
                    color: "var(--color-text-tertiary)",
                    minWidth: 28,
                    fontSize: 12,
                  }}
                >
                  {s.number}
                </span>
                <span
                  className="text-body flex-1 truncate"
                  style={stageNameStyle(status, selected, s.conditional)}
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
                      color: "var(--color-text-tertiary)",
                      fontSize: 9,
                    }}
                  >
                    Cond.
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
      <span className="text-label shrink-0" style={{ color: "var(--color-destructive)", fontSize: 10 }}>
        Error
      </span>
    );
  }
  if (selected && status === "pending") {
    return (
      <span className="text-label shrink-0" style={{ color: "var(--color-text-tertiary)", fontSize: 10 }}>
        Viewing
      </span>
    );
  }
  return null;
}

function stageNameStyle(
  status: StageStatus,
  selected: boolean,
  conditional?: boolean
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
  if (status === "checkpoint" || checkpoint && status !== "pending") {
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
}: {
  stage: Stage;
  status: StageStatus;
  fullOutput: string;
  isViewingHistorical?: boolean;
  onBackToCurrent?: () => void;
  stage1Error: string | null;
  tensionScore: number | null;
  stage1bRequired: boolean;
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
            Viewing completed stage: <span style={{ color: "var(--color-text-secondary)" }}>{stage.number} — {stage.name}</span>
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
      <div className="flex-1 overflow-y-auto px-6 py-10 sm:px-12 sm:py-10">

        {isError && ["01","02","03","04","05","06","07","08","09","10","11","12"].includes(stage.id) ? (
          <div style={{ paddingBottom: 80 }}>
            <header>
              <span className="text-label text-primary">
                Stage {stage.number} — {stage.name}
              </span>
              <h1 className="text-h2 mt-3 text-text-primary">{stage.name}</h1>
              <p
                className="text-body-sm mt-3"
                style={{ color: "var(--color-destructive)" }}
              >
                Stage {stage.number} failed
              </p>
              <hr className="my-6 h-px border-0 bg-border" />
            </header>
            <div
              className="rounded-md p-5"
              style={{
                border: "1px solid var(--color-destructive)",
                backgroundColor: "oklch(0.5 0.2 25 / 0.05)",
              }}
            >
              <p className="text-body text-text-primary">
                {stage1Error ?? "An unexpected error occurred."}
              </p>
              <button
                type="button"
                onClick={onRetry}
                className="mt-4 inline-flex h-10 items-center justify-center rounded-md px-5 text-sm font-semibold transition-colors"
                style={{
                  backgroundColor: "var(--color-primary)",
                  color: "var(--color-primary-foreground)",
                }}
              >
                Retry Stage {stage.number}
              </button>
            </div>
          </div>
        ) : showStage1bResubmit ? (
          <Stage1bResubmitView
            output={fullOutput}
            resubmitting={resubmitting}
            onResubmit={onResubmitBrief}
          />
        ) : showRationale ? (
          <div style={{ paddingBottom: 80 }}>
            <SelectionRationale
              onConfirm={() => onConfirmCheckpoint(stage.id)}
            />
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
              showLowScoreAlert={letter === "A" && stage1bRequired}
              onConfirm={(notes) => onConfirmCheckpoint(stage.id, notes)}
              onResubmit={onResubmitCheckpoint ? (fb) => onResubmitCheckpoint(stage.id, fb) : undefined}
              onEscalate={onEscalateCheckpoint ? (r) => onEscalateCheckpoint(stage.id, r) : undefined}
              resubmitting={checkpointResubmitting}
              reviewContent={
                <>
                  {letter === "A" && tensionScore !== null && (
                    <p
                      className="text-body-sm mb-3"
                      style={{ color: "var(--color-text-tertiary)" }}
                    >
                      Strategic Tension Score: <strong style={{ color: tensionScore >= 7 ? "var(--color-success)" : "var(--color-warning)" }}>{tensionScore}/10</strong>
                    </p>
                  )}
                  <StreamedOutput text={fullOutput} streaming={false} />
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
              <StreamedOutput text={text} streaming={isRunning} />
            </article>
          </>
        )}
      </div>

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
      <p
        className="text-body-sm mt-3"
        style={{ color: "var(--color-destructive)" }}
      >
        Stage held — see errors below
      </p>
    );
  }
  return (
    <p
      className="text-body-sm mt-3"
      style={{ color: "var(--color-text-tertiary)" }}
    >
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
      setShown(full);
      return;
    }
    setShown("");
    let i = 0;
    const id = window.setInterval(() => {
      i += 6;
      setShown(fullRef.current.slice(0, i));
      if (i >= fullRef.current.length) window.clearInterval(id);
    }, 24);
    return () => window.clearInterval(id);
  }, [full, streaming]);

  return shown;
}

// Render a minimal subset of markdown-like blocks per the spec.
function StreamedOutput({
  text,
  streaming,
}: {
  text: string;
  streaming: boolean;
}) {
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
                  color: "#C8873A",
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
                  borderLeft: "3px solid #C8873A",
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
              <ul
                key={i}
                style={{ paddingLeft: 20, margin: "8px 0", listStyle: "none" }}
              >
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
                        backgroundColor: "#C8873A",
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
        p.kind === "b" ? <strong key={i} style={{ color: "#F0EDE8", fontWeight: 600 }}>{p.v}</strong> :
        p.kind === "i" ? <em key={i}>{p.v}</em> :
        <span key={i}>{p.v}</span>,
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
                backgroundColor: "#C8873A",
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
  nextStageStatus,
  isViewingHistorical,
  pipelineComplete,
  onContinue,
  onBack,
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
  onReturnToCurrent: () => void;
  onViewFinal: () => void;
}) {
  // Right-side primary action
  let rightEl: ReactNode = null;
  if (status === "running") {
    rightEl = (
      <span className="text-body-sm" style={{ color: "#5A5652" }}>
        Generating…
      </span>
    );
  } else if (pipelineComplete && !isViewingHistorical) {
    rightEl = (
      <PrimaryActionButton onClick={onViewFinal} label="View Final Output →" />
    );
  } else if (isViewingHistorical) {
    rightEl = (
      <button
        type="button"
        onClick={onReturnToCurrent}
        className="inline-flex h-9 items-center rounded-md px-4 text-sm font-medium transition-colors"
        style={{
          border: "1px solid var(--color-border)",
          color: "var(--color-text-primary)",
          backgroundColor: "transparent",
        }}
      >
        Return to Current Stage →
      </button>
    );
  } else if (status === "checkpoint") {
    // Checkpoint UI already renders its own confirm — no duplicate button.
    rightEl = (
      <span className="text-body-sm" style={{ color: "#5A5652" }}>
        Review and confirm above to continue
      </span>
    );
  } else if (status === "complete" && nextStage && nextStageStatus === "pending") {
    rightEl = (
      <PrimaryActionButton
        onClick={onContinue}
        label={`Continue to ${nextStage.name} →`}
      />
    );
  } else if (status === "complete" && nextStage && nextStageStatus === "running") {
    rightEl = (
      <span className="text-body-sm" style={{ color: "#5A5652" }}>
        {nextStage.name} generating…
      </span>
    );
  }

  return (
    <div
      className="flex h-[56px] shrink-0 items-center justify-between border-t bg-background"
      style={{
        borderColor: "#2A2A2A",
        backgroundColor: "#0A0A0A",
        padding: "0 48px",
      }}
    >
      <div>
        {prevStage && status !== "running" ? (
          <button
            type="button"
            onClick={onBack}
            className="text-body-sm font-medium transition-colors"
            style={{ color: "#8A8680", background: "transparent", border: "none", cursor: "pointer" }}
          >
            ← {prevStage.name}
          </button>
        ) : (
          <span className="text-body-sm" style={{ color: "var(--color-text-tertiary)" }}>
            Stage {stage.number}
          </span>
        )}
      </div>
      <div>{rightEl}</div>
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
        backgroundColor: "#C8873A",
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
        <h1 className="text-h2 mt-3 text-text-primary">
          Additional brief information required
        </h1>
        <p className="text-body-sm mt-3 text-text-secondary">
          The brief did not meet the threshold required to proceed. Please
          respond in writing to the questions below — Brief Analysis will be
          re-run with the enriched brief before moving forward.
        </p>
        <hr className="my-6 h-px border-0 bg-border" />
      </header>

      <article style={{ marginBottom: 32 }}>
        <StreamedOutput text={output} streaming={false} />
      </article>

      <div
        className="rounded-md p-5"
        style={{
          border: "1px solid var(--color-border)",
          backgroundColor: "var(--color-surface)",
        }}
      >
        <label
          htmlFor="stage1b-response"
          className="text-label text-text-secondary"
        >
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
          <span
            className="text-body-sm"
            style={{ color: "var(--color-text-tertiary)" }}
          >
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

