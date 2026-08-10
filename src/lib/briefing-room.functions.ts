// Briefing Room server functions — Steps 1–4 (diagnostic) and Step 5 (handoff
// preview). Step 6 (approve → land in Saved Briefs → run Stage 1) is performed
// client-side by calling saveBrief() with the preview payload, then routing
// into the existing Save-and-Run path via PENDING_BRIEF_STORAGE_KEY.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callClaude } from "./claude.server";
import {
  STEP_1_SYSTEM,
  STEP_2_SYSTEM,
  STEP_3_SYSTEM,
  STEP_4_SYSTEM,
  buildIntakeBlock,
  type Step1Output,
  type Step2Output,
  type Step3Output,
  type Step4Output,
  type Truth,
} from "./briefing-room-prompts";
import {
  buildHandoffPayload,
  type HandoffPayload,
  type WorkspaceForHandoff,
} from "./briefing-room-handoff";
import type { PrebriefForBriefingRoom } from "./intelligence/prebrief-text";

const EvidenceSchema = z.object({
  label: z.string().max(200).default(""),
  type: z.string().max(80).default(""),
  content: z.string().max(50000).default(""),
});

async function loadWorkspace(id: string, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("briefing_room_workspaces")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Briefing workspace not found");
  if ((data as { user_id: string }).user_id !== userId) throw new Error("Forbidden");
  return data as unknown as {
    id: string;
    user_id: string;
    brand_name: string;
    category: string;
    raw_brief: string;
    supporting_evidence: Array<{ label: string; type: string; content: string }>;
    diagnosis: Step1Output | null;
    truths: Step2Output | null;
    relevance: Step3Output | null;
    tensions: Step4Output | null;
    selected_frame: string | null;
    selected_tension_index: number | null;
    status: string;
    updated_at: string;
  };
}

/**
 * Every Briefing Room step runs inside one browser-initiated request. Without
 * this guard a failed model call left no trace at all: the workspace kept its
 * previous values and nothing recorded that a run was attempted or why it
 * failed. Now the failure is persisted to `last_error` before it is rethrown.
 */
async function guardedStep<T>(
  workspaceId: string,
  label: string,
  args: Parameters<typeof callClaude>[0],
): Promise<T> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  try {
    const raw = await callClaude(args);
    const parsed = parseJson<T>(raw, label);
    await supabaseAdmin
      .from("briefing_room_workspaces")
      .update({ last_error: null })
      .eq("id", workspaceId);
    return parsed;
  } catch (e) {
    const msg = e instanceof Error ? e.message : `${label} failed`;
    await supabaseAdmin
      .from("briefing_room_workspaces")
      .update({ last_error: `${label}: ${msg}` })
      .eq("id", workspaceId);
    throw new Error(`${label}: ${msg}`);
  }
}


function parseJson<T>(raw: string, label: string): T {
  // Strip markdown fences if the model added them despite instructions.
  let s = raw.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  }
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error(`${label}: model returned no JSON object`);
  }
  try {
    return JSON.parse(s.slice(start, end + 1)) as T;
  } catch (e) {
    throw new Error(`${label}: JSON parse failed — ${(e as Error).message}`);
  }
}

// ─── CRUD ────────────────────────────────────────────────────────────

export const listBriefingWorkspaces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("briefing_room_workspaces")
      .select("id, brand_name, category, status, updated_at, tensions")
      .eq("user_id", context.userId!)
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{
      id: string;
      brand_name: string;
      category: string;
      status: string;
      updated_at: string;
      tensions: Step4Output | null;
    }>;
  });

export const createBriefingWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        brandName: z.string().max(200).default(""),
        category: z.string().max(200).default(""),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("briefing_room_workspaces")
      .insert({
        user_id: context.userId!,
        brand_name: data.brandName,
        category: data.category,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (row as { id: string }).id };
  });

export const getBriefingWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => loadWorkspace(data.id, context.userId!));

