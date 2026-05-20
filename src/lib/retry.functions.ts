import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type StageId =
  | "1" | "1b" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"
  | "10" | "11" | "12" | "13" | "13b" | "14" | "14b" | "14c" | "15" | "16";

/**
 * Resets a stage so the runner re-executes from scratch.
 * Clears both the cached output AND the error so the server-side
 * "if (existing output) return it" short-circuit no longer applies.
 */
export const resetStage = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        sessionId: z.string().uuid(),
        stageId: z.enum([
          "1","1b","2","3","4","5","6","7","8","9","10","11","12","13","13b","14","14b","14c","15","16",
        ]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const id = data.stageId as StageId;
    const baseFields = {
      status: "running" as const,
      stage_status: `running:${id}`,
      retry_status: null as string | null,
    };
    switch (id) {
      case "1":   await supabaseAdmin.from("sessions").update({ ...baseFields, stage_1_output: null, stage_1_error: null }).eq("id", data.sessionId); break;
      case "1b":  await supabaseAdmin.from("sessions").update({ ...baseFields, stage_1b_output: null, stage_1_error: null }).eq("id", data.sessionId); break;
      case "2":   await supabaseAdmin.from("sessions").update({ ...baseFields, stage_2_output: null, stage_2_error: null }).eq("id", data.sessionId); break;
      case "3":   await supabaseAdmin.from("sessions").update({ ...baseFields, stage_3_output: null, stage_3_error: null }).eq("id", data.sessionId); break;
      case "4":   await supabaseAdmin.from("sessions").update({ ...baseFields, stage_4_output: null, stage_4_error: null }).eq("id", data.sessionId); break;
      case "5":   await supabaseAdmin.from("sessions").update({ ...baseFields, stage_5_output: null, stage_5_error: null }).eq("id", data.sessionId); break;
      case "6":   await supabaseAdmin.from("sessions").update({ ...baseFields, stage_6_output: null, stage_6_error: null }).eq("id", data.sessionId); break;
      case "7":   await supabaseAdmin.from("sessions").update({ ...baseFields, stage_7_output: null, stage_7_error: null }).eq("id", data.sessionId); break;
      case "8":   await supabaseAdmin.from("sessions").update({ ...baseFields, stage_8_output: null, stage_8_error: null }).eq("id", data.sessionId); break;
      case "9":   await supabaseAdmin.from("sessions").update({ ...baseFields, stage_9_output: null, stage_9_error: null }).eq("id", data.sessionId); break;
      case "10":  await supabaseAdmin.from("sessions").update({ ...baseFields, stage_10_output: null, stage_10_error: null }).eq("id", data.sessionId); break;
      case "11":  await supabaseAdmin.from("sessions").update({ ...baseFields, stage_11_output: null, stage_11_error: null }).eq("id", data.sessionId); break;
      case "12":  await supabaseAdmin.from("sessions").update({ ...baseFields, stage_12_output: null, stage_12_error: null }).eq("id", data.sessionId); break;
      case "13":  await supabaseAdmin.from("sessions").update({ ...baseFields, stage_13_output: null, stage_13_error: null }).eq("id", data.sessionId); break;
      case "13b": await supabaseAdmin.from("sessions").update({ ...baseFields, stage_13b_output: null, stage_13b_error: null }).eq("id", data.sessionId); break;
      case "14":  await supabaseAdmin.from("sessions").update({ ...baseFields, stage_14_output: null, stage_14_error: null }).eq("id", data.sessionId); break;
      case "14b": await supabaseAdmin.from("sessions").update({ ...baseFields, stage_14b_output: null, stage_14b_error: null }).eq("id", data.sessionId); break;
      case "14c": await supabaseAdmin.from("sessions").update({ ...baseFields, stage_14c_output: null, stage_14c_error: null }).eq("id", data.sessionId); break;
      case "15":  await supabaseAdmin.from("sessions").update({ ...baseFields, stage_15_output: null, stage_15_error: null }).eq("id", data.sessionId); break;
      case "16":  await supabaseAdmin.from("sessions").update({ ...baseFields, stage_16_consulting_output: null, stage_16_agency_output: null, stage_16_workshop_output: null, stage_16_error: null }).eq("id", data.sessionId); break;
    }
    return { ok: true };
  });
