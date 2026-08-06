// Tier Two Full Integrity Check — Brand Grenade Pre-Flight Integrity System
//
// Runs 12 deep integrity checks using the hybrid approach:
//   - Real pipeline execution on a TestBrand session for Phase 1 (Stages 1–16)
//   - Real Phase 2 chain (Stage 17 → select → 17B → 18)
//   - Two parallel sessions running Stage 1 to verify concurrency safety
//   - Structural checks (prompt presence, token caps, sanitiser config, route)
//
// All sessions are tagged `is_preflight_test = true` and deleted in a finally
// block only after a fully green run. Failed runs preserve their TestBrand
// sessions for forensic debugging. A unique partial index on preflight_checks
// (status='running', check_type='full') enforces a single global runner;
// rows older than 25 minutes can be force-overridden.
//
// Streaming async generator: client subscribes and renders live progress.
// Persists full per-check results to preflight_checks.tier_two_results.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { STAGE_9_SYSTEM_PROMPT } from "@/lib/stage9-prompt";
import { CONDITIONALLY_BANNED_STAGE9, UNIVERSAL_BANNED_STAGE9, conditionalStage9HitAllowedInLeftOfCentre, conditionalStage9HitAllowedInCore } from "@/lib/stage9-banned-words";
import { findBannedWordHits } from "@/lib/output-banned-word-gate";
import detonationCanvasSource from "@/routes/detonation_.canvas.tsx?raw";
import detonationSource from "@/routes/detonation.tsx?raw";
import claudeServerSource from "@/lib/claude.server.ts?raw";
import sanitiseSource from "@/lib/sanitise-output.ts?raw";

// runStage1 is no longer invoked server-side from this module. The client
// driver runs Stage 1 as its own server-fn RPC after check_1_handoff.

import { runStage9 } from "@/lib/stage9.functions";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FullCheckId =
  | "stage_1_brief_analysis"
  | "phase1a_chain_2_to_7"
  | "stage_8_checkpoint_b"
  | "stage_prompts_integrity"
  | "stage_9_edt_guard_output"
  | "stage_10_11_evaluation_chain"
  | "stage_12_smp_selection"
  | "phase1_completion_13_to_16"
  | "sanitiser_and_token_caps"
  | "phase2_detonation_chain"
  | "canvas_to_detonation_navigation"
  | "concurrent_session_integrity"
  | "loc_track_integrity"
  | "smp_verbatim_carriage_20_20b_21";

export type FullCheckResult = {
  id: FullCheckId;
  index: number;
  name: string;
  status: "pending" | "running" | "pass" | "fail";
  durationMs: number | null;
  detail: string | null;
  remediation: string | null;
};

export type TierTwoEvent =
  | { type: "lock_failed"; reason: string; existingStartedAt: string | null }
  | { type: "start"; recordId: string; checks: FullCheckResult[] }
  | { type: "check_start"; index: number; id: FullCheckId; name: string }
  | { type: "check_progress"; index: number; message: string }
  | { type: "check_done"; result: FullCheckResult }
  | {
      // Emitted by runTierTwoFullCheck after acquiring the lock and inserting
      // the TestBrand session. The client drives Check 1 (Stage 1 — Brief
      // Analysis) by invoking runStage1 as its OWN server-fn RPC so it gets
      // a fresh Cloudflare Worker wall-clock budget — same pattern as every
      // other long Claude call in the runner.
      type: "check_1_handoff";
      recordId: string;
      sessionId: string;
      sessionIds: string[];
      results: FullCheckResult[];
      startedAtMs: number;
    }
  | {
      // Emitted after Check 1. The client drives Check 2 by invoking each of
      // Stages 2, 3, 4, 4B, 5, 6, and 7 as separate server-fn RPCs so every
      // long Claude call receives a fresh wall-clock budget.
      type: "check_2_handoff";
      recordId: string;
      sessionId: string;
      sessionIds: string[];
      results: FullCheckResult[];
      startedAtMs: number;
    }
  | {
      // Emitted after Check 2 (Phase 1A chain) completes. The client drives
      // Check 3 (Stage 8 + Checkpoint B) by invoking each as a SEPARATE
      // server-fn RPC — each call is a fresh Worker invocation with its own
      // wall-clock budget — then opens runTierTwoChecksFrom4 to continue
      // checks 4–7 and the existing Check 8 handoff.
      type: "check_3_handoff";
      recordId: string;
      sessionId: string;
      sessionIds: string[];
      results: FullCheckResult[];
      startedAtMs: number;
    }
  | {
      // Emitted after Check 5. The client drives Check 6 by invoking Stage 10
      // and Stage 11 as separate server-fn RPCs.
      type: "check_6_handoff";
      recordId: string;
      sessionId: string;
      sessionIds: string[];
      results: FullCheckResult[];
      startedAtMs: number;
    }
  | {
      // Emitted after Check 6. The client drives Check 7 (Stage 12 +
      // selection/rationale persistence) as separate server-fn RPCs with the
      // same watchdog protection as the other long generation checks.
      type: "check_7_handoff";
      recordId: string;
      sessionId: string;
      sessionIds: string[];
      results: FullCheckResult[];
      startedAtMs: number;
    }
  | {
      // Emitted after Check 7 completes. The client is expected to drive
      // Check 8 (Stages 13–16) by invoking each stage as a separate server
      // function call — each call is a fresh Worker invocation with its own
      // wall-clock budget — then resume checks 9–12 via runTierTwoChecksFrom9.
      type: "check_8_handoff";
      recordId: string;
      sessionId: string;
      sessionIds: string[];
      results: FullCheckResult[];
      startedAtMs: number;
    }
  | {
      // Emitted after Check 9. The client drives Check 10 by invoking Stage 17,
      // territory selection, Stage 17B, and Stage 18 as separate RPCs.
      type: "check_10_handoff";
      recordId: string;
      sessionId: string;
      sessionIds: string[];
      results: FullCheckResult[];
      startedAtMs: number;
    }
  | {
      // Emitted after Check 11. The client drives Check 12 by running the two
      // Stage 1 concurrency calls as separate RPCs, then finalises the run.
      type: "check_12_handoff";
      recordId: string;
      sessionIds: string[];
      concurrentSessionIds: [string, string];
      results: FullCheckResult[];
      startedAtMs: number;
    }
  | {
      type: "done";
      recordId: string;
      overall: "ready" | "issue_detected";
      results: FullCheckResult[];
      sessionIdsCleaned: string[];
      totalDurationMs: number;
    }
  | { type: "error"; message: string };

