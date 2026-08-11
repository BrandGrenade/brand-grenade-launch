// Shared regeneration path for a single lens. Used by both Revise (guided, with
// notes) and Try Again (unguided second take). The only difference between the
// two is the instruction block appended to the base user message — everything
// else, including the attempt record written afterwards, is identical.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callClaude } from "@/lib/claude.server";
import { getLens } from "@/lib/stimulus/lenses";
import {
  STIMULUS_SYSTEM_PROMPT,
  buildStimulusUserMessage,
  parseStimulusResponse,
} from "@/lib/stimulus/generate-prompt";
import {
  BIG_IDEA_SYSTEM_PROMPT,
  buildBigIdeaUserMessage,
  parseBigIdeaResponse,
} from "@/lib/stimulus/big-idea-prompt";

export type RegenMode = "revise" | "try_again";

type DirectionRow = {
  id: string;
  run_id: string;
  lens_id: string;
  direction: string | null;
  revise_count: number | null;
};

type RunRow = {
  id: string;
  session_id: string;
  channel_name: string;
  channel_brief: string;
  smp: string;
  run_mode?: string;
};

/**
 * Every prior take for this lens, oldest first. Fed back into the prompt so a
 * Try Again cannot quietly reproduce a version the creative has already seen.
 */
async function priorAttemptTexts(directionId: string): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from("stimulus_direction_attempts")
    .select("direction, attempt_no")
    .eq("direction_id", directionId)
    .order("attempt_no", { ascending: true });
  return (data ?? [])
    .map((r) => (r.direction ?? "").trim())
    .filter((t) => t.length > 0);
}

function buildInstruction(mode: RegenMode, notes: string | undefined, priors: string[]): string {
  const priorBlock =
    priors.length > 0
      ? [
          "═══ EVERY PREVIOUS ATTEMPT FROM THIS LENS ═══",
          ...priors.map((p, i) => `--- Attempt ${i + 1} ---\n${p}`),
          "",
        ].join("\n")
      : "";

  if (mode === "revise") {
    return [
      priorBlock,
      "═══ MANDATORY REVISION INSTRUCTION FROM THE CREATIVE ═══",
      (notes ?? "").trim(),
      "",
      "Rewrite this lens's output so it obeys the revision instruction. Same output contract. Do not repeat any previous version.",
    ].join("\n");
  }

  return [
    priorBlock,
    "═══ MANDATORY INSTRUCTION — SECOND TAKE ═══",
    "The creative has rejected every attempt above without giving direction. They do not want a",
    "refinement of what is there; they want a genuinely different idea through the same lens.",
    "",
    "Produce a new attempt that:",
    "· uses a different central image, situation or device from every attempt above",
    "· does not reuse the distinctive phrasing, structure or opening move of any attempt above",
    "· is not a softened, sharpened or reworded version of an earlier attempt",
    "· obeys the same lens discipline, the same brief and the same output contract",
    "",
    "If your first instinct is close to something above, discard it and go again.",
  ].join("\n");
}

/**
 * Regenerates one lens and records the result as a new attempt, which becomes
 * the active attempt. Prior attempts are retained, never overwritten.
 */
