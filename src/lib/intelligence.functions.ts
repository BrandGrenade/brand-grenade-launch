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
import { withIntelligenceWatchdog } from "./intelligence-stream-watchdog";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type SupabaseAuthedClient = SupabaseClient<Database>;




import { parseJsonLenient } from "./loc/json-sanitize";
import { buildSystemPrompt } from "./intelligence/system-prompt";
import { buildUserMessage, type IntelligenceInputs } from "./intelligence/user-message";

const RunInput = z.object({
  intelligenceSessionId: z.string().uuid(),
  /** Optional free-text human redirect applied to this re-run only. */
  instructions: z.string().trim().max(8000).optional(),
});


const FileMetaSchema = z.object({
  field: z.string(),
  filename: z.string(),
  extracted_text_preview: z.string(),
  file_type: z.string(),
  upload_status: z.enum(["complete", "error"]),
});

const CreateInput = z.object({
  brand_name: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(200),
  brief_type: z.enum(["commercial", "government"]),
  markets: z.string().trim().max(500).nullish(),
  audience_context_notes: z.string().trim().max(2000).nullish(),
  input_primary_consumer: z.string().max(400_000).nullish(),
  input_brand_health: z.string().max(400_000).nullish(),
  input_competitive_audit: z.string().max(400_000).nullish(),
  input_cultural_trends: z.string().max(400_000).nullish(),
  input_audience_segmentation: z.string().max(400_000).nullish(),
  input_bg_intel_pack: z.string().max(400_000).nullish(),
  input_files: z.array(FileMetaSchema).max(100).optional(),
});

export const createIntelligenceSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateInput.parse(input))
  .handler(async ({ data, context }): Promise<{ sessionId: string }> => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("intelligence_sessions")
      .insert({
        user_id: userId,
        brand_name: data.brand_name,
        category: data.category,
        // brief_type / markets / audience are not first-class columns.
        // Store brief_type in report_metadata atomically with the insert so
        // it can NEVER be lost between insert and a follow-up update.
        territory_input: data.markets ?? null,
        additional_context: data.audience_context_notes ?? null,
        input_primary_consumer: data.input_primary_consumer ?? null,
        input_brand_health: data.input_brand_health ?? null,
        input_competitive_audit: data.input_competitive_audit ?? null,
        input_cultural_trends: data.input_cultural_trends ?? null,
        input_audience_segmentation: data.input_audience_segmentation ?? null,
        input_bg_intel_pack: data.input_bg_intel_pack ?? null,
        input_files: (data.input_files ?? []) as unknown as import("@/integrations/supabase/types").Json,
        status: "draft",
        report_metadata: { brief_type: data.brief_type } as unknown as import("@/integrations/supabase/types").Json,
      })
      .select("id")
      .single();
    if (error || !row) {
      throw new Error(error?.message ?? "Failed to create intelligence session");
    }
    return { sessionId: row.id };
  });


const UpdateInput = CreateInput.extend({
  intelligenceSessionId: z.string().uuid(),
});

export const updateAndRerunIntelligenceSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdateInput.parse(input))
  .handler(async ({ data, context }): Promise<{ sessionId: string }> => {
    const { supabase, userId } = context;
    const sessionId = data.intelligenceSessionId;

    const { data: existing, error: readErr } = await supabase
      .from("intelligence_sessions")
      .select("id, user_id, status, stage_status, current_layer, final_report, report_metadata, retry_count, last_error, started_at, completed_at")
      .eq("id", sessionId)
      .maybeSingle();
    if (readErr || !existing) throw new Error("Intelligence session not found");
    if (existing.user_id !== userId) throw new Error("Unauthorised");

    const existingMeta =
      existing.report_metadata &&
      typeof existing.report_metadata === "object" &&
      !Array.isArray(existing.report_metadata)
        ? (existing.report_metadata as Record<string, unknown>)
        : {};
    const hasReport = Boolean(existing.final_report);

    const { error: updateErr } = await supabase
      .from("intelligence_sessions")
      .update({
        brand_name: data.brand_name,
        category: data.category,
        territory_input: data.markets ?? null,
        additional_context: data.audience_context_notes ?? null,
        input_primary_consumer: data.input_primary_consumer ?? null,
        input_brand_health: data.input_brand_health ?? null,
        input_competitive_audit: data.input_competitive_audit ?? null,
        input_cultural_trends: data.input_cultural_trends ?? null,
        input_audience_segmentation: data.input_audience_segmentation ?? null,
        input_bg_intel_pack: data.input_bg_intel_pack ?? null,
        input_files: (data.input_files ?? []) as unknown as import("@/integrations/supabase/types").Json,
        // Save inputs only. Do not start analysis or clear an existing report.
        status: hasReport ? "complete" : "draft",
        stage_status: hasReport ? existing.stage_status : null,
        current_layer: hasReport ? existing.current_layer : 0,
        report_metadata: {
          ...existingMeta,
          brief_type: data.brief_type,
        } as unknown as import("@/integrations/supabase/types").Json,
        retry_count: hasReport ? existing.retry_count : 0,
        last_error: hasReport ? existing.last_error : null,
        started_at: hasReport ? existing.started_at : null,
        completed_at: hasReport ? existing.completed_at : null,
      })
      .eq("id", sessionId);
    if (updateErr) throw new Error(updateErr.message);

    // Manual run is triggered separately by the user from the report page.
    return { sessionId };
  });