// Brand Intelligence fixture used by Check 8. Exported so the client driver
// can seed it via the saveBrandIntelligence server fn before running Stage 13.
export const PREFLIGHT_TESTBRAND_BRAND_INTELLIGENCE = {
  brand_values: "Legend. Gregarious. Abundant.",
  tone_of_voice: "Confident. Cheeky. Witty.",
  asset_1: "Live Large — Strong and ownable.",
  asset_2: "Wrestle Responsibly — Strong and ownable.",
  asset_3: "TestBrand Hero Campaign — Present but weak.",
  notes: "Preflight TestBrand — automated brand intelligence fixture for integrity check.",
} as const;

const CHECK_DEFS: ReadonlyArray<{ id: FullCheckId; name: string }> = [
  { id: "stage_1_brief_analysis", name: "Stage 1 — Brief Analysis on TestBrand" },
  { id: "phase1a_chain_2_to_7", name: "Stages 2–7 — Phase 1A sequential chain" },
  { id: "stage_8_checkpoint_b", name: "Stage 8 — Proposition + Checkpoint B confirmation" },
  { id: "stage_prompts_integrity", name: "All 22 stage system prompts present & non-empty" },
  { id: "stage_9_edt_guard_output", name: "Stage 9 — EDT guard output sanitisation" },
  { id: "stage_10_11_evaluation_chain", name: "Stages 10–11 — Evaluation chain" },
  { id: "stage_12_smp_selection", name: "Stage 12 — SMP selection + rationale persistence" },
  { id: "phase1_completion_13_to_16", name: "Stages 13–15 — Phase 1 completion + Stage 16 gate correctly locked pre-Phase 2" },
  { id: "sanitiser_and_token_caps", name: "Sanitiser configuration + token caps on all stages" },
  { id: "phase2_detonation_chain", name: "Phase 2 chain (17 → 22) + Stage 16 Document Assembly end-to-end" },
  { id: "canvas_to_detonation_navigation", name: "Three Truth Canvas → Detonation route navigation" },
  { id: "concurrent_session_integrity", name: "Concurrent session integrity (two parallel Stage 1 runs)" },
  { id: "loc_track_integrity", name: "Left-of-Centre track — 13 engines, anchors, validation, persistence" },
];

// ---------------------------------------------------------------------------
// Constants — TestBrand fixture
// ---------------------------------------------------------------------------

const TESTBRAND_BRAND_NAME = "Preflight TestBrand";
const TESTBRAND_CATEGORY = "Australian premium energy drink";
// Narrow-but-representative brief: one competitor, one target, one product claim.
// Rich enough to exercise the real multi-universe path (Stage 5/6 typically
// yields ~3–4 universes on this input), but not so category-rich that it
// only survives via the Stage 6 top-5 cap. This is the health-check baseline,
// NOT a worst-case stress test.
const TESTBRAND_BRIEF = `Brand: TestBrand. Category: Australian premium energy drink. Challenge: Red Bull owns the youth-and-urgency story in energy drinks, but the disciplined Australian man who trains seriously and reads ingredient labels has no drink built for his standard. Product: natural green-tea caffeine plus electrolytes — clean energy for people who track what they consume. Target: Australian men 30 to 40 who train four times a week and treat their intake as part of their training. Competitor: Red Bull owns urgency and youth and cannot credibly claim clean performance. Business objective: own the clean-performance territory in Australian energy drinks.`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type FinalDone<T> = T & { done: true };

async function drainGenerator<C extends { delta?: string; done?: true }>(
  generatorOrPromise: AsyncGenerator<C, void, unknown> | Promise<AsyncGenerator<C, void, unknown>>,
): Promise<FinalDone<C>> {
  const gen = (await generatorOrPromise) as AsyncGenerator<C, void, unknown>;
  let final: FinalDone<C> | null = null;
  for await (const chunk of gen) {
    if (chunk && (chunk as { done?: true }).done) {
      final = chunk as FinalDone<C>;
    }
  }
  if (!final) throw new Error("Stream ended without a final payload");
  return final;
}

function nowIso() {
  return new Date().toISOString();
}

function makeResults(): FullCheckResult[] {
  return CHECK_DEFS.map((def, i) => ({
    id: def.id,
    index: i + 1,
    name: def.name,
    status: "pending" as const,
    durationMs: null,
    detail: null,
    remediation: null,
  }));
}

async function persistResults(
  supabaseAdmin: typeof import("@/integrations/supabase/client.server").supabaseAdmin,
  recordId: string,
  results: FullCheckResult[],
): Promise<void> {
  await supabaseAdmin
    .from("preflight_checks")
    .update({ tier_two_results: results as unknown as never })
    .eq("id", recordId);
}

const StartInput = z.object({
  forceOverride: z.boolean().optional(),
  overrideReason: z.string().max(500).optional(),
});

// ---------------------------------------------------------------------------
// Main streaming server function
// ---------------------------------------------------------------------------

