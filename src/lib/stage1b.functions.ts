import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { streamClaude } from "./claude.server";
import { STAGE_1B_SYSTEM_PROMPT, buildStage1bUserMessage } from "./stage1b-prompt";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSessionOwner } from "@/lib/auth-helpers.server";
import { assertStageOutput } from "./pipeline-integrity";

const RunStage1bInput = z.object({ sessionId: z.string().uuid() });

export const runStage1b = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => RunStage1bInput.parse(input))
  .handler(async function* ({ data, context }) {
    await assertSessionOwner(data.sessionId, context.userId);
    await assertStageOutput(data.sessionId, 1, "Stage 1B");
    const { data: session, error: loadErr } = await supabaseAdmin
      .from("sessions")
      .select("brief_text, stage_1_output, stage_1b_output")
      .eq("id", data.sessionId)
      .single();
    if (loadErr || !session) throw new Error(`Session not found: ${loadErr?.message ?? "no row"}`);
    if (!session.stage_1_output) throw new Error("Stage 1 output missing — cannot run Stage 1B");
    if (session.stage_1b_output) {
      yield { delta: session.stage_1b_output };
      yield { done: true as const, output: session.stage_1b_output };
      return;
    }

    const userMessage = buildStage1bUserMessage({
      stage1Output: session.stage_1_output,
      briefText: session.brief_text,
    });

    let output = "";
    try {
      for await (const delta of streamClaude({
        systemPrompt: STAGE_1B_SYSTEM_PROMPT,
        userMessage,
        maxTokens: 12000,
        sessionId: data.sessionId,
        stageLabel: "Stage 1B",
        stageNumber: "1B",
        stageName: "Brief Enhancement",
      })) {
        output += delta;
        yield { delta };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Stage 1B failed";
      throw e instanceof Error ? e : new Error(msg);
    }

    const cleaned = sanitizeStage1bOutput(output);

    const { error: updateErr } = await supabaseAdmin
      .from("sessions")
      .update({ stage_1b_output: cleaned })
      .eq("id", data.sessionId);
    if (updateErr) throw new Error(`Failed to save Stage 1B output: ${updateErr.message}`);

    if (cleaned !== output) {
      yield { delta: "\n\n---\n(Out-of-remit questions automatically removed by Stage 1B exclusion filter.)" };
    }
    yield { done: true as const, output: cleaned };
  });

// ─────────────────────────────────────────────────────────────────────────────
// Post-generation safety net — strips any "GAP IDENTIFIED / QUESTION / WHY
// THIS MATTERS" block whose text matches the Permanent Exclusion List or any
// Forbidden Question Pattern from stage1b-prompt.ts. Belt-and-braces against
// model drift; the prompt is the primary defence.
// ─────────────────────────────────────────────────────────────────────────────
const STAGE_1B_BANNED_PATTERNS: RegExp[] = [
  /\bsource[ds]?\b/i, /\bcit(e|ed|ation|ations)\b/i, /\brefere(nce|nces)\b/i,
  /\bevidence\b/i, /\bproof\b/i, /\bdocument(ed|ation)?\b/i,
  /\bdata showing\b/i, /\bresearch showing\b/i, /\bstud(y|ies)\b/i,
  /\bsurvey(s)?\b/i, /\bstatistic(s)?\b/i, /\breport(s)?\b/i, /\bbibliograph/i,
  /\brate (the |each |these )?competitor/i, /\bscore (the |each |these )?competitor/i,
  /\brank the competitor/i, /\bcompetitor (matrix|benchmark)/i, /\bbenchmark(ing)?\b/i,
  /\bobserv(ed|ation|ations|ing)\b/i, /\bethnograph/i, /\bshadow(ed|ing)\b/i,
  /\bfield stud(y|ies)\b/i, /\bday[- ]in[- ]the[- ]life\b/i,
  /\bdemonstrat(e|ion|ions)\b/i, /\bproof point/i, /\bcase stud(y|ies)\b/i,
  /\btrack record\b/i, /\bprior example/i,
  /\bwho will attend\b/i, /\bbudget\b/i, /\btimeline\b/i, /\brollout\b/i, /\bphasing\b/i,
  /\bwhen will (you|the) (launch|roll|go[- ]to[- ]market)/i,
];

function blockIsBanned(block: string): boolean {
  return STAGE_1B_BANNED_PATTERNS.some((re) => re.test(block));
}

export function sanitizeStage1bOutput(raw: string): string {
  if (!raw) return raw;
  // Split into question blocks delimited by "GAP IDENTIFIED:"
  // Preserve everything before the first GAP IDENTIFIED.
  const marker = /(^|\n)\s*GAP IDENTIFIED\s*:/i;
  const firstIdx = raw.search(marker);
  if (firstIdx === -1) return raw;
  const preamble = raw.slice(0, firstIdx);
  const rest = raw.slice(firstIdx);
  // Split rest by occurrences of "GAP IDENTIFIED:" while keeping the marker.
  const blocks = rest.split(/(?=(?:^|\n)\s*GAP IDENTIFIED\s*:)/i);
  const kept: string[] = [];
  let removed = 0;
  for (const b of blocks) {
    if (!b.trim()) continue;
    if (blockIsBanned(b)) { removed++; continue; }
    kept.push(b.replace(/^\n+/, "\n"));
  }
  let out = preamble + kept.join("");
  if (removed > 0) {
    out += `\n\n_Stage 1B exclusion filter removed ${removed} out-of-remit question${removed === 1 ? "" : "s"} (sources / ratings / observed behaviour / documented proof / operational detail)._`;
  }
  return out;
}

const ResubmitBriefInput = z.object({
  sessionId: z.string().uuid(),
  additionalBrief: z.string().min(20).max(50000),
});

export const resubmitBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ResubmitBriefInput.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertSessionOwner(data.sessionId, context.userId);
    const { data: session, error: loadErr } = await supabaseAdmin
      .from("sessions")
      .select("brief_text")
      .eq("id", data.sessionId)
      .single();
    if (loadErr || !session) throw new Error(`Session not found: ${loadErr?.message ?? "no row"}`);

    const enriched = `${session.brief_text}\n\n---\nADDITIONAL BRIEF INFORMATION (Stage 1B responses):\n${data.additionalBrief}`;

    const { error: updateErr } = await supabaseAdmin
      .from("sessions")
      .update({
        brief_text: enriched,
        stage_1_output: null,
        stage_1_tension_score: null,
        stage_1b_required: false,
        stage_1b_output: null,
        stage_1_error: null,
        current_stage: 1,
        status: "running",
      })
      .eq("id", data.sessionId);
    if (updateErr) throw new Error(`Failed to resubmit brief: ${updateErr.message}`);

    return { ok: true };
  });

