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
import { buildHandoffPayload, type HandoffPayload } from "./briefing-room-handoff";

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
    const raw = await callClaude({
      systemPrompt: STEP_1_SYSTEM,
      userMessage: user,
      maxTokens: 4000,
      skipUniversalWrapper: true,
    });
    const parsed = parseJson<Step1Output>(raw, "Step 1");
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
    const raw = await callClaude({
      systemPrompt: STEP_2_SYSTEM,
      userMessage: user,
      maxTokens: 6000,
      skipUniversalWrapper: true,
    });
    const parsed = parseJson<Step2Output>(raw, "Step 2");
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
    const raw = await callClaude({
      systemPrompt: STEP_3_SYSTEM,
      userMessage: user,
      maxTokens: 4000,
      skipUniversalWrapper: true,
    });
    const parsed = parseJson<Step3Output>(raw, "Step 3");
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
    const raw = await callClaude({
      systemPrompt: STEP_4_SYSTEM,
      userMessage: user,
      maxTokens: 4000,
      skipUniversalWrapper: true,
    });
    const parsed = parseJson<Step4Output>(raw, "Step 4");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("briefing_room_workspaces")
      .update({ tensions: parsed, selected_tension_index: null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return parsed;
  });
