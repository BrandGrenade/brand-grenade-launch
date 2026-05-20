import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Clears the error and output for a single stage so the regular runner can
 * be invoked again. The actual stage runner is dispatched from the client
 * (it already exists per stage) — this just resets DB state.
 */
export const resetStage = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        sessionId: z.string().uuid(),
        stageId: z
          .string()
          .regex(/^(1|1b|2|3|4|5|6|7|8|9|10|11|12|13|13b|14|14b|14c|15|16)$/i),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const id = data.stageId.toLowerCase();
    const errorCol = `stage_${id}_error` as
      | "stage_1_error" | "stage_1b_error" | "stage_2_error" | "stage_3_error"
      | "stage_4_error" | "stage_5_error" | "stage_6_error" | "stage_7_error"
      | "stage_8_error" | "stage_9_error" | "stage_10_error" | "stage_11_error"
      | "stage_12_error" | "stage_13_error" | "stage_13b_error" | "stage_14_error"
      | "stage_14b_error" | "stage_14c_error" | "stage_15_error" | "stage_16_error";
    await supabaseAdmin
      .from("sessions")
      .update({ [errorCol]: null, status: "running", stage_status: `running:${id}` })
      .eq("id", data.sessionId);
    return { ok: true };
  });
