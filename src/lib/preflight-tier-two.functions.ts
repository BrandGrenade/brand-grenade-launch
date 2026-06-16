// Tier Two Full Integrity Check — Brand Grenade Pre-Flight Integrity System
//
// Runs 12 deep integrity checks using the hybrid approach:
//   - Real pipeline execution on a TestBrand session for Phase 1 (Stages 1–16)
//   - Real Phase 2 chain (Stage 17 → select → 17B → 18)
//   - Two parallel sessions running Stage 1 to verify concurrency safety
//   - Structural checks (prompt presence, token caps, sanitiser config, route)
//
// All sessions are tagged `is_preflight_test = true` and deleted in a finally
// block on completion or failure. A unique partial index on preflight_checks
// (status='running', check_type='full') enforces a single global runner;
// rows older than 25 minutes can be force-overridden.
//
// Streaming async generator: client subscribes and renders live progress.
// Persists full per-check results to preflight_checks.tier_two_results.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { STAGE_9_SYSTEM_PROMPT } from "@/lib/stage9-prompt";
import detonationCanvasSource from "@/routes/detonation_.canvas.tsx?raw";
import detonationSource from "@/routes/detonation.tsx?raw";
import claudeServerSource from "@/lib/claude.server.ts?raw";
import sanitiseSource from "@/lib/sanitise-output.ts?raw";

import { runStage1 } from "@/lib/stage1.functions";
import { runStage2 } from "@/lib/stage2.functions";
import { runStage3 } from "@/lib/stage3.functions";
import { runStage4 } from "@/lib/stage4.functions";
import { runStage5 } from "@/lib/stage5.functions";
import { runStage6 } from "@/lib/stage6.functions";
import { runStage7 } from "@/lib/stage7.functions";
import { runStage8, confirmCheckpointB } from "@/lib/stage8.functions";
import { runStage9 } from "@/lib/stage9.functions";
import { runStage10 } from "@/lib/stage10.functions";
import { runStage11 } from "@/lib/stage11.functions";
import { runStage12, saveSelectedSMP, saveSelectionRationale } from "@/lib/stage12.functions";
import { runStage13, saveBrandIntelligence } from "@/lib/stage13.functions";
import { runStage13b } from "@/lib/stage13b.functions";
import { runStage14 } from "@/lib/stage14.functions";
import { runStage14b } from "@/lib/stage14b.functions";
import { runStage14c } from "@/lib/stage14c.functions";
import { runStage15 } from "@/lib/stage15.functions";
import { runStage16 } from "@/lib/stage16.functions";
import { runStage17, selectStage17Territory } from "@/lib/stage17.functions";
import { runStage17b } from "@/lib/stage17b.functions";
import { runStage18 } from "@/lib/stage18.functions";

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
  | "concurrent_session_integrity";

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
      type: "done";
      recordId: string;
      overall: "ready" | "issue_detected";
      results: FullCheckResult[];
      sessionIdsCleaned: string[];
      totalDurationMs: number;
    }
  | { type: "error"; message: string };

const CHECK_DEFS: ReadonlyArray<{ id: FullCheckId; name: string }> = [
  { id: "stage_1_brief_analysis", name: "Stage 1 — Brief Analysis on TestBrand" },
  { id: "phase1a_chain_2_to_7", name: "Stages 2–7 — Phase 1A sequential chain" },
  { id: "stage_8_checkpoint_b", name: "Stage 8 — Proposition + Checkpoint B confirmation" },
  { id: "stage_prompts_integrity", name: "All 22 stage system prompts present & non-empty" },
  { id: "stage_9_edt_guard_output", name: "Stage 9 — EDT guard output sanitisation" },
  { id: "stage_10_11_evaluation_chain", name: "Stages 10–11 — Evaluation chain" },
  { id: "stage_12_smp_selection", name: "Stage 12 — SMP selection + rationale persistence" },
  { id: "phase1_completion_13_to_16", name: "Stages 13–16 — Phase 1 completion" },
  { id: "sanitiser_and_token_caps", name: "Sanitiser configuration + token caps on all stages" },
  { id: "phase2_detonation_chain", name: "Phase 2 — Stage 17 → Select → 17B → 18 chain" },
  { id: "canvas_to_detonation_navigation", name: "Three Truth Canvas → Detonation route navigation" },
  { id: "concurrent_session_integrity", name: "Concurrent session integrity (two parallel Stage 1 runs)" },
];

