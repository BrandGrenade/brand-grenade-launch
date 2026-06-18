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
  recordPreflightCheck8Result,
  runTierTwoChecksFrom9,
  PREFLIGHT_TESTBRAND_BRAND_INTELLIGENCE,
  type FullCheckId,
  type FullCheckResult,
  type TierTwoEvent,
} from "@/lib/preflight-tier-two.functions";
import { saveBrandIntelligence, runStage13 } from "@/lib/stage13.functions";
import { runStage13b } from "@/lib/stage13b.functions";
import { runStage14 } from "@/lib/stage14.functions";
import { runStage14b } from "@/lib/stage14b.functions";
import { runStage14c } from "@/lib/stage14c.functions";
import { runStage15 } from "@/lib/stage15.functions";
import { runStage16 } from "@/lib/stage16.functions";

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

type RunState = "idle" | "running" | "complete" | "lock_failed" | "error";

const CHECK_NAMES: Record<FullCheckId, string> = {
  stage_1_brief_analysis: "1. Stage 1 — Brief Analysis on TestBrand",
  phase1a_chain_2_to_7: "2. Stages 2–7 — Phase 1A sequential chain",
  stage_8_checkpoint_b: "3. Stage 8 — Proposition + Checkpoint B confirmation",
  stage_prompts_integrity: "4. All 22 stage system prompts present & non-empty",
  stage_9_edt_guard_output: "5. Stage 9 — EDT guard output sanitisation",
  stage_10_11_evaluation_chain: "6. Stages 10–11 — Evaluation chain",
  stage_12_smp_selection: "7. Stage 12 — SMP selection + rationale persistence",
  phase1_completion_13_to_16: "8. Stages 13–16 — Phase 1 completion",
  sanitiser_and_token_caps: "9. Sanitiser configuration + token caps on all stages",
  phase2_detonation_chain: "10. Phase 2 — Stage 17 → Select → 17B → 18 chain",
  canvas_to_detonation_navigation: "11. Three Truth Canvas → Detonation route navigation",
  concurrent_session_integrity: "12. Concurrent session integrity (two parallel Stage 1 runs)",
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
      "Open Stages 13–16 function files. Verify saveBrandIntelligence completes and Stages 14, 14b, 14c, 15, 16 read the correct upstream columns. Inspect the detail above for the first failing stage.",
    etaMinutes: 20,
  },
  sanitiser_and_token_caps: {
    instruction:
      "Open src/lib/sanitise-output.ts and src/lib/claude.server.ts. Sanitiser banned-token list must be non-empty and every stage's streamClaude call must specify an explicit maxTokens. Restore caps per prompt_versions.md.",
    etaMinutes: 10,
  },
  phase2_detonation_chain: {
    instruction:
      "Open src/lib/stage17.functions.ts, stage17b.functions.ts, stage18.functions.ts. Verify Stage 17 produces territories, selectStage17Territory persists the selection, 17B reads it, and 18 runs only after 17B completes. Inspect detail above.",
    etaMinutes: 15,
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
  const runResumeFn = useServerFn(runTierTwoChecksFrom9);
  const recordCheck8Fn = useServerFn(recordPreflightCheck8Result);
  const seedBrandIntelFn = useServerFn(saveBrandIntelligence);
  const stage13Fn = useServerFn(runStage13);
  const stage13bFn = useServerFn(runStage13b);
  const stage14Fn = useServerFn(runStage14);
  const stage14bFn = useServerFn(runStage14b);
  const stage14cFn = useServerFn(runStage14c);
  const stage15Fn = useServerFn(runStage15);
  const stage16Fn = useServerFn(runStage16);

  const [state, setState] = useState<RunState>("idle");
  const [results, setResults] = useState<FullCheckResult[]>([]);
  const [currentMessage, setCurrentMessage] = useState<string>("");
  const [overall, setOverall] = useState<"ready" | "issue_detected" | null>(null);
  const [lockMessage, setLockMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [draftOpen, setDraftOpen] = useState(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number | null>(null);

  // Hydrate from latest persisted run on mount.
  useEffect(() => {
    (async () => {
      try {
        const latest = await getLatestFn();
        if (latest && Array.isArray(latest.tier_two_results)) {
          setResults(latest.tier_two_results as unknown as FullCheckResult[]);
          if (latest.status === "complete") {
            setState("complete");
            setOverall((latest.overall_result as "ready" | "issue_detected" | null) ?? null);
          }
        }
      } catch {
        /* silent */
      }
    })();
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

  // Process events from one streaming server-fn generator. Returns the
  // handoff payload if the stream ended with `check_8_handoff`, otherwise
  // null. Returns "lock_failed" / "error" sentinels for terminal states.
  type ProcessOutcome =
    | { kind: "handoff"; payload: Extract<TierTwoEvent, { type: "check_8_handoff" }> }
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
      if (ev.type === "check_8_handoff") {
        setResults(ev.results);
        return { kind: "handoff", payload: ev };
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

  // Drive Check 8 by invoking each of Stages 13, 13B, 14, 14B, 14C, 15, 16
  // as a SEPARATE server-fn RPC. Each RPC is a fresh Cloudflare Worker
  // invocation with its own wall-clock budget — this is the structural fix
  // for the Stage 14 hang that occurred when all seven ran inside one
  // chained server-fn invocation.
  const driveCheck8 = async (
    handoff: Extract<TierTwoEvent, { type: "check_8_handoff" }>,
  ): Promise<FullCheckResult> => {
    const idx = 7; // Check 8 → index 7
    const def = handoff.results[idx];
    setCurrentMessage(`▶ ${def.name}`);
    setResults((prev) => prev.map((r) => (r.index === 8 ? { ...r, status: "running" } : r)));
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
      {
        label: "Stage 16 (agency)",
        run: () =>
          drainStream(
            stage16Fn({ data: { sessionId, format: "agency" } }) as unknown as AsyncGenerator<
              { delta?: string; done?: true },
              void,
              unknown
            >,
          ),
      },
    ];
    try {
      for (const { label, run } of stages) {
        setCurrentMessage(`  · Running ${label} (separate Worker invocation)...`);
        const t0 = Date.now();
        await run();
        timings.push(`${label}: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      }
      return {
        ...def,
        status: "pass",
        durationMs: Date.now() - started,
        detail: `Phase 1 complete (Stages 13–16) — each stage ran as its own server-fn RPC. ${timings.join(", ")}.`,
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
          "Open Stages 13–16 function files. Verify saveBrandIntelligence completes and each stage reads the correct upstream columns. Inspect the named stage's logs.",
      };
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

      const outcome = await processStream(gen);
      if (outcome.kind !== "handoff") return;

      // ---- Client-driven Check 8 ----
      const check8Result = await driveCheck8(outcome.payload);
      const updatedResults = outcome.payload.results.map((r) =>
        r.index === 8 ? check8Result : r,
      );
      setResults(updatedResults);
      setCurrentMessage(`✓ ${check8Result.name} — ${check8Result.status.toUpperCase()}`);
      await recordCheck8Fn({
        data: { recordId: outcome.payload.recordId, allResults: updatedResults },
      });

      // ---- Resume: checks 9–12 + finalisation ----
      const resumeGen = (await runResumeFn({
        data: {
          recordId: outcome.payload.recordId,
          sessionId: outcome.payload.sessionId,
          sessionIds: outcome.payload.sessionIds,
          priorResults: updatedResults,
          startedAtMs: outcome.payload.startedAtMs,
        },
      })) as AsyncGenerator<TierTwoEvent, void, unknown>;
      await processStream(resumeGen);
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e));
      setState("error");
      stopElapsed();
    }
  };

  const failedResults = useMemo(() => results.filter((r) => r.status === "fail"), [results]);
  const failedCount = failedResults.length;
  const passedCount = useMemo(() => results.filter((r) => r.status === "pass").length, [results]);
  const failedNames = useMemo(
    () => failedResults.map((r) => CHECK_NAMES[r.id as FullCheckId] ?? r.name),
    [failedResults],
  );
  const totalEtaMinutes = useMemo(
    () =>
      failedResults.reduce(
        (sum, r) => sum + (REMEDIATION_BY_ID[r.id as FullCheckId]?.etaMinutes ?? 10),
        0,
      ),
    [failedResults],
  );

  const escalationVisible = state === "complete" && overall === "issue_detected" && failedCount > 0;

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
              ) : (
                <span className="text-red-400">
                  ✗ {failedCount} failed / {passedCount} passed
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
          <div className="text-label text-red-300">Escalation Protocol</div>
          <h3 className="text-h3 mt-1 text-text-primary">
            {failedCount} check{failedCount === 1 ? "" : "s"} failed — do not present live
          </h3>
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
              {results.map((r) => {
                const rem = REMEDIATION_BY_ID[r.id as FullCheckId];
                return (
                  <li
                    key={r.id}
                    className="border border-neutral-800 bg-neutral-900/60 p-3 text-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {statusBadge(r.status)}
                          <span className="font-medium text-text-primary">
                            {CHECK_NAMES[r.id as FullCheckId] ?? r.name}
                          </span>
                          {r.durationMs !== null && (
                            <span className="text-xs text-text-tertiary">
                              ({(r.durationMs / 1000).toFixed(1)}s)
                            </span>
                          )}
                        </div>
                        {r.detail && (
                          <div className="mt-1.5 text-xs text-text-secondary">{r.detail}</div>
                        )}
                        {r.status === "fail" && rem && (
                          <div className="mt-2 border-l-2 border-red-700 pl-2 text-xs text-red-300">
                            <div>
                              <span className="font-semibold">Remediation:</span> {rem.instruction}
                            </div>
                            <div className="mt-1 text-red-200/80">
                              <span className="font-semibold">Estimated fix time:</span> ~{rem.etaMinutes} minutes
                            </div>
                          </div>
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
