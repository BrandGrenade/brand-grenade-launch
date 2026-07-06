import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSessionOwner } from "@/lib/auth-helpers.server";

type StageId =
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
  | "16";

/**
 * Resets a stage so the runner re-executes from scratch.
 * Clears both the cached output AND the error so the server-side
 * "if (existing output) return it" short-circuit no longer applies.
 */
export const resetStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        sessionId: z.string().uuid(),
        stageId: z.enum([
          "1",
          "1b",
          "2",
          "3",
          "4",
          "4b",
          "5",
          "6",
          "7",
          "8",
          "9",
          "10",
          "11",
          "12",
          "13",
          "13b",
          "14",
          "14b",
          "14c",
          "15",
          "16",
        ]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSessionOwner(data.sessionId, context.userId);
    const id = data.stageId as StageId;
    const baseFields = {
      status: "running" as const,
      stage_status: `running:${id}`,
      retry_status: null as string | null,
      stream_last_delta_at: null as string | null,
    };
    switch (id) {
      case "1":
        await supabaseAdmin
          .from("sessions")
          .update({ ...baseFields, stage_1_output: null, stage_1_error: null })
          .eq("id", data.sessionId);
        break;
      case "1b":
        await supabaseAdmin
          .from("sessions")
          .update({ ...baseFields, stage_1b_output: null, stage_1_error: null })
          .eq("id", data.sessionId);
        break;
      case "2":
        await supabaseAdmin
          .from("sessions")
          .update({ ...baseFields, stage_2_output: null, stage_2_error: null })
          .eq("id", data.sessionId);
        break;
      case "3":
        await supabaseAdmin
          .from("sessions")
          .update({ ...baseFields, stage_3_output: null, stage_3_error: null })
          .eq("id", data.sessionId);
        break;
      case "4":
        await supabaseAdmin
          .from("sessions")
          .update({ ...baseFields, stage_4_output: null, stage_4_error: null })
          .eq("id", data.sessionId);
        break;
      case "4b":
        await supabaseAdmin
          .from("sessions")
          .update({ ...baseFields, stage_4b_output: null, stage_4b_error: null })
          .eq("id", data.sessionId);
        break;
      case "5":
        await supabaseAdmin
          .from("sessions")
          .update({ ...baseFields, stage_5_output: null, stage_5_error: null })
          .eq("id", data.sessionId);
        break;
        await supabaseAdmin
          .from("sessions")
          .update({ ...baseFields, stage_5_output: null, stage_5_error: null })
          .eq("id", data.sessionId);
        break;
      case "6":
        await supabaseAdmin
          .from("sessions")
          .update({ ...baseFields, stage_6_output: null, stage_6_error: null })
          .eq("id", data.sessionId);
        break;
      case "7":
        await supabaseAdmin
          .from("sessions")
          .update({ ...baseFields, stage_7_output: null, stage_7_error: null })
          .eq("id", data.sessionId);
        break;
      case "8":
        await supabaseAdmin
          .from("sessions")
          .update({ ...baseFields, stage_8_output: null, stage_8_error: null })
          .eq("id", data.sessionId);
        break;
      case "9":
        await supabaseAdmin
          .from("sessions")
          .update({ ...baseFields, stage_9_output: null, stage_9_leftofcentre_output: null, stage_9_error: null } as never)
          .eq("id", data.sessionId);
        break;
      case "10":
        await supabaseAdmin
          .from("sessions")
          .update({ ...baseFields, stage_10_output: null, stage_10_error: null })
          .eq("id", data.sessionId);
        break;
      case "11":
        await supabaseAdmin
          .from("sessions")
          .update({ ...baseFields, stage_11_output: null, stage_11_error: null })
          .eq("id", data.sessionId);
        break;
      case "12":
        await supabaseAdmin
          .from("sessions")
          .update({ ...baseFields, stage_12_output: null, stage_12_error: null })
          .eq("id", data.sessionId);
        break;
      case "13":
        await supabaseAdmin
          .from("sessions")
          .update({ ...baseFields, stage_13_output: null, stage_13_error: null })
          .eq("id", data.sessionId);
        break;
      case "13b":
        await supabaseAdmin
          .from("sessions")
          .update({ ...baseFields, stage_13b_output: null, stage_13b_error: null })
          .eq("id", data.sessionId);
        break;
      case "14":
        await supabaseAdmin
          .from("sessions")
          .update({ ...baseFields, stage_14_output: null, stage_14_error: null })
          .eq("id", data.sessionId);
        break;
      case "14b":
        await supabaseAdmin
          .from("sessions")
          .update({ ...baseFields, stage_14b_output: null, stage_14b_error: null })
          .eq("id", data.sessionId);
        break;
      case "14c":
        await supabaseAdmin
          .from("sessions")
          .update({ ...baseFields, stage_14c_output: null, stage_14c_error: null })
          .eq("id", data.sessionId);
        break;
      case "15":
        await supabaseAdmin
          .from("sessions")
          .update({ ...baseFields, stage_15_output: null, stage_15_error: null })
          .eq("id", data.sessionId);
        break;
      case "16":
        await supabaseAdmin
          .from("sessions")
          .update({
            ...baseFields,
            stage_16_consulting_output: null,
            stage_16_agency_output: null,
            stage_16_workshop_output: null,
            stage_16_vision_output: null,
            stage_16_error: null,
          } as never)
          .eq("id", data.sessionId);
        break;
    }
    return { ok: true };
  });