// ---------------------------------------------------------------------------
// Constants — TestBrand fixture
// ---------------------------------------------------------------------------

const TESTBRAND_BRAND_NAME = "Preflight TestBrand";
const TESTBRAND_CATEGORY = "Australian premium energy drink";
const TESTBRAND_STRATEGIC_MODE = "Brand Detonation";
const TESTBRAND_BRIEF = `Brand: TestBrand. Category: Australian premium energy drink. Challenge: the entire energy drink category sells urgency, crash, and artificial stimulation to men who have moved on. The disciplined man who trains, tracks his macros, and demands performance from everything he consumes has no energy drink that matches his standard. TestBrand is the first energy drink built for deliberate performance, not emergency rescue. Product: natural caffeine from green tea plus adaptogens plus electrolytes. Full strength. No apology. Target: males 28 to 42 who train seriously, track their intake, and read the category's crash-and-recover narrative as an insult to their discipline. Competitors: Monster and Red Bull own urgency and youth. V owns the casual drinker. None own the disciplined performance male. Business objective: own the deliberate performance territory the category has never addressed.`;

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
      // CHECK 1 — Stage 1 Brief Analysis
      // Creates the primary TestBrand session and runs Stage 1.
      // ---------------------------------------------------------------------
      yield { type: "check_start", index: 1, id: CHECK_DEFS[0].id, name: CHECK_DEFS[0].name };
      {
        const gen = runCheck(
          1,
          async (emit) => {
            emit("Creating TestBrand session (is_preflight_test=true)");
            const { data: s, error: sErr } = await supabaseAdmin
              .from("sessions")
              .insert({
                brand_name: TESTBRAND_BRAND_NAME,
                category: TESTBRAND_CATEGORY,
                strategic_mode: TESTBRAND_STRATEGIC_MODE,
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
            emit(`TestBrand session created: ${primarySessionId.slice(0, 8)}`);
            emit("Running Stage 1 (Brief Analysis)...");
            const final = await drainGenerator(runStage1({ data: { sessionId: primarySessionId } }));
            const output = (final as { output?: string }).output ?? "";
            if (output.length < 200) throw new Error(`Stage 1 output too short (${output.length} chars)`);
            const tension = (final as { tensionScore?: number | null }).tensionScore;
            return {
              detail: `Stage 1 completed in ${(((final as { output: string }).output ?? "").length)} chars. Tension score: ${tension ?? "n/a"}.`,
            };
          },
          "Open Stage 1 prompt and Claude invocation logs. Verify stage1.functions.ts streamClaude call succeeds against TestBrand brief.",
        );
        let result!: FullCheckResult;
        for (;;) {
          const r = await gen.next();
          if (r.done) {
            result = r.value;
            break;
          }
          yield r.value;
        }
        yield { type: "check_done", result };
      }

      // Guard: if Stage 1 failed, the pipeline-dependent checks (2,3,5,6,7,8) cannot run.
      const stage1Ok = results[0].status === "pass";

      // ---------------------------------------------------------------------
      // CHECK 2 — Stages 2–7 Phase 1A chain
      // ---------------------------------------------------------------------
      yield { type: "check_start", index: 2, id: CHECK_DEFS[1].id, name: CHECK_DEFS[1].name };
      {
        const gen = runCheck(
          2,
          async (emit) => {
            if (!stage1Ok || !primarySessionId) throw new Error("Skipped: Stage 1 failed");
            // Auto-confirm Checkpoint A so Stage 2 can run.
            emit("Auto-confirming Checkpoint A");
            await supabaseAdmin
              .from("sessions")
              .update({ checkpoint_a_confirmed: true })
              .eq("id", primarySessionId);

            const stages: Array<[string, () => Promise<unknown>]> = [
              ["Stage 2", () => drainGenerator(runStage2({ data: { sessionId: primarySessionId! } }))],
              ["Stage 3", () => drainGenerator(runStage3({ data: { sessionId: primarySessionId! } }))],
              ["Stage 4", () => drainGenerator(runStage4({ data: { sessionId: primarySessionId! } }))],
              ["Stage 5", () => drainGenerator(runStage5({ data: { sessionId: primarySessionId! } }))],
              ["Stage 6", () => drainGenerator(runStage6({ data: { sessionId: primarySessionId! } }))],
              ["Stage 7", () => drainGenerator(runStage7({ data: { sessionId: primarySessionId! } }))],
            ];
            const timings: string[] = [];
            for (const [label, run] of stages) {
              emit(`Running ${label}...`);
              const t0 = Date.now();
              await run();
              timings.push(`${label}: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
            }
            return { detail: `Phase 1A chain completed. ${timings.join(", ")}.` };
          },
          "Inspect logs for the first failed stage in the 2–7 chain; check Checkpoint A confirmation and prior-stage output columns are populated.",
        );
        let result!: FullCheckResult;
        for (;;) {
          const r = await gen.next();
          if (r.done) {
            result = r.value;
            break;
          }
          yield r.value;
        }
        yield { type: "check_done", result };
      }

      // ---------------------------------------------------------------------
      // CHECK 3 — Stage 8 + Checkpoint B
      // ---------------------------------------------------------------------
      yield { type: "check_start", index: 3, id: CHECK_DEFS[2].id, name: CHECK_DEFS[2].name };
      {
        const gen = runCheck(
          3,
          async (emit) => {
            if (!primarySessionId || results[1].status !== "pass")
              throw new Error("Skipped: Phase 1A chain did not complete");
            emit("Running Stage 8 (Strategic Propositions)...");
            await drainGenerator(runStage8({ data: { sessionId: primarySessionId } }));
            emit("Confirming Checkpoint B");
            await confirmCheckpointB({ data: { sessionId: primarySessionId } });
            // Verify it actually persisted
            const { data: row, error } = await supabaseAdmin
              .from("sessions")
              .select("checkpoint_b_confirmed, stage_8_output")
              .eq("id", primarySessionId)
              .single();
            if (error) throw new Error(`Verification read failed: ${error.message}`);
            if (!row?.checkpoint_b_confirmed) throw new Error("Checkpoint B did not persist as true");
            if (!row?.stage_8_output) throw new Error("Stage 8 output missing after run");
            return { detail: "Stage 8 produced propositions and Checkpoint B persisted as confirmed." };
          },
          "Check stage8.functions.ts and confirmCheckpointB writeback. Verify stage_7_output had ≥2 territories.",
        );
        let result!: FullCheckResult;
        for (;;) {
          const r = await gen.next();
          if (r.done) {
            result = r.value;
            break;
          }
          yield r.value;
        }
        yield { type: "check_done", result };
      }

      // ---------------------------------------------------------------------
      // CHECK 4 — Stage prompts integrity (structural)
      // ---------------------------------------------------------------------
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
          if (r.done) {
            result = r.value;
            break;
          }
          yield r.value;
        }
        yield { type: "check_done", result };
      }

      // ---------------------------------------------------------------------
      // CHECK 5 — Stage 9 EDT Guard output sanitisation (real)
      // ---------------------------------------------------------------------
      yield { type: "check_start", index: 5, id: CHECK_DEFS[4].id, name: CHECK_DEFS[4].name };
      {
        const gen = runCheck(
          5,
          async (emit) => {
            if (!primarySessionId || results[2].status !== "pass")
              throw new Error("Skipped: Stage 8 / Checkpoint B did not complete");
            emit("Running Stage 9 (EDT Generation)...");
            const final = await drainGenerator(runStage9({ data: { sessionId: primarySessionId } }));
            const output = String((final as { output?: string }).output ?? "");
            if (output.length < 200) throw new Error(`Stage 9 output too short (${output.length} chars)`);
            // Scan for banned EDT words (apologetic / permission-seeking register).
            const banned = ["earned", "deserved", "guilt", "apology", "permission"];
            const offenders = banned.filter((w) =>
              new RegExp(`\\b${w}\\b`, "i").test(output),
            );
            if (offenders.length)
              throw new Error(
                `Stage 9 output contains banned EDT words: ${offenders.join(", ")}. Guard prompt failed at runtime.`,
              );
            return {
              detail: `Stage 9 output (${output.length} chars) passed EDT guard scan — no banned register words present.`,
            };
          },
          "Inspect Stage 9 system prompt banned-words clause and the Claude response in stage_9_output; tighten prompt or add post-sanitiser.",
        );
        let result!: FullCheckResult;
        for (;;) {
          const r = await gen.next();
          if (r.done) {
            result = r.value;
            break;
          }
          yield r.value;
        }
        yield { type: "check_done", result };
      }

      // ---------------------------------------------------------------------
      // CHECK 6 — Stages 10–11 evaluation chain
      // ---------------------------------------------------------------------
      yield { type: "check_start", index: 6, id: CHECK_DEFS[5].id, name: CHECK_DEFS[5].name };
      {
        const gen = runCheck(
          6,
          async (emit) => {
            if (!primarySessionId || results[4].status !== "pass")
              throw new Error("Skipped: Stage 9 did not complete");
            emit("Running Stage 10 (Scoring)...");
            await drainGenerator(runStage10({ data: { sessionId: primarySessionId } }));
            emit("Running Stage 11 (Validation)...");
            await drainGenerator(runStage11({ data: { sessionId: primarySessionId } }));
            const { data: row } = await supabaseAdmin
              .from("sessions")
              .select("stage_10_output, stage_11_output")
              .eq("id", primarySessionId)
              .single();
            if (!row?.stage_10_output || !row?.stage_11_output)
              throw new Error("Stage 10 or 11 output missing after run");
            return { detail: "Stages 10 & 11 completed; outputs persisted." };
          },
          "Inspect stage10.functions.ts / stage11.functions.ts; verify Stage 8 propositions were available as input.",
        );
        let result!: FullCheckResult;
        for (;;) {
          const r = await gen.next();
          if (r.done) {
            result = r.value;
            break;
          }
          yield r.value;
        }
        yield { type: "check_done", result };
      }

      // ---------------------------------------------------------------------
      // CHECK 7 — Stage 12 SMP selection + rationale persistence (real)
      // ---------------------------------------------------------------------
      yield { type: "check_start", index: 7, id: CHECK_DEFS[6].id, name: CHECK_DEFS[6].name };
      {
        const gen = runCheck(
          7,
          async (emit) => {
            if (!primarySessionId || results[5].status !== "pass")
              throw new Error("Skipped: Stage 10/11 chain did not complete");
            emit("Running Stage 12 (SMP synthesis)...");
            await drainGenerator(runStage12({ data: { sessionId: primarySessionId } }));
            const { data: row } = await supabaseAdmin
              .from("sessions")
              .select("stage_12_output")
              .eq("id", primarySessionId)
              .single();
            const stage12 = row?.stage_12_output ?? "";
            if (!stage12) throw new Error("Stage 12 output missing");
            // Auto-select first SMP-ish line (top-ranked).
            const firstSmpLine =
              stage12
                .split("\n")
                .map((l: string) => l.trim())
                .find((l: string) => l.length > 30 && /[A-Za-z]/.test(l)) ?? "Auto-selected first proposition (preflight TestBrand)";
            emit("Saving selected SMP (top-ranked auto-selection)");
            await saveSelectedSMP({
              data: {
                sessionId: primarySessionId,
                smpLine: firstSmpLine.slice(0, 2000),
                fieldName: "Preflight Auto-Selection",
              },
            });
            emit("Saving selection rationale (Checkpoint C)");
            await saveSelectionRationale({
              data: {
                sessionId: primarySessionId,
                rationale: { auto: "Preflight TestBrand auto-selected top-ranked SMP for integrity validation." },
              },
            });
            const { data: verify } = await supabaseAdmin
              .from("sessions")
              .select("selected_smp, checkpoint_c_confirmed")
              .eq("id", primarySessionId)
              .single();
            if (!verify?.selected_smp) throw new Error("selected_smp did not persist");
            if (!verify?.checkpoint_c_confirmed) throw new Error("Checkpoint C did not flip to true");
            return { detail: "Stage 12 SMP synthesis + selection + rationale persisted; Checkpoint C confirmed." };
          },
          "Inspect stage12.functions.ts saveSelectedSMP / saveSelectionRationale handlers and confirmWrite path.",
        );
        let result!: FullCheckResult;
        for (;;) {
          const r = await gen.next();
          if (r.done) {
            result = r.value;
            break;
          }
          yield r.value;
        }
        yield { type: "check_done", result };
      }

      // ---------------------------------------------------------------------
      // CHECK 8 — Phase 1 completion: Stages 13–16
      // ---------------------------------------------------------------------
      yield { type: "check_start", index: 8, id: CHECK_DEFS[7].id, name: CHECK_DEFS[7].name };
      {
        const gen = runCheck(
          8,
          async (emit) => {
            if (!primarySessionId || results[6].status !== "pass")
              throw new Error("Skipped: Stage 12 selection did not complete");
            // Seed Brand Intelligence BEFORE Stage 13 — runStage13 throws
            // "Brand Intelligence not supplied" if brand_intelligence is null.
            emit("Seeding Brand Intelligence (auto, preflight fixture)");
            await saveBrandIntelligence({
              data: {
                sessionId: primarySessionId,
                brandIntelligence: {
                  brand_values: "Legend. Gregarious. Abundant.",
                  tone_of_voice: "Confident. Cheeky. Witty.",
                  asset_1: "Live Large — Strong and ownable.",
                  asset_2: "Wrestle Responsibly — Strong and ownable.",
                  asset_3: "TestBrand Hero Campaign — Present but weak.",
                  notes: "Preflight TestBrand — automated brand intelligence fixture for integrity check.",
                },
              },
            });
            emit("Running Stage 13 (Brand Intelligence draft)...");
            await drainGenerator(runStage13({ data: { sessionId: primarySessionId } }));
            emit("Running Stage 13B...");
            await drainGenerator(runStage13b({ data: { sessionId: primarySessionId } }));
            emit("Running Stage 14...");
            await drainGenerator(runStage14({ data: { sessionId: primarySessionId } }));
            emit("Running Stage 14B...");
            await drainGenerator(runStage14b({ data: { sessionId: primarySessionId } }));
            emit("Running Stage 14C...");
            await drainGenerator(runStage14c({ data: { sessionId: primarySessionId } }));
            emit("Running Stage 15 (Audit)...");
            await drainGenerator(runStage15({ data: { sessionId: primarySessionId } }));
            emit("Running Stage 16 (Document — agency format)...");
            await drainGenerator(
              runStage16({ data: { sessionId: primarySessionId, format: "agency" } }) as unknown as AsyncGenerator<{ delta?: string; done?: true }, void, unknown>,
            );
            const { data: row } = await supabaseAdmin
              .from("sessions")
              .select("stage_13_output, stage_14_output, stage_15_output, stage_16_agency_output, status")
              .eq("id", primarySessionId)
              .single();
            if (!row?.stage_16_agency_output) throw new Error("Stage 16 agency output missing");
            return {
              detail: `Phase 1 complete (Stages 13–16). Session status: ${row?.status ?? "unknown"}. Stage 16 output: ${row?.stage_16_agency_output.length ?? 0} chars.`,
            };
          },
          "Identify the first failing stage in the 13–16 chain from progress log; check brand_intelligence persistence and Stage 15 audit gate.",
        );
        let result!: FullCheckResult;
        for (;;) {
          const r = await gen.next();
          if (r.done) {
            result = r.value;
            break;
          }
          yield r.value;
        }
        yield { type: "check_done", result };
      }

      // ---------------------------------------------------------------------
      // CHECK 9 — Sanitiser config + token caps (structural)
      // ---------------------------------------------------------------------
      yield { type: "check_start", index: 9, id: CHECK_DEFS[8].id, name: CHECK_DEFS[8].name };
      {
        const gen = runCheck(
          9,
          async () => {
            // Sanitiser: confirm a transform function is exported and trims something.
            const sanitise = await import("@/lib/sanitise-output");
            const sanitiseFns = Object.entries(sanitise).filter(
              ([, v]) => typeof v === "function",
            );
            if (sanitiseFns.length === 0)
              throw new Error("sanitise-output.ts exports no functions");
            if (!/sanitise|sanitize|strip|clean/i.test(sanitiseSource))
              throw new Error("sanitise-output.ts source lacks expected sanitisation keywords");

            // Token caps: scan every stage*.functions.ts source for an explicit maxTokens cap.
            // Accept either a numeric literal (`maxTokens: 8000`) or an identifier reference
            // (`maxTokens: section.maxTokens`) — the latter resolves to caps defined in a
            // companion `stage*-sections.ts` config file, which we also verify contains literals.
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
              detail: `Sanitiser exports ${sanitiseFns.length} function(s); all 27 stage modules declare explicit maxTokens caps.`,
            };
          },
          "Add `maxTokens: <N>` to the callClaude/streamClaude call inside the named stage, or restore sanitise-output.ts exports.",
        );
        let result!: FullCheckResult;
        for (;;) {
          const r = await gen.next();
          if (r.done) {
            result = r.value;
            break;
          }
          yield r.value;
        }
        yield { type: "check_done", result };
      }

      // ---------------------------------------------------------------------
      // CHECK 10 — Phase 2 chain: Stage 17 → select → 17B → 18
      // ---------------------------------------------------------------------
      yield { type: "check_start", index: 10, id: CHECK_DEFS[9].id, name: CHECK_DEFS[9].name };
      {
        const gen = runCheck(
          10,
          async (emit) => {
            if (!primarySessionId || results[7].status !== "pass")
              throw new Error("Skipped: Phase 1 completion (Stages 13–16) did not pass");
            // Ensure Three Truths exist (Phase 2 prerequisite).
            emit("Stubbing Three Truths (product/consumer/cultural) — Phase 2 prerequisite");
            await supabaseAdmin
              .from("sessions")
              .update({
                truth_product: "TestBrand consistently delivers cold-pressed adaptogenic tonic with clinically meaningful dosing.",
                truth_consumer: "Consumers say they want calm but reward intensity.",
                truth_cultural: "Wellness has become a performance — fatigue with earnestness is rising.",
                truth_cultural_confirmed: true,
                brand_intel_confirmed: true,
                phase_2_status: "in_progress",
              })
              .eq("id", primarySessionId);
            emit("Running Stage 17 (Detonation Territory)...");
            const s17 = await runStage17({ data: { sessionId: primarySessionId } });
            const territoryMarkdown = (s17 as { output: string }).output ?? "";
            if (territoryMarkdown.length < 200) throw new Error("Stage 17 output too short");
            // Pick first ## territory block.
            const blocks = territoryMarkdown.split(/\n(?=##\s)/).filter((b) => /##\s/.test(b));
            const first = blocks[0] ?? territoryMarkdown;
            emit("Selecting top-ranked territory (auto)");
            await selectStage17Territory({
              data: { sessionId: primarySessionId, territoryMarkdown: first },
            });
            emit("Running Stage 17B (Detonation Intelligence)...");
            await runStage17b({ data: { sessionId: primarySessionId } });
            emit("Running Stage 18 (The Detonation)...");
            await runStage18({ data: { sessionId: primarySessionId } });
            const { data: row } = await supabaseAdmin
              .from("sessions")
              .select("stage_17_output, stage_17_selected_territory, stage_17b_output, stage_18_output")
              .eq("id", primarySessionId)
              .single();
            if (!row?.stage_17b_output || !row?.stage_18_output)
              throw new Error("Stage 17B or 18 output missing after Phase 2 chain");
            return {
              detail: "Phase 2 chain executed end-to-end: Stage 17 → territory selection → 17B → 18, all outputs persisted.",
            };
          },
          "Inspect Phase 2 checkpoint gate (D), selectStage17Territory writeback, and stage_17b_output column write.",
        );
        let result!: FullCheckResult;
        for (;;) {
          const r = await gen.next();
          if (r.done) {
            result = r.value;
            break;
          }
          yield r.value;
        }
        yield { type: "check_done", result };
      }

      // ---------------------------------------------------------------------
      // CHECK 11 — Canvas → Detonation route navigation (structural)
      // ---------------------------------------------------------------------
      yield { type: "check_start", index: 11, id: CHECK_DEFS[10].id, name: CHECK_DEFS[10].name };
      {
        const gen = runCheck(
          11,
          async () => {
            const checks: Array<{ ok: boolean; msg: string }> = [];
            checks.push({
              ok: /createFileRoute\(['"]\/detonation['"]\)/.test(detonationSource),
              msg: "detonation route registered",
            });
            checks.push({
              ok: /export\s+function\s+DetonationRoute|export\s+const\s+DetonationRoute|component:\s*DetonationRoute/.test(
                detonationSource,
              ) || /component:\s*\w+/.test(detonationSource),
              msg: "detonation route has component",
            });
            checks.push({
              ok: /await\s+navigate\s*\(\s*\{\s*to:\s*['"]\/detonation['"]/.test(
                detonationCanvasSource,
              ),
              msg: "canvas → detonation navigation call present",
            });
            checks.push({
              ok: /saveBrandIntelligence/.test(detonationCanvasSource),
              msg: "saveBrandIntelligence wired in canvas",
            });
            checks.push({
              ok: /STAGE_9_SYSTEM_PROMPT/.test(STAGE_9_SYSTEM_PROMPT) || STAGE_9_SYSTEM_PROMPT.length > 200,
              msg: "Stage 9 prompt resolvable",
            });
            const failed = checks.filter((c) => !c.ok);
            if (failed.length) throw new Error(`Structural checks failed: ${failed.map((f) => f.msg).join("; ")}`);
            return { detail: `All ${checks.length} structural route/navigation invariants present.` };
          },
          "Open src/routes/detonation_.canvas.tsx and verify the explicit `await navigate({ to: '/detonation' })` after saveBrandIntelligence completes.",
        );
        let result!: FullCheckResult;
        for (;;) {
          const r = await gen.next();
          if (r.done) {
            result = r.value;
            break;
          }
          yield r.value;
        }
        yield { type: "check_done", result };
      }

      // ---------------------------------------------------------------------
      // CHECK 12 — Concurrent session integrity (two parallel Stage 1 runs)
      // ---------------------------------------------------------------------
      yield { type: "check_start", index: 12, id: CHECK_DEFS[11].id, name: CHECK_DEFS[11].name };
      {
        const gen = runCheck(
          12,
          async (emit) => {
            emit("Creating two parallel TestBrand sessions");
            const mkSession = async (suffix: string): Promise<string> => {
              const { data: s, error } = await supabaseAdmin
                .from("sessions")
                .insert({
                  brand_name: `${TESTBRAND_BRAND_NAME} ${suffix}`,
                  category: TESTBRAND_CATEGORY,
                  strategic_mode: TESTBRAND_STRATEGIC_MODE,
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
            emit(`Sessions created: ${idA.slice(0, 8)} & ${idB.slice(0, 8)} — running Stage 1 in parallel`);
            const [resA, resB] = await Promise.all([
              drainGenerator(runStage1({ data: { sessionId: idA } })),
              drainGenerator(runStage1({ data: { sessionId: idB } })),
            ]);
            const outA = String((resA as { output?: string }).output ?? "");
            const outB = String((resB as { output?: string }).output ?? "");
            if (outA.length < 200 || outB.length < 200)
              throw new Error("One or both parallel Stage 1 outputs too short");
            // Read back from DB to confirm each session got its own write (no cross-contamination).
            const { data: rows, error: readErr } = await supabaseAdmin
              .from("sessions")
              .select("id, stage_1_output")
              .in("id", [idA, idB]);
            if (readErr) throw new Error(`Read-back failed: ${readErr.message}`);
            const rowA = rows?.find((r) => r.id === idA);
            const rowB = rows?.find((r) => r.id === idB);
            if (!rowA?.stage_1_output || !rowB?.stage_1_output)
              throw new Error("One or both sessions missing stage_1_output after parallel run");
            if (rowA.stage_1_output === rowB.stage_1_output)
              throw new Error("Parallel sessions produced identical stage_1_output — cross-contamination suspected");
            return {
              detail: `Two parallel Stage 1 runs completed independently with distinct outputs (${outA.length} / ${outB.length} chars).`,
            };
          },
          "Inspect runStage1 for any cross-session state (module-level caches, shared mutable refs). All session reads/writes must scope by sessionId.",
        );
        let result!: FullCheckResult;
        for (;;) {
          const r = await gen.next();
          if (r.done) {
            result = r.value;
            break;
          }
          yield r.value;
        }
        yield { type: "check_done", result };
      }
    } catch (fatal) {
      const msg = fatal instanceof Error ? fatal.message : String(fatal);
      yield { type: "error", message: `Fatal error during Tier Two: ${msg}` };
    } finally {
      // -------------------------------------------------------------------
      // Cleanup — delete every TestBrand session we created
      // -------------------------------------------------------------------
      const ids = Array.from(createdSessionIds);
      if (ids.length > 0) {
        await supabaseAdmin.from("sessions").delete().in("id", ids);
      }

      // Finalise preflight_checks row
      const failedCount = results.filter((r) => r.status === "fail").length;
      const overall: "ready" | "issue_detected" = failedCount === 0 ? "ready" : "issue_detected";
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

// ---------------------------------------------------------------------------
// Read latest full check (for dashboard polling / hydration)
// ---------------------------------------------------------------------------

export const getLatestTierTwoCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, context, error } = await supabaseAdmin
      .from("preflight_checks")
      .select("id, status, started_at, completed_at, tier_two_results, overall_result")
      .eq("check_type", "full")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ?? null;
  });
