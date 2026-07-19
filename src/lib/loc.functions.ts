// Left-of-Centre orchestrator — nine-engine rebuild.
//
// Fires nine engines in parallel. Each engine returns exactly one
// proposition line + one-sentence descriptor. No classifier. No
// validation. No courage assessment. No credible path.
//
// All existing LOC database columns, status handling, and retry logic
// are preserved. Validation-related columns are written as null.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSessionOwner } from "@/lib/auth-helpers.server";
import { callClaude } from "./claude.server";
import { buildLocInputs, type WorkspaceInputSnapshot } from "./loc/brief-extract";
import {
  abstractStrategicOpportunity,
  buildEngineUserMessage,
  getEngineSystemPrompt,
  parseEngineOutput,
  type EngineOutput,
} from "./loc/engine-prompts";
import {
  renderLocFullMarkdown,
  type LocEnginePackage,
} from "./loc/decision-package";
import { LOC_ENGINES, type EngineName } from "./loc/task-types";
import { runValidationPass, type EngineValidationEntry } from "./loc/validation";

const RunInput = z.object({
  sessionId: z.string().uuid(),
  force: z.boolean().optional(),
  retryInstructions: z.string().max(8000).optional(),
  keepEngines: z.array(z.enum(LOC_ENGINES as unknown as [EngineName, ...EngineName[]])).optional(),
});

const StatusInput = z.object({ sessionId: z.string().uuid() });

