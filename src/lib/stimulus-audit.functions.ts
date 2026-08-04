// CREATIVE STIMULUS ENGINE — PROMPT AUDIT.
// Reconstructs, exactly, the strategic grounding that each of the 37 lens
// calls received for a given run: the SMP text, the Detonation Line, and the
// Channel Detonation Brief — plus the fully rendered user message for any
// single lens, byte-for-byte as the model saw it.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSessionAccess } from "@/lib/auth-helpers.server";
import { getLens } from "./stimulus/lenses";
import { buildStimulusUserMessage } from "./stimulus/generate-prompt";

export type LensAuditRow = {
  lensId: string;
  lensName: string;
  sortOrder: number;
  batch: number;
  status: string;
};

export type StimulusRunAudit = {
  runId: string;
  sessionId: string;
  brandName: string;
  category: string;
  channelName: string;
  /** Exactly the SMP string sent in every lens call. */
  smp: string;
  smpChars: number;
  /** Exactly the Detonation Line string sent in every lens call. */
  detonationLine: string;
  detonationLineChars: number;
  /** Exactly the Stage 21 channel brief sent in every lens call. */
  channelBrief: string;
  channelBriefChars: number;
  /** True when the run's stored SMP no longer matches the session's current SMP. */
  smpMatchesSession: boolean;
  sessionSmp: string;
  batchSize: number;
  lenses: LensAuditRow[];
};

const RUN_SELECT = "id, session_id, channel_name, channel_brief, smp";

const AuditInput = z.object({
  runId: z.string().uuid(),
  batchSize: z.number().int().min(1).max(6).default(4),
});

export const auditStimulusRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => AuditInput.parse(i))
  .handler(async ({ data, context }): Promise<StimulusRunAudit> => {
    const { data: run, error } = await supabaseAdmin
      .from("stimulus_runs")
      .select(RUN_SELECT)
      .eq("id", data.runId)
      .single();
    if (error || !run) throw new Error(`Stimulus run not found: ${error?.message ?? "no row"}`);
    await assertSessionAccess(run.session_id, context.userId);

    const { data: sessionRow } = await supabaseAdmin
      .from("sessions")
      .select("brand_name, category, stage_18_detonation_line, selected_smp")
      .eq("id", run.session_id)
      .single();

    const { data: dirs } = await supabaseAdmin
      .from("stimulus_directions")
      .select("lens_id, lens_name, sort_order, status")
      .eq("run_id", run.id)
      .order("sort_order", { ascending: true });

    const detonationLine = sessionRow?.stage_18_detonation_line ?? "";
    const sessionSmp = sessionRow?.selected_smp ?? "";

    const lenses: LensAuditRow[] = (dirs ?? []).map((d, idx) => ({
      lensId: d.lens_id as string,
      lensName: (d.lens_name as string) ?? (d.lens_id as string),
      sortOrder: (d.sort_order as number) ?? idx,
      batch: Math.floor(idx / data.batchSize) + 1,
      status: (d.status as string) ?? "unknown",
    }));

    return {
      runId: run.id,
      sessionId: run.session_id,
      brandName: sessionRow?.brand_name ?? "—",
      category: sessionRow?.category ?? "—",
      channelName: run.channel_name,
      smp: run.smp ?? "",
      smpChars: (run.smp ?? "").length,
      detonationLine,
      detonationLineChars: detonationLine.length,
      channelBrief: run.channel_brief ?? "",
      channelBriefChars: (run.channel_brief ?? "").length,
      smpMatchesSession: (run.smp ?? "").trim() === sessionSmp.trim(),
      sessionSmp,
      batchSize: data.batchSize,
      lenses,
    };
  });

const PromptInput = z.object({
  runId: z.string().uuid(),
  lensId: z.string().min(1).max(80),
});

/** The exact rendered user message a single lens received. */
export const auditStimulusLensPrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => PromptInput.parse(i))
  .handler(async ({ data, context }) => {
    const { data: run, error } = await supabaseAdmin
      .from("stimulus_runs")
      .select(RUN_SELECT)
      .eq("id", data.runId)
      .single();
    if (error || !run) throw new Error(`Stimulus run not found: ${error?.message ?? "no row"}`);
    await assertSessionAccess(run.session_id, context.userId);

    const lens = getLens(data.lensId);
    if (!lens) throw new Error(`Unknown lens: ${data.lensId}`);

    const { data: sessionRow } = await supabaseAdmin
      .from("sessions")
      .select("brand_name, category, stage_18_detonation_line")
      .eq("id", run.session_id)
      .single();

    return {
      lensId: lens.id,
      lensName: lens.name,
      message: buildStimulusUserMessage({
        brandName: sessionRow?.brand_name ?? "—",
        category: sessionRow?.category ?? "—",
        channelName: run.channel_name,
        channelBrief: run.channel_brief ?? "",
        smp: run.smp ?? "",
        detonationLine: sessionRow?.stage_18_detonation_line ?? "",
        lenses: [lens],
      }),
    };
  });
