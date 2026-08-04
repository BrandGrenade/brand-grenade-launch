import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { streamClaude } from "./claude.server";
import { STAGE_1_SYSTEM_PROMPT, buildStage1UserMessage } from "./stage1-prompt";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSessionAccess } from "@/lib/auth-helpers.server";
import { findBannedWordHits, generateWithBannedWordGate, type OutputGateMode } from "./output-banned-word-gate";

const BriefFieldsSchema = z
  .object({
    briefTitle: z.string().max(500).default(""),
    brandName: z.string().max(500).default(""),
    category: z.string().max(500).default(""),
    date: z.string().max(40).default(""),
    submittedBy: z.string().max(500).default(""),
    sections: z.record(z.string(), z.string().max(20000)).default({}),
    supportingMaterials: z.array(z.string().max(500)).default([]),
  })
  .optional();

const CreateSessionInput = z.object({
  brandName: z.string().min(1).max(200),
  category: z.string().min(1).max(200),
  briefText: z.string().min(20).max(50000),
  devMode: z.boolean().optional(),
  briefFields: BriefFieldsSchema,
});

export const createSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => CreateSessionInput.parse(input))
  .handler(async ({ data, context }) => {
    const briefVersions = data.briefFields
      ? [
          {
            version: 1,
            fields: data.briefFields,
            submitted_at: new Date().toISOString(),
          },
        ]
      : [];
    const { data: row, error } = await supabaseAdmin
      .from("sessions")
      .insert({
        brand_name: data.brandName,
        category: data.category,
        brief_text: data.briefText,
        brief_versions: briefVersions,
        status: "running",
        current_stage: 1,
        dev_mode: data.devMode ?? false,
        user_id: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(`Failed to create session: ${error.message}`);
    return { sessionId: row.id as string };
  });



const RunStage1Input = z.object({
  sessionId: z.string().uuid(),
  feedback: z.string().max(10000).optional(),
  previousOutput: z.string().max(50000).optional(),
});

const STAGE_1_POISON_WORDS = [
  "transformation", "transform", "journey", "authentic", "authenticity", "empower", "empowerment",
  "innovative", "innovation", "seamless", "ecosystem", "synergy", "holistic", "purpose-driven",
  "storytelling", "engage", "engagement", "disrupt", "disruption", "community", "passion", "passionate",
  "best-in-class", "world-class", "cutting-edge", "next-level", "reimagine", "reimagining",
] as const;

async function collectClaudeText(args: Parameters<typeof streamClaude>[0]): Promise<string> {
  let text = "";
  for await (const delta of streamClaude(args)) text += delta;
  return text;
}

function extractTensionScore(text: string): number | null {
  const m = text.match(/Strategic\s+Tension\s+Score\s*[:\-]?\s*\**\s*(\d{1,2})\s*\/\s*10/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) && n >= 1 && n <= 10 ? n : null;
}

export const runStage1 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => RunStage1Input.parse(input))
  .handler(async function* ({ data, context }) {
    await assertSessionAccess(data.sessionId, context.userId);
    const { data: session, error: loadErr } = await supabaseAdmin
      .from("sessions")
      .select("brand_name, category, brief_text, stage_1_output, brief_versions, is_preflight_test")
      .eq("id", data.sessionId)
      .single();
    if (loadErr || !session) throw new Error(`Session not found: ${loadErr?.message ?? "no row"}`);

    const feedback = data.feedback?.trim();

    // Stage 1B gate: fires ONLY when one or more of the nine mandatory brief
    // sections (8 structured sections + supporting materials) is completely
    // empty. Tension score is NEVER used to gate Stage 1B.
    const stage1bRequired = computeStage1bRequiredFromBrief(session.brief_versions);

    if (session.stage_1_output && !feedback) {
      const score = extractTensionScore(session.stage_1_output);
      yield { delta: session.stage_1_output };
      yield {
        done: true as const,
        output: session.stage_1_output,
        tensionScore: score,
        stage1bRequired,
      };
      return;
    }

    const previousOutput = data.previousOutput?.trim() || session.stage_1_output || null;

    if (feedback) {
      await supabaseAdmin
        .from("sessions")
        .update({ stage_1_output: null, stage_1_tension_score: null, stage_1_error: null })
        .eq("id", data.sessionId);
    }

    let userMessage = buildStage1UserMessage({
      brandName: session.brand_name,
      category: session.category,
      briefText: session.brief_text,
    });
    if (feedback) {
      const { buildFeedbackInjection } = await import("./feedback-injection");
      const { prefix, suffix } = buildFeedbackInjection({
        feedback,
        previousOutput,
        stageLabel: "Stage 1 — Brief Analysis",
      });
      userMessage = `${prefix}${userMessage}${suffix}`;
    }


    let output = "";
    try {
      const mode: OutputGateMode = session.is_preflight_test === true ? "test" : "live";
      const gated = await generateWithBannedWordGate({
        stageLabel: "Stage 1",
        columnLabel: "stage_1_output",
        mode,
        maxAttempts: 3,
        validate: (text) =>
          findBannedWordHits({
            text,
            terms: STAGE_1_POISON_WORDS,
            rule: "stage1-poison-words",
            stageLabel: "Stage 1",
            columnLabel: "stage_1_output",
          }),
        generate: (attempt, retryNote) =>
          collectClaudeText({
            systemPrompt: STAGE_1_SYSTEM_PROMPT,
            userMessage: `${userMessage}${retryNote ?? ""}`,
            maxTokens: 64000,
            sessionId: data.sessionId,
            stageLabel: attempt === 1 ? "Stage 1" : `Stage 1 (sanitiser retry ${attempt})`,
            stageNumber: "1",
            stageName: "Brief Analysis",
          }),
      });
      output = gated.output;
      yield { delta: output };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Stage 1 failed";
      await supabaseAdmin.from("sessions").update({ stage_1_error: msg }).eq("id", data.sessionId);
      throw e instanceof Error ? e : new Error(msg);
    }

    const tensionScore = extractTensionScore(output);
    // NOTE: stage1bRequired is determined purely by brief completeness above.
    // The tension score is informational only and never gates Stage 1B.

    let lastSaveErr: { message: string } | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const { error } = await supabaseAdmin
        .from("sessions")
        .update({
          stage_1_output: output,
          stage_1_tension_score: tensionScore,
          stage_1b_required: stage1bRequired,
          stage_1_error: null,
          stage_status: "complete:1",
        })
        .eq("id", data.sessionId);
      if (!error) { lastSaveErr = null; break; }
      lastSaveErr = error;
      console.error(`[stage1] save attempt ${attempt + 1} failed: ${error.message}`);
      if (attempt < 2) await new Promise((r) => setTimeout(r, 5000));
    }
    if (lastSaveErr) throw new Error(`Failed to save Stage 1 output after 3 attempts: ${lastSaveErr.message}`);

    yield { done: true as const, output, tensionScore, stage1bRequired };
  });

// Returns true iff one or more of the ten MANDATORY brief fields is empty.
// The eleven structured fields map 1:1 to BRIEF_SECTIONS; field 11
// (Mandatories and Never-Says) is optional and never gates Stage 1B.
// If the session has no structured brief_versions (legacy plain-text brief),
// the gate is OFF — Stage 1 always advances.
function computeStage1bRequiredFromBrief(briefVersions: unknown): boolean {
  if (!Array.isArray(briefVersions) || briefVersions.length === 0) return false;
  const latest = briefVersions[briefVersions.length - 1] as { fields?: { sections?: Record<string, string> } } | undefined;
  const fields = latest?.fields;
  if (!fields) return false;
  const sections = fields.sections ?? {};
  const mandatoryKeys = [
    "f1_brand",
    "f2_objective",
    "f3_outcome",
    "f4_barrier",
    "f5_tried",
    "f6_audience",
    "f7_current_belief",
    "f8_desired_belief",
    "f9_rtb",
    "f10_competitive",
  ];
  for (const k of mandatoryKeys) {
    if ((sections[k] ?? "").trim().length === 0) return true;
  }
  return false;
}
