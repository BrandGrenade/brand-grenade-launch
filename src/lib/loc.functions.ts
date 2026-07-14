// Left-of-Centre orchestrator.
//
// Runs classifier -> 4 engines in parallel -> LOC validation per engine
// in parallel -> assembles decision packages -> writes to sessions.
//
// LOC fires at Briefing Room handoff time (same moment as Stage 1) in
// the background. Retries and manual "Generate LOC" for legacy sessions
// call the same server fn with force:true.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSessionOwner } from "@/lib/auth-helpers.server";
import { callClaude } from "./claude.server";
import { buildLocInputs, type WorkspaceInputSnapshot } from "./loc/brief-extract";
import {
  LOC_CLASSIFIER_SYSTEM_PROMPT,
  buildLocClassifierUserMessage,
  parseClassifierOutput,
} from "./loc/classifier-prompt";
import {
  buildEngineUserMessage,
  getEngineSystemPrompt,
  parseEngineOutput,
  type EngineOutput,
} from "./loc/engine-prompts";
import {
  LOC_VALIDATION_SYSTEM_PROMPT,
  buildLocValidationUserMessage,
  parseLocValidation,
  type LocValidationResult,
} from "./loc/validation-prompts";
import {
  renderLocFullMarkdown,
  type LocEnginePackage,
} from "./loc/decision-package";
import type { EngineName } from "./loc/task-types";

const RunInput = z.object({
  sessionId: z.string().uuid(),
  force: z.boolean().optional(),
});

const StatusInput = z.object({ sessionId: z.string().uuid() });

const ENGINES: EngineName[] = ["breach", "synect", "displace", "naive"];