const stageClearFields: Record<StageId, Record<string, null>> = {
  "1": { stage_1_output: null, stage_1_error: null, stage_1_tension_score: null },
  "1b": { stage_1b_output: null, stage_1_error: null },
  "2": { stage_2_output: null, stage_2_error: null },
  "3": { stage_3_output: null, stage_3_error: null },
  "4": { stage_4_output: null, stage_4_error: null },
  "4b": { stage_4b_output: null, stage_4b_error: null },
  "5": { stage_5_output: null, stage_5_error: null },
  "6": { stage_6_output: null, stage_6_error: null },
  "7": { stage_7_output: null, stage_7_error: null },
  "8": { stage_8_output: null, stage_8_error: null },
  "9": { stage_9_output: null, stage_9_leftofcentre_output: null, stage_9_error: null },
  "10": { stage_10_output: null, stage_10_error: null },
  "11": { stage_11_output: null, stage_11_error: null },
  "12": { stage_12_output: null, stage_12_error: null, stage_12_smps: null },
  "13": { stage_13_output: null, stage_13_error: null, stage_13_verdict: null },
  "13b": { stage_13b_output: null, stage_13b_error: null },
  "14": { stage_14_output: null, stage_14_error: null },
  "14b": { stage_14b_output: null, stage_14b_error: null },
  "14c": { stage_14c_output: null, stage_14c_error: null },
  "15": { stage_15_output: null, stage_15_error: null, stage_15_clearance_status: null },
  "16": {
    stage_16_consulting_output: null,
    stage_16_agency_output: null,
    stage_16_workshop_output: null,
    stage_16_vision_output: null,
    stage_16_error: null,
  },
};

// Derived from the canonical STAGE_MANIFEST — Phase 1 only (retry+cascade
// applies to stages 1–16). Verified byte-for-byte identical to the previous
// hand-maintained stageOrder; the sub-stage positions are preserved.
import { STAGE_MANIFEST } from "./pipeline-integrity";
const stageOrder: StageId[] = STAGE_MANIFEST
  .filter((e) => e.phase === 1)
  .map((e) => e.id as StageId);

export const resetStageCascade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        sessionId: z.string().uuid(),
        stageId: z.enum([
          "1",
          "1b",
          "2",
          "3",
          "4",
          "4b",
          "5",
          "6",
          "7",
          "8",
          "9",
          "10",
          "11",
          "12",
          "13",
          "13b",
          "14",
          "14b",
          "14c",
          "15",
          "16",
        ]),
        feedback: z.string().max(10000).optional(),
        previousOutput: z.string().max(200000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSessionOwner(data.sessionId, context.userId);
    const id = data.stageId as StageId;
    const start = stageOrder.indexOf(id);
    if (start < 0) throw new Error(`Unknown stage id: ${id}`);

    // Persist any amendment note + previous output keyed by stage id so the
    // shared Claude wrapper injects it into the very next run of this stage.
    // We read-modify-write so concurrent retries do not clobber each other.
    const feedback = data.feedback?.trim();
    let nextAmendments: Record<string, unknown> | null = null;
    {
      const { data: current } = await supabaseAdmin
        .from("sessions")
        .select("stage_amendments")
        .eq("id", data.sessionId)
        .single();
      const map = { ...((current?.stage_amendments ?? {}) as Record<string, unknown>) };
      if (feedback) {
        map[id] = {
          feedback,
          previousOutput: data.previousOutput?.slice(0, 200000) ?? null,
          ts: new Date().toISOString(),
        };
      } else if (id in map) {
        // No new note on this retry — clear any stale amendment for this stage
        // so an old note does not silently re-apply.
        delete map[id];
      }
      nextAmendments = map;
    }

    const update: Record<string, unknown> = {
      status: "running",
      current_stage: parseInt(id, 10),
      stage_status: `running:${id}`,
      retry_status: null,
      stage_amendments: nextAmendments,
    };

    for (const stageId of stageOrder.slice(start)) {
      Object.assign(update, stageClearFields[stageId]);
    }

    if (start <= stageOrder.indexOf("8")) {
      Object.assign(update, {
        checkpoint_b_confirmed: false,
        checkpoint_b_confirmed_at: null,
        checkpoint_b_notes: null,
      });
    }

    if (start <= stageOrder.indexOf("12")) {
      Object.assign(update, {
        checkpoint_c_confirmed: false,
        checkpoint_c_confirmed_at: null,
        checkpoint_c_notes: null,
        selected_smp: null,
        selected_smp_field_name: null,
        selection_rationale: null,
      });
    }

    const { error } = await supabaseAdmin
      .from("sessions")
      .update(update as never)
      .eq("id", data.sessionId);
    if (error) throw new Error(`Failed to reset stage cascade: ${error.message}`);
    return { ok: true };
  });
