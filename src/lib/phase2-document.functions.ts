// Server functions for Phase 2 (Brand Detonation) document generation.
//
// Returns rendered HTML directly to the client, which opens it in a new
// tab and prints to PDF natively. Phase 2 content already lives in the
// sessions table — no AI re-generation needed.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  buildPhase2Document,
  buildAllPhase2,
  buildCompleteBundle,
  type Phase2DocType,
  type Phase2Session,
} from "./phase2-document-generator";

const PHASE_2_COLS =
  "id, brand_name, selected_smp, stage_17_selected_territory, stage_17b_output, stage_18_selected_detonation, stage_19_output, stage_20_output, stage_21_outputs, stage_22_brand_architecture, stage_22_distinctive_assets, doc_consulting_url";

async function loadSession(sessionId: string): Promise<Phase2Session & { doc_consulting_url: string | null }> {
  const { data, error } = await supabaseAdmin
    .from("sessions")
    .select(PHASE_2_COLS)
    .eq("id", sessionId)
    .single();
  if (error || !data) throw new Error(`Session not found: ${error?.message ?? "no row"}`);
  return data as unknown as Phase2Session & { doc_consulting_url: string | null };
}

const DOC_TYPES = [
  "detonation_territory",
  "detonation_intelligence",
  "the_detonation",
  "activation_architecture",
  "master_brief",
  "channel_brief",
  "distinctive_assets",
  "brand_architecture",
  "all_phase2",
] as const;

const Input = z.object({
  sessionId: z.string().uuid(),
  docType: z.enum(DOC_TYPES),
  channelKey: z.string().optional(),
});

export const generatePhase2Document = createServerFn({ method: "POST" })
  .inputValidator((i) => Input.parse(i))
  .handler(async ({ data }) => {
    const session = await loadSession(data.sessionId);
    const html =
      data.docType === "all_phase2"
        ? buildAllPhase2(session)
        : buildPhase2Document(session, data.docType as Phase2DocType, data.channelKey);
    return { html };
  });

const CompleteInput = z.object({
  sessionId: z.string().uuid(),
});

export const generateCompleteBundle = createServerFn({ method: "POST" })
  .inputValidator((i) => CompleteInput.parse(i))
  .handler(async ({ data }) => {
    const session = await loadSession(data.sessionId);
    const html = await buildCompleteBundle(session, session.doc_consulting_url);
    return { html };
  });
