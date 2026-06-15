// Tier Two Full Integrity Check — dashboard panel
//
// "Run System Check" button. When clicked, streams progress from
// runTierTwoFullCheck (a server-side async generator) and renders a live
// per-check pass/fail board. On completion, shows overall result + per-check
// detail + remediation guidance for any failures. Includes a 25-minute stale
// lock override.

import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  runTierTwoFullCheck,
  getLatestTierTwoCheck,
  type FullCheckResult,
  type TierTwoEvent,
} from "@/lib/preflight-tier-two.functions";

type RunState = "idle" | "running" | "complete" | "lock_failed" | "error";

const CHECK_NAMES: Record<string, string> = {
  stage_1_brief_analysis: "1. Stage 1 — Brief Analysis on TestBrand",
  phase1a_chain_2_to_7: "2. Stages 2–7 — Phase 1A sequential chain",
  stage_8_checkpoint_b: "3. Stage 8 — Proposition + Checkpoint B confirmation",
  stage_prompts_integrity: "4. All 22 stage system prompts present & non-empty",
  stage_9_edt_guard_output: "5. Stage 9 — EDT guard output sanitisation",
  stage_10_11_evaluation_chain: "6. Stages 10–11 — Evaluation chain",
  stage_12_smp_selection: "7. Stage 12 — SMP selection + rationale persistence",
  phase1_completion_13_to_16: "8. Stages 13–16 — Phase 1 completion",
  sanitiser_and_token_caps: "9. Sanitiser + token caps on all stages",
  phase2_detonation_chain: "10. Phase 2 — Stage 17 → Select → 17B → 18 chain",
  canvas_to_detonation_navigation: "11. Three Truth Canvas → Detonation route navigation",
  concurrent_session_integrity: "12. Concurrent session integrity (two parallel Stage 1 runs)",
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

export function PreflightFullCheckPanel() {
  const runTierTwoFn = useServerFn(runTierTwoFullCheck);
  const getLatestFn = useServerFn(getLatestTierTwoCheck);

  const [state, setState] = useState<RunState>("idle");
  const [results, setResults] = useState<FullCheckResult[]>([]);
  const [currentMessage, setCurrentMessage] = useState<string>("");
  const [overall, setOverall] = useState<"ready" | "issue_detected" | null>(null);
  const [lockMessage, setLockMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number | null>(null);

  // Hydrate from latest persisted run on mount.
  useEffect(() => {
    (async () => {
      try {
        const latest = await getLatestFn({ data: {} as never } as never);
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

      for await (const ev of gen) {
        if (ev.type === "lock_failed") {
          setState("lock_failed");
          setLockMessage(ev.reason);
          stopElapsed();
          return;
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
          setResults((prev) =>
            prev.map((r) => (r.index === ev.result.index ? ev.result : r)),
          );
          continue;
        }
        if (ev.type === "done") {
          setOverall(ev.overall);
          setState("complete");
          setCurrentMessage(
            `Completed in ${(ev.totalDurationMs / 1000).toFixed(1)}s. Cleaned up ${ev.sessionIdsCleaned.length} TestBrand session(s).`,
          );
          stopElapsed();
          if (ev.overall === "ready") toast.success("Tier Two: all 12 checks passed");
          else toast.error(`Tier Two: ${ev.results.filter((r) => r.status === "fail").length} check(s) failed`);
          continue;
        }
        if (ev.type === "error") {
          setErrorMessage(ev.message);
          setState("error");
          stopElapsed();
          continue;
        }
      }
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e));
      setState("error");
      stopElapsed();
    }
  };

  const failedCount = useMemo(() => results.filter((r) => r.status === "fail").length, [results]);
  const passedCount = useMemo(() => results.filter((r) => r.status === "pass").length, [results]);

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
              {results.map((r) => (
                <li
                  key={r.id}
                  className="border border-neutral-800 bg-neutral-900/60 p-3 text-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {statusBadge(r.status)}
                        <span className="font-medium text-text-primary">
                          {CHECK_NAMES[r.id] ?? r.name}
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
                      {r.status === "fail" && r.remediation && (
                        <div className="mt-1.5 border-l-2 border-red-700 pl-2 text-xs text-red-300">
                          <span className="font-semibold">Remediation:</span> {r.remediation}
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
