// One-off verification script — runs the LOC orchestrator directly against
// a specified session using supabaseAdmin (bypasses the auth middleware and
// the Checkpoint-C lock, since this is a maintenance test invocation).
//
// Run with: bunx tsx scripts/loc-verify.ts <sessionId>
//
// Prints the assembled LOC markdown and writes results to the DB.

import { supabaseAdmin } from "../src/integrations/supabase/client.server";
import { callClaude } from "../src/lib/claude.server";
import { buildLocInputs, type WorkspaceInputSnapshot } from "../src/lib/loc/brief-extract";
import {
  LOC_CLASSIFIER_SYSTEM_PROMPT,
  buildLocClassifierUserMessage,
  parseClassifierOutput,
} from "../src/lib/loc/classifier-prompt";
import {
  buildEngineUserMessage,
  getEngineSystemPrompt,
  parseEngineOutput,
  type EngineOutput,
} from "../src/lib/loc/engine-prompts";
import {
  LOC_VALIDATION_SYSTEM_PROMPT,
  buildLocValidationUserMessage,
  parseLocValidation,
  type LocValidationResult,
} from "../src/lib/loc/validation-prompts";
import {
  renderLocFullMarkdown,
  type LocEnginePackage,
} from "../src/lib/loc/decision-package";
import type { EngineName } from "../src/lib/loc/task-types";

const ENGINES: EngineName[] = ["breach", "synect", "displace", "naive"];

