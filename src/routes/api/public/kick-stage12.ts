import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { streamClaude } from "@/lib/claude.server";
import { STAGE_12_SYSTEM_PROMPT, buildStage12UserMessage } from "@/lib/stage12-prompt";
import {
  filterValidatedFromStage11,
  parseStage10Scores,
  buildFrozenScoresBlock,
} from "@/lib/stage12-filter";

/**
 * Internal recovery endpoint: re-runs Stage 12 server-side using existing
 * stored upstream outputs. Used to recover sessions where the original
 * Stage 12 stream was interrupted before stage_12_output was written.
 *
 * No upstream stages (1–11) are re-run. Reads only stored outputs.
 */
export const Route = createFileRoute("/api/public/kick-stage12")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let sessionId: string;
        try {
          const body = (await request.json()) as { sessionId?: string };
          sessionId = String(body.sessionId ?? "");
          if (!/^[0-9a-f-]{36}$/i.test(sessionId)) {
            return new Response("Invalid sessionId", { status: 400 });
          }
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const { data: session, error } = await supabaseAdmin
          .from("sessions")
          .select(
            "brand_name, category, stage_1_output, stage_2_output, stage_10_output, stage_11_output",
          )
          .eq("id", sessionId)
          .single();
        if (error || !session) {
          return new Response(`Session not found: ${error?.message ?? "no row"}`, { status: 404 });
        }
        if (!session.stage_11_output) {
          return new Response("Stage 11 output missing", { status: 400 });
        }

        const stage10Output = session.stage_10_output ?? "";
        const { filteredOutput, validated, eliminated } = filterValidatedFromStage11(
          session.stage_11_output,
        );
        if (validated.length === 0) {
          return new Response("Stage 11 produced no VALIDATED SMPs", { status: 400 });
        }
        const scores = parseStage10Scores(stage10Output);
        const frozenScoresBlock = buildFrozenScoresBlock(validated, scores);

        const userMessage = buildStage12UserMessage({
          brandName: session.brand_name,
          category: session.category,
          stage11FilteredOutput: filteredOutput,
          frozenScoresBlock,
          stage10Output,
          cmm: session.stage_2_output ?? "",
          stage1Output: session.stage_1_output ?? "",
          validatedCount: validated.length,
          eliminatedCount: eliminated.length,
        });

        await supabaseAdmin
          .from("sessions")
          .update({
            current_stage: 12,
            status: "running",
            stage_12_error: null,
            stage_12_output: null,
          })
          .eq("id", sessionId);

        let output = "";
        try {
          for await (const delta of streamClaude({
            systemPrompt: STAGE_12_SYSTEM_PROMPT,
            userMessage,
            maxTokens: 6000,
            sessionId,
            stageLabel: "Stage 12 (recovery)",
            stageNumber: "12",
            stageName: "Proposition Selection",
          })) {
            output += delta;
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Stage 12 failed";
          await supabaseAdmin
            .from("sessions")
            .update({ stage_12_error: msg })
            .eq("id", sessionId);
          return new Response(`Stage 12 failed: ${msg}`, { status: 500 });
        }

        const { error: updateErr } = await supabaseAdmin
          .from("sessions")
          .update({ stage_12_output: output, stage_12_error: null, status: "checkpoint" })
          .eq("id", sessionId);
        if (updateErr) {
          return new Response(`Failed to save Stage 12 output: ${updateErr.message}`, {
            status: 500,
          });
        }

        return Response.json({ ok: true, length: output.length });
      },
    },
  },
});