async function runOneEngine(args: {
  engine: EngineName;
  sessionId: string;
  retryCount: number;
  inputs: ReturnType<typeof buildLocInputs>;
  taskType: import("./loc/task-types").LocTaskType;
}): Promise<{ engine: EngineName; output: EngineOutput | null; error?: string }> {
  try {
    const systemPrompt = getEngineSystemPrompt(args.engine, args.sessionId, args.retryCount);
    const userMessage = buildEngineUserMessage({
      engine: args.engine,
      taskType: args.taskType,
      inputs: args.inputs,
    });
    const raw = await callClaude({
      systemPrompt,
      userMessage,
      maxTokens: 8000,
      sessionId: args.sessionId,
      stageLabel: `LOC ${args.engine}`,
      stageNumber: "9-loc",
      stageName: `LOC ${args.engine}`,
    });
    const output = parseEngineOutput(raw, args.engine);
    return { engine: args.engine, output };
  } catch (e) {
    return {
      engine: args.engine,
      output: null,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

async function validateOneEngine(args: {
  sessionId: string;
  engine: EngineName;
  inputs: ReturnType<typeof buildLocInputs>;
  engineOutput: EngineOutput;
}): Promise<{ validation: LocValidationResult | null; error?: string }> {
  try {
    const raw = await callClaude({
      systemPrompt: LOC_VALIDATION_SYSTEM_PROMPT,
      userMessage: buildLocValidationUserMessage({
        inputs: args.inputs,
        engine: args.engine,
        engineOutput: args.engineOutput,
      }),
      maxTokens: 6000,
      sessionId: args.sessionId,
      stageLabel: `LOC validate ${args.engine}`,
      stageNumber: "9-loc-val",
      stageName: `LOC validation ${args.engine}`,
    });
    return { validation: parseLocValidation(raw) };
  } catch (e) {
    return { validation: null, error: e instanceof Error ? e.message : String(e) };
  }
}

export const runLeftOfCentre = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => RunInput.parse(i))
  .handler(async ({ data, context }) => {
    await assertSessionOwner(data.sessionId, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select("brand_name, category, brief_text, checkpoint_c_confirmed")
      .eq("id", data.sessionId)
      .single<{
        brand_name: string;
        category: string;
        brief_text: string;
        checkpoint_c_confirmed: boolean | null;
      }>();
    if (error || !session) {
      throw new Error(`LOC: session not found: ${error?.message ?? "no row"}`);
    }

    // Read current LOC state via raw fetch (new columns may not yet be in
    // the generated types.ts).
    const { data: locRow } = await supabaseAdmin
      .from("sessions")
      .select("loc_status, loc_retry_count, updated_at")
      .eq("id", data.sessionId)
      .single<{ loc_status: string | null; loc_retry_count: number | null; updated_at: string | null }>();

    if (session.checkpoint_c_confirmed) {
      throw new Error("LOC is locked: Checkpoint C already confirmed for this session.");
    }
    if (!data.force && locRow?.loc_status === "complete") {
      return { alreadyComplete: true, sessionId: data.sessionId };
    }
    if (locRow?.loc_status === "running") {
      // Block concurrent runs: even with force, if the current run touched
      // the row within the last 5 minutes, treat it as still in flight.
      const lastTouch = locRow.updated_at ? Date.parse(locRow.updated_at) : 0;
      const staleMs = Date.now() - lastTouch;
      if (!data.force || staleMs < 5 * 60 * 1000) {
        return { alreadyRunning: true, sessionId: data.sessionId, staleMs };
      }
    }

    const retryCount = data.force ? (locRow?.loc_retry_count ?? 0) + 1 : locRow?.loc_retry_count ?? 0;

    // Look up the Briefing Room workspace (best-effort) to get UNFILTERED
    // Step 2 truths and the raw Step 4 tension. Falls back to brief_text.
    let workspace: WorkspaceInputSnapshot | null = null;
    try {
      const { data: wsRow } = await supabaseAdmin
        .from("briefing_room_workspaces")
        .select("truths, diagnosis, tensions, selected_tension_index, selected_frame")
        .eq("user_id", context.userId)
        .eq("brand_name", session.brand_name)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (wsRow) workspace = wsRow as unknown as WorkspaceInputSnapshot;
    } catch {
      workspace = null;
    }

    const inputs = buildLocInputs({
      brandName: session.brand_name,
      category: session.category,
      briefText: session.brief_text ?? "",
      workspace,
    });

    // Mark running (and wipe stale outputs if forcing).
    await supabaseAdmin
      .from("sessions")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({
        loc_status: "running",
        loc_error: null,
        ...(data.force
          ? {
              loc_engine_outputs: null,
              loc_validation: null,
              loc_decision_packages: null,
              loc_task_type: null,
              loc_task_runner_up: null,
              loc_classifier_rationale: null,
              stage_9_leftofcentre_output: null,
              loc_retry_count: retryCount,
            }
          : {}),
      } as never)
      .eq("id", data.sessionId);

    try {
      // 1. Classifier.
      const classifierRaw = await callClaude({
        systemPrompt: LOC_CLASSIFIER_SYSTEM_PROMPT,
        userMessage: buildLocClassifierUserMessage(inputs),
        maxTokens: 2000,
        sessionId: data.sessionId,
        stageLabel: "LOC classifier",
        stageNumber: "9-loc-classify",
        stageName: "LOC classifier",
      });
      const classifier = parseClassifierOutput(classifierRaw);

      await supabaseAdmin
        .from("sessions")
        .update({
          loc_task_type: classifier.task_type,
          loc_task_runner_up: classifier.runner_up,
          loc_classifier_rationale: classifier.rationale,
        } as never)
        .eq("id", data.sessionId);

      // 2. All four engines in parallel.
      const engineResults = await Promise.all(
        ENGINES.map((engine) =>
          runOneEngine({
            engine,
            sessionId: data.sessionId,
            retryCount,
            inputs,
            taskType: classifier.task_type,
          }),
        ),
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
        .eq("id", data.sessionId);

      // 3. Validation per engine (parallel), skip engines that failed or
      //    produced no proposition and no working.
      const validationResults = await Promise.all(
        engineResults.map(async (r) => {
          if (!r.output) return { engine: r.engine, validation: null, error: r.error };
          const v = await validateOneEngine({
            sessionId: data.sessionId,
            engine: r.engine,
            inputs,
            engineOutput: r.output,
          });
          return { engine: r.engine, validation: v.validation, error: v.error };
        }),
      );

      const validationRecord: Record<string, unknown> = {};
      for (const v of validationResults) {
        validationRecord[v.engine] = v.validation
          ? { ok: true, validation: v.validation }
          : { ok: false, error: v.error };
      }

      // Persist validation immediately so a later timeout during assembly
      // does not lose the expensive Claude calls above.
      await supabaseAdmin
        .from("sessions")
        .update({ loc_validation: validationRecord } as never)
        .eq("id", data.sessionId);

      // 4. Assemble decision packages.
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
        .eq("id", data.sessionId);

      return {
        ok: true,
        sessionId: data.sessionId,
        taskType: classifier.task_type,
        engineCount: packages.length,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await supabaseAdmin
        .from("sessions")
        .update({ loc_status: "failed", loc_error: msg } as never)
        .eq("id", data.sessionId);
      throw new Error(`LOC generation failed: ${msg}`);
    }
  });

export const getLocStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => StatusInput.parse(i))
  .handler(async ({ data, context }) => {
    await assertSessionOwner(data.sessionId, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("sessions")
      .select("loc_status, loc_error, loc_task_type, loc_task_runner_up, loc_retry_count, loc_generated_at, checkpoint_c_confirmed")
      .eq("id", data.sessionId)
      .single();
    if (error) throw new Error(`getLocStatus: ${error.message}`);
    return row;
  });

// Recovers a run whose expensive Claude work landed in the DB but whose
// final assembly write was lost (Worker CPU/wall timeout after step 3).
// Re-derives markdown + decision packages purely from persisted state —
// no Claude calls, so it always fits in a single request.
export const finalizeLeftOfCentre = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => StatusInput.parse(i))
  .handler(async ({ data, context }) => {
    await assertSessionOwner(data.sessionId, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("sessions")
      .select("loc_status, loc_engine_outputs, loc_validation, loc_task_type, loc_task_runner_up, loc_classifier_rationale, loc_retry_count, checkpoint_c_confirmed")
      .eq("id", data.sessionId)
      .single<{
        loc_status: string | null;
        loc_engine_outputs: Record<string, { ok: boolean; output?: EngineOutput; error?: string }> | null;
        loc_validation: Record<string, { ok: boolean; validation?: LocValidationResult; error?: string }> | null;
        loc_task_type: string | null;
        loc_task_runner_up: string | null;
        loc_classifier_rationale: string | null;
        loc_retry_count: number | null;
        checkpoint_c_confirmed: boolean | null;
      }>();
    if (error || !row) throw new Error(`finalizeLoc: session not found: ${error?.message ?? "no row"}`);
    if (row.checkpoint_c_confirmed) throw new Error("LOC locked: Checkpoint C confirmed.");
    if (row.loc_status === "complete") return { alreadyComplete: true };
    if (!row.loc_engine_outputs || !row.loc_validation) {
      throw new Error("finalizeLoc: no persisted engine or validation data — run LOC first.");
    }

    const engineOutputs = row.loc_engine_outputs;
    const validation = row.loc_validation;
    const taskType = (row.loc_task_type ?? "sales-decline") as import("./loc/task-types").LocTaskType;

    const packages: LocEnginePackage[] = ENGINES
      .filter((e) => engineOutputs[e]?.ok && engineOutputs[e]?.output)
      .map((e) => ({
        engine: e,
        taskType,
        engineOutput: engineOutputs[e]!.output as EngineOutput,
        validation: validation[e]?.ok ? (validation[e]!.validation as LocValidationResult) : null,
        validationError: validation[e]?.ok ? undefined : validation[e]?.error,
      }));

    if (packages.length === 0) throw new Error("finalizeLoc: no successful engine outputs to assemble.");

    const generatedAt = new Date().toISOString();
    const markdown = renderLocFullMarkdown({
      classifier: {
        task_type: taskType,
        runner_up: (row.loc_task_runner_up ?? null) as import("./loc/task-types").LocTaskType | null,
        rationale: row.loc_classifier_rationale ?? "",
      },
      packages,
      retryCount: row.loc_retry_count ?? 0,
      generatedAt,
      sourceNote: "recovered from persisted engine + validation state",
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
        loc_decision_packages: packagesJson,
        stage_9_leftofcentre_output: markdown,
        loc_status: "complete",
        loc_generated_at: generatedAt,
        loc_error: null,
      } as never)
      .eq("id", data.sessionId);

    return { ok: true, recovered: true, engineCount: packages.length };
  });
