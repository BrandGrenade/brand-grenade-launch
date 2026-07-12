// Intelligence Engine — single-call orchestrator.
//
// Reads an intelligence_sessions row, builds the system + user prompts
// from src/lib/intelligence/*, streams a single Claude Sonnet 4.6 call,
// writes running:1..running:10 progress markers as the response streams,
// parses the final JSON (with lenient repair), and persists the report
// plus a briefing-room handoff payload.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { streamClaude } from "./claude.server";
import { parseJsonLenient } from "./loc/json-sanitize";
import { buildSystemPrompt } from "./intelligence/system-prompt";
import { buildUserMessage, type IntelligenceInputs } from "./intelligence/user-message";

const RunInput = z.object({
  intelligenceSessionId: z.string().uuid(),
});

const MAX_RETRIES = 3;
const MAX_TOKENS = 16000;
const MODEL = "claude-sonnet-4-6";
export const INTELLIGENCE_TEMPERATURE = 0.4;

type BriefType = "commercial" | "government";

interface PrebriefForBriefingRoom {
  strategic_anchor?: string;
  tension?: string;
  audience?: string;
  cultural_context?: string;
  creative_territory_direction?: string;
  must_include?: string[];
  must_avoid?: string[];
}

interface Territory {
  id: string;
  name?: string;
  prebrief_for_briefing_room?: PrebriefForBriefingRoom;
  [key: string]: unknown;
}

interface IntelligenceReport {
  completeness_assessment?: unknown;
  executive_summary?: string;
  territories?: Territory[];
  recommended_primary_territory_id?: string;
  [key: string]: unknown;
}

export type RunIntelligenceResult =
  | { success: true; sessionId: string }
  | { success: false; sessionId: string; error: string };

function normaliseBriefType(raw: string | null | undefined): BriefType {
  return raw?.toLowerCase().trim() === "government" ? "government" : "commercial";
}

