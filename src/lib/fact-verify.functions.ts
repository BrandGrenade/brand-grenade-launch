// Thin server-function wrapper over the shared fact-verification dispatcher.
// All logic lives in ./fact-verify.server.ts — this file only exposes it as
// callable RPC so a stage's output can be re-verified on demand (admin/tests,
// retry paths) without re-running the stage itself.
//
// Adding a future stage to the dispatcher requires no change here: add the
// entry to FACT_VERIFIED_STAGES and it becomes callable through this fn.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSessionAccess } from "@/lib/auth-helpers.server";

const StageKey = z.enum(["stage2", "stage4b"]);

export const reverifyStageFacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ sessionId: z.string().uuid(), stageKey: StageKey }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSessionAccess(data.sessionId, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { FACT_VERIFIED_STAGES, runStageFactVerification } = await import(
      "./fact-verify.server"
    );
    const config = FACT_VERIFIED_STAGES[data.stageKey];
    const { data: row, error } = await supabaseAdmin
      .from("sessions")
      .select(`brand_name, category, ${config.outputColumn}`)
      .eq("id", data.sessionId)
      .single();
    if (error || !row) throw new Error(`Session not found: ${error?.message ?? "no row"}`);
    const source = (row as unknown as Record<string, string | null>)[config.outputColumn];
    if (!source) throw new Error(`${config.label} has no output to verify.`);

    const outcome = await runStageFactVerification({
      stageKey: data.stageKey,
      output: source,
      brandName: (row as unknown as { brand_name: string }).brand_name,
      category: (row as unknown as { category: string }).category,
    });

    const patch = { [config.outputColumn]: outcome.output } as Record<string, string>;
    const { error: updateErr } = await supabaseAdmin
      .from("sessions")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(patch as any)
      .eq("id", data.sessionId);

    if (updateErr) throw new Error(`Failed to save verified output: ${updateErr.message}`);

    return {
      checked: outcome.checked,
      flagged: outcome.flagged,
      ranSearch: outcome.ranSearch,
      results: outcome.results,
    };
  });
