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
    const errorCol = `stage_${id}_error`;
    const patch: Record<string, unknown> = {
      [errorCol]: null,
      status: "running",
      stage_status: `running:${id}`,
    };
    await supabaseAdmin.from("sessions").update(patch).eq("id", data.sessionId);
    return { ok: true };
  });
