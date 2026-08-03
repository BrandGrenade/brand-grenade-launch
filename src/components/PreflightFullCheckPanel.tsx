// Tier Two Full Integrity Check — dashboard panel
//
// • "Run System Check" button (the first action on the dashboard).
// • Streams progress from runTierTwoFullCheck (server async generator).
// • On failure, shows per-check remediation + estimated fix time from a
//   central registry (REMEDIATION_BY_ID below) and surfaces the Escalation
//   Protocol with two clickable actions.

import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  runTierTwoFullCheck,
  getLatestTierTwoCheck,
  getRecentTierTwoResults,
  recordPreflightResults,
  recordPreflightCheck3Result,
  recordPreflightCheck8Result,
  finalizePreflightRun,
  confirmPreflightCheckpointA,
  runTierTwoChecksFrom4,
  runTierTwoChecksFrom7,
  runTierTwoChecksFrom9,
  runTierTwoChecksFrom11,
  runTierTwoCheck13,
  PREFLIGHT_TESTBRAND_BRAND_INTELLIGENCE,
  type FullCheckId,
  type FullCheckResult,
  type TierTwoEvent,
} from "@/lib/preflight-tier-two.functions";
import {
  summariseSeverities,
  shouldBlockPresentation,
  SEVERITY_LABEL,
  SEVERITY_COLOR,
  type Severity,
} from "@/lib/preflight-severity";
import { supabase } from "@/integrations/supabase/client";
import { runStage1 } from "@/lib/stage1.functions";
import { runStage2 } from "@/lib/stage2.functions";
import { runStage3 } from "@/lib/stage3.functions";
import { runStage4 } from "@/lib/stage4.functions";
import { runStage4b } from "@/lib/stage4b.functions";
import { runStage5 } from "@/lib/stage5.functions";
import { runStage6 } from "@/lib/stage6.functions";
import { runStage7 } from "@/lib/stage7.functions";
import { runStage8, confirmCheckpointB } from "@/lib/stage8.functions";
import { runStage10 } from "@/lib/stage10.functions";
import { runStage11 } from "@/lib/stage11.functions";
import { runStage12, saveSelectedSMP, saveSelectionRationale } from "@/lib/stage12.functions";
import { countStage12PropositionCards, filterValidatedFromStage11 } from "@/lib/stage12-filter";
import { saveBrandIntelligence, runStage13 } from "@/lib/stage13.functions";
import { runStage13b } from "@/lib/stage13b.functions";
import { runStage14 } from "@/lib/stage14.functions";
import { runStage14b } from "@/lib/stage14b.functions";
import { runStage14c } from "@/lib/stage14c.functions";
import { runStage15 } from "@/lib/stage15.functions";
import { runStage16 } from "@/lib/stage16.functions";
import { runStage17, selectStage17Territory } from "@/lib/stage17.functions";
import { runStage17b } from "@/lib/stage17b.functions";
import { runStage18, selectStage18Detonation } from "@/lib/stage18.functions";
import { runStage19 } from "@/lib/stage19.functions";
import { runStage20, approveStage20 } from "@/lib/stage20.functions";
import { runStage20b } from "@/lib/stage20b.functions";
import { runStage21 } from "@/lib/stage21.functions";
import { runStage22 } from "@/lib/stage22.functions";
import { splitCards } from "@/lib/phase2-shared";

// Drain a streaming server-fn AsyncGenerator until its final `done` chunk.
async function drainStream<C extends { delta?: string; done?: true }>(
  generatorOrPromise: AsyncGenerator<C, void, unknown> | Promise<AsyncGenerator<C, void, unknown>>,
): Promise<C & { done: true }> {
  const gen = (await generatorOrPromise) as AsyncGenerator<C, void, unknown>;
  let final: (C & { done: true }) | null = null;
  for await (const chunk of gen) {
    if (chunk && (chunk as { done?: true }).done) {
      final = chunk as C & { done: true };
    }
  }
  if (!final) throw new Error("Stream ended without a final payload");
  return final;
}

// Poll `sessions.<column>` every `intervalMs` up to `maxMs`. Resolves with the
// first non-null value, rejects on timeout. Used to survive dropped SSE
// connections on long-generation streaming stages: even when the browser
// never receives the terminal `done` chunk (Cloudflare edge closes the
// connection mid-flight), the server-side handler has still written its
// output to the DB, and the DB is the source of truth.
async function pollForSessionColumn(
  sessionId: string,
  column: string,
  opts: { intervalMs?: number; maxMs?: number } = {},
): Promise<string> {
  const intervalMs = opts.intervalMs ?? 5_000;
  const maxMs = opts.maxMs ?? 3 * 60_000;
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, intervalMs));
    try {
      const { data } = await supabase
        .from("sessions")
        .select(column)
        .eq("id", sessionId)
        .maybeSingle();
      const value = (data as Record<string, unknown> | null)?.[column];
      if (typeof value === "string" && value.length > 0) return value;
    } catch {
      /* transient — try again */
    }
  }
  throw new Error(`DB poll timed out after ${Math.round(maxMs / 1000)}s waiting for sessions.${column}`);
}

// Run a streaming stage but fall back to DB polling if the SSE connection is
// dropped mid-flight. Whichever source produces the final output first wins.
// This closes the "browser never gets the `done` chunk because Cloudflare
// closed the stream" failure mode for long-generation stages.
async function drainStreamOrPollDb<C extends { delta?: string; done?: true; output?: string }>(
  generator: AsyncGenerator<C, void, unknown> | Promise<AsyncGenerator<C, void, unknown>>,
  fallback: { sessionId: string; column: string; minChars?: number; maxMs?: number; intervalMs?: number },
): Promise<{ output: string; source: "stream" | "db-poll" }> {
  const minChars = fallback.minChars ?? 1000;
  const streamP = drainStream(generator)
    .then((r) => String((r as { output?: string }).output ?? ""))
    .catch(() => "");
  const dbP = pollForSessionColumn(fallback.sessionId, fallback.column, {
    intervalMs: fallback.intervalMs,
    maxMs: fallback.maxMs,
  });
  return await new Promise<{ output: string; source: "stream" | "db-poll" }>((resolve, reject) => {
    let settled = false;
    let streamResolved = false;
    let streamValue = "";
    streamP.then((v) => {
      streamResolved = true;
      streamValue = v;
      if (settled) return;
      if (v && v.length >= minChars) {
        settled = true;
        resolve({ output: v, source: "stream" });
      }
      // If stream returned nothing/short, keep waiting on dbP.
    });
    dbP
      .then((v) => {
        if (settled) return;
        settled = true;
        resolve({ output: v, source: "db-poll" });
      })
      .catch((err) => {
        if (settled) return;
        // If the DB source of truth timed out and the stream has not already
        // completed, fail immediately. Waiting for a never-resolving stream is
        // the exact dropped-SSE hang this helper exists to avoid.
        settled = true;
        if (streamResolved && streamValue.length > 0) resolve({ output: streamValue, source: "stream" });
        else reject(err);
      });
  });
}

// Per-stage watchdog thresholds. Sized from ACTUAL observed worst-case
// runtimes across today's Tier Two runs, then padded with generous headroom
// (roughly 2× observed max, or observed max + 5 min, whichever is greater).
// The watchdog should ONLY fire on a genuine multi-minute stall — never on
// a heavy stage that's just running long normally. A stage sitting close
// to its threshold is a bug; every heavy stage below has comfortable slack.
//
// Observed worst cases from today (rounded up): Stage 7 ~169s (continuation
// windows can spike to ~6min), Stage 11 ~523s (heartbeat stall), Stage 15
// ~532s (heartbeat stall), Stage 16 assembly can spike ~7min, Phase 2 tail
// (17→22) similarly heavy. All heavy stages therefore ≥15 min budget.
const STAGE_WATCHDOG_MS: Record<string, number> = {
  // Fast single-pass CMM / constraint stages — 6 min is ample.
  "Stage 1": 6 * 60_000,
  "Stage 1B": 6 * 60_000,
  "Stage 3": 6 * 60_000,
  "Stage 4": 6 * 60_000,
  "Stage 13B": 6 * 60_000,
  "Stage 14B": 6 * 60_000,
  "Stage 14C": 6 * 60_000,
  // Heavy Phase 1 generation stages — all bumped well clear of observed max.
  "Stage 2": 12 * 60_000,
  "Stage 4B": 12 * 60_000,
  "Stage 5": 12 * 60_000,
  "Stage 6": 10 * 60_000,
  "Stage 7": 15 * 60_000,   // continuation loop, up to 3× 64k passes
  "Stage 8": 10 * 60_000,
  "Stage 9": 12 * 60_000,   // core + LOC with banned-word retries
  "Stage 10": 10 * 60_000,
  "Stage 11": 15 * 60_000,  // per-SMP pressure test — observed 523s stall
  "Stage 12": 15 * 60_000,  // multi-SMP synthesis + rationale
  "Stage 13": 10 * 60_000,
  "Stage 14": 10 * 60_000,
  "Stage 15": 15 * 60_000,  // observed 532s stall — was 360s
  "Stage 16": 15 * 60_000,  // long document assembly
  // Phase 2 detonation chain — all heavy generation, sized to match.
  "Stage 17": 10 * 60_000,
  "Stage 17B": 10 * 60_000,
  "Stage 18": 15 * 60_000,  // The Detonation — flagship long generation
  "Stage 19": 10 * 60_000,
  "Stage 20": 12 * 60_000,
  "Stage 20B": 10 * 60_000,
  "Stage 21": 12 * 60_000,
  "Stage 22": 12 * 60_000,
};
const DEFAULT_WATCHDOG_MS = 10 * 60_000;

function thresholdForLabel(label: string): number {
  if (STAGE_WATCHDOG_MS[label] !== undefined) return STAGE_WATCHDOG_MS[label];
  // Match "Stage 7 (continuation 2)" etc. by the leading "Stage N" prefix.
  const m = /^(Stage\s+\d+[A-Z]?)/i.exec(label);
  if (m && STAGE_WATCHDOG_MS[m[1]] !== undefined) return STAGE_WATCHDOG_MS[m[1]];
  return DEFAULT_WATCHDOG_MS;
}