export const runTierTwoFullCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => StartInput.parse(i ?? {}))
  .handler(async function* ({ data, context }): AsyncGenerator<TierTwoEvent, void, unknown> {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // -----------------------------------------------------------------------
    // 1. Acquire global lock
    // -----------------------------------------------------------------------
    const STALE_MS = 25 * 60 * 1000;

    // Check for an existing 'running' full row
    const { data: existingRunning } = await supabaseAdmin
      .from("preflight_checks")
      .select("id, started_at")
      .eq("check_type", "full")
      .eq("status", "running")
      .order("started_at", { ascending: false })
      .limit(1);

    if (existingRunning && existingRunning.length > 0) {
      const row = existingRunning[0];
      const ageMs = Date.now() - new Date(row.started_at as string).getTime();
      if (ageMs < STALE_MS && !data.forceOverride) {
        yield {
          type: "lock_failed",
          reason: `A Tier Two check is already running (started ${Math.round(ageMs / 1000)}s ago). Wait or use override.`,
          existingStartedAt: row.started_at as string,
        };
        return;
      }
      // Mark stale/overridden row as abandoned so the unique index releases.
      await supabaseAdmin
        .from("preflight_checks")
        .update({
          status: "abandoned",
          completed_at: nowIso(),
          override_used: Boolean(data.forceOverride),
          override_timestamp: data.forceOverride ? nowIso() : null,
          override_reason: data.forceOverride
            ? (data.overrideReason ?? "Manual override")
            : `Auto-abandoned: stale (${Math.round(ageMs / 60000)}m old)`,
        })
        .eq("id", row.id);
    }

    // Insert our running row
    const { data: insertedRow, error: insertErr } = await supabaseAdmin
      .from("preflight_checks")
      .insert({
        check_type: "full",
        status: "running",
        started_by: context.userId,
        tier_two_results: makeResults() as unknown as never,
      })
      .select("id")
      .single();

    if (insertErr || !insertedRow) {
      yield {
        type: "error",
        message: `Failed to acquire preflight lock: ${insertErr?.message ?? "no row returned"}`,
      };
      return;
    }
    const recordId = insertedRow.id as string;

    const results = makeResults();
    yield { type: "start", recordId, checks: results };

    const startedAtMs = Date.now();
    const createdSessionIds = new Set<string>();
    let primarySessionId: string | null = null;
    // When true, the run hands off Check 8 to the client driver. The finally
    // block must NOT cleanup or finalise in that case — the resume server fn
    // (runTierTwoChecksFrom9) owns both responsibilities.
    let handedOff = false;

    // -----------------------------------------------------------------------
    // Per-check runner helper
    // -----------------------------------------------------------------------
    const runCheck = async function* (
      index1: number,
      fn: (emit: (msg: string) => void) => Promise<{ detail: string }>,
      remediationOnFail: string,
    ): AsyncGenerator<TierTwoEvent, FullCheckResult, unknown> {
      const idx = index1 - 1;
      const def = CHECK_DEFS[idx];
      const events: TierTwoEvent[] = [];
      const emit = (message: string) => {
        events.push({ type: "check_progress", index: index1, message });
      };
      results[idx] = { ...results[idx], status: "running" };
      await persistResults(supabaseAdmin, recordId, results);
      const started = Date.now();
      let res: FullCheckResult;
      try {
        const { detail } = await fn(emit);
        res = {
          ...results[idx],
          status: "pass",
          durationMs: Date.now() - started,
          detail,
          remediation: null,
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        res = {
          ...results[idx],
          status: "fail",
          durationMs: Date.now() - started,
          detail: msg,
          remediation: remediationOnFail,
        };
      }
      results[idx] = res;
      await persistResults(supabaseAdmin, recordId, results);
      return res;
    };

    try {
      // ---------------------------------------------------------------------
      // CHECK 1 — Hand off to client.
      // Create the primary TestBrand session, then yield check_1_handoff.
      // The client invokes runStage1 as its OWN server-fn RPC so Stage 1
      // gets a fresh Cloudflare Worker wall-clock budget — same pattern as
      // every other long Claude call in the runner. Running Stage 1 inline
      // here previously left Check 1 stuck in "pending" and cascaded every
      // downstream check into a skip.
      // ---------------------------------------------------------------------
      yield { type: "check_start", index: 1, id: CHECK_DEFS[0].id, name: CHECK_DEFS[0].name };
      yield { type: "check_progress", index: 1, message: "Creating TestBrand session (is_preflight_test=true)" };
      {
        const { data: s, error: sErr } = await supabaseAdmin
          .from("sessions")
          .insert({
            brand_name: TESTBRAND_BRAND_NAME,
            category: TESTBRAND_CATEGORY,
            brief_text: TESTBRAND_BRIEF,
            status: "running",
            current_stage: 1,
            dev_mode: false,
            user_id: context.userId,
            is_preflight_test: true,
          })
          .select("id")
          .single();
        if (sErr || !s) throw new Error(`Session insert failed: ${sErr?.message ?? "no row"}`);
        primarySessionId = s.id as string;
        createdSessionIds.add(primarySessionId);
        yield { type: "check_progress", index: 1, message: `TestBrand session created: ${primarySessionId.slice(0, 8)}` };
      }

      // Mark Check 1 as running so the dashboard reflects in-flight state
      // while the client invokes Stage 1 in its own Worker invocation.
      results[0] = { ...results[0], status: "running" };
      await persistResults(supabaseAdmin, recordId, results);

      handedOff = true;
      yield {
        type: "check_1_handoff",
        recordId,
        sessionId: primarySessionId ?? "",
        sessionIds: Array.from(createdSessionIds),
        results,
        startedAtMs,
      };
      return;


    } catch (fatal) {
      const msg = fatal instanceof Error ? fatal.message : String(fatal);
      yield { type: "error", message: `Fatal error during Tier Two: ${msg}` };
    } finally {
      // When the run has been handed off to the client driver for Check 8,
      // cleanup and finalisation are deferred — runTierTwoChecksFrom9 owns
      // both. Skipping here avoids deleting the in-progress TestBrand session
      // and avoids prematurely finalising the preflight_checks row.
      if (!handedOff) {
        const ids = Array.from(createdSessionIds);
        const failedCount = results.filter((r) => r.status === "fail").length;
        const overall: "ready" | "issue_detected" = failedCount === 0 ? "ready" : "issue_detected";
        // Preserve TestBrand sessions on failure for post-mortem.
        if (ids.length > 0 && failedCount === 0) {
          await supabaseAdmin.from("sessions").delete().in("id", ids);
        }

        await supabaseAdmin
          .from("preflight_checks")
          .update({
            status: "complete",
            completed_at: nowIso(),
            tier_two_results: results as unknown as never,
            overall_result: overall,
          })
          .eq("id", recordId);

        yield {
          type: "done",
          recordId,
          overall,
          results,
          sessionIdsCleaned: ids,
          totalDurationMs: Date.now() - startedAtMs,
        };
      }
    }
  });

// ---------------------------------------------------------------------------
// Read latest full check (for dashboard polling / hydration)
// ---------------------------------------------------------------------------

export const getLatestTierTwoCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("preflight_checks")
      .select("id, status, started_at, completed_at, tier_two_results, overall_result")
      .eq("check_type", "full")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ?? null;
  });

/**
 * Fetch the last N completed Tier Two runs' results. Used by the severity
 * classifier to detect a recurring transient — a "transient" that fails the
 * same way across multiple consecutive runs is escalated to BLOCKER.
 */
export const getRecentTierTwoResults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ limit: z.number().int().min(1).max(20).optional() }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("preflight_checks")
      .select("id, started_at, completed_at, tier_two_results, overall_result")
      .eq("check_type", "full")
      .eq("status", "complete")
      .order("started_at", { ascending: false })
      .limit(data.limit ?? 5);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ---------------------------------------------------------------------------
// Check 8 result recorder + resume stream (checks 9–12)
//
// The client drives Check 8 by invoking each Stage (13, 13B, 14, 14B, 14C,
// 15, 16) as its own server-fn RPC — each one is a fresh Cloudflare Worker
// invocation with its own wall-clock budget. After all seven stages finish,
// the client calls recordPreflightCheck8Result with the aggregated result,
// then opens runTierTwoChecksFrom9 to finish the run.
// ---------------------------------------------------------------------------

const FullCheckResultSchema = z.object({
  id: z.string(),
  index: z.number(),
  name: z.string(),
  status: z.enum(["pending", "running", "pass", "fail"]),
  durationMs: z.number().nullable(),
  detail: z.string().nullable(),
  remediation: z.string().nullable(),
});

export const recordPreflightResults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        recordId: z.string().uuid(),
        allResults: z.array(FullCheckResultSchema),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("preflight_checks")
      .update({ tier_two_results: data.allResults as unknown as never })
      .eq("id", data.recordId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// Flip checkpoint_a_confirmed=true on the preflight TestBrand session so the
// client-driven Check 2 chain (Stages 2–7) can proceed. Invoked after the
// client has run Check 1 (Stage 1) in its own Worker invocation.
export const confirmPreflightCheckpointA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ sessionId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("sessions")
      .update({ checkpoint_a_confirmed: true })
      .eq("id", data.sessionId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });


