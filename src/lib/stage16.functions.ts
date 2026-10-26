// Stage 16 — Document Assembly server functions.
// The generation logic lives in stage16.server.ts (shared by the streaming
// path below and the /api/public/stage16-tick background runner).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSessionAccess } from "@/lib/auth-helpers.server";
import { assertUpstreamStageOutput } from "./pipeline-integrity";
import {
  COLUMN_BY_FORMAT,
  STAGE_16_RUNNING,
  generateStage16Format,
  parseStage16Sentinel,
} from "./stage16.server";

export { VALUATION_DISCLAIMER, VALUATION_READER_GUIDE, VALUATION_PROPOSITION_PROVENANCE } from "./valuation-front-matter";

const FormatSchema = z.enum(["agency", "consulting", "workshop", "vision", "valuation"]);
const Input = z.object({
  sessionId: z.string().uuid(),
  format: FormatSchema,
  force: z.boolean().optional(),
});

export const runStage16 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => Input.parse(i))
  .handler(async function* ({ data, context }) {
    await assertSessionAccess(data.sessionId, context.userId);
    await assertUpstreamStageOutput(data.sessionId, 16);
    yield* generateStage16Format({
      sessionId: data.sessionId,
      format: data.format,
      force: data.force,
    });
  });

/**
 * Queues a Stage 16 document format for the background runner
 * (/api/public/stage16-tick), which streams keep-alives for the whole run so
 * the published runtime cannot cancel a multi-minute document mid-stream.
 * Returns the format already queued/claimed when one is in flight, and
 * queued:false when a cached document already exists (nothing to do).
 */
export const startStage16 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => Input.parse(i))
  .handler(async ({ data, context }) => {
    await assertSessionAccess(data.sessionId, context.userId);
    await assertUpstreamStageOutput(data.sessionId, 16);
    const { data: row, error } = await supabaseAdmin
      .from("sessions")
      .select(
        "stage_16_error, stage_16_agency_output, stage_16_consulting_output, stage_16_workshop_output, stage_16_vision_output, stage_16_valuation_output",
      )
      .eq("id", data.sessionId)
      .single();
    if (error || !row) throw new Error(`Session not found: ${error?.message ?? "no row"}`);
    const sentinel = parseStage16Sentinel((row.stage_16_error as string | null) ?? null);
    if (sentinel.running) return { queued: true as const, format: sentinel.format };
    const existing = row[COLUMN_BY_FORMAT[data.format]] as string | null;
    if (!data.force && existing && existing.trim().length > 1000) {
      return { queued: false as const, format: data.format };
    }
    await supabaseAdmin
      .from("sessions")
      .update({ stage_16_error: `${STAGE_16_RUNNING}:${data.format}` })
      .eq("id", data.sessionId);
    return { queued: true as const, format: data.format };
  });