// Client-side backstop watchdog. Races a stage RPC against a stream-liveness
// check on `sessions.stream_last_delta_at` (falling back to `updated_at` for
// non-streaming stages that don't touch the delta column). Keying off the
// stream-safety wrapper's heartbeat means a stage that is still receiving
// tokens — even if writes are batching or the row hasn't been touched for
// unrelated reasons — is NOT killed. A genuinely dead Worker (no tokens at
// all) still trips the watchdog because the heartbeat stops moving.
async function runWithWatchdog(
  opts: { sessionId: string; label: string; maxIdleMs?: number; pollMs?: number },
  work: () => Promise<unknown>,
): Promise<unknown> {
  const maxIdleMs = opts.maxIdleMs ?? thresholdForLabel(opts.label);
  const pollMs = opts.pollMs ?? 15_000;
  let stopped = false;
  const startedAt = Date.now();

  const watchdog = new Promise<never>((_, reject) => {
    const tick = async () => {
      if (stopped) return;
      try {
        const { data } = await supabase
          .from("sessions")
          .select("updated_at, stream_last_delta_at")
          .eq("id", opts.sessionId)
          .maybeSingle();
        const rowUpdatedAt = data?.updated_at ? new Date(data.updated_at).getTime() : 0;
        const streamDeltaAt = (data as { stream_last_delta_at?: string | null } | null)
          ?.stream_last_delta_at
          ? new Date((data as { stream_last_delta_at: string }).stream_last_delta_at).getTime()
          : 0;
        // Prefer the stream-liveness heartbeat when present; fall back to the
        // generic row-update timestamp for non-streaming stages / older rows.
        const liveness = Math.max(streamDeltaAt, rowUpdatedAt);
        // Reference point: never treat the pre-start row as instantly stale.
        const reference = Math.max(liveness, startedAt);
        const idleFor = Date.now() - reference;
        if (idleFor > maxIdleMs) {
          stopped = true;
          try {
            await supabase
              .from("sessions")
              .update({ status: "interrupted" })
              .eq("id", opts.sessionId);
          } catch { /* best-effort */ }
          const heartbeatSrc = streamDeltaAt > 0 ? "stream_last_delta_at" : "updated_at";
          reject(new Error(
            `Watchdog: ${opts.label} no stream heartbeat (${heartbeatSrc}) for ${Math.round(idleFor / 1000)}s ` +
            `(threshold ${Math.round(maxIdleMs / 1000)}s). Server Worker presumed dead; row released.`,
          ));
          return;
        }
      } catch { /* transient poll error — try again */ }
      if (!stopped) setTimeout(() => { void tick(); }, pollMs);
    };
    setTimeout(() => { void tick(); }, pollMs);
  });

  try {
    return await Promise.race([work(), watchdog]);
  } finally {
    stopped = true;
  }
}


type RunState = "idle" | "running" | "complete" | "lock_failed" | "error";

const CHECK_NAMES: Record<FullCheckId, string> = {
  stage_1_brief_analysis: "1. Stage 1 — Brief Analysis on TestBrand",
  phase1a_chain_2_to_7: "2. Stages 2–7 — Phase 1A sequential chain",
  stage_8_checkpoint_b: "3. Stage 8 — Proposition + Checkpoint B confirmation",
  stage_prompts_integrity: "4. All 22 stage system prompts present & non-empty",
  stage_9_edt_guard_output: "5. Stage 9 — EDT guard output sanitisation",
  stage_10_11_evaluation_chain: "6. Stages 10–11 — Evaluation chain",
  stage_12_smp_selection: "7. Stage 12 — SMP selection + rationale persistence",
  phase1_completion_13_to_16: "8. Stages 13–15 — Phase 1 completion + Stage 16 gate correctly locked pre-Phase 2",
  sanitiser_and_token_caps: "9. Sanitiser configuration + token caps on all stages",
  phase2_detonation_chain: "10. Phase 2 chain (17 → 22) + Stage 16 Document Assembly end-to-end",
  canvas_to_detonation_navigation: "11. Three Truth Canvas → Detonation route navigation",
  concurrent_session_integrity: "12. Concurrent session integrity (two parallel Stage 1 runs)",
  loc_track_integrity: "13. Left-of-Centre track — 13 engines, anchors, validation, persistence",
};

// Central remediation registry — explicit instruction + estimated fix time per
// check id. Used in preference to whatever the server returned so the user
// always sees the exact prescribed remediation language, not a generic error.
const REMEDIATION_BY_ID: Record<FullCheckId, { instruction: string; etaMinutes: number }> = {
  stage_1_brief_analysis: {
    instruction:
      "Open src/lib/stage1.functions.ts and src/lib/claude.server.ts. Verify the ANTHROPIC_API_KEY secret is live, the Stage 1 system prompt is non-empty, and the streamClaude call returns >200 chars against the TestBrand brief. Re-run the System Check.",
    etaMinutes: 10,
  },
  phase1a_chain_2_to_7: {
    instruction:
      "Open Stages 2–7 function files and verify Checkpoint A is being auto-confirmed and each stage reads the prior stage's output column. Inspect the first failing stage's error detail above and fix that single stage before re-running.",
    etaMinutes: 20,
  },
  stage_8_checkpoint_b: {
    instruction:
      "Open src/lib/stage8.functions.ts. Verify the Strategic Propositions prompt is intact and confirmCheckpointB writes checkpoint_b_confirmed = true. If checkpoint write succeeded but Stage 9 cannot read it, inspect RLS on sessions.",
    etaMinutes: 10,
  },
  stage_prompts_integrity: {
    instruction:
      "One or more of the 22 stage system prompt files is missing or empty. Open the named prompt file under src/lib/*-prompt.ts and restore the prompt from prompt_versions.md before re-running.",
    etaMinutes: 5,
  },
  stage_9_edt_guard_output: {
    instruction:
      "Open src/lib/stage9-prompt.ts. The Emotional Direction Test banned-word clause (earned, deserved, guilt, apology, permission) must appear verbatim. Restore the v2.1 EDT guard from prompt_versions.md.",
    etaMinutes: 10,
  },
  stage_10_11_evaluation_chain: {
    instruction:
      "Open src/lib/stage10.functions.ts and src/lib/stage11.functions.ts. Verify both stages read stage_9_output, that Stage 11 produces a ranked evaluation, and that the Claude model is reachable. Inspect the detail above for which stage failed first.",
    etaMinutes: 15,
  },
  stage_12_smp_selection: {
    instruction:
      "Open src/lib/stage12.functions.ts. Verify saveSelectedSMP and saveSelectionRationale persist to sessions.stage_12_selected_smp and stage_12_selection_rationale. Inspect RLS UPDATE policy on sessions.",
    etaMinutes: 10,
  },
  phase1_completion_13_to_16: {
    instruction:
      "Stages 13–15 must complete cleanly AND Stage 16's Phase-2-completion gate must fire pre-Phase 2. If a Stage 13–15 step failed, inspect that stage's function file. If the Stage 16 gate did NOT fire, restore the Phase 2 readiness check in src/lib/stage16.functions.ts — Stage 16 must refuse to assemble before Checkpoints D and E are confirmed.",
    etaMinutes: 20,
  },
  sanitiser_and_token_caps: {
    instruction:
      "Open src/lib/sanitise-output.ts and src/lib/claude.server.ts. Sanitiser banned-token list must be non-empty and every stage's streamClaude call must specify an explicit maxTokens. Restore caps per prompt_versions.md.",
    etaMinutes: 10,
  },
  phase2_detonation_chain: {
    instruction:
      "Open src/lib/stage17–22 function files and src/lib/stage16.functions.ts. Phase 2 order: Stage 17 → selectStage17Territory (Checkpoint D) → 17B → 18 → selectStage18Detonation (E) → 19 → 20 → approveStage20 (F, composite ≥ 40) → 20B → 21 → 22 → Stage 16 Document Assembly. Inspect the first failing step above.",
    etaMinutes: 25,
  },
  canvas_to_detonation_navigation: {
    instruction:
      "Open src/routes/detonation_.canvas.tsx. The handler that runs after saveBrandIntelligence must call `await navigate({ to: '/detonation', search: { session: sessionId } })`. Verify src/routes/detonation.tsx exports DetonationRoute. Do not patch — restore the await navigate pattern.",
    etaMinutes: 5,
  },
  concurrent_session_integrity: {
    instruction:
      "Two parallel TestBrand sessions did not both complete Stage 1 cleanly. Inspect Supabase RLS, the sessions unique constraints, and the Claude rate-limit error. If the failure is a rate-limit, retry; if RLS, fix the policy. Do not serialise stage execution to mask a real concurrency bug.",
    etaMinutes: 15,
  },
  loc_track_integrity: {
    instruction:
      "The Left-of-Centre track failed its contract. The failing engine is named in loc_engine_outputs on the preserved TestBrand LOC session — read that column first rather than re-running. Common causes: an engine prompt whose parser contract drifted (parseEngineOutput in src/lib/loc/engine-prompts.ts), the anchor gate rejecting every proposition, or the validation pass nulling scores. Do not relax the assertions in src/lib/loc-integrity.server.ts to make this pass.",
    etaMinutes: 20,
  },
};

function statusBadge(status: FullCheckResult["status"]) {
  switch (status) {
    case "pass":
      return <span className="inline-flex h-5 items-center gap-1 rounded bg-emerald-600/20 px-2 text-[11px] font-semibold uppercase tracking-wider text-emerald-400">PASS</span>;
    case "fail":
      return <span className="inline-flex h-5 items-center gap-1 rounded bg-red-600/25 px-2 text-[11px] font-semibold uppercase tracking-wider text-red-400">FAIL</span>;
    case "running":
      return <span className="inline-flex h-5 items-center gap-1 rounded bg-amber-600/20 px-2 text-[11px] font-semibold uppercase tracking-wider text-amber-400">RUNNING…</span>;
    case "pending":
    default:
      return <span className="inline-flex h-5 items-center gap-1 rounded bg-neutral-700/40 px-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">PENDING</span>;
  }
}