// ─────────────────────────────────────────────────────────────────────────────
// Structured brief edit + resubmit (Edit Brief feature)
//
// Appends a new version to brief_versions, rewrites brief_text from the new
// structured fields, and HARD-RESETS every downstream stage output so the
// pipeline reruns from Stage 1 against the amended brief.
// ─────────────────────────────────────────────────────────────────────────────

const BriefFieldsSchema = z.object({
  briefTitle: z.string().max(500).default(""),
  brandName: z.string().max(500).default(""),
  category: z.string().max(500).default(""),
  date: z.string().max(40).default(""),
  submittedBy: z.string().max(500).default(""),
  sections: z.record(z.string(), z.string().max(20000)).default({}),
  supportingMaterials: z.array(z.string().max(500)).default([]),
});

const ResubmitStructuredInput = z.object({
  sessionId: z.string().uuid(),
  briefFields: BriefFieldsSchema,
  briefText: z.string().min(20).max(50000),
});

// Every stage output / error / derived state we must clear when the brief
// is amended. Stage 1 itself is cleared so it reruns with the new brief;
// every other stage is cleared so nothing downstream is left stale.
const DOWNSTREAM_RESET: Record<string, null | false | string> = {
  stage_1_output: null,
  stage_1_error: null,
  stage_1_tension_score: null,
  stage_1b_output: null,
  stage_1b_required: false,
  stage_2_output: null, stage_2_error: null,
  stage_3_output: null, stage_3_error: null,
  stage_4_output: null, stage_4_error: null,
  stage_4b_output: null, stage_4b_error: null,
  stage_5_output: null, stage_5_error: null,
  stage_6_output: null, stage_6_error: null, stage_6_status: null,
  stage_7_output: null, stage_7_error: null, stage_7_territory_count: null,
  stage_8_output: null, stage_8_error: null, stage_8_feedback: null,
  stage_9_output: null, stage_9_error: null,
  stage_10_output: null, stage_10_error: null,
  stage_11_output: null, stage_11_error: null,
  stage_12_output: null, stage_12_error: null, stage_12_smps: null,
  stage_13_output: null, stage_13_error: null, stage_13_verdict: null,
  stage_13b_output: null, stage_13b_error: null,
  stage_14_output: null, stage_14_error: null,
  stage_14b_output: null, stage_14b_error: null,
  stage_14c_output: null, stage_14c_error: null,
  stage_15_output: null, stage_15_error: null, stage_15_clearance_status: null,
  stage_16_consulting_output: null, stage_16_agency_output: null,
  stage_16_workshop_output: null, stage_16_format: null, stage_16_error: null,
  stage_17_output: null, stage_17_error: null, stage_17_selected_territory: null,
  stage_17b_output: null, stage_17b_error: null,
  stage_18_output: null, stage_18_error: null,
  stage_18_detonation_line: null, stage_18_selected_detonation: null,
  stage_19_output: null, stage_19_error: null,
  stage_20_output: null, stage_20_error: null, stage_20_approved: false,
  stage_21_outputs: null, stage_21_error: null,
  stage_22_output: null, stage_22_error: null,
  stage_22_brand_architecture: null, stage_22_distinctive_assets: null,
  brand_intelligence: null,
  selected_smp: null,
  selected_smp_field_name: null,
  checkpoint_a_confirmed: false,
  checkpoint_b_confirmed: false,
  checkpoint_c_confirmed: false,
  retry_status: null,
};

