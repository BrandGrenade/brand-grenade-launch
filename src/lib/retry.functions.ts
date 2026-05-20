import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type StageId =
  | "1" | "1b" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"
  | "10" | "11" | "12" | "13" | "13b" | "14" | "14b" | "14c" | "15" | "16";

/**
 * Clears the error for a single stage so the client can re-invoke the
 * stage runner. The runner itself remains the source of truth for the
 * stage's output column.
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
    // Inline switch keeps the column literal-typed for supabase-js.
    const base = { status: "running" as const, stage_status: `running:${id}` };
    const sb = supabaseAdmin.from("sessions");
    switch (id) {
      case "1":   await sb.update({ status: base.status, stage_status: base.stage_status, stage_1_error: null }).eq("id", data.sessionId); break;
      case "1b":  await sb.update({ status: base.status, stage_status: base.stage_status, stage_1b_error: null }).eq("id", data.sessionId); break;
      case "2":   await sb.update({ status: base.status, stage_status: base.stage_status, stage_2_error: null }).eq("id", data.sessionId); break;
      case "3":   await sb.update({ status: base.status, stage_status: base.stage_status, stage_3_error: null }).eq("id", data.sessionId); break;
      case "4":   await sb.update({ status: base.status, stage_status: base.stage_status, stage_4_error: null }).eq("id", data.sessionId); break;
      case "5":   await sb.update({ status: base.status, stage_status: base.stage_status, stage_5_error: null }).eq("id", data.sessionId); break;
      case "6":   await sb.update({ status: base.status, stage_status: base.stage_status, stage_6_error: null }).eq("id", data.sessionId); break;
      case "7":   await sb.update({ status: base.status, stage_status: base.stage_status, stage_7_error: null }).eq("id", data.sessionId); break;
      case "8":   await sb.update({ status: base.status, stage_status: base.stage_status, stage_8_error: null }).eq("id", data.sessionId); break;
      case "9":   await sb.update({ status: base.status, stage_status: base.stage_status, stage_9_error: null }).eq("id", data.sessionId); break;
      case "10":  await sb.update({ status: base.status, stage_status: base.stage_status, stage_10_error: null }).eq("id", data.sessionId); break;
      case "11":  await sb.update({ status: base.status, stage_status: base.stage_status, stage_11_error: null }).eq("id", data.sessionId); break;
      case "12":  await sb.update({ status: base.status, stage_status: base.stage_status, stage_12_error: null }).eq("id", data.sessionId); break;
      case "13":  await sb.update({ status: base.status, stage_status: base.stage_status, stage_13_error: null }).eq("id", data.sessionId); break;
      case "13b": await sb.update({ status: base.status, stage_status: base.stage_status, stage_13b_error: null }).eq("id", data.sessionId); break;
      case "14":  await sb.update({ status: base.status, stage_status: base.stage_status, stage_14_error: null }).eq("id", data.sessionId); break;
      case "14b": await sb.update({ status: base.status, stage_status: base.stage_status, stage_14b_error: null }).eq("id", data.sessionId); break;
      case "14c": await sb.update({ status: base.status, stage_status: base.stage_status, stage_14c_error: null }).eq("id", data.sessionId); break;
      case "15":  await sb.update({ status: base.status, stage_status: base.stage_status, stage_15_error: null }).eq("id", data.sessionId); break;
      case "16":  await sb.update({ status: base.status, stage_status: base.stage_status, stage_16_error: null }).eq("id", data.sessionId); break;
    }
    return { ok: true };
  });