export const finalizePreflightRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        recordId: z.string().uuid(),
        allResults: z.array(FullCheckResultSchema),
        sessionIds: z.array(z.string().uuid()),
        startedAtMs: z.number(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const failedCount = data.allResults.filter((r) => r.status === "fail").length;
    const overall: "ready" | "issue_detected" = failedCount === 0 ? "ready" : "issue_detected";
    // Only clean up TestBrand sessions on a fully green run. If ANY check
    // failed, preserve the session(s) so their stage outputs (Stage 9
    // propositions, Stage 11 verdicts, etc.) remain queryable for
    // post-mortem — a test that wipes its own evidence on failure can't be
    // debugged. Preserved rows keep is_preflight_test=true so they can be
    // filtered out of live views and swept later manually.
    let sessionsCleaned: string[] = [];
    if (data.sessionIds.length > 0 && failedCount === 0) {
      await supabaseAdmin.from("sessions").delete().in("id", data.sessionIds);
      sessionsCleaned = data.sessionIds;
    }
    const { error } = await supabaseAdmin
      .from("preflight_checks")
      .update({
        status: "complete",
        completed_at: nowIso(),
        tier_two_results: data.allResults as unknown as never,
        overall_result: overall,
      })
      .eq("id", data.recordId);
    if (error) throw new Error(error.message);
    return {
      recordId: data.recordId,
      overall,
      results: data.allResults,
      sessionIdsCleaned: sessionsCleaned,
      sessionIdsPreserved: failedCount === 0 ? [] : data.sessionIds,
      totalDurationMs: Date.now() - data.startedAtMs,
    };
  });

export const recordPreflightCheck8Result = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        recordId: z.string().uuid(),
        allResults: z.array(FullCheckResultSchema),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("preflight_checks")
      .update({ tier_two_results: data.allResults as unknown as never })
      .eq("id", data.recordId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const runTierTwoChecksFrom9 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        recordId: z.string().uuid(),
        sessionId: z.string().uuid(),
        sessionIds: z.array(z.string().uuid()),
        priorResults: z.array(FullCheckResultSchema),
        startedAtMs: z.number(),
      })
      .parse(i),
  )
  .handler(async function* ({ data, context }): AsyncGenerator<TierTwoEvent, void, unknown> {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { recordId, sessionId, startedAtMs } = data;
    const results: FullCheckResult[] = data.priorResults.map((r) => ({
      ...r,
      id: r.id as FullCheckId,
    }));
    const createdSessionIds = new Set<string>(data.sessionIds);
    const primarySessionId = sessionId;
    let handedOff = false;

    const runCheck = async function* (
      index1: number,
      fn: (emit: (msg: string) => void) => Promise<{ detail: string }>,
      remediationOnFail: string,
    ): AsyncGenerator<TierTwoEvent, FullCheckResult, unknown> {
      const idx = index1 - 1;
      const def = CHECK_DEFS[idx];
      const events: TierTwoEvent[] = [];
      const emit = (message: string) => {
        events.push({ type: "check_progress", index: index1, message });
      };
      results[idx] = { ...results[idx], status: "running" };
      await persistResults(supabaseAdmin, recordId, results);
      const started = Date.now();
      let res: FullCheckResult;
      try {
        const { detail } = await fn(emit);
        res = {
          ...results[idx],
          status: "pass",
          durationMs: Date.now() - started,
          detail,
          remediation: null,
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        res = {
          ...results[idx],
          status: "fail",
          durationMs: Date.now() - started,
          detail: msg,
          remediation: remediationOnFail,
        };
      }
      // Emit any progress events buffered during fn execution.
      for (const ev of events) yield ev;
      results[idx] = res;
      await persistResults(supabaseAdmin, recordId, results);
      return res;
    };

    void context;

    try {
      // CHECK 9 — Sanitiser + token caps
      yield { type: "check_start", index: 9, id: CHECK_DEFS[8].id, name: CHECK_DEFS[8].name };
      {
        const gen = runCheck(
          9,
          async () => {
            const sanitise = await import("@/lib/sanitise-output");
            const sanitiseFns = Object.entries(sanitise).filter(([, v]) => typeof v === "function");
            if (sanitiseFns.length === 0) throw new Error("sanitise-output.ts exports no functions");
            if (!/sanitise|sanitize|strip|clean/i.test(sanitiseSource))
              throw new Error("sanitise-output.ts source lacks expected sanitisation keywords");
            const stageSources = import.meta.glob("@/lib/stage*.functions.ts", {
              query: "?raw",
              import: "default",
              eager: true,
            }) as Record<string, string>;
            const sectionSources = import.meta.glob("@/lib/stage*-sections.ts", {
              query: "?raw",
              import: "default",
              eager: true,
            }) as Record<string, string>;
            const stageFiles = Object.entries(stageSources).map(([path, src]) => ({
              name: path.split("/").pop() ?? path,
              src,
            }));
            if (stageFiles.length < 20)
              throw new Error(`Expected ≥20 stage*.functions.ts files, found ${stageFiles.length}`);
            const sectionLiteralFiles = Object.values(sectionSources).filter((src) =>
              /maxTokens\s*:\s*\d+/.test(src),
            ).length;
            const missingCap: string[] = [];
            for (const { name, src } of stageFiles) {
              const hasLiteralCap = /maxTokens\s*:\s*\d+/.test(src);
              const hasIdentifierCap =
                /maxTokens\s*:\s*[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]+)+/.test(src) &&
                sectionLiteralFiles > 0;
              if (!hasLiteralCap && !hasIdentifierCap) missingCap.push(name);
            }
            if (missingCap.length)
              throw new Error(`Stages missing explicit maxTokens cap: ${missingCap.join(", ")}`);
            if (!/maxTokens/.test(claudeServerSource))
              throw new Error("claude.server.ts does not reference maxTokens");
            return {
              detail: `Sanitiser exports ${sanitiseFns.length} function(s); all stage modules declare explicit maxTokens caps.`,
            };
          },
          "Add `maxTokens: <N>` to the callClaude/streamClaude call inside the named stage, or restore sanitise-output.ts exports.",
        );
        let result!: FullCheckResult;
        for (;;) {
          const r = await gen.next();
          if (r.done) {
            result = r.value as FullCheckResult;
            break;
          }
          yield r.value as TierTwoEvent;
        }
        yield { type: "check_done", result };
      }

      // CHECK 10 — Phase 2 chain handoff
      yield { type: "check_start", index: 10, id: CHECK_DEFS[9].id, name: CHECK_DEFS[9].name };
      if (results[7].status !== "pass") {
        results[9] = {
          ...results[9],
          status: "fail",
          durationMs: 0,
          detail: "Skipped: Phase 1 completion (Stages 13–16) did not pass",
          remediation: "Fix Check 8 before re-running Phase 2 pre-flight.",
        };
        await persistResults(supabaseAdmin, recordId, results);
        yield { type: "check_done", result: results[9] };
      } else {
        yield { type: "check_progress", index: 10, message: "Stubbing Three Truths — Phase 2 prerequisite" };
        await supabaseAdmin
          .from("sessions")
          .update({
            truth_product:
              "TestBrand consistently delivers cold-pressed adaptogenic tonic with clinically meaningful dosing.",
            truth_consumer: "Consumers say they want calm but reward intensity.",
            truth_cultural: "Wellness has become a performance — fatigue with earnestness is rising.",
            truth_cultural_confirmed: true,
            brand_intel_confirmed: true,
            phase_2_status: "in_progress",
          })
          .eq("id", primarySessionId);
        results[9] = { ...results[9], status: "running" };
        await persistResults(supabaseAdmin, recordId, results);
      }

      yield {
        type: "check_10_handoff",
        recordId,
        sessionId: primarySessionId,
        sessionIds: Array.from(createdSessionIds),
        results,
        startedAtMs,
      };
      handedOff = true;
      return;
    } catch (fatal) {
      const msg = fatal instanceof Error ? fatal.message : String(fatal);
      yield { type: "error", message: `Fatal error during Tier Two (resume): ${msg}` };
    } finally {
      if (handedOff) return;
      const ids = Array.from(createdSessionIds);
      const failedCount = results.filter((r) => r.status === "fail").length;
      const overall: "ready" | "issue_detected" = failedCount === 0 ? "ready" : "issue_detected";
      // Preserve TestBrand sessions on failure for post-mortem.
      if (ids.length > 0 && failedCount === 0) {
        await supabaseAdmin.from("sessions").delete().in("id", ids);
      }
      await supabaseAdmin
        .from("preflight_checks")
        .update({
          status: "complete",
          completed_at: nowIso(),
          tier_two_results: results as unknown as never,
          overall_result: overall,
        })
        .eq("id", recordId);
      yield {
        type: "done",
        recordId,
        overall,
        results,
        sessionIdsCleaned: ids,
        totalDurationMs: Date.now() - startedAtMs,
      };
    }
  });