async function runOneEngine(args: {
  engine: EngineName;
  sessionId: string;
  inputs: ReturnType<typeof buildLocInputs>;
  retryInstructions?: string;
  abstractOpportunity?: string;
}): Promise<{ engine: EngineName; output: EngineOutput | null; error?: string }> {
  try {
    const systemPrompt = getEngineSystemPrompt(args.engine);
    const userMessage = buildEngineUserMessage({
      engine: args.engine,
      inputs: args.inputs,
      retryInstructions: args.retryInstructions,
      abstractOpportunity: args.abstractOpportunity,
    });
    const raw = await callClaude({
      systemPrompt,
      userMessage,
      maxTokens: 4000,
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

    const { data: locRow } = await supabaseAdmin
      .from("sessions")
      .select("loc_status, loc_retry_count, loc_generated_at, loc_engine_outputs")
      .eq("id", data.sessionId)
      .single<{
        loc_status: string | null;
        loc_retry_count: number | null;
        loc_generated_at: string | null;
        loc_engine_outputs: Record<string, { ok: boolean; output?: EngineOutput; error?: string }> | null;
      }>();

    if (session.checkpoint_c_confirmed) {
      throw new Error("LOC is locked: Checkpoint C already confirmed for this session.");
    }
    if (!data.force && locRow?.loc_status === "complete") {
      return { alreadyComplete: true, sessionId: data.sessionId };
    }
    if (locRow?.loc_status === "running") {
      const lastTouch = locRow.loc_generated_at ? Date.parse(locRow.loc_generated_at) : 0;
      const staleMs = Date.now() - lastTouch;
      if (!data.force && staleMs < 5 * 60 * 1000) {
        return { alreadyRunning: true, sessionId: data.sessionId, staleMs };
      }
    }

    const retryCount = data.force ? (locRow?.loc_retry_count ?? 0) + 1 : locRow?.loc_retry_count ?? 0;
    const keepSet = new Set<EngineName>(data.keepEngines ?? []);
    const priorOutputs = locRow?.loc_engine_outputs ?? {};

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

    // Mark running (and wipe stale outputs if forcing, unless engine is in keep set).
    const preservedOutputs: Record<string, unknown> = {};
    if (data.force && keepSet.size > 0) {
      for (const e of keepSet) {
        if (priorOutputs[e]?.ok) preservedOutputs[e] = priorOutputs[e];
      }
    }
    await supabaseAdmin
      .from("sessions")
      .update({
        loc_status: "running",
        loc_error: null,
        ...(data.force
          ? {
              loc_engine_outputs: keepSet.size > 0 ? preservedOutputs : null,
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
      // Fire engines in parallel — skip any engine the user asked to keep.
      const enginesToRun = LOC_ENGINES.filter((e) => !keepSet.has(e));
      const engineResults = await Promise.all(
        enginesToRun.map((engine) =>
          runOneEngine({
            engine,
            sessionId: data.sessionId,
            inputs,
            retryInstructions: data.retryInstructions,
          }),
        ),
      );

      const engineOutputsRecord: Record<string, unknown> = { ...preservedOutputs };
      for (const r of engineResults) {
        engineOutputsRecord[r.engine] = r.output
          ? { ok: true, output: r.output }
          : { ok: false, error: r.error };
      }

      await supabaseAdmin
        .from("sessions")
        .update({ loc_engine_outputs: engineOutputsRecord } as never)
        .eq("id", data.sessionId);

      // Include kept engines' prior outputs in the successful set.
      const keptSuccessful = Array.from(keepSet)
        .map((e) => {
          const prior = priorOutputs[e];
          return prior?.ok && prior.output
            ? { engine: e, output: prior.output as EngineOutput }
            : null;
        })
        .filter((x): x is { engine: EngineName; output: EngineOutput } => x !== null);

      const successful = [
        ...keptSuccessful,
        ...engineResults.filter(
          (r): r is { engine: EngineName; output: EngineOutput } => r.output !== null,
        ),
      ];

      if (successful.length === 0) {
        throw new Error("All LOC engines failed to return output.");
      }

      // Six-dimension validation pass across all successful engines.
      let validationEntries: EngineValidationEntry[] = [];
      let validationError: string | null = null;
      try {
        validationEntries = await runValidationPass({
          sessionId: data.sessionId,
          brandName: session.brand_name,
          category: session.category,
          engineOutputs: successful,
        });
      } catch (ve) {
        validationError = ve instanceof Error ? ve.message : String(ve);
      }
      const validationByEngine = new Map(
        validationEntries.map((v) => [v.engine, v]),
      );

      const packages: LocEnginePackage[] = successful.map((r) => ({
        engine: r.engine,
        engineOutput: r.output,
        validation: null,
      }));

      const generatedAt = new Date().toISOString();
      const markdown = renderLocFullMarkdown({
        packages,
        retryCount,
        generatedAt,
        sourceNote: inputs.sourceNote,
      });

      const packagesJson = packages.map((p) => {
        const v = validationByEngine.get(p.engine);
        return {
          engine: p.engine,
          engineOutput: p.engineOutput,
          validation: v?.score ?? null,
          validationError: v?.error ?? null,
        };
      });

      await supabaseAdmin
        .from("sessions")
        .update({
          loc_validation: {
            generatedAt,
            error: validationError,
            entries: validationEntries,
          },
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

// Recovers a run whose engine outputs landed in the DB but whose final
// assembly write was lost. Re-derives markdown + decision packages from
// persisted engine outputs — no Claude calls.
export const finalizeLeftOfCentre = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => StatusInput.parse(i))
  .handler(async ({ data, context }) => {
    await assertSessionOwner(data.sessionId, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("sessions")
      .select("loc_status, loc_engine_outputs, loc_retry_count, checkpoint_c_confirmed")
      .eq("id", data.sessionId)
      .single<{
        loc_status: string | null;
        loc_engine_outputs: Record<string, { ok: boolean; output?: EngineOutput; error?: string }> | null;
        loc_retry_count: number | null;
        checkpoint_c_confirmed: boolean | null;
      }>();
    if (error || !row) throw new Error(`finalizeLoc: session not found: ${error?.message ?? "no row"}`);
    if (row.checkpoint_c_confirmed) throw new Error("LOC locked: Checkpoint C confirmed.");
    if (row.loc_status === "complete") return { alreadyComplete: true };
    if (!row.loc_engine_outputs) {
      throw new Error("finalizeLoc: no persisted engine data — run LOC first.");
    }

    const engineOutputs = row.loc_engine_outputs;

    const packages: LocEnginePackage[] = LOC_ENGINES
      .filter((e) => engineOutputs[e]?.ok && engineOutputs[e]?.output)
      .map((e) => ({
        engine: e,
        engineOutput: engineOutputs[e]!.output as EngineOutput,
        validation: null,
      }));

    if (packages.length === 0) throw new Error("finalizeLoc: no successful engine outputs to assemble.");

    const generatedAt = new Date().toISOString();
    const markdown = renderLocFullMarkdown({
      packages,
      retryCount: row.loc_retry_count ?? 0,
      generatedAt,
      sourceNote: "recovered from persisted engine outputs",
    });

    const packagesJson = packages.map((p) => ({
      engine: p.engine,
      engineOutput: p.engineOutput,
      validation: null,
      validationError: null,
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