export const resubmitBriefStructured = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ResubmitStructuredInput.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true; version: number }> => {
    await assertSessionOwner(data.sessionId, context.userId);
    const { data: session, error: loadErr } = await supabaseAdmin
      .from("sessions")
      .select("brief_versions, brand_name, category")
      .eq("id", data.sessionId)
      .single();
    if (loadErr || !session) throw new Error(`Session not found: ${loadErr?.message ?? "no row"}`);

    const existing = (Array.isArray(session.brief_versions) ? session.brief_versions : []) as Array<{ version?: number }>;
    const nextVersion = existing.length > 0
      ? Math.max(...existing.map((v) => Number(v?.version) || 0)) + 1
      : 2; // first edit always becomes v2 even if v1 was never recorded (legacy)
    const newVersion = {
      version: nextVersion,
      fields: data.briefFields,
      submitted_at: new Date().toISOString(),
    };

    const { error: updateErr } = await supabaseAdmin
      .from("sessions")
      .update({
        ...DOWNSTREAM_RESET,
        brief_text: data.briefText,
        brief_versions: [...existing, newVersion],
        brand_name: data.briefFields.brandName || session.brand_name,
        category: data.briefFields.category || session.category,
        current_stage: 1,
        status: "running",
        stage_status: null,
      })
      .eq("id", data.sessionId);
    if (updateErr) throw new Error(`Failed to resubmit structured brief: ${updateErr.message}`);

    return { ok: true, version: nextVersion };
  });