export const runTierTwoChecksFrom11 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        recordId: z.string().uuid(),
        sessionIds: z.array(z.string().uuid()),
        priorResults: z.array(FullCheckResultSchema),
        startedAtMs: z.number(),
      })
      .parse(i),
  )
  .handler(async function* ({ data, context }): AsyncGenerator<TierTwoEvent, void, unknown> {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { recordId, startedAtMs } = data;
    const results: FullCheckResult[] = data.priorResults.map((r) => ({
      ...r,
      id: r.id as FullCheckId,
    }));
    const createdSessionIds = new Set<string>(data.sessionIds);
    let handedOff = false;

    const runCheck = async function* (
      index1: number,
      fn: (emit: (msg: string) => void) => Promise<{ detail: string }>,
      remediationOnFail: string,
    ): AsyncGenerator<TierTwoEvent, FullCheckResult, unknown> {
      const idx = index1 - 1;
      const events: TierTwoEvent[] = [];
      const emit = (message: string) => events.push({ type: "check_progress", index: index1, message });
      results[idx] = { ...results[idx], status: "running" };
      await persistResults(supabaseAdmin, recordId, results);
      const started = Date.now();
      let res: FullCheckResult;
      try {
        const { detail } = await fn(emit);
        res = { ...results[idx], status: "pass", durationMs: Date.now() - started, detail, remediation: null };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        res = { ...results[idx], status: "fail", durationMs: Date.now() - started, detail: msg, remediation: remediationOnFail };
      }
      for (const ev of events) yield ev;
      results[idx] = res;
      await persistResults(supabaseAdmin, recordId, results);
      return res;
    };

    try {
      yield { type: "check_start", index: 11, id: CHECK_DEFS[10].id, name: CHECK_DEFS[10].name };
      {
        const gen = runCheck(11, async () => {
          const checks: Array<{ ok: boolean; msg: string }> = [];
          checks.push({ ok: /createFileRoute\(['"]\/detonation['"]\)/.test(detonationSource), msg: "detonation route registered" });
          checks.push({
            ok:
              /export\s+function\s+DetonationRoute|export\s+const\s+DetonationRoute|component:\s*DetonationRoute/.test(detonationSource) ||
              /component:\s*\w+/.test(detonationSource),
            msg: "detonation route has component",
          });
          checks.push({ ok: /await\s+navigate\s*\(\s*\{\s*to:\s*['"]\/detonation['"]/.test(detonationCanvasSource), msg: "canvas → detonation navigation call present" });
          checks.push({ ok: /saveBrandIntelligence/.test(detonationCanvasSource), msg: "saveBrandIntelligence wired in canvas" });
          checks.push({ ok: /STAGE_9_SYSTEM_PROMPT/.test(STAGE_9_SYSTEM_PROMPT) || STAGE_9_SYSTEM_PROMPT.length > 200, msg: "Stage 9 prompt resolvable" });
          const failed = checks.filter((c) => !c.ok);
          if (failed.length) throw new Error(`Structural checks failed: ${failed.map((f) => f.msg).join("; ")}`);
          return { detail: `All ${checks.length} structural route/navigation invariants present.` };
        }, "Open src/routes/detonation_.canvas.tsx and verify the explicit `await navigate({ to: '/detonation' })` after saveBrandIntelligence completes.");
        let result!: FullCheckResult;
        for (;;) {
          const r = await gen.next();
          if (r.done) { result = r.value as FullCheckResult; break; }
          yield r.value as TierTwoEvent;
        }
        yield { type: "check_done", result };
      }

      yield { type: "check_start", index: 12, id: CHECK_DEFS[11].id, name: CHECK_DEFS[11].name };
      yield { type: "check_progress", index: 12, message: "Creating two parallel TestBrand sessions" };
      const mkSession = async (suffix: string): Promise<string> => {
        const { data: s, error } = await supabaseAdmin
          .from("sessions")
          .insert({
            brand_name: `${TESTBRAND_BRAND_NAME} ${suffix}`,
            category: TESTBRAND_CATEGORY,
            brief_text: TESTBRAND_BRIEF + `\n\nConcurrency variant: ${suffix}.`,
            status: "running",
            current_stage: 1,
            dev_mode: false,
            user_id: context.userId,
            is_preflight_test: true,
          })
          .select("id")
          .single();
        if (error || !s) throw new Error(`Concurrent session insert failed (${suffix}): ${error?.message ?? "no row"}`);
        return s.id as string;
      };
      const [idA, idB] = await Promise.all([mkSession("A"), mkSession("B")]);
      createdSessionIds.add(idA);
      createdSessionIds.add(idB);
      results[11] = { ...results[11], status: "running" };
      await persistResults(supabaseAdmin, recordId, results);
      handedOff = true;
      yield {
        type: "check_12_handoff",
        recordId,
        sessionIds: Array.from(createdSessionIds),
        concurrentSessionIds: [idA, idB],
        results,
        startedAtMs,
      };
    } catch (fatal) {
      const msg = fatal instanceof Error ? fatal.message : String(fatal);
      yield { type: "error", message: `Fatal error during Tier Two (checks 11–12): ${msg}` };
    } finally {
      if (!handedOff) {
        const ids = Array.from(createdSessionIds);
        const failedCount = results.filter((r) => r.status === "fail").length;
        const overall: "ready" | "issue_detected" = failedCount === 0 ? "ready" : "issue_detected";
        if (ids.length > 0 && failedCount === 0) await supabaseAdmin.from("sessions").delete().in("id", ids);
        await supabaseAdmin
          .from("preflight_checks")
          .update({
            status: "complete",
            completed_at: nowIso(),
            tier_two_results: results as unknown as never,
            overall_result: overall,
          })
          .eq("id", recordId);
      }
    }
  });

export const runTierTwoChecksFrom7 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        recordId: z.string().uuid(),
        sessionId: z.string(),
        sessionIds: z.array(z.string().uuid()),
        priorResults: z.array(FullCheckResultSchema),
        startedAtMs: z.number(),
      })
      .parse(i),
  )
  .handler(async function* ({ data }): AsyncGenerator<TierTwoEvent, void, unknown> {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { recordId, sessionId, startedAtMs } = data;
    const results: FullCheckResult[] = data.priorResults.map((r) => ({ ...r, id: r.id as FullCheckId }));
    const primarySessionId = sessionId || null;
    const createdSessionIds = new Set<string>(data.sessionIds);
    let handedOff = false;

    const runCheck = async function* (
      index1: number,
      fn: (emit: (msg: string) => void) => Promise<{ detail: string }>,
      remediationOnFail: string,
    ): AsyncGenerator<TierTwoEvent, FullCheckResult, unknown> {
      const idx = index1 - 1;
      const events: TierTwoEvent[] = [];
      const emit = (message: string) => events.push({ type: "check_progress", index: index1, message });
      results[idx] = { ...results[idx], status: "running" };
      await persistResults(supabaseAdmin, recordId, results);
      const started = Date.now();
      let res: FullCheckResult;
      try {
        const { detail } = await fn(emit);
        res = { ...results[idx], status: "pass", durationMs: Date.now() - started, detail, remediation: null };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        res = { ...results[idx], status: "fail", durationMs: Date.now() - started, detail: msg, remediation: remediationOnFail };
      }
      for (const ev of events) yield ev;
      results[idx] = res;
      await persistResults(supabaseAdmin, recordId, results);
      return res;
    };

    try {
      handedOff = true;
      yield { type: "check_7_handoff", recordId, sessionId: primarySessionId ?? "", sessionIds: Array.from(createdSessionIds), results, startedAtMs };
    } catch (fatal) {
      const msg = fatal instanceof Error ? fatal.message : String(fatal);
      yield { type: "error", message: `Fatal error during Tier Two (check 7 handoff): ${msg}` };
    } finally {
      if (!handedOff) {
        const ids = Array.from(createdSessionIds);
        const failedCount = results.filter((r) => r.status === "fail").length;
        const overall: "ready" | "issue_detected" = failedCount === 0 ? "ready" : "issue_detected";
        const cleaned = ids.length > 0 && failedCount === 0 ? ids : [];
        if (cleaned.length > 0) await supabaseAdmin.from("sessions").delete().in("id", ids);
        await supabaseAdmin.from("preflight_checks").update({ status: "complete", completed_at: nowIso(), tier_two_results: results as unknown as never, overall_result: overall }).eq("id", recordId);
        yield { type: "done", recordId, overall, results, sessionIdsCleaned: cleaned, totalDurationMs: Date.now() - startedAtMs };
      }
    }
  });

// ---------------------------------------------------------------------------
// Check 3 result recorder + resume stream (checks 4–7 → check 8 handoff)
//
// The client drives Check 3 by invoking runStage8 and confirmCheckpointB as
// two separate server-fn RPCs (each a fresh Cloudflare Worker invocation
// with its own wall-clock budget). After Check 3 is recorded, the client
// opens runTierTwoChecksFrom4 which runs checks 4–7 and then emits the
// existing check_8_handoff to chain into Check 8 + checks 9–12.
// ---------------------------------------------------------------------------

export const recordPreflightCheck3Result = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        recordId: z.string().uuid(),
        allResults: z.array(FullCheckResultSchema),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("preflight_checks")
      .update({ tier_two_results: data.allResults as unknown as never })
      .eq("id", data.recordId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const runTierTwoChecksFrom4 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        recordId: z.string().uuid(),
        sessionId: z.string(),
        sessionIds: z.array(z.string().uuid()),
        priorResults: z.array(FullCheckResultSchema),
        startedAtMs: z.number(),
      })
      .parse(i),
  )
  .handler(async function* ({ data, context }): AsyncGenerator<TierTwoEvent, void, unknown> {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { recordId, sessionId, startedAtMs } = data;
    const results: FullCheckResult[] = data.priorResults.map((r) => ({
      ...r,
      id: r.id as FullCheckId,
    }));
    const createdSessionIds = new Set<string>(data.sessionIds);
    const primarySessionId = sessionId || null;
    let handedOff = false;

    const runCheck = async function* (
      index1: number,
      fn: (emit: (msg: string) => void) => Promise<{ detail: string }>,
      remediationOnFail: string,
    ): AsyncGenerator<TierTwoEvent, FullCheckResult, unknown> {
      const idx = index1 - 1;
      const events: TierTwoEvent[] = [];
      const emit = (message: string) => {
        events.push({ type: "check_progress", index: index1, message });
      };
      results[idx] = { ...results[idx], status: "running" };
      await persistResults(supabaseAdmin, recordId, results);
      const started = Date.now();
      let res: FullCheckResult;
      try {
        const { detail } = await fn(emit);
        res = {
          ...results[idx],
          status: "pass",
          durationMs: Date.now() - started,
          detail,
          remediation: null,
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        res = {
          ...results[idx],
          status: "fail",
          durationMs: Date.now() - started,
          detail: msg,
          remediation: remediationOnFail,
        };
      }
      for (const ev of events) yield ev;
      results[idx] = res;
      await persistResults(supabaseAdmin, recordId, results);
      return res;
    };

    void context;

    try {
      // -------------------------------------------------------------------
      // CHECK 4 — Stage prompts integrity (structural)
      // -------------------------------------------------------------------
      yield { type: "check_start", index: 4, id: CHECK_DEFS[3].id, name: CHECK_DEFS[3].name };
      {
        const gen = runCheck(
          4,
          async (emit) => {
            emit("Importing all stage prompt modules");
            const promptModules = await Promise.all([
              import("@/lib/stage1-prompt"),
              import("@/lib/stage1b-prompt"),
              import("@/lib/stage2-prompt"),
              import("@/lib/stage3-prompt"),
              import("@/lib/stage4-prompt"),
              import("@/lib/stage5-prompt"),
              import("@/lib/stage6-prompt"),
              import("@/lib/stage7-prompt"),
              import("@/lib/stage8-prompt"),
              import("@/lib/stage9-prompt"),
              import("@/lib/stage10-prompt"),
              import("@/lib/stage11-prompt"),
              import("@/lib/stage12-prompt"),
              import("@/lib/stage13-prompt"),
              import("@/lib/stage13b-prompt"),
              import("@/lib/stage14-prompt"),
              import("@/lib/stage14b-prompt"),
              import("@/lib/stage14c-prompt"),
              import("@/lib/stage15-prompt"),
              import("@/lib/stage16-prompt"),
              import("@/lib/stage17-detonation-territory-prompt"),
              import("@/lib/stage17b-detonation-intelligence-prompt"),
              import("@/lib/stage18-the-detonation-prompt"),
              import("@/lib/stage19-activation-architecture-prompt"),
              import("@/lib/stage20-master-detonation-brief-prompt"),
              import("@/lib/stage21-channel-detonation-briefs-prompt"),
              import("@/lib/stage22-brand-architecture-prompt"),
            ]);
            const missing: string[] = [];
            let totalPrompts = 0;
            for (const mod of promptModules) {
              for (const [k, v] of Object.entries(mod as Record<string, unknown>)) {
                if (typeof v === "string" && /SYSTEM_PROMPT|_PROMPT$/.test(k)) {
                  totalPrompts++;
                  if (v.trim().length < 200) missing.push(`${k} (${v.trim().length} chars)`);
                }
              }
            }
            if (missing.length) throw new Error(`Prompts too short/empty: ${missing.join(", ")}`);
            return {
              detail: `All ${totalPrompts} stage system prompts present and ≥200 chars across 22 stages (1, 1B, 2–17, 17B, 18–22).`,
            };
          },
          "Open the named prompt module and restore the missing/empty *_SYSTEM_PROMPT export.",
        );
        let result!: FullCheckResult;
        for (;;) {
          const r = await gen.next();
          if (r.done) { result = r.value as FullCheckResult; break; }
          yield r.value as TierTwoEvent;
        }
        yield { type: "check_done", result };
      }

      // -------------------------------------------------------------------
      // CHECK 5 — Stage 9 EDT Guard output sanitisation
      // -------------------------------------------------------------------
      yield { type: "check_start", index: 5, id: CHECK_DEFS[4].id, name: CHECK_DEFS[4].name };
      {
        const gen = runCheck(
          5,
          async (emit) => {
            if (!primarySessionId || results[2].status !== "pass")
              throw new Error("Skipped: Stage 8 / Checkpoint B did not complete");
            emit("Running Stage 9 (EDT Generation)...");
            await drainGenerator(runStage9({ data: { sessionId: primarySessionId } }));
            const { data: row, error: rowErr } = await supabaseAdmin
              .from("sessions")
              .select("brand_name, brief_text, stage_2_output, stage_9_output, stage_9_leftofcentre_output")
              .eq("id", primarySessionId)
              .single();
            if (rowErr || !row) throw new Error(`Could not reload Stage 9 columns: ${rowErr?.message ?? "no row"}`);
            const core = String(row.stage_9_output ?? "");
            const loc = String((row as unknown as { stage_9_leftofcentre_output?: string | null }).stage_9_leftofcentre_output ?? "");
            if (core.length < 200) throw new Error(`Stage 9 core output too short (${core.length} chars)`);
            // Left-of-centre is NOT generated by Stage 9 any more — it is produced by
            // the parallel LOC track fired at Briefing Room handoff (src/lib/loc.functions.ts).
            // Synthetic preflight sessions never go through the Briefing Room, so this
            // column is legitimately empty here. Scan it when present; never fail on absence.
            const locPresent = loc.length >= 120;

            const universalHits = [
              ...findBannedWordHits({ text: core, terms: UNIVERSAL_BANNED_STAGE9, rule: "stage9-universal", stageLabel: "Stage 9", columnLabel: "stage_9_output" }),
              ...findBannedWordHits({ text: loc, terms: UNIVERSAL_BANNED_STAGE9, rule: "stage9-universal", stageLabel: "Stage 9", columnLabel: "stage_9_leftofcentre_output" }),
            ];
            if (universalHits.length) {
              throw new Error(`Stage 9 output contains universal banned words: ${Array.from(new Set(universalHits.map((h) => `${h.match} in ${h.columnLabel}`))).join(", ")}. Runtime gate failed.`);
            }

            const coreConditionalRaw = findBannedWordHits({ text: core, terms: CONDITIONALLY_BANNED_STAGE9, rule: "stage9-core-conditional", stageLabel: "Stage 9", columnLabel: "stage_9_output" });
            const coreConditional = coreConditionalRaw.filter((hit) => !conditionalStage9HitAllowedInCore({
              word: hit.word,
              brandName: String(row.brand_name ?? ""),
              briefText: String(row.brief_text ?? ""),
              stage2Output: String(row.stage_2_output ?? ""),
            }));
            if (coreConditional.length) {
              throw new Error(`Stage 9 core output contains competitor-owned (or brief-excluded) conditional words: ${Array.from(new Set(coreConditional.map((h) => h.match))).join(", ")}.`);
            }

            const locConditional = findBannedWordHits({ text: loc, terms: CONDITIONALLY_BANNED_STAGE9, rule: "stage9-leftofcentre-conditional", stageLabel: "Stage 9", columnLabel: "stage_9_leftofcentre_output" });
            const disallowedLoc = locConditional.filter((hit) => !conditionalStage9HitAllowedInLeftOfCentre({
              word: hit.word,
              index: hit.index,
              output: loc,
              brandName: String(row.brand_name ?? ""),
              briefText: String(row.brief_text ?? ""),
              stage2Output: String(row.stage_2_output ?? ""),
            }));
            if (disallowedLoc.length) {
              throw new Error(`Stage 9 left-of-centre output contains competitor-owned conditional words: ${Array.from(new Set(disallowedLoc.map((h) => h.match))).join(", ")}.`);
            }
            return { detail: `Stage 9 core (${core.length} chars) passed runtime scans: universal list clear; conditional list blocked where competitor-owned. Left-of-centre: ${locPresent ? `${loc.length} chars scanned and clear` : "not present (LOC runs on its own track from Briefing Room handoff; synthetic preflight sessions have none) — skipped, not failed"}.` };
          },
          "Inspect Stage 9 runtime banned-word gate across stage_9_output and stage_9_leftofcentre_output; universal words must regenerate/fail in Tier Two and competitor-owned conditional terms must be blocked.",
        );
        let result!: FullCheckResult;
        for (;;) {
          const r = await gen.next();
          if (r.done) { result = r.value as FullCheckResult; break; }
          yield r.value as TierTwoEvent;
        }
        yield { type: "check_done", result };
      }

      // -------------------------------------------------------------------
      // CHECK 6 — Hand off to client. Stage 10 and Stage 11 are separate
      // long Claude calls and must not share one server invocation.
      // -------------------------------------------------------------------
      yield { type: "check_start", index: 6, id: CHECK_DEFS[5].id, name: CHECK_DEFS[5].name };
      if (!primarySessionId || results[4].status !== "pass") {
        results[5] = {
          ...results[5],
          status: "fail",
          durationMs: 0,
          detail: "Skipped: Stage 9 did not complete",
          remediation: "Fix Check 5 before running Stage 10/11 evaluation.",
        };
        await persistResults(supabaseAdmin, recordId, results);
        yield { type: "check_done", result: results[5] };
      }

      handedOff = true;
      yield {
        type: "check_6_handoff",
        recordId,
        sessionId: primarySessionId ?? "",
        sessionIds: Array.from(createdSessionIds),
        results,
        startedAtMs,
      };
      return;
    } catch (fatal) {
      const msg = fatal instanceof Error ? fatal.message : String(fatal);
      yield { type: "error", message: `Fatal error during Tier Two (checks 4–7): ${msg}` };
    } finally {
      if (!handedOff) {
        const ids = Array.from(createdSessionIds);
        const failedCount = results.filter((r) => r.status === "fail").length;
        const overall: "ready" | "issue_detected" = failedCount === 0 ? "ready" : "issue_detected";
        // Preserve TestBrand sessions on failure so their outputs remain
        // queryable for post-mortem. Only clean up on a fully green run.
        if (ids.length > 0 && failedCount === 0) {
          await supabaseAdmin.from("sessions").delete().in("id", ids);
        }
        await supabaseAdmin
          .from("preflight_checks")
          .update({
            status: "complete",
            completed_at: nowIso(),
            tier_two_results: results as unknown as never,
            overall_result: overall,
          })
          .eq("id", recordId);
        yield {
          type: "done",
          recordId,
          overall,
          results,
          sessionIdsCleaned: ids,
          totalDurationMs: Date.now() - startedAtMs,
        };
      }
    }
  });


// ---------------------------------------------------------------------------
// CHECK 13 — Left-of-Centre track integrity
//
// The LOC track does not run inside the Stage 1–22 pipeline: it fires from a
// Briefing Room handoff on its own orchestrator. Before this check it had ZERO
// automated coverage (scripts/loc-verify.ts covered 4 of 13 engines and was
// never invoked by anything), which is how Engine 12's silent failure reached
// production. This check seeds a synthetic briefing_room_workspaces row, runs
// the real orchestrator via runLeftOfCentre, and asserts the persisted result
// against the contract in src/lib/loc-integrity.server.ts.
//
// Runs as its own RPC — 13 parallel Claude calls plus abstraction, anchor and
// validation passes will not fit inside another check's invocation budget.
// ---------------------------------------------------------------------------
export const runTierTwoCheck13 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ recordId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { assertLocRunHealthy, buildPreflightLocWorkspace } = await import(
      "@/lib/loc-integrity.server"
    );
    const { runLeftOfCentre } = await import("@/lib/loc.functions");

    const started = Date.now();
    const brandName = `${TESTBRAND_BRAND_NAME} LOC`;
    let sessionId: string | null = null;
    let workspaceId: string | null = null;

    const cleanup = async (preserve: boolean) => {
      if (workspaceId) {
        await supabaseAdmin.from("briefing_room_workspaces").delete().eq("id", workspaceId);
      }
      if (sessionId && !preserve) {
        await supabaseAdmin.from("sessions").delete().eq("id", sessionId);
      }
    };

    try {
      const { data: s, error: sErr } = await supabaseAdmin
        .from("sessions")
        .insert({
          brand_name: brandName,
          category: TESTBRAND_CATEGORY,
          brief_text: TESTBRAND_BRIEF,
          status: "running",
          current_stage: 1,
          dev_mode: false,
          user_id: context.userId,
          is_preflight_test: true,
        })
        .select("id")
        .single();
      if (sErr || !s) throw new Error(`LOC test session insert failed: ${sErr?.message ?? "no row"}`);
      sessionId = s.id as string;

      // Synthetic Briefing Room handoff — buildLocInputs reads this by
      // (user_id, brand_name), which is exactly the real handoff path.
      const { data: ws, error: wsErr } = await supabaseAdmin
        .from("briefing_room_workspaces")
        .insert({
          user_id: context.userId,
          ...buildPreflightLocWorkspace(brandName),
        } as never)
        .select("id")
        .single();
      if (wsErr || !ws) throw new Error(`LOC test workspace insert failed: ${wsErr?.message ?? "no row"}`);
      workspaceId = ws.id as string;

      await runLeftOfCentre({ data: { sessionId, force: true } });

      const { data: row, error: rowErr } = await supabaseAdmin
        .from("sessions")
        .select(
          "loc_status, loc_error, loc_task_type, loc_generated_at, loc_engine_outputs, loc_decision_packages, loc_validation, stage_9_leftofcentre_output",
        )
        .eq("id", sessionId)
        .single();
      if (rowErr || !row) throw new Error(`Could not reload LOC columns: ${rowErr?.message ?? "no row"}`);

      const detail = assertLocRunHealthy(
        row as unknown as Parameters<typeof assertLocRunHealthy>[0],
        started,
      );
      await cleanup(false);
      return {
        status: "pass" as const,
        durationMs: Date.now() - started,
        detail: `${detail} (${((Date.now() - started) / 1000).toFixed(1)}s)`,
        remediation: null,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Preserve the session on failure so loc_engine_outputs stays queryable.
      await cleanup(true).catch(() => undefined);
      return {
        status: "fail" as const,
        durationMs: Date.now() - started,
        detail: `LOC track integrity failed: ${msg}${sessionId ? ` (session ${sessionId} preserved for post-mortem)` : ""}`,
        remediation:
          "Inspect src/lib/loc.functions.ts and src/lib/loc/engine-prompts.ts. Read loc_engine_outputs on the preserved session — each engine records ok/error individually, so the failing engine is named there. Do not relax the assertions in src/lib/loc-integrity.server.ts to make this pass.",
      };
    }
  });