async function main() {
  const sessionId = process.argv[2];
  const force = process.argv.includes("--force");
  if (!sessionId) {
    console.error("Usage: bunx tsx scripts/loc-verify.ts <sessionId> [--force]");
    process.exit(1);
  }

  const { data: session, error } = await supabaseAdmin
    .from("sessions")
    .select("brand_name, category, brief_text, user_id")
    .eq("id", sessionId)
    .single<{ brand_name: string; category: string; brief_text: string; user_id: string }>();
  if (error || !session) throw new Error(`Session not found: ${error?.message}`);

  const { data: locRow } = await supabaseAdmin
    .from("sessions")
    .select("loc_retry_count")
    .eq("id", sessionId)
    .single<{ loc_retry_count: number | null }>();

  const retryCount = force ? (locRow?.loc_retry_count ?? 0) + 1 : locRow?.loc_retry_count ?? 0;

  let workspace: WorkspaceInputSnapshot | null = null;
  const { data: wsRow } = await supabaseAdmin
    .from("briefing_room_workspaces")
    .select("truths, diagnosis, tensions, selected_tension_index, selected_frame")
    .eq("user_id", session.user_id)
    .eq("brand_name", session.brand_name)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (wsRow) workspace = wsRow as unknown as WorkspaceInputSnapshot;

  const inputs = buildLocInputs({
    brandName: session.brand_name,
    category: session.category,
    briefText: session.brief_text ?? "",
    workspace,
  });

  console.log(`[LOC] Brand: ${session.brand_name}`);
  console.log(`[LOC] Source: ${inputs.sourceNote}`);
  console.log(`[LOC] Anchored tension: ${inputs.anchoredTension.slice(0, 200)}...`);

  await supabaseAdmin
    .from("sessions")
    .update({ loc_status: "running", loc_error: null } as never)
    .eq("id", sessionId);

  try {
    console.log("[LOC] Running classifier...");
    const classifierRaw = await callClaude({
      systemPrompt: LOC_CLASSIFIER_SYSTEM_PROMPT,
      userMessage: buildLocClassifierUserMessage(inputs),
      maxTokens: 2000,
      sessionId,
      stageLabel: "LOC classifier",
      stageNumber: "9-loc-classify",
      stageName: "LOC classifier",
    });
    const classifier = parseClassifierOutput(classifierRaw);
    console.log(`[LOC] Task type: ${classifier.task_type} (runner-up: ${classifier.runner_up})`);

    await supabaseAdmin
      .from("sessions")
      .update({
        loc_task_type: classifier.task_type,
        loc_task_runner_up: classifier.runner_up,
        loc_classifier_rationale: classifier.rationale,
      } as never)
      .eq("id", sessionId);

    console.log("[LOC] Running 4 engines in parallel...");
    const engineResults = await Promise.all(
      ENGINES.map(async (engine) => {
        try {
          const systemPrompt = getEngineSystemPrompt(engine, sessionId, retryCount);
          const userMessage = buildEngineUserMessage({
            engine,
            taskType: classifier.task_type,
            inputs,
          });
          const raw = await callClaude({
            systemPrompt,
            userMessage,
            maxTokens: 8000,
            sessionId,
            stageLabel: `LOC ${engine}`,
            stageNumber: "9-loc",
            stageName: `LOC ${engine}`,
          });
          const out = parseEngineOutput(raw, engine);
          console.log(`[LOC] engine ${engine}: proposition="${out.proposition}"`);
          return { engine, output: out as EngineOutput | null, error: undefined as string | undefined };
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error(`[LOC] engine ${engine} FAILED: ${msg}`);
          return { engine, output: null, error: msg };
        }
      }),
    );

    const engineOutputsRecord: Record<string, unknown> = {};
    for (const r of engineResults) {
      engineOutputsRecord[r.engine] = r.output
        ? { ok: true, output: r.output }
        : { ok: false, error: r.error };
    }
    await supabaseAdmin
      .from("sessions")
      .update({ loc_engine_outputs: engineOutputsRecord } as never)
      .eq("id", sessionId);

    console.log("[LOC] Running validation per engine in parallel...");
    const validationResults = await Promise.all(
      engineResults.map(async (r) => {
        if (!r.output) return { engine: r.engine, validation: null, error: r.error };
        try {
          const raw = await callClaude({
            systemPrompt: LOC_VALIDATION_SYSTEM_PROMPT,
            userMessage: buildLocValidationUserMessage({
              inputs,
              engine: r.engine,
              engineOutput: r.output,
            }),
            maxTokens: 6000,
            sessionId,
            stageLabel: `LOC validate ${r.engine}`,
            stageNumber: "9-loc-val",
            stageName: `LOC validation ${r.engine}`,
          });
          const v = parseLocValidation(raw);
          return { engine: r.engine, validation: v as LocValidationResult | null, error: undefined as string | undefined };
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error(`[LOC] validation ${r.engine} FAILED: ${msg}`);
          return { engine: r.engine, validation: null, error: msg };
        }
      }),
    );

    const validationRecord: Record<string, unknown> = {};
    for (const v of validationResults) {
      validationRecord[v.engine] = v.validation
        ? { ok: true, validation: v.validation }
        : { ok: false, error: v.error };
    }

    const packages: LocEnginePackage[] = engineResults
      .filter((r) => r.output !== null)
      .map((r) => {
        const val = validationResults.find((v) => v.engine === r.engine);
        return {
          engine: r.engine,
          taskType: classifier.task_type,
          engineOutput: r.output as EngineOutput,
          validation: val?.validation ?? null,
          validationError: val?.error,
        };
      });

    const generatedAt = new Date().toISOString();
    const markdown = renderLocFullMarkdown({
      classifier,
      packages,
      retryCount,
      generatedAt,
      sourceNote: inputs.sourceNote,
    });

    const packagesJson = packages.map((p) => ({
      engine: p.engine,
      taskType: p.taskType,
      engineOutput: p.engineOutput,
      validation: p.validation,
      validationError: p.validationError ?? null,
    }));

    await supabaseAdmin
      .from("sessions")
      .update({
        loc_validation: validationRecord,
        loc_decision_packages: packagesJson,
        stage_9_leftofcentre_output: markdown,
        loc_status: "complete",
        loc_generated_at: generatedAt,
        loc_error: null,
        loc_retry_count: retryCount,
      } as never)
      .eq("id", sessionId);

    console.log("\n\n========= LOC MARKDOWN =========\n");
    console.log(markdown);
    console.log("\n========= END =========\n");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabaseAdmin
      .from("sessions")
      .update({ loc_status: "failed", loc_error: msg } as never)
      .eq("id", sessionId);
    console.error("[LOC] FAILED:", msg);
    process.exit(1);
  }
}

void main();