const MAX_RETRIES = 3;
const MAX_TOKENS = 32000;
const MODEL = "claude-sonnet-4-6";
export const INTELLIGENCE_TEMPERATURE = 0.4;

type BriefType = "commercial" | "government";

interface PrebriefForBriefingRoom {
  strategic_anchor?: string;
  tension?: string;
  audience?: string;
  cultural_context?: string;
  competitive_context?: string;
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

/** A 'running' row with no heartbeat for this long is treated as dead. */
const STALE_RUN_MS = 4 * 60_000;


/**
 * Dispatcher. The analysis itself is a multi-minute streamed model call, so it
 * MUST NOT be awaited inside the browser's request — a closed tab, reload, or
 * dropped connection kills the Worker mid-flight and the row hangs on
 * `running` forever. We hand the work to `ctx.waitUntil()` and return
 * immediately; `/intelligence/$id` polls the row every 3s for progress.
 */
export const runIntelligenceAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RunInput.parse(input))
  .handler(async ({ data, context }): Promise<RunIntelligenceResult> => {
    const { supabase, userId } = context;
    const sessionId = data.intelligenceSessionId;

    // Durable dispatch marker, written INSIDE the request (not in the
    // background continuation). Without it a lost background invocation is
    // indistinguishable from a request that never arrived: the row simply
    // stays `draft` with started_at and last_error null — exactly the state
    // session cd9acf53 was found in. With it, every accepted dispatch is
    // visible, and a dead worker leaves a stale `running` row the takeover
    // guard below can reclaim.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    try {
      const patch: Record<string, unknown> = {
        status: "running",
        stage_status: "queued",
        started_at: new Date().toISOString(),
        current_layer: 0,
        last_error: null,
      };
      const instructions = data.instructions?.trim();
      if (instructions) {
        // Human redirect for this re-run: persisted so the background worker
        // (which re-reads the row) picks it up, and the retry ceiling is
        // reset because this is a deliberate, directed re-run.
        const { data: cur } = await supabaseAdmin
          .from("intelligence_sessions")
          .select("report_metadata, final_report")
          .eq("id", sessionId)
          .maybeSingle();
        const meta =
          cur?.report_metadata && typeof cur.report_metadata === "object" && !Array.isArray(cur.report_metadata)
            ? (cur.report_metadata as Record<string, unknown>)
            : {};
        patch["report_metadata"] = {
          ...meta,
          redirect_instructions: instructions,
          redirect_previous_report: (cur?.final_report ?? "").slice(0, 40000) || null,
          redirect_at: new Date().toISOString(),
        };
        patch["retry_count"] = 0;
      }
      await supabaseAdmin
        .from("intelligence_sessions")
        .update(patch as never)
        .eq("id", sessionId);
    } catch (e) {
      console.error(`[intelligence:${sessionId}] could not write dispatch marker`, e);
    }


    // The background job returns failure objects rather than throwing, so a
    // rejected-promise logger alone loses every early-exit reason (session not
    // found, unauthorised, run-in-progress, retry ceiling). Record them.
    const { scheduleBackground } = await import("./background.server");
    scheduleBackground(
      executeIntelligenceRun(supabase, userId, sessionId, true).then(async (result) => {
        if (result.success) return result;
        console.error(
          `[intelligence:${sessionId}] run did not start: ${result.error}`,
        );
        try {
          await supabaseAdmin
            .from("intelligence_sessions")
            .update({ status: "failed", last_error: `Run did not start: ${result.error}` })
            .eq("id", sessionId);
        } catch {
          /* best effort */
        }
        return result;
      }),
      `intelligence:${sessionId}`,
    );
    return { success: true, sessionId };
  });



export { STALE_RUN_MS };

