import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { streamClaude } from "./claude.server";
import { withStreamSafety } from "./stream-stage-safety";
import { STAGE_6_SYSTEM_PROMPT, buildStage6UserMessage } from "./stage6-prompt";
import { trimCMMForDownstream } from "./context-trim";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSessionAccess } from "@/lib/auth-helpers.server";
import { assertUpstreamStageOutput } from "./pipeline-integrity";

const RunStage6Input = z.object({ sessionId: z.string().uuid() });

/**
 * Hard cap Stage 6 universes to the STRONGEST `max`.
 *
 * Rationale: Stage 7 has a wall-clock budget of ~240s per Worker invocation
 * and downstream stages assume ≤5 territories. A category-rich brief can
 * cause Stage 5/6 to emit 8–12 universes, which reliably kills Stage 7
 * mid-stream. We match the Stage 7 top-5 cap here so no downstream stage
 * ever sees more than 5, regardless of upstream volume.
 *
 * Strength scoring per universe block (starts at "## Name"):
 *   +3  per "— Validated" insight
 *   +2  per "PASSED UNEXPECTED BEHAVIOUR FILTER" mark
 *   -1  per "— Not carried forward" insight
 *   +1  if the closing `> strongest insight` blockquote is substantial (>80 chars)
 *
 * Ties break on (a) validated count, then (b) original order (stability).
 * Kept universes are re-emitted in their ORIGINAL order so downstream
 * ordering assumptions hold.
 */
export function capStage6Universes(text: string, max: number, sessionId: string): string {
  const lines = text.split("\n");
  const blockStarts: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^##\s+\S/.test(lines[i])) blockStarts.push(i);
  }
  if (blockStarts.length <= max) return text;

  const preamble = blockStarts[0] > 0 ? lines.slice(0, blockStarts[0]).join("\n") : "";
  const blocks = blockStarts.map((start, idx) => {
    const end = idx + 1 < blockStarts.length ? blockStarts[idx + 1] : lines.length;
    const body = lines.slice(start, end).join("\n").trimEnd();
    const headingMatch = lines[start].match(/^##\s+(.+?)\s*$/);
    const name = headingMatch ? headingMatch[1].trim() : `(universe ${idx + 1})`;
    return { originalIndex: idx, name, body };
  });

  const scored = blocks.map((b) => {
    const validated = (b.body.match(/—\s*Validated\b/gi) ?? []).length;
    const dropped = (b.body.match(/—\s*Not carried forward\b/gi) ?? []).length;
    const passed = (b.body.match(/PASSED UNEXPECTED BEHAVIOUR FILTER/gi) ?? []).length;
    const strongestMatch = b.body.match(/^>\s+(.+)$/m);
    const strongestLen = strongestMatch ? strongestMatch[1].trim().length : 0;
    const score = validated * 3 + passed * 2 - dropped + (strongestLen > 80 ? 1 : 0);
    return { ...b, score, validated, dropped, passed, strongestLen };
  });

  const kept = [...scored]
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.validated - a.validated ||
        a.originalIndex - b.originalIndex,
    )
    .slice(0, max)
    .sort((a, b) => a.originalIndex - b.originalIndex);

  console.warn(
    `[stage6] session=${sessionId} produced ${blocks.length} universes — trimming to strongest ${max}. ` +
      `Scores: [${scored
        .map(
          (s) =>
            `${s.originalIndex}:"${s.name}" score=${s.score} (v${s.validated}/pass${s.passed}/drop${s.dropped}/strongest${s.strongestLen})`,
        )
        .join(" | ")}]. Kept: [${kept.map((k) => `${k.originalIndex}:"${k.name}"`).join(" | ")}]`,
  );

  const body = kept.map((k) => k.body).join("\n\n");
  return (preamble ? preamble.trimEnd() + "\n\n" : "") + body + "\n";
}

export const runStage6 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => RunStage6Input.parse(input))
  .handler(async function* ({ data, context }) {
    await assertSessionAccess(data.sessionId, context.userId);
    await assertUpstreamStageOutput(data.sessionId, 6);
    const { data: session, error: loadErr } = await supabaseAdmin
      .from("sessions")
      .select("brand_name, category, stage_2_output, stage_3_output, stage_5_output, stage_6_output")
      .eq("id", data.sessionId)
      .single();
    if (loadErr || !session) throw new Error(`Session not found: ${loadErr?.message ?? "no row"}`);
    if (!session.stage_2_output) throw new Error("Stage 2 output (CMM) missing — cannot run Stage 6");
    if (!session.stage_3_output) throw new Error("Stage 3 output (Constraint Matrix) missing — cannot run Stage 6");
    if (!session.stage_5_output) throw new Error("Stage 5 output (Insights) missing — cannot run Stage 6");
    if (session.stage_6_output) {
      yield { delta: session.stage_6_output };
      yield { done: true as const, output: session.stage_6_output };
      return;
    }

    await supabaseAdmin
      .from("sessions")
      .update({ current_stage: 6, status: "running", stage_6_error: null })
      .eq("id", data.sessionId);

    const userMessage = buildStage6UserMessage({
      brandName: session.brand_name,
      category: session.category,
      stage5Output: session.stage_5_output,
      cmm: trimCMMForDownstream(session.stage_2_output),
      constraintMatrix: session.stage_3_output,
    });

    let output = "";
    for await (const delta of withStreamSafety(
      { sessionId: data.sessionId, stageLabel: "Stage 6", outputColumn: "stage_6_output", errorColumn: "stage_6_error" },
      streamClaude({
        systemPrompt: STAGE_6_SYSTEM_PROMPT,
        userMessage,
        maxTokens: 64000,
        sessionId: data.sessionId,
        stageLabel: "Stage 6",
        stageNumber: "6",
        stageName: "Insight Validation",
      }),
    )) {
        output += delta;
        yield { delta };
      }


    // HARD CAP: keep only the STRONGEST 5 universes so Stage 7 (and every
    // downstream stage) never receives more than its wall-clock budget can
    // process. Matches the Stage 7 top-5 cap. See capStage6Universes above
    // for the ranking rubric.
    const MAX_UNIVERSES = 5;
    output = capStage6Universes(output, MAX_UNIVERSES, data.sessionId);

    const { error: updateErr } = await supabaseAdmin
      .from("sessions")
      .update({ stage_6_output: output, stage_6_error: null, stage_status: "complete:6" })
      .eq("id", data.sessionId);
    if (updateErr) throw new Error(`Failed to save Stage 6 output: ${updateErr.message}`);

    yield { done: true as const, output };
  });