export const runIntelligenceAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RunInput.parse(input))
  .handler(async ({ data, context }): Promise<RunIntelligenceResult> => {
    const { supabase, userId } = context;
    const sessionId = data.intelligenceSessionId;

    // 01 — Read and authorise.
    const { data: row, error: readErr } = await supabase
      .from("intelligence_sessions")
      .select("*")
      .eq("id", sessionId)
      .maybeSingle();

    if (readErr || !row) {
      return { success: false, sessionId, error: "Session not found" };
    }
    if (row.user_id !== userId) {
      return { success: false, sessionId, error: "Unauthorised" };
    }

    // Guard: another run already in progress.
    if (row.status === "running") {
      return { success: false, sessionId, error: "A run is already in progress for this session" };
    }

    // Guard: retry ceiling.
    if ((row.retry_count ?? 0) >= MAX_RETRIES) {
      return {
        success: false,
        sessionId,
        error: `Retry limit reached (${MAX_RETRIES}). Reset retry_count to try again.`,
      };
    }

    // Load-bearing service-role writer so status updates survive RLS during
    // long streams and after the request context tears down.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    type IntelligenceUpdate =
      import("@/integrations/supabase/types").Database["public"]["Tables"]["intelligence_sessions"]["Update"];
    const writeStatus = async (patch: IntelligenceUpdate): Promise<void> => {
      try {
        await supabaseAdmin.from("intelligence_sessions").update(patch).eq("id", sessionId);
      } catch {
        // status writes are best-effort
      }
    };

    // 02 — Mark running.
    await writeStatus({
      status: "running",
      started_at: new Date().toISOString(),
      stage_status: "running:0",
      current_layer: 0,
      last_error: null,
    });

    const briefType = normaliseBriefType(
      typeof (row as { brief_type?: string | null }).brief_type === "string"
        ? (row as { brief_type?: string | null }).brief_type ?? null
        : null,
    );

    // 03 — System prompt.
    const systemPrompt = buildSystemPrompt(briefType);

    // 04 — User message from the six research inputs + framing fields.
    // brief_type / markets / audience_context_notes are not first-class
    // columns on the current schema; derive them from row fields that
    // carry the same information (territory_input holds market scope,
    // additional_context holds audience/other notes).
    const inputs: IntelligenceInputs = {
      brand_name: row.brand_name ?? null,
      category: row.category ?? null,
      brief_type: briefType,
      markets: row.territory_input ?? null,
      audience_context_notes: row.additional_context ?? null,
      input_primary_consumer: row.input_primary_consumer ?? null,
      input_brand_health: row.input_brand_health ?? null,
      input_competitive_audit: row.input_competitive_audit ?? null,
      input_cultural_trends: row.input_cultural_trends ?? null,
      input_audience_segmentation: row.input_audience_segmentation ?? null,
      input_bg_intel_pack: row.input_bg_intel_pack ?? null,
    };
    const userMessage = buildUserMessage(inputs);

    // 05/06 — Stream the single Claude call and publish running:1..running:10
    // heartbeats keyed off cumulative character count. Ten evenly-spaced
    // markers give the client a monotonically increasing signal to poll
    // against while the model streams.
    let accumulated = "";
    let lastLayerPublished = 0;

    // Expected total ~ MAX_TOKENS * 4 chars; step in tenths.
    const STEP_CHARS = Math.floor((MAX_TOKENS * 4) / 10);

    try {
      const stream = streamClaude({
        systemPrompt,
        userMessage,
        maxTokens: MAX_TOKENS,
        model: MODEL,
        temperature: INTELLIGENCE_TEMPERATURE,
        skipUniversalWrapper: true, // Intelligence Engine owns its own system prompt
        stageLabel: "Intelligence Engine",
        stageNumber: "IE",
        stageName: "Intelligence Engine",
      });

      for await (const delta of stream) {
        accumulated += delta;
        const layer = Math.min(10, Math.max(1, Math.floor(accumulated.length / STEP_CHARS) + 1));
        if (layer > lastLayerPublished) {
          lastLayerPublished = layer;
          await writeStatus({
            stage_status: `running:${layer}`,
            current_layer: layer,
          });
        }
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown streaming error";
      await writeStatus({
        status: "failed",
        last_error: message,
        retry_count: (row.retry_count ?? 0) + 1,
        final_report: accumulated.length > 0 ? accumulated : null,
      });
      return { success: false, sessionId, error: message };
    }

    const raw = accumulated.trim();
    if (!raw) {
      await writeStatus({
        status: "failed",
        last_error: "Empty response from model",
        retry_count: (row.retry_count ?? 0) + 1,
      });
      return { success: false, sessionId, error: "Empty response from model" };
    }

    // Strip an accidental fenced ```json ... ``` wrapper if the model
    // produced one despite the contract.
    const stripped = raw
      .replace(/^\s*```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();

    // 07 — Parse (with lenient repair pass inside parseJsonLenient).
    let parsed: IntelligenceReport | null = null;
    let parseError: string | null = null;
    try {
      parsed = parseJsonLenient<IntelligenceReport>(stripped);
    } catch (e) {
      parseError = e instanceof Error ? e.message : "Invalid JSON response";
    }

    if (!parsed) {
      await writeStatus({
        status: "failed",
        last_error: `Invalid JSON response: ${parseError ?? "unknown"}`,
        retry_count: (row.retry_count ?? 0) + 1,
        final_report: raw, // preserve raw for debugging
      });
      return { success: false, sessionId, error: "Invalid JSON response" };
    }

    // 08 — Extract handoff payload = the recommended primary territory's prebrief.
    const territories = Array.isArray(parsed.territories) ? parsed.territories : [];
    const recommendedId = parsed.recommended_primary_territory_id ?? null;
    const primary =
      (recommendedId ? territories.find((t) => t.id === recommendedId) : undefined) ??
      territories[0] ??
      null;
    const handoffPayload = primary?.prebrief_for_briefing_room ?? null;

    const reportMetadata = {
      completeness_assessment: parsed.completeness_assessment ?? null,
      executive_summary: parsed.executive_summary ?? null,
      recommended_primary_territory_id: recommendedId,
      territory_count: territories.length,
    };

    await writeStatus({
      status: "complete",
      completed_at: new Date().toISOString(),
      stage_status: "complete:10",
      current_layer: 10,
      final_report: JSON.stringify(parsed),
      report_metadata: reportMetadata as unknown as import("@/integrations/supabase/types").Json,
      handoff_payload: handoffPayload as unknown as import("@/integrations/supabase/types").Json | null,
      handoff_written_at: handoffPayload ? new Date().toISOString() : null,
      last_error: null,
    });

    // 09
    return { success: true, sessionId };
  });