function buildPostponementDraft(failedNames: string[]) {
  const list = failedNames.map((n) => `  • ${n}`).join("\n");
  return `Subject: Re-scheduling today's strategy session

Hi [Client first name],

A quick heads-up before our session today.

Our pre-flight integrity check flagged ${failedNames.length} issue${failedNames.length === 1 ? "" : "s"} on the strategy platform that we need to clear before we run live with you:
${list}

We are not willing to present strategic work on a platform that is not 100% verified, so I'd like to postpone our session by 24 hours while we fix this. I'll send through a fresh calendar invite within the hour.

Apologies for the short notice — we'd rather pull the session than hand you anything less than the standard you signed up for.

Speak shortly,
[Your name]`;
}

export function PreflightFullCheckPanel() {
  const runTierTwoFn = useServerFn(runTierTwoFullCheck);
  const getLatestFn = useServerFn(getLatestTierTwoCheck);
  const recordResultsFn = useServerFn(recordPreflightResults);
  const runFrom4Fn = useServerFn(runTierTwoChecksFrom4);
  const runFrom7Fn = useServerFn(runTierTwoChecksFrom7);
  const runResumeFn = useServerFn(runTierTwoChecksFrom9);
  const runFrom11Fn = useServerFn(runTierTwoChecksFrom11);
  const recordCheck3Fn = useServerFn(recordPreflightCheck3Result);
  const recordCheck8Fn = useServerFn(recordPreflightCheck8Result);
  const finalizeRunFn = useServerFn(finalizePreflightRun);
  const confirmCheckpointAFn = useServerFn(confirmPreflightCheckpointA);
  const stage2Fn = useServerFn(runStage2);
  const stage3Fn = useServerFn(runStage3);
  const stage4Fn = useServerFn(runStage4);
  const stage4bFn = useServerFn(runStage4b);
  const stage5Fn = useServerFn(runStage5);
  const stage6Fn = useServerFn(runStage6);
  const stage7Fn = useServerFn(runStage7);
  const stage8Fn = useServerFn(runStage8);
  const stage1Fn = useServerFn(runStage1);
  const confirmCheckpointBFn = useServerFn(confirmCheckpointB);
  const stage10Fn = useServerFn(runStage10);
  const stage11Fn = useServerFn(runStage11);
  const stage12Fn = useServerFn(runStage12);
  const saveSelectedSMPFn = useServerFn(saveSelectedSMP);
  const saveSelectionRationaleFn = useServerFn(saveSelectionRationale);
  const seedBrandIntelFn = useServerFn(saveBrandIntelligence);
  const stage13Fn = useServerFn(runStage13);
  const stage13bFn = useServerFn(runStage13b);
  const stage14Fn = useServerFn(runStage14);
  const stage14bFn = useServerFn(runStage14b);
  const stage14cFn = useServerFn(runStage14c);
  const stage15Fn = useServerFn(runStage15);
  const stage16Fn = useServerFn(runStage16);
  const stage17Fn = useServerFn(runStage17);
  const selectStage17Fn = useServerFn(selectStage17Territory);
  const stage17bFn = useServerFn(runStage17b);
  const stage18Fn = useServerFn(runStage18);
  const selectStage18Fn = useServerFn(selectStage18Detonation);
  const stage19Fn = useServerFn(runStage19);
  const stage20Fn = useServerFn(runStage20);
  const approveStage20Fn = useServerFn(approveStage20);
  const stage20bFn = useServerFn(runStage20b);
  const stage21Fn = useServerFn(runStage21);
  const stage22Fn = useServerFn(runStage22);

  const [state, setState] = useState<RunState>("idle");
  const [results, setResults] = useState<FullCheckResult[]>([]);
  const [currentMessage, setCurrentMessage] = useState<string>("");
  const [overall, setOverall] = useState<"ready" | "issue_detected" | null>(null);
  const [lockMessage, setLockMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [draftOpen, setDraftOpen] = useState(false);
  // Prior completed runs' results, used only for recurrence escalation in the
  // severity classifier (a transient that fails the same way N runs in a row
  // becomes a blocker). Excludes the current run.
  const [priorRuns, setPriorRuns] = useState<FullCheckResult[][]>([]);
  const getRecentFn = useServerFn(getRecentTierTwoResults);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number | null>(null);

  // Load the last 5 completed runs once on mount so severity classification
  // has recurrence data. Excludes running rows and the current in-flight run.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await getRecentFn({ data: { limit: 5 } });
        if (cancelled) return;
        const priors = (rows ?? [])
          .filter((r) => Array.isArray(r.tier_two_results))
          .map((r) => r.tier_two_results as unknown as FullCheckResult[]);
        // Drop the most recent one if it matches what we're currently displaying
        // (avoid double-counting the current row as its own prior).
        setPriorRuns(priors.slice(1));
      } catch { /* best-effort */ }
    })();
    return () => { cancelled = true; };
  }, [getRecentFn]);


  // Hydrate from latest persisted run on mount, and poll while a run is in
  // progress server-side (e.g. the user closed the tab and reopened it) so
  // per-check progress becomes visible instead of a static "already running"
  // banner.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      try {
        const latest = await getLatestFn();
        if (cancelled) return;
        if (latest && Array.isArray(latest.tier_two_results)) {
          setResults(latest.tier_two_results as unknown as FullCheckResult[]);
        }
        if (latest?.status === "running") {
          if (latest.started_at) {
            const startedMs = new Date(latest.started_at).getTime();
            startedAtRef.current = startedMs;
            setElapsedMs(Date.now() - startedMs);
          }
          setState((prev) => (prev === "idle" || prev === "lock_failed" ? "lock_failed" : prev));
          setLockMessage(
            `A Tier Two check is running server-side. Live per-check progress below refreshes every 5s. You can override to start a new run, or wait for this one to finish.`,
          );
          timer = setTimeout(tick, 5000);
        } else if (latest?.status === "complete") {
          setState("complete");
          setOverall((latest.overall_result as "ready" | "issue_detected" | null) ?? null);
        }
      } catch {
        if (!cancelled) timer = setTimeout(tick, 10000);
      }
    };

    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [getLatestFn]);

  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  const startElapsed = () => {
    startedAtRef.current = Date.now();
    setElapsedMs(0);
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      if (startedAtRef.current) setElapsedMs(Date.now() - startedAtRef.current);
    }, 500);
  };
  const stopElapsed = () => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
  };

  // Process events from one streaming server-fn generator. Returns a
  // handoff payload if the stream ended with one of the staged client-driver
  // handoffs, otherwise terminal sentinel.
  type ProcessOutcome =
    | { kind: "handoff1"; payload: Extract<TierTwoEvent, { type: "check_1_handoff" }> }
    | { kind: "handoff2"; payload: Extract<TierTwoEvent, { type: "check_2_handoff" }> }
    | { kind: "handoff3"; payload: Extract<TierTwoEvent, { type: "check_3_handoff" }> }
    | { kind: "handoff6"; payload: Extract<TierTwoEvent, { type: "check_6_handoff" }> }
    | { kind: "handoff7"; payload: Extract<TierTwoEvent, { type: "check_7_handoff" }> }
    | { kind: "handoff8"; payload: Extract<TierTwoEvent, { type: "check_8_handoff" }> }
    | { kind: "handoff10"; payload: Extract<TierTwoEvent, { type: "check_10_handoff" }> }
    | { kind: "handoff12"; payload: Extract<TierTwoEvent, { type: "check_12_handoff" }> }
    | { kind: "done" }
    | { kind: "lock_failed" }
    | { kind: "error" };
  const processStream = async (
    gen: AsyncGenerator<TierTwoEvent, void, unknown>,
  ): Promise<ProcessOutcome> => {
    for await (const ev of gen) {
      if (ev.type === "lock_failed") {
        setState("lock_failed");
        setLockMessage(ev.reason);
        stopElapsed();
        return { kind: "lock_failed" };
      }
      if (ev.type === "start") {
        setResults(ev.checks);
        continue;
      }
      if (ev.type === "check_start") {
        setCurrentMessage(`▶ ${ev.name}`);
        setResults((prev) =>
          prev.map((r) => (r.index === ev.index ? { ...r, status: "running" } : r)),
        );
        continue;
      }
      if (ev.type === "check_progress") {
        setCurrentMessage(`  · ${ev.message}`);
        continue;
      }
      if (ev.type === "check_done") {
        setResults((prev) => prev.map((r) => (r.index === ev.result.index ? ev.result : r)));
        continue;
      }
      if (ev.type === "check_1_handoff") {
        setResults(ev.results);
        return { kind: "handoff1", payload: ev };
      }
      if (ev.type === "check_2_handoff") {
        setResults(ev.results);
        return { kind: "handoff2", payload: ev };
      }
      if (ev.type === "check_3_handoff") {
        setResults(ev.results);
        return { kind: "handoff3", payload: ev };
      }
      if (ev.type === "check_6_handoff") {
        setResults(ev.results);
        return { kind: "handoff6", payload: ev };
      }
      if (ev.type === "check_7_handoff") {
        setResults(ev.results);
        return { kind: "handoff7", payload: ev };
      }
      if (ev.type === "check_8_handoff") {
        setResults(ev.results);
        return { kind: "handoff8", payload: ev };
      }
      if (ev.type === "check_10_handoff") {
        setResults(ev.results);
        return { kind: "handoff10", payload: ev };
      }
      if (ev.type === "check_12_handoff") {
        setResults(ev.results);
        return { kind: "handoff12", payload: ev };
      }
      if (ev.type === "done") {
        setOverall(ev.overall);
        setState("complete");
        setCurrentMessage(
          `Completed in ${(ev.totalDurationMs / 1000).toFixed(1)}s. Cleaned up ${ev.sessionIdsCleaned.length} TestBrand session(s).`,
        );
        stopElapsed();
        if (ev.overall === "ready") toast.success("Tier Two: all 12 checks passed");
        else
          toast.error(
            `Tier Two: ${ev.results.filter((r) => r.status === "fail").length} check(s) failed`,
          );
        return { kind: "done" };
      }
      if (ev.type === "error") {
        setErrorMessage(ev.message);
        setState("error");
        stopElapsed();
        return { kind: "error" };
      }
    }
    return { kind: "done" };
  };

  // Drive Check 1 (Stage 1 — Brief Analysis) by invoking runStage1 as a
  // SEPARATE server-fn RPC. The previous in-runner direct invocation left
  // Check 1 stuck in "pending" — which cascaded every dependent check into
  // "Skipped: Stage 1 failed". Running it as its own Worker invocation
  // matches how Check 12's parallel Stage 1 runs succeed.
  const driveCheck1 = async (
    handoff: Extract<TierTwoEvent, { type: "check_1_handoff" }>,
  ): Promise<FullCheckResult> => {
    const def = handoff.results[0];
    setCurrentMessage(`▶ ${def.name}`);
    const runningResults = handoff.results.map((r) =>
      r.index === 1 ? { ...r, status: "running" as const } : r,
    );
    handoff.results = runningResults;
    setResults(runningResults);
    await recordResultsFn({
      data: { recordId: handoff.recordId, allResults: runningResults },
    });
    const started = Date.now();
    const sessionId = handoff.sessionId;
    try {
      if (!sessionId) throw new Error("No TestBrand sessionId provided");
      setCurrentMessage("  · Running Stage 1 (Brief Analysis) — separate Worker invocation...");
      const final = await drainStream(
        stage1Fn({ data: { sessionId } }) as unknown as AsyncGenerator<
          { delta?: string; done?: true; output?: string; tensionScore?: number | null },
          void,
          unknown
        >,
      );
      const output = (final as { output?: string }).output ?? "";
      if (output.length < 200) throw new Error(`Stage 1 output too short (${output.length} chars)`);
      const tension = (final as { tensionScore?: number | null }).tensionScore;
      return {
        ...def,
        status: "pass",
        durationMs: Date.now() - started,
        detail: `Stage 1 completed in ${output.length} chars. Tension score: ${tension ?? "n/a"}.`,
        remediation: null,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        ...def,
        status: "fail",
        durationMs: Date.now() - started,
        detail: `Check 1 failed: ${msg}.`,
        remediation:
          "Open Stage 1 prompt and Claude invocation logs. Verify stage1.functions.ts streamClaude call succeeds against TestBrand brief.",
      };
    }
  };

  const driveCheck2 = async (
    handoff: Extract<TierTwoEvent, { type: "check_2_handoff" }>,
  ): Promise<FullCheckResult> => {
    const def = handoff.results[1];
    setCurrentMessage(`▶ ${def.name}`);
    const runningResults = handoff.results.map((r) =>
      r.index === 2 ? { ...r, status: "running" as const } : r,
    );
    handoff.results = runningResults;
    setResults(runningResults);
    await recordResultsFn({
      data: { recordId: handoff.recordId, allResults: runningResults },
    });
    const started = Date.now();
    const sessionId = handoff.sessionId;
    const timings: string[] = [];
    const stages: Array<{ label: string; run: () => Promise<unknown> }> = [
      { label: "Stage 2", run: () => drainStream(stage2Fn({ data: { sessionId } })) },
      { label: "Stage 3", run: () => drainStream(stage3Fn({ data: { sessionId } })) },
      { label: "Stage 4", run: () => drainStream(stage4Fn({ data: { sessionId } })) },
      { label: "Stage 4B", run: () => drainStream(stage4bFn({ data: { sessionId } })) },
      { label: "Stage 5", run: () => drainStream(stage5Fn({ data: { sessionId } })) },
      { label: "Stage 6", run: () => drainStream(stage6Fn({ data: { sessionId } })) },
      { label: "Stage 7", run: () => drainStream(stage7Fn({ data: { sessionId } })) },
    ];
    try {
      if (!sessionId || handoff.results[0].status !== "pass") throw new Error("Skipped: Stage 1 failed");
      for (const { label, run } of stages) {
        setCurrentMessage(`  · Running ${label} (separate Worker invocation)...`);
        const t0 = Date.now();
        await runWithWatchdog({ sessionId, label }, run);
        timings.push(`${label}: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      }
      return { ...def, status: "pass", durationMs: Date.now() - started, detail: `Phase 1A chain completed — each stage ran as its own server-fn RPC. ${timings.join(", ")}.`, remediation: null };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ...def, status: "fail", durationMs: Date.now() - started, detail: `Check 2 failed: ${msg}. Completed: ${timings.join(", ") || "none"}.`, remediation: "Inspect logs for the first failed stage in the 2–7 chain; check Checkpoint A confirmation and prior-stage output columns are populated." };
    }
  };

  const driveCheck6 = async (
    handoff: Extract<TierTwoEvent, { type: "check_6_handoff" }>,
  ): Promise<FullCheckResult> => {
    const def = handoff.results[5];
    setCurrentMessage(`▶ ${def.name}`);
    const runningResults = handoff.results.map((r) =>
      r.index === 6 ? { ...r, status: "running" as const } : r,
    );
    handoff.results = runningResults;
    setResults(runningResults);
    await recordResultsFn({
      data: { recordId: handoff.recordId, allResults: runningResults },
    });
    const started = Date.now();
    const sessionId = handoff.sessionId;
    const timings: string[] = [];
    try {
      if (!sessionId || handoff.results[4].status !== "pass") throw new Error("Skipped: Stage 9 did not complete");
      for (const { label, run } of [
        { label: "Stage 10", run: () => drainStream(stage10Fn({ data: { sessionId } })) },
        { label: "Stage 11", run: () => drainStream(stage11Fn({ data: { sessionId } })) },
      ]) {
        setCurrentMessage(`  · Running ${label} (separate Worker invocation)...`);
        const t0 = Date.now();
        await runWithWatchdog({ sessionId, label }, run);
        timings.push(`${label}: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      }
      return { ...def, status: "pass", durationMs: Date.now() - started, detail: `Stages 10 & 11 completed — each ran as its own server-fn RPC. ${timings.join(", ")}.`, remediation: null };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ...def, status: "fail", durationMs: Date.now() - started, detail: `Check 6 failed: ${msg}. Completed: ${timings.join(", ") || "none"}.`, remediation: "Inspect stage10.functions.ts / stage11.functions.ts; verify Stage 8 propositions were available as input." };
    }
  };

  const driveCheck7 = async (
    handoff: Extract<TierTwoEvent, { type: "check_7_handoff" }>,
  ): Promise<FullCheckResult> => {
    const def = handoff.results[6];
    setCurrentMessage(`▶ ${def.name}`);
    const runningResults = handoff.results.map((r) =>
      r.index === 7 ? { ...r, status: "running" as const } : r,
    );
    handoff.results = runningResults;
    setResults(runningResults);
    await recordResultsFn({
      data: { recordId: handoff.recordId, allResults: runningResults },
    });
    const started = Date.now();
    const sessionId = handoff.sessionId;
    const timings: string[] = [];
    try {
      if (!sessionId || handoff.results[5].status !== "pass") {
        throw new Error("Skipped: Stage 10/11 chain did not complete");
      }

      setCurrentMessage("  · Verifying Stage 11 output before Stage 12...");
      let t0 = Date.now();
      const { data: pre } = await supabase
        .from("sessions")
        .select("stage_11_output")
        .eq("id", sessionId)
        .single();
      const stage11Output = String(pre?.stage_11_output ?? "");
      if (stage11Output.length < 200) throw new Error("Stage 11 output missing or too short before Stage 12");
      const validated = filterValidatedFromStage11(stage11Output).validated;
      if (validated.length === 0) throw new Error("Stage 11 produced no VALIDATED SMPs to feed Stage 12");
      timings.push(`Stage 11 validation: ${((Date.now() - t0) / 1000).toFixed(1)}s`);

      setCurrentMessage(
        `  · Running Stage 12 (SMP synthesis, expecting >= ${validated.length} card(s); DB-poll fallback armed)...`,
      );
      t0 = Date.now();
      const s12 = (await runWithWatchdog(
        { sessionId, label: "Stage 12", maxIdleMs: 4 * 60_000, pollMs: 15_000 },
        () =>
          drainStreamOrPollDb(
            stage12Fn({ data: { sessionId } }) as unknown as AsyncGenerator<
              { delta?: string; done?: true; output?: string },
              void,
              unknown
            >,
            { sessionId, column: "stage_12_output", minChars: 1000, maxMs: 3 * 60_000, intervalMs: 5_000 },
          ),
      )) as { output: string; source: "stream" | "db-poll" };
      timings.push(`Stage 12 (via ${s12.source}): ${((Date.now() - t0) / 1000).toFixed(1)}s`);

      const stage12 = s12.output;
      if (!stage12) throw new Error("Stage 12 output missing after run");
      const cardCount = countStage12PropositionCards(stage12);
      if (cardCount < validated.length) {
        throw new Error(
          `Stage 12 card-integrity failure: only ${cardCount} card(s) rendered for ${validated.length} validated SMP(s)`,
        );
      }

      const selected = validated[0];
      setCurrentMessage("  · Persisting preflight auto-selection and Checkpoint C rationale...");
      t0 = Date.now();
      await saveSelectedSMPFn({
        data: {
          sessionId,
          smpLine: selected.smpLine.slice(0, 1000),
          fieldName: selected.fieldName.slice(0, 500) || "Preflight Auto-Selection",
        },
      });
      await saveSelectionRationaleFn({
        data: {
          sessionId,
          rationale: { auto: "Preflight TestBrand auto-selected top-ranked SMP for integrity validation." },
        },
      });
      const { data: verify } = await supabase
        .from("sessions")
        .select("selected_smp, checkpoint_c_confirmed")
        .eq("id", sessionId)
        .single();
      if (!verify?.selected_smp) throw new Error("selected_smp did not persist");
      if (!verify?.checkpoint_c_confirmed) throw new Error("Checkpoint C did not flip to true");
      timings.push(`Selection + rationale: ${((Date.now() - t0) / 1000).toFixed(1)}s`);

      return {
        ...def,
        status: "pass",
        durationMs: Date.now() - started,
        detail: `Stage 12 SMP synthesis (${cardCount}/${validated.length} cards) + selection + rationale persisted; Checkpoint C confirmed. ${timings.join(", ")}.`,
        remediation: null,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        ...def,
        status: "fail",
        durationMs: Date.now() - started,
        detail: `Check 7 failed: ${msg}. Completed: ${timings.join(", ") || "none"}.`,
        remediation:
          "Inspect stage12.functions.ts saveSelectedSMP / saveSelectionRationale and the Stage 11 → Stage 12 column wiring in pipeline-integrity.ts.",
      };
    }
  };

  // Drive Check 3 (Stage 8 + Checkpoint B) by invoking each as a SEPARATE
  // server-fn RPC. Each is a fresh Cloudflare Worker invocation with its
  // own wall-clock budget — structural fix for the silent worker death
  // that occurred when both ran inside one chained server-fn invocation.
  const driveCheck3 = async (
    handoff: Extract<TierTwoEvent, { type: "check_3_handoff" }>,
  ): Promise<FullCheckResult> => {
    const idx = 2; // Check 3 → index 2
    const def = handoff.results[idx];
    setCurrentMessage(`▶ ${def.name}`);
    const runningResults = handoff.results.map((r) =>
      r.index === 3 ? { ...r, status: "running" as const } : r,
    );
    handoff.results = runningResults;
    setResults(runningResults);
    await recordResultsFn({
      data: { recordId: handoff.recordId, allResults: runningResults },
    });
    const started = Date.now();
    const sessionId = handoff.sessionId;
    const timings: string[] = [];
    try {
      if (!sessionId || handoff.results[1].status !== "pass") {
        throw new Error("Skipped: Phase 1A chain did not complete");
      }
      setCurrentMessage("  · Running Stage 8 (Strategic Propositions) — separate Worker invocation...");
      let t0 = Date.now();
      await drainStream(stage8Fn({ data: { sessionId } }) as unknown as AsyncGenerator<
        { delta?: string; done?: true },
        void,
        unknown
      >);
      timings.push(`Stage 8: ${((Date.now() - t0) / 1000).toFixed(1)}s`);

      setCurrentMessage("  · Confirming Checkpoint B — separate Worker invocation...");
      t0 = Date.now();
      await confirmCheckpointBFn({ data: { sessionId } });
      timings.push(`Checkpoint B: ${((Date.now() - t0) / 1000).toFixed(1)}s`);

      return {
        ...def,
        status: "pass",
        durationMs: Date.now() - started,
        detail: `Stage 8 produced propositions and Checkpoint B persisted as confirmed — each ran as its own server-fn RPC. ${timings.join(", ")}.`,
        remediation: null,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        ...def,
        status: "fail",
        durationMs: Date.now() - started,
        detail: `Check 3 failed: ${msg}. Completed: ${timings.join(", ") || "none"}.`,
        remediation:
          "Open src/lib/stage8.functions.ts. Verify the Strategic Propositions prompt is intact and confirmCheckpointB writes checkpoint_b_confirmed = true.",
      };
    }
  };

  // Drive Check 8: run Stages 13, 13B, 14, 14B, 14C, 15 as separate server-fn
  // RPCs (each a fresh Cloudflare Worker invocation with its own wall-clock
  // budget). Stage 16 (Document Assembly) is INTENTIONALLY not run here — its
  // own gate correctly refuses to assemble a document until Phase 2 has
  // completed (Checkpoints D and E confirmed). We verify that gate FIRES as
  // designed by attempting Stage 16 and expecting the specific lock error.
  // Actual document-assembly verification runs inside Check 10 after Phase 2.
  const driveCheck8 = async (
    handoff: Extract<TierTwoEvent, { type: "check_8_handoff" }>,
  ): Promise<FullCheckResult> => {
    const idx = 7; // Check 8 → index 7
    const def = handoff.results[idx];
    setCurrentMessage(`▶ ${def.name}`);
    const runningResults = handoff.results.map((r) =>
      r.index === 8 ? { ...r, status: "running" as const } : r,
    );
    handoff.results = runningResults;
    setResults(runningResults);
    await recordResultsFn({
      data: { recordId: handoff.recordId, allResults: runningResults },
    });
    const started = Date.now();
    const sessionId = handoff.sessionId;
    const timings: string[] = [];
    const stages: Array<{ label: string; run: () => Promise<unknown> }> = [
      {
        label: "Seed Brand Intelligence",
        run: () =>
          seedBrandIntelFn({
            data: {
              sessionId,
              brandIntelligence: { ...PREFLIGHT_TESTBRAND_BRAND_INTELLIGENCE },
            },
          }),
      },
      { label: "Stage 13", run: () => drainStream(stage13Fn({ data: { sessionId } })) },
      { label: "Stage 13B", run: () => drainStream(stage13bFn({ data: { sessionId } })) },
      { label: "Stage 14", run: () => drainStream(stage14Fn({ data: { sessionId } })) },
      { label: "Stage 14B", run: () => drainStream(stage14bFn({ data: { sessionId } })) },
      { label: "Stage 14C", run: () => drainStream(stage14cFn({ data: { sessionId } })) },
      { label: "Stage 15", run: () => drainStream(stage15Fn({ data: { sessionId } })) },
    ];
    try {
      for (const { label, run } of stages) {
        setCurrentMessage(`  · Running ${label} (separate Worker invocation)...`);
        const t0 = Date.now();
        await runWithWatchdog({ sessionId, label }, run);
        timings.push(`${label}: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      }
      // Now verify Stage 16's Phase-2-completion gate correctly refuses to
      // run before Phase 2 has produced Stage 22 output + Checkpoints D/E.
      setCurrentMessage("  · Verifying Stage 16 gate is locked pre-Phase 2 (expected)...");
      const t0 = Date.now();
      let gateFired = false;
      let gateMessage = "";
      try {
        await drainStream(
          stage16Fn({ data: { sessionId, format: "agency" } }) as unknown as AsyncGenerator<
            { delta?: string; done?: true },
            void,
            unknown
          >,
        );
      } catch (gateErr) {
        gateMessage = gateErr instanceof Error ? gateErr.message : String(gateErr);
        if (/Document Assembly is locked/i.test(gateMessage)) gateFired = true;
      }
      timings.push(`Stage 16 gate probe: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      if (!gateFired) {
        throw new Error(
          `Stage 16 gate did NOT fire pre-Phase 2 — this is a platform bug (documents must not assemble from a half-finished run). ` +
            `Received: ${gateMessage || "no error (Stage 16 unexpectedly succeeded)"}`,
        );
      }
      return {
        ...def,
        status: "pass",
        durationMs: Date.now() - started,
        detail:
          `Stages 13–15 completed cleanly and Stage 16 gate correctly refused to assemble pre-Phase 2 (expected). ` +
          `${timings.join(", ")}. Document assembly is verified end-to-end in Check 10 after Phase 2.`,
        remediation: null,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        ...def,
        status: "fail",
        durationMs: Date.now() - started,
        detail: `Check 8 failed: ${msg}. Completed: ${timings.join(", ") || "none"}.`,
        remediation:
          "Inspect the first failing stage's logs. If Stages 13–15 completed but the Stage 16 gate probe reports the gate did NOT fire, the fix is in src/lib/stage16.functions.ts (Phase 2 readiness gate) — not in the test.",
      };
    }
  };

  const driveCheck10 = async (
    handoff: Extract<TierTwoEvent, { type: "check_10_handoff" }>,
  ): Promise<FullCheckResult> => {
    const def = handoff.results[9];
    setCurrentMessage(`▶ ${def.name}`);
    const runningResults = handoff.results.map((r) =>
      r.index === 10 ? { ...r, status: "running" as const } : r,
    );
    handoff.results = runningResults;
    setResults(runningResults);
    await recordResultsFn({
      data: { recordId: handoff.recordId, allResults: runningResults },
    });
    const started = Date.now();
    const sessionId = handoff.sessionId;
    const timings: string[] = [];
    try {
      if (!sessionId || handoff.results[7].status !== "pass") {
        throw new Error("Skipped: Phase 1 completion (Check 8) did not pass");
      }

      // Stage 17 → select first territory (Checkpoint D)
      setCurrentMessage("  · Running Stage 17 (separate Worker invocation)...");
      let t0 = Date.now();
      const s17 = await stage17Fn({ data: { sessionId } });
      timings.push(`Stage 17: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      const territoryMarkdown = (s17 as { output?: string }).output ?? "";
      if (territoryMarkdown.length < 200) throw new Error("Stage 17 output too short");
      const territoryCards = splitCards(territoryMarkdown);
      const firstTerritory = territoryCards[0]?.markdown ?? territoryMarkdown.split(/\n(?=##\s)/)[0] ?? territoryMarkdown;
      setCurrentMessage("  · Selecting top-ranked territory (Checkpoint D)...");
      t0 = Date.now();
      await selectStage17Fn({ data: { sessionId, territoryMarkdown: firstTerritory } });
      timings.push(`Select territory (D): ${((Date.now() - t0) / 1000).toFixed(1)}s`);

      // Stage 17B → Stage 18
      for (const { label, run } of [
        { label: "Stage 17B", run: () => stage17bFn({ data: { sessionId } }) },
        { label: "Stage 18", run: () => stage18Fn({ data: { sessionId } }) },
      ]) {
        setCurrentMessage(`  · Running ${label} (separate Worker invocation)...`);
        t0 = Date.now();
        await runWithWatchdog({ sessionId, label }, run);
        timings.push(`${label}: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      }

      // Select first detonation (Checkpoint E). Read stage_18_output back from
      // DB and pick the first card. The full markdown is a safe fallback.
      setCurrentMessage("  · Selecting first detonation candidate (Checkpoint E)...");
      t0 = Date.now();
      const { data: s18row } = await supabase
        .from("sessions")
        .select("stage_18_output")
        .eq("id", sessionId)
        .single();
      const s18md = (s18row?.stage_18_output as string | null) ?? "";
      if (!s18md || s18md.length < 100) throw new Error("Stage 18 output missing before selection");
      const detCards = splitCards(s18md);
      const firstDet = detCards[0]?.markdown ?? s18md;
      const firstLine = (detCards[0]?.name ?? firstDet.split("\n").find((l) => l.trim())?.trim() ?? "TestBrand Detonation").slice(0, 200);
      await selectStage18Fn({
        data: { sessionId, detonationMarkdown: firstDet, detonationLine: firstLine },
      });
      timings.push(`Select detonation (E): ${((Date.now() - t0) / 1000).toFixed(1)}s`);

      // Stage 19 → Stage 20
      for (const { label, run } of [
        { label: "Stage 19", run: () => stage19Fn({ data: { sessionId } }) },
        { label: "Stage 20", run: () => stage20Fn({ data: { sessionId } }) },
      ]) {
        setCurrentMessage(`  · Running ${label} (separate Worker invocation)...`);
        t0 = Date.now();
        await runWithWatchdog({ sessionId, label }, run);
        timings.push(`${label}: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      }

      // Approve Stage 20 (Checkpoint F) so Stage 20B/21 can run.
      setCurrentMessage("  · Approving Stage 20 brief (Checkpoint F)...");
      t0 = Date.now();
      try {
        await approveStage20Fn({ data: { sessionId } });
        timings.push(`Approve Stage 20 (F): ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      } catch (approveErr) {
        const m = approveErr instanceof Error ? approveErr.message : String(approveErr);
        throw new Error(`Stage 20 approval failed (${m}). Stage 20 must produce a Brief Quality Score ≥ 40 to approve — inspect the Stage 20 output on session ${sessionId.slice(0, 8)}.`);
      }

      // Stage 20B → Stage 21 → Stage 22.
      // Stage 20B requires a full six-field audienceInput object (Zod-validated).
      // In Tier Two we synthesize a plausible TestBrand audience so the schema
      // is satisfied without a human at the input screen. This is a fixture,
      // not real audience intelligence — it exists purely to exercise the
      // Stage 20B → 21 → 22 wiring end-to-end.
      const testbrandAudienceInput = {
        audienceAsHumans:
          "Disciplined Australian men 25–40 who train early, work hard, and read labels. They see themselves as builders of their own standards, not as consumers of hype. They resent being sold to and respect brands that talk to them like adults.",
        dayInTheirLife:
          "5:30 alarm, gym or run before work, protein and coffee, focused work block, second training session or family time in the evening, in bed by 10. Energy drinks slot in pre-training and mid-afternoon; the pre-workout can is the ritual.",
        influenceMap:
          "Training partners, a small circle of coaches or PT friends, one or two performance podcasts, Instagram accounts of athletes they actually rate. Advertising is treated as noise; peer recommendation and ingredient literacy are the real signal.",
        decisionJourney:
          "Notice a can in a mate's gym bag or a servo fridge → check the ingredient panel on the spot → try one can → judge on how it feels in the session → repeat purchase becomes habit at the same servo/supermarket run. Price matters less than trust in the formulation.",
        psychologicalProfile:
          "Values control, competence, and honesty. Suspicious of marketing theatre. Motivated by self-respect more than status. Buys things that quietly signal discipline to himself, not loudly to others.",
        channelUniverseAndBudget:
          "Lean challenger budget. Owned: product, pack, and one sharp social channel. Earned: gym-community seeding and long-form podcast placements. Paid: tightly targeted OOH near gyms and servos in launch cities, plus performance social. No mass TV. Retail activation at point of purchase is non-negotiable.",
      };
      for (const { label, run } of [
        { label: "Stage 20B", run: () => stage20bFn({ data: { sessionId, audienceInput: testbrandAudienceInput } }) },
        { label: "Stage 21", run: () => stage21Fn({ data: { sessionId } }) },
        { label: "Stage 22", run: () => stage22Fn({ data: { sessionId } }) },
      ]) {
        setCurrentMessage(`  · Running ${label} (separate Worker invocation)...`);
        t0 = Date.now();
        await runWithWatchdog({ sessionId, label }, run);
        timings.push(`${label}: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      }


      // Phase 2 is complete — now assemble the Stage 16 document (agency).
      // This exercises the legitimate Stage 16 path its own gate requires.
      // Uses drainStreamOrPollDb: Stage 16 is a long-generation streamed
      // stage and Cloudflare's edge has been observed closing the SSE
      // connection before the terminal `done` chunk reaches the browser,
      // hanging the harness even though the server wrote the output. The
      // DB column is the source of truth.
      setCurrentMessage("  · Running Stage 16 Document Assembly (agency) — Phase 2 now complete (DB-poll fallback armed)...");
      t0 = Date.now();
      const s16 = await drainStreamOrPollDb(
        stage16Fn({ data: { sessionId, format: "agency" } }) as unknown as AsyncGenerator<
          { delta?: string; done?: true; output?: string },
          void,
          unknown
        >,
        { sessionId, column: "stage_16_agency_output", minChars: 1000, maxMs: 3 * 60_000, intervalMs: 5_000 },
      );
      timings.push(`Stage 16 (agency, via ${s16.source}): ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      const s16out = s16.output;
      if (s16out.length < 1000) {
        throw new Error(`Stage 16 assembly output too short (${s16out.length} chars) — expected a full document.`);
      }

      return {
        ...def,
        status: "pass",
        durationMs: Date.now() - started,
        detail:
          `Phase 2 chain executed end-to-end (17 → 22) and Stage 16 Document Assembly then produced ${s16out.length} chars in the legitimate post-Phase-2 order. ${timings.join(", ")}.`,
        remediation: null,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        ...def,
        status: "fail",
        durationMs: Date.now() - started,
        detail: `Check 10 failed: ${msg}. Completed: ${timings.join(", ") || "none"}.`,
        remediation:
          "Inspect the first failing step above. Phase 2 order: Stage 17 → selectStage17Territory (D) → 17B → 18 → selectStage18Detonation (E) → 19 → 20 → approveStage20 (F, score ≥ 40) → 20B → 21 → 22 → Stage 16 Document Assembly.",
      };
    }
  };

  const driveCheck12 = async (
    handoff: Extract<TierTwoEvent, { type: "check_12_handoff" }>,
  ): Promise<FullCheckResult> => {
    const def = handoff.results[11];
    setCurrentMessage(`▶ ${def.name}`);
    const runningResults = handoff.results.map((r) =>
      r.index === 12 ? { ...r, status: "running" as const } : r,
    );
    handoff.results = runningResults;
    setResults(runningResults);
    await recordResultsFn({
      data: { recordId: handoff.recordId, allResults: runningResults },
    });
    const started = Date.now();
    const [idA, idB] = handoff.concurrentSessionIds;
    const timings: string[] = [];
    try {
      setCurrentMessage("  · Running parallel Stage 1 session A/B (each its own Worker invocation)...");
      const t0 = Date.now();
      const [resA, resB] = await Promise.all([
        drainStream(stage1Fn({ data: { sessionId: idA } })),
        drainStream(stage1Fn({ data: { sessionId: idB } })),
      ]);
      timings.push(`Parallel Stage 1: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      const outA = String((resA as { output?: string }).output ?? "");
      const outB = String((resB as { output?: string }).output ?? "");
      if (outA.length < 200 || outB.length < 200) throw new Error("One or both parallel Stage 1 outputs too short");
      if (outA === outB) throw new Error("Parallel sessions produced identical stage_1_output — cross-contamination suspected");
      return { ...def, status: "pass", durationMs: Date.now() - started, detail: `Two parallel Stage 1 runs completed independently with distinct outputs (${outA.length} / ${outB.length} chars). ${timings.join(", ")}.`, remediation: null };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ...def, status: "fail", durationMs: Date.now() - started, detail: `Check 12 failed: ${msg}. Completed: ${timings.join(", ") || "none"}.`, remediation: "Inspect runStage1 for any cross-session state. All session reads/writes must scope by sessionId." };
    }
  };

  const runCheck = async (forceOverride: boolean) => {
    setState("running");
    setLockMessage(null);
    setErrorMessage(null);
    setOverall(null);
    setExpanded(true);
    setCurrentMessage("Acquiring lock…");
    startElapsed();

    try {
      const gen = (await runTierTwoFn({
        data: forceOverride
          ? { forceOverride: true, overrideReason: "User override from dashboard" }
          : {},
      })) as AsyncGenerator<TierTwoEvent, void, unknown>;

      const initialOutcome = await processStream(gen);
      if (initialOutcome.kind !== "handoff1") return;

      // ---- Client-driven Check 1 (Stage 1 as its own server-fn RPC) ----
      const check1Result = await driveCheck1(initialOutcome.payload);
      let workingResults = initialOutcome.payload.results.map((r) =>
        r.index === 1 ? check1Result : r,
      );
      setResults(workingResults);
      setCurrentMessage(`✓ ${check1Result.name} — ${check1Result.status.toUpperCase()}`);
      await recordResultsFn({
        data: { recordId: initialOutcome.payload.recordId, allResults: workingResults },
      });

      // If Stage 1 failed, mark every downstream check as failed and finalise.
      if (check1Result.status !== "pass") {
        workingResults = workingResults.map((r) =>
          r.index === 1
            ? r
            : {
                ...r,
                status: "fail" as const,
                durationMs: 0,
                detail: r.detail ?? "Skipped: Stage 1 failed",
                remediation: r.remediation ?? "Fix Check 1 before re-running the suite.",
              },
        );
        setResults(workingResults);
        const final = await finalizeRunFn({
          data: {
            recordId: initialOutcome.payload.recordId,
            allResults: workingResults,
            sessionIds: initialOutcome.payload.sessionIds,
            startedAtMs: initialOutcome.payload.startedAtMs,
          },
        });
        setOverall(final.overall);
        setState("complete");
        setCurrentMessage(
          `Completed in ${(final.totalDurationMs / 1000).toFixed(1)}s. Cleaned up ${final.sessionIdsCleaned.length} TestBrand session(s).`,
        );
        stopElapsed();
        toast.error(
          `Tier Two: ${workingResults.filter((r) => r.status === "fail").length} check(s) failed`,
        );
        return;
      }

      // Auto-confirm Checkpoint A on the preflight session so the Phase 1A
      // chain can proceed. Same effect the previous in-runner step had.
      setCurrentMessage("  · Auto-confirming Checkpoint A on TestBrand session…");
      await confirmCheckpointAFn({
        data: { sessionId: initialOutcome.payload.sessionId },
      });

      // Construct the check_2_handoff payload locally — server no longer
      // emits it; the client owns the Check 1 → Check 2 handoff now.
      const outcome1 = {
        kind: "handoff2" as const,
        payload: {
          type: "check_2_handoff" as const,
          recordId: initialOutcome.payload.recordId,
          sessionId: initialOutcome.payload.sessionId,
          sessionIds: initialOutcome.payload.sessionIds,
          results: workingResults,
          startedAtMs: initialOutcome.payload.startedAtMs,
        },
      };

      // ---- Client-driven Check 2 (Stages 2–7 as separate RPCs) ----
      const check2Result = await driveCheck2(outcome1.payload);
      workingResults = outcome1.payload.results.map((r) =>
        r.index === 2 ? check2Result : r,
      );
      setResults(workingResults);
      setCurrentMessage(`✓ ${check2Result.name} — ${check2Result.status.toUpperCase()}`);
      await recordResultsFn({
        data: { recordId: outcome1.payload.recordId, allResults: workingResults },
      });

      const check3Handoff: Extract<TierTwoEvent, { type: "check_3_handoff" }> = {
        type: "check_3_handoff",
        recordId: outcome1.payload.recordId,
        sessionId: outcome1.payload.sessionId,
        sessionIds: outcome1.payload.sessionIds,
        results: workingResults,
        startedAtMs: outcome1.payload.startedAtMs,
      };

      // ---- Client-driven Check 3 (Stage 8 + Checkpoint B as separate RPCs) ----
      const check3Result = await driveCheck3(check3Handoff);
      workingResults = check3Handoff.results.map((r) =>
        r.index === 3 ? check3Result : r,
      );
      setResults(workingResults);
      setCurrentMessage(`✓ ${check3Result.name} — ${check3Result.status.toUpperCase()}`);
      await recordCheck3Fn({
        data: { recordId: outcome1.payload.recordId, allResults: workingResults },
      });

      // ---- Resume server-side: checks 4–5 → check_6_handoff ----
      const from4Gen = (await runFrom4Fn({
        data: {
          recordId: check3Handoff.recordId,
          sessionId: check3Handoff.sessionId,
          sessionIds: check3Handoff.sessionIds,
          priorResults: workingResults,
          startedAtMs: check3Handoff.startedAtMs,
        },
      })) as AsyncGenerator<TierTwoEvent, void, unknown>;
      const outcome2 = await processStream(from4Gen);
      if (outcome2.kind !== "handoff6") return;

      // ---- Client-driven Check 6 (Stages 10–11 as separate RPCs) ----
      const check6Result = await driveCheck6(outcome2.payload);
      workingResults = outcome2.payload.results.map((r) =>
        r.index === 6 ? check6Result : r,
      );
      setResults(workingResults);
      setCurrentMessage(`✓ ${check6Result.name} — ${check6Result.status.toUpperCase()}`);
      await recordResultsFn({
        data: { recordId: outcome2.payload.recordId, allResults: workingResults },
      });

      // ---- Resume server-side: check 7 handoff ----
      const from7Gen = (await runFrom7Fn({
        data: {
          recordId: outcome2.payload.recordId,
          sessionId: outcome2.payload.sessionId,
          sessionIds: outcome2.payload.sessionIds,
          priorResults: workingResults,
          startedAtMs: outcome2.payload.startedAtMs,
        },
      })) as AsyncGenerator<TierTwoEvent, void, unknown>;
      const outcome3 = await processStream(from7Gen);
      if (outcome3.kind !== "handoff7") return;

      // ---- Client-driven Check 7 (Stage 12 + selection/rationale) ----
      const check7Result = await driveCheck7(outcome3.payload);
      workingResults = outcome3.payload.results.map((r) =>
        r.index === 7 ? check7Result : r,
      );
      setResults(workingResults);
      setCurrentMessage(`✓ ${check7Result.name} — ${check7Result.status.toUpperCase()}`);
      await recordResultsFn({
        data: { recordId: outcome3.payload.recordId, allResults: workingResults },
      });

      const check8Handoff: Extract<TierTwoEvent, { type: "check_8_handoff" }> = {
        type: "check_8_handoff",
        recordId: outcome3.payload.recordId,
        sessionId: outcome3.payload.sessionId,
        sessionIds: outcome3.payload.sessionIds,
        results: workingResults,
        startedAtMs: outcome3.payload.startedAtMs,
      };

      // ---- Client-driven Check 8 (skip if check 7 didn't pass) ----
      let check8Result: FullCheckResult;
      if (check7Result.status !== "pass") {
        check8Result = {
          ...check8Handoff.results[7],
          status: "fail",
          durationMs: 0,
          detail: "Skipped: Stage 12 selection did not complete",
          remediation: "Fix the upstream Check 7 failure before re-running.",
        };
      } else {
        check8Result = await driveCheck8(check8Handoff);
      }
      workingResults = check8Handoff.results.map((r) =>
        r.index === 8 ? check8Result : r,
      );
      setResults(workingResults);
      setCurrentMessage(`✓ ${check8Result.name} — ${check8Result.status.toUpperCase()}`);
      await recordCheck8Fn({
        data: { recordId: check8Handoff.recordId, allResults: workingResults },
      });

      // ---- Resume: Check 9 → Check 10 handoff ----
      const resumeGen = (await runResumeFn({
        data: {
          recordId: check8Handoff.recordId,
          sessionId: check8Handoff.sessionId,
          sessionIds: check8Handoff.sessionIds,
          priorResults: workingResults,
          startedAtMs: check8Handoff.startedAtMs,
        },
      })) as AsyncGenerator<TierTwoEvent, void, unknown>;
      const outcome4 = await processStream(resumeGen);
      if (outcome4.kind !== "handoff10") return;

      // ---- Client-driven Check 10 (Phase 2 chain as separate RPCs) ----
      const check10Result = await driveCheck10(outcome4.payload);
      workingResults = outcome4.payload.results.map((r) =>
        r.index === 10 ? check10Result : r,
      );
      setResults(workingResults);
      setCurrentMessage(`✓ ${check10Result.name} — ${check10Result.status.toUpperCase()}`);
      await recordResultsFn({
        data: { recordId: outcome4.payload.recordId, allResults: workingResults },
      });

      // ---- Resume: Check 11 → Check 12 handoff ----
      const from11Gen = (await runFrom11Fn({
        data: {
          recordId: outcome4.payload.recordId,
          sessionIds: outcome4.payload.sessionIds,
          priorResults: workingResults,
          startedAtMs: outcome4.payload.startedAtMs,
        },
      })) as AsyncGenerator<TierTwoEvent, void, unknown>;
      const outcome5 = await processStream(from11Gen);
      if (outcome5.kind !== "handoff12") return;

      // ---- Client-driven Check 12 + finalisation ----
      const check12Result = await driveCheck12(outcome5.payload);
      workingResults = outcome5.payload.results.map((r) =>
        r.index === 12 ? check12Result : r,
      );
      setResults(workingResults);
      setCurrentMessage(`✓ ${check12Result.name} — ${check12Result.status.toUpperCase()}`);
      await recordResultsFn({
        data: { recordId: outcome5.payload.recordId, allResults: workingResults },
      });

      // ---- Client-driven Check 13 (Left-of-Centre track, own RPC) ----
      const def13 = workingResults.find((r) => r.index === 13);
      if (def13) {
        setCurrentMessage(`▶ ${def13.name} — firing 13 LOC engines…`);
        workingResults = workingResults.map((r) =>
          r.index === 13 ? { ...r, status: "running" as const } : r,
        );
        setResults(workingResults);
        await recordResultsFn({
          data: { recordId: outcome5.payload.recordId, allResults: workingResults },
        });
        const c13 = await runCheck13Fn({ data: { recordId: outcome5.payload.recordId } });
        const check13Result: FullCheckResult = { ...def13, ...c13 };
        workingResults = workingResults.map((r) => (r.index === 13 ? check13Result : r));
        setResults(workingResults);
        setCurrentMessage(`✓ ${check13Result.name} — ${check13Result.status.toUpperCase()}`);
        await recordResultsFn({
          data: { recordId: outcome5.payload.recordId, allResults: workingResults },
        });
      }

      const final = await finalizeRunFn({
        data: {
          recordId: outcome5.payload.recordId,
          allResults: workingResults,
          sessionIds: outcome5.payload.sessionIds,
          startedAtMs: outcome5.payload.startedAtMs,
        },
      });
      setOverall(final.overall);
      setState("complete");
      setCurrentMessage(`Completed in ${(final.totalDurationMs / 1000).toFixed(1)}s. Cleaned up ${final.sessionIdsCleaned.length} TestBrand session(s).`);
      stopElapsed();
      if (final.overall === "ready") toast.success("Tier Two: all 13 checks passed");
      else {
        const { summary: s } = summariseSeverities(workingResults, priorRuns);
        if (s.blocker > 0) toast.error(`Tier Two: ${s.blocker} BLOCKER(s) — do not present live`);
        else if (s.degraded > 0) toast.warning(`Tier Two: ${s.degraded} degraded — usable`);
        else toast.info(`Tier Two: ${s.harness} harness / ${s.transient} transient — platform OK`);
      }
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e));
      setState("error");
      stopElapsed();
    }
  };

  // -------------------------------------------------------------------------
  // Severity classification. Failures are NOT counted uniformly — blockers
  // trigger "do not present live"; degraded/harness/transient never do. See
  // src/lib/preflight-severity.ts for the hardcoded per-check rules.
  // -------------------------------------------------------------------------
  const { summary: severitySummary, classified: classifiedResults } = useMemo(
    () => summariseSeverities(results, priorRuns),
    [results, priorRuns],
  );
  const blockerResults = useMemo(
    () =>
      classifiedResults
        .filter(({ classified }) => classified.kind === "fail" && classified.severity === "blocker")
        .map(({ result }) => result),
    [classifiedResults],
  );
  const passedCount = severitySummary.passed;
  // "Failed check names" for the postponement draft = blockers only. Degraded
  // / harness / transient are usable-live and should not be named in a
  // postponement note.
  const failedNames = useMemo(
    () => blockerResults.map((r) => CHECK_NAMES[r.id as FullCheckId] ?? r.name),
    [blockerResults],
  );
  const totalEtaMinutes = useMemo(
    () =>
      blockerResults.reduce(
        (sum, r) => sum + (REMEDIATION_BY_ID[r.id as FullCheckId]?.etaMinutes ?? 10),
        0,
      ),
    [blockerResults],
  );

  // Only blockers gate presentation. This is the whole point of severity:
  // a harness drift or a transient blip does NOT justify pulling the demo.
  const escalationVisible =
    state === "complete" && shouldBlockPresentation(severitySummary);
  const nonBlockingIssuesVisible =
    state === "complete" &&
    !escalationVisible &&
    (severitySummary.degraded + severitySummary.harness + severitySummary.transient) > 0;

  const goToCompletedSessions = () => {
    const el = document.getElementById("completed-sessions");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const copyDraft = async () => {
    const text = buildPostponementDraft(failedNames);
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Draft copied to clipboard");
    } catch {
      toast.error("Copy failed — select and copy manually");
    }
  };

  return (
    <section className="mb-6 border border-neutral-800 bg-neutral-950/60 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-label text-primary">Pre-Flight — Tier Two</div>
          <h2 className="text-h3 mt-1 text-text-primary">Full Integrity Check</h2>
          <p className="text-body mt-1 text-text-secondary">
            12 deep checks. Single TestBrand session runs Stages 1–16 sequentially. Phase 2 chain (17→17B→18). Two parallel Stage 1 runs. Structural checks for prompts, token caps, sanitiser, and Canvas→Detonation route. Auto-cleans test sessions on completion. Target runtime ~20 minutes.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {state === "running" ? (
            <button
              disabled
              className="cursor-not-allowed bg-neutral-800 px-5 py-2.5 text-sm font-semibold text-neutral-400"
            >
              Running… {(elapsedMs / 1000).toFixed(0)}s
            </button>
          ) : (
            <button
              onClick={() => runCheck(false)}
              className="bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Run System Check
            </button>
          )}
          {state === "complete" && overall && (
            <div className="text-xs">
              {overall === "ready" ? (
                <span className="text-emerald-400">✓ Platform Ready — 12/12 passed</span>
              ) : escalationVisible ? (
                <span className="text-red-400">
                  ✗ {severitySummary.blocker} blocker{severitySummary.blocker === 1 ? "" : "s"} — do not present live
                </span>
              ) : (
                <span className="text-amber-300">
                  ⚠ Platform OK — {severitySummary.degraded}D / {severitySummary.harness}H / {severitySummary.transient}T ({passedCount} passed)
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {state === "lock_failed" && lockMessage && (
        <div className="mt-4 border border-amber-700/50 bg-amber-900/20 p-3 text-sm">
          <div className="font-semibold text-amber-300">A Tier Two check is already running</div>
          <div className="mt-1 text-amber-200/80">{lockMessage}</div>
          <button
            onClick={() => runCheck(true)}
            className="mt-3 bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600"
          >
            Override and start a new run
          </button>
        </div>
      )}

      {state === "error" && errorMessage && (
        <div className="mt-4 border border-red-700/50 bg-red-900/20 p-3 text-sm text-red-200">
          <div className="font-semibold text-red-300">Fatal error</div>
          <div className="mt-1">{errorMessage}</div>
        </div>
      )}

      {escalationVisible && (
        <div className="mt-4 border border-red-700/60 bg-red-950/30 p-4">
          <div className="text-label text-red-300">Escalation Protocol · Blockers only</div>
          <h3 className="text-h3 mt-1 text-text-primary">
            {severitySummary.blocker} blocker{severitySummary.blocker === 1 ? "" : "s"} — do not present live
          </h3>
          <p className="text-body mt-1 text-text-secondary">
            Only BLOCKER-severity failures trigger this banner. Non-blocking issues this run:{" "}
            <span className="font-semibold text-amber-300">{severitySummary.degraded} degraded</span>,{" "}
            <span className="font-semibold text-sky-300">{severitySummary.harness} harness</span>,{" "}
            <span className="font-semibold text-neutral-300">{severitySummary.transient} transient</span>,{" "}
            <span className="font-semibold text-neutral-400">{severitySummary.skipped} skipped (dependency failed)</span>.
          </p>
          <p className="text-body mt-1 text-text-secondary">
            Estimated platform fix time: <span className="font-semibold text-text-primary">~{totalEtaMinutes} minutes</span>. Choose one of the two protocols below before notifying the client.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setDraftOpen((v) => !v)}
              className="border border-red-700/60 bg-red-950/40 p-3 text-left hover:bg-red-900/40"
            >
              <div className="text-label text-red-300">Option 1</div>
              <div className="text-body mt-1 font-semibold text-text-primary">
                Generate draft postponement communication
              </div>
              <div className="text-xs text-text-tertiary mt-1">
                Drafts a short, on-brand re-scheduling note naming the failed checks.
              </div>
            </button>
            <button
              type="button"
              onClick={goToCompletedSessions}
              className="border border-red-700/60 bg-red-950/40 p-3 text-left hover:bg-red-900/40"
            >
              <div className="text-label text-red-300">Option 2</div>
              <div className="text-body mt-1 font-semibold text-text-primary">
                Present completed sessions instead
              </div>
              <div className="text-xs text-text-tertiary mt-1">
                Jumps to the completed sessions list, ready to present prior verified work.
              </div>
            </button>
          </div>

          {draftOpen && (
            <div className="mt-3 border border-red-700/50 bg-neutral-950/60 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-label text-red-300">Draft — postponement communication</span>
                <button
                  type="button"
                  onClick={copyDraft}
                  className="bg-red-700 px-2 py-1 text-xs font-semibold text-white hover:bg-red-600"
                >
                  Copy draft
                </button>
              </div>
              <pre className="mt-2 whitespace-pre-wrap font-mono text-xs text-text-secondary">
                {buildPostponementDraft(failedNames)}
              </pre>
            </div>
          )}
        </div>
      )}

      {nonBlockingIssuesVisible && (
        <div className="mt-4 border border-amber-700/40 bg-amber-950/20 p-3 text-sm">
          <div className="text-label text-amber-300">Non-blocking issues · Platform usable live</div>
          <div className="mt-1 text-amber-200/80">
            No BLOCKER-severity failures. Detected:{" "}
            <span className="font-semibold text-amber-300">{severitySummary.degraded} degraded</span>,{" "}
            <span className="font-semibold text-sky-300">{severitySummary.harness} harness</span> (check itself out of date),{" "}
            <span className="font-semibold text-neutral-300">{severitySummary.transient} transient</span> (external blip — re-run if it repeats),{" "}
            <span className="font-semibold text-neutral-400">{severitySummary.skipped} skipped</span>. See per-check detail below.
          </div>
        </div>
      )}

      {(state === "running" || state === "complete") && (
        <>
          {state === "running" && currentMessage && (
            <div className="mt-4 font-mono text-xs text-neutral-400">{currentMessage}</div>
          )}

          <button
            onClick={() => setExpanded((v) => !v)}
            className="mt-4 text-xs text-text-secondary underline hover:text-text-primary"
          >
            {expanded ? "Hide" : "Show"} per-check detail ({results.length} checks)
          </button>

          {expanded && results.length > 0 && (
            <ul className="mt-3 space-y-2">
              {classifiedResults.map(({ result: r, classified }) => {
                const rem = REMEDIATION_BY_ID[r.id as FullCheckId];
                const sevKey: Severity | "skipped" | null =
                  classified.kind === "fail" ? classified.severity :
                  classified.kind === "skipped" ? "skipped" : null;
                const sevColor = sevKey ? SEVERITY_COLOR[sevKey] : null;
                return (
                  <li
                    key={r.id}
                    className={`border p-3 text-sm ${sevColor ? `${sevColor.border} ${sevColor.bg}` : "border-neutral-800 bg-neutral-900/60"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {classified.kind === "skipped" ? (
                            <span className="rounded-sm bg-neutral-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                              Skipped
                            </span>
                          ) : (
                            statusBadge(r.status)
                          )}
                          {sevKey && (
                            <span className={`rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${sevColor!.text} ${sevColor!.bg} border ${sevColor!.border}`}>
                              {SEVERITY_LABEL[sevKey]}
                            </span>
                          )}
                          <span className="font-medium text-text-primary">
                            {CHECK_NAMES[r.id as FullCheckId] ?? r.name}
                          </span>
                          {r.durationMs !== null && classified.kind !== "skipped" && (
                            <span className="text-xs text-text-tertiary">
                              ({(r.durationMs / 1000).toFixed(1)}s)
                            </span>
                          )}
                        </div>
                        {classified.kind === "skipped" ? (
                          <div className="mt-1.5 text-xs text-neutral-400">
                            Skipped — dependency failed: {classified.dependencyDetail}
                          </div>
                        ) : (
                          <>
                            {r.detail && (
                              <div className="mt-1.5 text-xs text-text-secondary">{r.detail}</div>
                            )}
                            {classified.kind === "fail" && (
                              <div className={`mt-2 border-l-2 pl-2 text-xs ${sevColor!.border} ${sevColor!.text}`}>
                                <div>
                                  <span className="font-semibold">Why {SEVERITY_LABEL[classified.severity]}:</span> {classified.reason}
                                </div>
                                {classified.note && (
                                  <div className="mt-1 opacity-80">{classified.note}</div>
                                )}
                              </div>
                            )}
                            {classified.kind === "fail" && classified.severity === "blocker" && rem && (
                              <div className="mt-2 border-l-2 border-red-700 pl-2 text-xs text-red-300">
                                <div>
                                  <span className="font-semibold">Remediation:</span> {rem.instruction}
                                </div>
                                <div className="mt-1 text-red-200/80">
                                  <span className="font-semibold">Estimated fix time:</span> ~{rem.etaMinutes} minutes
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