export const updateBriefingIntake = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid(),
        brandName: z.string().max(200),
        category: z.string().max(200),
        rawBrief: z.string().max(50000),
        evidence: z.array(EvidenceSchema).max(20),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await loadWorkspace(data.id, context.userId!); // ownership check
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("briefing_room_workspaces")
      .update({
        brand_name: data.brandName,
        category: data.category,
        raw_brief: data.rawBrief,
        supporting_evidence: data.evidence,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteBriefingWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await loadWorkspace(data.id, context.userId!);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("briefing_room_workspaces")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setBriefingSelections = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid(),
        selectedFrame: z.enum(["problem", "opportunity", "both"]).nullable().optional(),
        selectedTensionIndex: z.number().int().min(0).max(10).nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await loadWorkspace(data.id, context.userId!);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: {
      selected_frame?: string | null;
      selected_tension_index?: number | null;
    } = {};
    if (data.selectedFrame !== undefined) patch.selected_frame = data.selectedFrame;
    if (data.selectedTensionIndex !== undefined)
      patch.selected_tension_index = data.selectedTensionIndex;
    const { error } = await supabaseAdmin
      .from("briefing_room_workspaces")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── STEP RUNNERS ────────────────────────────────────────────────────

async function requireIntake(ws: Awaited<ReturnType<typeof loadWorkspace>>) {
  if (!ws.raw_brief.trim() || ws.raw_brief.trim().length < 20) {
    throw new Error("Raw brief must be at least 20 characters before running diagnosis.");
  }
}

export const runBriefingStep1 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const ws = await loadWorkspace(data.id, context.userId!);
    await requireIntake(ws);
    const user = `${buildIntakeBlock({
      brandName: ws.brand_name,
      category: ws.category,
      rawBrief: ws.raw_brief,
      evidence: ws.supporting_evidence,
    })}\n\nProduce the Step 1 diagnostic JSON now.`;
    const parsed = await guardedStep<Step1Output>(data.id, "Step 1", {
      systemPrompt: STEP_1_SYSTEM,
      userMessage: user,
      maxTokens: 4000,
      skipUniversalWrapper: true,
    });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Downstream steps depend on Step 1 — clear them on re-run to avoid stale cascade.
    const { error } = await supabaseAdmin
      .from("briefing_room_workspaces")
      .update({
        diagnosis: parsed,
        truths: null,
        relevance: null,
        tensions: null,
        selected_tension_index: null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return parsed;
  });

export const runBriefingStep2 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const ws = await loadWorkspace(data.id, context.userId!);
    await requireIntake(ws);
    const user = `${buildIntakeBlock({
      brandName: ws.brand_name,
      category: ws.category,
      rawBrief: ws.raw_brief,
      evidence: ws.supporting_evidence,
    })}\n\nProduce the Step 2 truths JSON now.`;
    const parsed = await guardedStep<Step2Output>(data.id, "Step 2", {
      systemPrompt: STEP_2_SYSTEM,
      userMessage: user,
      maxTokens: 6000,
      skipUniversalWrapper: true,
    });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("briefing_room_workspaces")
      .update({ truths: parsed, relevance: null, tensions: null, selected_tension_index: null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return parsed;
  });

export const runBriefingStep3 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const ws = await loadWorkspace(data.id, context.userId!);
    if (!ws.diagnosis) throw new Error("Run Step 1 first.");
    if (!ws.truths) throw new Error("Run Step 2 first.");
    const user = `DIAGNOSIS (Step 1):
${JSON.stringify(ws.diagnosis, null, 2)}

TRUTHS (Step 2):
${JSON.stringify(ws.truths.truths, null, 2)}

Produce the Step 3 relevance JSON now.`;
    const parsed = await guardedStep<Step3Output>(data.id, "Step 3", {
      systemPrompt: STEP_3_SYSTEM,
      userMessage: user,
      maxTokens: 4000,
      skipUniversalWrapper: true,
    });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("briefing_room_workspaces")
      .update({ relevance: parsed, tensions: null, selected_tension_index: null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return parsed;
  });

export const runBriefingStep4 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const ws = await loadWorkspace(data.id, context.userId!);
    if (!ws.diagnosis) throw new Error("Run Step 1 first.");
    if (!ws.truths) throw new Error("Run Step 2 first.");
    if (!ws.relevance) throw new Error("Run Step 3 first.");
    const relevantIdx = new Set(
      ws.relevance.relevance.filter((r) => r.verdict === "relevant").map((r) => r.truth_index),
    );
    const relevantTruths: Array<Truth & { original_index: number }> = ws.truths.truths
      .map((t, i) => ({ ...t, original_index: i }))
      .filter((t) => relevantIdx.has(t.original_index));

    if (relevantTruths.length === 0) {
      const parsed: Step4Output = {
        candidate_tensions: [],
        no_tension_flag: true,
        no_tension_reason:
          "No truths survived the Step 3 relevance pass — nothing to collide against the real problem/opportunity. Add stronger evidence before proceeding.",
      };
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await supabaseAdmin
        .from("briefing_room_workspaces")
        .update({ tensions: parsed })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return parsed;
    }

    const user = `DIAGNOSIS (Step 1):
${JSON.stringify(ws.diagnosis, null, 2)}

RELEVANT TRUTHS ONLY (from Step 3 filter — indices below refer to these, not the full Step 2 list):
${JSON.stringify(relevantTruths, null, 2)}

Produce the Step 4 candidate tensions JSON now. Cite indices from the array above via "collided_truth_indices".`;
    const parsed = await guardedStep<Step4Output>(data.id, "Step 4", {
      systemPrompt: STEP_4_SYSTEM,
      userMessage: user,
      maxTokens: 4000,
      skipUniversalWrapper: true,
    });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("briefing_room_workspaces")
      .update({ tensions: parsed, selected_tension_index: null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return parsed;
  });

// ─── STEP 5 — HANDOFF PREVIEW ────────────────────────────────────────
// Composes the eleven-field BriefFields + brief_text (with load-bearing
// anchor block) that will be handed off. Pure preview — no DB writes.
// Step 6 (approve) runs on the client: saveBrief({fields, briefText}) →
// sessionStorage(PENDING_BRIEF_STORAGE_KEY) → navigate('/brief') → the
// existing structured editor takes over with one-click Save-and-Run.

export const getBriefingHandoffPreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<HandoffPayload> => {
    const ws = await loadWorkspace(data.id, context.userId!);

    // Extract the structured Intelligence Engine prebrief (when this workspace
    // was seeded from the Intelligence Lab) so must_include / must_avoid /
    // competitive_context / cultural_context can be mapped into their correct
    // Step-5 fields instead of being stranded in raw_brief.
    let prebrief: PrebriefForBriefingRoom | null = null;
    const researchDocs: Array<{ label: string; content: string }> = [];
    for (const ev of ws.supporting_evidence ?? []) {
      if (ev.type === "intelligence_prebrief_json" && typeof ev.content === "string") {
        try {
          prebrief = JSON.parse(ev.content) as PrebriefForBriefingRoom;
        } catch {
          /* ignore malformed prebrief blob */
        }
      }
      if (ev.type === "intelligence_research_input" && typeof ev.content === "string" && ev.content.trim()) {
        researchDocs.push({ label: ev.label || "(unlabelled)", content: ev.content });
      }
    }

    // Unified-context synthesis: the LLM generates ALL eleven brief fields
    // from the complete available context (raw brief + all research docs +
    // Intelligence Engine prebrief + Steps 1–4 outputs + selected frame +
    // selected tension). Every field is LLM-authored — no hardcoded
    // placeholders. On failure we fall through to derived fallbacks in
    // buildHandoffPayload so the payload is still non-blank.
    let llm_fields: NonNullable<WorkspaceForHandoff["llm_fields"]> | null = null;
    try {
      llm_fields = await synthesiseAllFields({
        brandName: ws.brand_name,
        category: ws.category,
        rawBrief: ws.raw_brief,
        researchDocs,
        diagnosis: ws.diagnosis,
        truths: ws.truths,
        relevance: ws.relevance,
        tensions: ws.tensions,
        selectedFrame: ws.selected_frame,
        selectedTensionIndex: ws.selected_tension_index,
        prebrief,
      });
    } catch (e) {
      // Non-fatal: derived fallbacks fire in buildHandoffPayload.
      const msg = (e as Error).message;
      llm_fields = {
        f5_tried_reason: `Unified-context synthesis failed: ${msg}`,
        f10_competitive_reason: `Unified-context synthesis failed: ${msg}`,
        f11_mandatories_reason: `Unified-context synthesis failed: ${msg}`,
      };
    }


    return buildHandoffPayload({
      brand_name: ws.brand_name,
      category: ws.category,
      diagnosis: ws.diagnosis,
      truths: ws.truths,
      relevance: ws.relevance,
      tensions: ws.tensions,
      selected_frame: ws.selected_frame,
      selected_tension_index: ws.selected_tension_index,
      prebrief,
      llm_fields,
    });
  });

// ─── Step 5 unified-context field synthesis ─────────────────────────
// One Claude call, strict JSON out, generating ALL eleven brief fields
// from the complete available context: raw brief + all six research
// documents (Primary Consumer, Brand Health, Competitive Audit, Cultural
// Trends, Audience Segmentation, BG Intel Pack) + Intelligence Engine
// prebrief (must_include, must_avoid, competitive_context,
// cultural_context, audience_context, creative_direction) + Step 1
// diagnosis (both frames + selected frame) + Step 2 truth set + Step 3
// relevance judgments + Step 4 selected tension verbatim.
//
// Discipline: AGGREGATOR + THINKER — never fabricate; ground every claim
// in the supplied context; when a field genuinely cannot be grounded,
// emit an empty string and a specific reason naming what was missing.

const STRATEGIC_OBJECTIVE_LIST = [
  "Launch",
  "Refresh (Packaging)",
  "Refresh (Campaign)",
  "Repositioning",
  "Defence",
  "Challenger",
  "Crisis Recovery",
  "Category Creation",
];

const STEP_5_UNIFIED_SYSTEM = `You are the Briefing Room's Step 5 field-population engine. Your job is to produce ALL ELEVEN brief fields (f1..f11) as complete, specific, human-ready drafts from the unified context supplied.

CORE DISCIPLINE — NON-NEGOTIABLE:
1. AGGREGATOR + THINKER. Ground every claim in the supplied context — raw brief, research documents, Intelligence Engine prebrief, or Steps 1–4 outputs. Do NOT invent competitors, statistics, campaigns, mandatories, restrictions, or facts that are absent from the context.
2. Every field must be a complete, human-ready draft in plain prose. No placeholders. No "edit before run" instructions. No "TBD". No empty strings unless truly ungroundable, in which case set the matching "*_reason" naming what document(s) were missing.
3. Where useful, tag inline citations "[source: <document label>]" or "[source: briefing_room_step_N]".
4. f2 (Strategic Objective) MUST be exactly one of these values: ${STRATEGIC_OBJECTIVE_LIST.join(", ")}. Choose the one that best matches the Step 1 selected frame and the diagnosed problem/opportunity shape.
5. f3 (Commercial Outcome) MUST be specific twelve-month targets — revenue indicator, trial rate, retention, consideration movement, share, or a proof-case milestone. Not a brand metric.
6. f4 (Primary Barrier) must name the barrier plainly. Do NOT restate the load-bearing tension here — a separate stage prepends it verbatim; write only the barrier itself.
7. f11 (Mandatories) — draw legal, brand, channel, regulatory mandatories from the research docs. Do NOT restate must_include / must_avoid here — a separate stage appends them verbatim; write only mandatories NOT already covered by the prebrief must_include/must_avoid lists.
8. Output STRICT JSON only. No markdown fences. First character must be '{'.

OUTPUT JSON SCHEMA (strict):
{
  "f1_brand": string,               // brand + product/service, 2–3 sentences
  "f2_objective": string,           // MUST be one of the STRATEGIC_OBJECTIVE_LIST values above
  "f3_outcome": string,             // specific 12-month commercial outcome
  "f4_barrier": string,             // single primary barrier prose
  "f5_tried": string,               // prior brand/marketing activity, or "" if not in docs
  "f5_tried_reason": string,        // required when f5_tried is ""
  "f6_audience": string,            // specific audience + belief/behaviour
  "f7_current_belief": string,      // what the audience currently believes
  "f8_desired_belief": string,      // the belief shift the strategy must achieve
  "f9_rtb": string,                 // reason to believe from product/brand/heritage truths
  "f10_competitive": string,        // competitor moves / category dynamic, or "" if not in docs
  "f10_competitive_reason": string, // required when f10_competitive is ""
  "f11_mandatories": string,        // legal/brand/channel mandatories NOT already in prebrief, or ""
  "f11_mandatories_reason": string  // required when f11_mandatories is ""
}`;

async function synthesiseAllFields(args: {
  brandName: string;
  category: string;
  rawBrief: string;
  researchDocs: Array<{ label: string; content: string }>;
  diagnosis: Step1Output | null;
  truths: Step2Output | null;
  relevance: Step3Output | null;
  tensions: Step4Output | null;
  selectedFrame: string | null;
  selectedTensionIndex: number | null;
  prebrief: PrebriefForBriefingRoom | null;
}): Promise<NonNullable<WorkspaceForHandoff["llm_fields"]>> {
  // Per-doc budget to keep the unified prompt within a sane window while
  // preserving the six-document context.
  const PER_DOC_LIMIT = 18_000;
  const docsBlock = args.researchDocs.length
    ? args.researchDocs
        .map((d, i) => {
          const trimmed = d.content.length > PER_DOC_LIMIT
            ? d.content.slice(0, PER_DOC_LIMIT) + "\n[…truncated for synthesis pass…]"
            : d.content;
          return `--- RESEARCH DOC #${i + 1} | label: ${d.label} ---\n${trimmed}\n--- END DOC #${i + 1} ---`;
        })
        .join("\n\n")
    : "(no raw research documents supplied)";

  const selectedTension =
    args.tensions &&
    !args.tensions.no_tension_flag &&
    typeof args.selectedTensionIndex === "number"
      ? args.tensions.candidate_tensions[args.selectedTensionIndex] ?? null
      : null;

  const rawBriefTrimmed = args.rawBrief.length > 30_000
    ? args.rawBrief.slice(0, 30_000) + "\n[…truncated…]"
    : args.rawBrief;

  const user = `BRAND: ${args.brandName || "(unspecified)"}
CATEGORY: ${args.category || "(unspecified)"}

RAW BRIEF (as supplied to the Briefing Room):
"""
${rawBriefTrimmed || "(empty)"}
"""

INTELLIGENCE ENGINE PREBRIEF (authoritative — must_include/must_avoid/competitive_context/cultural_context/audience/creative_territory_direction/strategic_anchor/tension):
${JSON.stringify(args.prebrief ?? null, null, 2)}

STEP 1 DIAGNOSIS (both frames + selected frame):
selected_frame: ${args.selectedFrame ?? "(none)"}
${JSON.stringify(args.diagnosis ?? null, null, 2)}

STEP 2 TRUTH SET (with source tags and discriminator/motivator/thorpe flags):
${JSON.stringify(args.truths ?? null, null, 2)}

STEP 3 RELEVANCE JUDGMENTS:
${JSON.stringify(args.relevance ?? null, null, 2)}

STEP 4 SELECTED TENSION (verbatim, load-bearing — cite in f4 context but do not restate the tension itself):
${JSON.stringify(selectedTension, null, 2)}

RAW RESEARCH DOCUMENTS (all six Intelligence Lab inputs when supplied):
${docsBlock}

Produce the unified Step 5 field JSON now. Every one of the eleven fields must be a complete human-ready draft grounded in the context above.`;

  const raw = await callClaude({
    systemPrompt: STEP_5_UNIFIED_SYSTEM,
    userMessage: user,
    maxTokens: 8000,
    skipUniversalWrapper: true,
  });
  return parseJson<NonNullable<WorkspaceForHandoff["llm_fields"]>>(raw, "Step 5 unified synthesis");
}