export async function regenerateDirection(opts: {
  direction: DirectionRow;
  run: RunRow;
  mode: RegenMode;
  notes?: string;
}): Promise<{ attemptId: string; attemptNo: number; direction: string }> {
  const { direction: row, run, mode, notes } = opts;
  const lens = getLens(row.lens_id);
  if (!lens) throw new Error(`Unknown lens ${row.lens_id}`);
  const isBigIdea = run.run_mode === "big_idea";

  const { data: sessionRow } = await supabaseAdmin
    .from("sessions")
    .select(
      "brand_name, category, stage_18_detonation_line, truth_product, truth_consumer, truth_cultural, stage_1_output, stage_2_output",
    )
    .eq("id", run.session_id)
    .single();

  const masterLine = (sessionRow?.stage_18_detonation_line ?? "").trim();

  const base = isBigIdea
    ? buildBigIdeaUserMessage({
        brandName: sessionRow?.brand_name ?? "—",
        category: sessionRow?.category ?? "—",
        smp: run.smp,
        detonationLine: masterLine,
        truths: [
          sessionRow?.truth_product ? `PRODUCT TRUTH: ${sessionRow.truth_product}` : "",
          sessionRow?.truth_consumer ? `CONSUMER TRUTH: ${sessionRow.truth_consumer}` : "",
          sessionRow?.truth_cultural ? `CULTURAL TRUTH: ${sessionRow.truth_cultural}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        strategicEvidence: [sessionRow?.stage_1_output ?? "", sessionRow?.stage_2_output ?? ""]
          .filter(Boolean)
          .join("\n\n")
          .slice(0, 14000),
        lenses: [lens],
      })
    : buildStimulusUserMessage({
        brandName: sessionRow?.brand_name ?? "—",
        category: sessionRow?.category ?? "—",
        channelName: run.channel_name,
        channelBrief: run.channel_brief,
        smp: run.smp,
        detonationLine: masterLine,
        lenses: [lens],
      });

  const priors = await priorAttemptTexts(row.id);
  const currentText = (row.direction ?? "").trim();
  if (currentText && !priors.includes(currentText)) priors.push(currentText);

  const userMessage = [base, "", buildInstruction(mode, notes, priors)].join("\n");

  const raw = await callClaude({
    systemPrompt: isBigIdea ? BIG_IDEA_SYSTEM_PROMPT : STIMULUS_SYSTEM_PROMPT,
    userMessage,
    skipUniversalWrapper: true,
    maxTokens: 4000,
    temperature: 1,
    sessionId: run.session_id,
    stageLabel: `Creative Stimulus ${mode === "revise" ? "revise" : "try again"} (${lens.name})`,
  });

  const bigParsed = isBigIdea ? parseBigIdeaResponse(raw)[lens.id] : undefined;
  const text = isBigIdea
    ? bigParsed?.idea?.trim() || raw.trim()
    : parseStimulusResponse(raw)[lens.id]?.trim() || raw.trim();
  if (!text) throw new Error("Regeneration produced no parseable output");

  const { data: last } = await supabaseAdmin
    .from("stimulus_direction_attempts")
    .select("attempt_no")
    .eq("direction_id", row.id)
    .order("attempt_no", { ascending: false })
    .limit(1)
    .maybeSingle();
  const attemptNo = (last?.attempt_no ?? 0) + 1;

  const { data: attempt, error: aErr } = await supabaseAdmin
    .from("stimulus_direction_attempts")
    .insert({
      direction_id: row.id,
      run_id: run.id,
      attempt_no: attemptNo,
      origin: mode,
      direction: text,
      campaign_line: isBigIdea ? bigParsed?.line || null : null,
      expression_under_master:
        isBigIdea && masterLine ? bigParsed?.expressionUnderMaster || null : null,
      master_line_at_generation: isBigIdea ? masterLine || null : null,
      rationale: isBigIdea ? bigParsed?.rationale || null : null,
      line_check: null,
      revise_notes: mode === "revise" ? (notes ?? "").trim() : null,
      ratings: null,
      rating_status: "unrated",
    })
    .select("id, attempt_no")
    .single();
  if (aErr || !attempt) throw new Error(`Failed to save attempt: ${aErr?.message}`);

  // The new attempt becomes active. A fresh direction invalidates its Gate One
  // rating and approval — those belong to the attempt that earned them.
  const { error: uErr } = await supabaseAdmin
    .from("stimulus_directions")
    .update({
      direction: text,
      active_attempt_id: attempt.id,
      ...(isBigIdea
        ? {
            campaign_line: bigParsed?.line || null,
            expression_under_master: masterLine
              ? bigParsed?.expressionUnderMaster || null
              : null,
            master_line_at_generation: masterLine || null,
            rationale: bigParsed?.rationale || null,
            line_check: null,
          }
        : {}),
      status: "generated",
      ...(mode === "revise"
        ? { revise_notes: (notes ?? "").trim(), revise_count: (row.revise_count ?? 0) + 1 }
        : {}),
      error: null,
      ratings: null,
      rating_status: "unrated",
      rating_error: null,
      rated_at: null,
      gate_one_approved: false,
      gate_one_approved_at: null,
      gate_one_snapshot: null,
    })
    .eq("id", row.id);
  if (uErr) throw new Error(uErr.message);

  return { attemptId: attempt.id, attemptNo: attempt.attempt_no, direction: text };
}

/**
 * Makes a stored attempt the active one. Deliberate, explicit action: the
 * activated attempt's own rating snapshot travels with it, so what feeds Gate
 * One and everything downstream is exactly what that attempt earned.
 */
export async function activateAttempt(directionId: string, attemptId: string) {
  const { data: attempt, error } = await supabaseAdmin
    .from("stimulus_direction_attempts")
    .select("id, direction_id, direction, campaign_line, expression_under_master, master_line_at_generation, rationale, line_check, revise_notes, ratings, rating_status, rated_at")
    .eq("id", attemptId)
    .single();
  if (error || !attempt) throw new Error("Attempt not found");
  if (attempt.direction_id !== directionId) throw new Error("Attempt does not belong to this lens");

  const { error: uErr } = await supabaseAdmin
    .from("stimulus_directions")
    .update({
      active_attempt_id: attempt.id,
      direction: attempt.direction ?? undefined,
      campaign_line: attempt.campaign_line,
      expression_under_master: attempt.expression_under_master,
      master_line_at_generation: attempt.master_line_at_generation,
      rationale: attempt.rationale,
      line_check: attempt.line_check,
      revise_notes: attempt.revise_notes,
      ratings: attempt.ratings,
      rating_status: attempt.rating_status ?? "unrated",
      rated_at: attempt.rated_at,
      rating_error: null,
      // Approval is earned per attempt; switching active attempt clears it
      // unless that attempt was itself approved and re-rated.
      gate_one_approved: false,
      gate_one_approved_at: null,
      gate_one_snapshot: null,
      status: "generated",
      error: null,
    })
    .eq("id", directionId);
  if (uErr) throw new Error(uErr.message);
  return { ok: true as const };
}