export async function executeIntelligenceRun(
  supabase: SupabaseAuthedClient,
  userId: string | undefined,
  sessionId: string,
  /** Set when this call owns the dispatch marker it just wrote. */
  ownsDispatch = false,
): Promise<RunIntelligenceResult> {
  {


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

    // Guard: another run already in progress — unless that run is provably
    // dead. A live run heartbeats updated_at every few seconds (see the
    // watchdog wiring below), so a row whose updated_at has not moved for
    // STALE_RUN_MS is a stalled Worker and may be taken over.
    if (!ownsDispatch && row.status === "running" && row.stage_status !== "queued") {
      const lastBeat = row.updated_at ? Date.parse(row.updated_at) : 0;
      const staleFor = Date.now() - lastBeat;
      if (!Number.isFinite(lastBeat) || staleFor < STALE_RUN_MS) {
        return { success: false, sessionId, error: "A run is already in progress for this session" };
      }
      console.warn(
        `[intelligence] session=${sessionId} taking over stalled run (no heartbeat for ${Math.round(
          staleFor / 1000,
        )}s)`,
      );
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

    // Snapshot the existing report BEFORE anything overwrites it. Partial
    // stream persistence writes into final_report while the run is in flight,
    // so this must happen before the first write of the run, on every entry
    // point (UI dispatch, redirect re-run, watchdog takeover).
    if (row.final_report) {
      const { snapshotIntelligenceReport } = await import("./intelligence-versions.server");
      await snapshotIntelligenceReport(sessionId, "before-rerun");
    }

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

    const metaBriefType =
      row.report_metadata && typeof row.report_metadata === "object" && !Array.isArray(row.report_metadata)
        ? (row.report_metadata as Record<string, unknown>).brief_type
        : null;
    const briefType = normaliseBriefType(typeof metaBriefType === "string" ? metaBriefType : null);

    // 03 — System prompt.
    // Strategic Objective branching: when the objective was carried across the
    // handoff into report_metadata, Category Creation forces Type 03 as the
    // primary territory lens. Absent an objective this is a no-op.
    const metaObjective =
      row.report_metadata && typeof row.report_metadata === "object" && !Array.isArray(row.report_metadata)
        ? (row.report_metadata as Record<string, unknown>)["strategic_objective"]
        : null;
    const { normaliseObjective, objectiveDirective } = await import("./strategic-objective");
    const systemPrompt =
      buildSystemPrompt(briefType) +
      objectiveDirective(normaliseObjective(metaObjective), "intelligence");

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
    let userMessage = buildUserMessage(inputs);

    // Human redirect (session-level "Retry with instructions"). Applied once:
    // the marker is cleared as soon as it has been folded into the prompt so a
    // later untargeted re-run does not silently re-apply it.
    {
      const metaAll =
        row.report_metadata && typeof row.report_metadata === "object" && !Array.isArray(row.report_metadata)
          ? (row.report_metadata as Record<string, unknown>)
          : {};
      const redirect = typeof metaAll["redirect_instructions"] === "string"
        ? (metaAll["redirect_instructions"] as string).trim()
        : "";
      if (redirect) {
        const { buildFeedbackInjection } = await import("./feedback-injection");
        const prevReport = typeof metaAll["redirect_previous_report"] === "string"
          ? (metaAll["redirect_previous_report"] as string)
          : null;
        const injection = buildFeedbackInjection({
          feedback: redirect,
          previousOutput: prevReport,
          stageLabel: "Intelligence Lab report",
        });
        userMessage = `${injection.prefix}${userMessage}${injection.suffix}`;
        const cleared = { ...metaAll };
        delete cleared["redirect_instructions"];
        delete cleared["redirect_previous_report"];
        const log = Array.isArray(cleared["redirect_log"]) ? (cleared["redirect_log"] as unknown[]) : [];
        log.push({ instructions: redirect.slice(0, 4000), at: new Date().toISOString() });
        cleared["redirect_log"] = log.slice(-50);
        await writeStatus({
          report_metadata: cleared as unknown as import("@/integrations/supabase/types").Json,
        });
      }
    }


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

      // Stall watchdog: a dead connection now raises a real error (caught
      // below and persisted as status='failed' + last_error) instead of
      // hanging in 'running' forever. The heartbeat keeps updated_at moving
      // while tokens actually flow, which is what makes a stall detectable.
      const guarded = withIntelligenceWatchdog(stream, {
        onHeartbeat: async () => {
          await writeStatus({ stage_status: `running:${Math.max(1, lastLayerPublished)}` });
        },
      });

      for await (const delta of guarded) {
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

    const priorMeta =
      row.report_metadata && typeof row.report_metadata === "object" && !Array.isArray(row.report_metadata)
        ? { ...(row.report_metadata as Record<string, unknown>) }
        : {};
    // The redirect marker is single-use; never carry it into the final row.
    delete priorMeta["redirect_instructions"];
    delete priorMeta["redirect_previous_report"];
    const reportMetadata = {
      ...priorMeta,
      // Preserve brief_type so downstream hydration (report page, PDF export,
      // Government Addendum rendering) reflects the user's original choice.
      brief_type: briefType,
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
  }
}


// ─── Briefing Room handoff ───────────────────────────────────────────────

import {
  INTELLIGENCE_SENTINEL,
  buildPreBriefText,
} from "./intelligence/prebrief-text";

export { INTELLIGENCE_SENTINEL };

const HandoffInput = z.object({
  intelligenceSessionId: z.string().uuid(),
  selectedTerritoryId: z.string().min(1),
});


export const createBriefingRoomFromIntelligence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => HandoffInput.parse(input))
  .handler(async ({ data, context }): Promise<{ workspaceId: string }> => {
    const { supabase, userId } = context;

    const { data: row, error: readErr } = await supabase
      .from("intelligence_sessions")
      .select("*")
      .eq("id", data.intelligenceSessionId)
      .maybeSingle();
    if (readErr || !row) throw new Error("Intelligence session not found");
    if (row.user_id !== userId) throw new Error("Unauthorised");
    if (row.status !== "complete" || !row.final_report) {
      throw new Error("Intelligence session is not complete");
    }

    let report: IntelligenceReport;
    try {
      report = JSON.parse(row.final_report) as IntelligenceReport;
    } catch {
      throw new Error("Intelligence report is not valid JSON");
    }
    const territories = Array.isArray(report.territories) ? report.territories : [];
    const selected = territories.find((t) => t.id === data.selectedTerritoryId);
    if (!selected) throw new Error("Selected territory not found in report");
    const prebrief = selected.prebrief_for_briefing_room ?? {};

    const brandName = row.brand_name ?? "(unspecified)";
    const category = row.category ?? "(unspecified)";
    const territoryName =
      typeof selected.name === "string" && selected.name.trim()
        ? selected.name
        : `Territory ${selected.id}`;
    const territoryDescription =
      typeof (selected as { description?: unknown }).description === "string"
        ? ((selected as { description?: string }).description ?? "")
        : "";

    const rawBrief = buildPreBriefText({
      intelligenceSessionId: row.id,
      brandName,
      category,
      territoryName,
      territoryDescription,
      prebrief,
      executiveSummary: typeof report.executive_summary === "string" ? report.executive_summary : null,
    });

    // Ship BOTH the structured prebrief JSON (so downstream buildHandoffPayload
    // can map must_include/must_avoid/competitive_context/cultural_context into
    // their correct Step-5 fields) AND every raw research document uploaded to
    // the Intelligence Lab (so Steps 1–4 and Step 5 field-generation see source
    // material, not just the synthesised summary).
    const evidenceBlocks: Array<{ label: string; type: string; content: string }> = [
      {
        label: `Intelligence Engine — Territory: ${territoryName}`,
        type: "intelligence_prebrief",
        content: JSON.stringify(
          { intelligence_session_id: row.id, territory: selected },
          null,
          2,
        ),
      },
      {
        label: "Intelligence Engine — Prebrief JSON (structured signals)",
        type: "intelligence_prebrief_json",
        content: JSON.stringify(prebrief, null, 2),
      },
    ];
    const RESEARCH_FIELDS: Array<{ key: keyof typeof row; label: string }> = [
      { key: "input_primary_consumer", label: "01 — Primary Consumer Research" },
      { key: "input_brand_health", label: "02 — Brand Health Tracking Data" },
      { key: "input_competitive_audit", label: "03 — Competitive Communications Audit" },
      { key: "input_cultural_trends", label: "04 — Cultural Trend Analysis" },
      { key: "input_audience_segmentation", label: "05 — Audience Segmentation Research" },
      { key: "input_bg_intel_pack", label: "06 — Brand Grenade Intelligence Pack" },
    ];
    for (const { key, label } of RESEARCH_FIELDS) {
      const raw = row[key];
      const content = typeof raw === "string" ? raw.trim() : "";
      if (content) {
        evidenceBlocks.push({ label, type: "intelligence_research_input", content });
      }
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ws, error: insertErr } = await supabaseAdmin
      .from("briefing_room_workspaces")
      .insert({
        user_id: userId!,
        brand_name: brandName,
        category,
        raw_brief: rawBrief,
        supporting_evidence: evidenceBlocks,
      })
      .select("id")
      .single();
    if (insertErr || !ws) {
      throw new Error(insertErr?.message ?? "Failed to create briefing workspace");
    }

    // Record handoff on the intelligence session.
    await supabaseAdmin
      .from("intelligence_sessions")
      .update({
        handoff_payload: {
          workspace_id: (ws as { id: string }).id,
          selected_territory_id: selected.id,
          prebrief,
        } as unknown as import("@/integrations/supabase/types").Json,
        handoff_written_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    return { workspaceId: (ws as { id: string }).id };
  });

