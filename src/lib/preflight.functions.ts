// Tier One Fast Check — Brand Grenade Pre-Flight Integrity System
//
// Runs 5 lightweight checks automatically on every dashboard load.
// Completes in well under 3 minutes. No pipeline execution.
//
// Result is persisted to public.preflight_checks (check_type='fast') for audit.

import { createServerFn } from "@tanstack/react-start";
import { STAGE_9_SYSTEM_PROMPT } from "@/lib/stage9-prompt";
// Vite raw imports — bundled as strings at build time so the Worker can
// statically inspect the route source for the Stage 17 navigation handler.
import detonationCanvasSource from "@/routes/detonation_.canvas.tsx?raw";
import detonationSource from "@/routes/detonation.tsx?raw";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type FastCheckId =
  | "db_connectivity"
  | "claude_api_health"
  | "stage9_edt_guard_prompt"
  | "stage12_query_speed"
  | "stage17_route_registration";

export type FastCheckResult = {
  id: FastCheckId;
  name: string;
  status: "pass" | "fail";
  durationMs: number;
  detail: string;
};

export type TierOneResult = {
  overall: "ready" | "issue_detected";
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  firstFailureName: string | null;
  checks: FastCheckResult[];
  recordId: string | null;
};

const FAST_CHECK_NAMES: Record<FastCheckId, string> = {
  db_connectivity: "Database Connectivity",
  claude_api_health: "Claude API Health",
  stage9_edt_guard_prompt: "Stage 9 EDT Guard Removed (v5.3)",
  stage12_query_speed: "Stage 12 Database Query Speed",
  stage17_route_registration: "Stage 17 Route Registration",
};

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

async function runCheck<T>(
  id: FastCheckId,
  fn: () => Promise<{ status: "pass" | "fail"; detail: string }>,
): Promise<FastCheckResult> {
  const started = Date.now();
  try {
    const r = await fn();
    return {
      id,
      name: FAST_CHECK_NAMES[id],
      status: r.status,
      detail: r.detail,
      durationMs: Date.now() - started,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      id,
      name: FAST_CHECK_NAMES[id],
      status: "fail",
      detail: msg,
      durationMs: Date.now() - started,
    };
  }
}

export const runTierOneFastCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TierOneResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { callClaude } = await import("@/lib/claude.server");

    const startedAt = new Date();

    // Insert a 'running' row up front so the audit trail captures attempts
    // even if the handler aborts mid-flight.
    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from("preflight_checks")
      .insert({
        check_type: "fast",
        status: "running",
        started_by: context.userId,
      })
      .select("id")
      .single();
    if (insertErr) {
      // Audit insert failure is itself a fault — return a synthetic result.
      const now = new Date();
      return {
        overall: "issue_detected",
        startedAt: startedAt.toISOString(),
        finishedAt: now.toISOString(),
        durationMs: now.getTime() - startedAt.getTime(),
        firstFailureName: "Pre-flight audit log",
        checks: [
          {
            id: "db_connectivity",
            name: "Database Connectivity",
            status: "fail",
            durationMs: 0,
            detail: `Failed to write preflight audit row: ${insertErr.message}`,
          },
        ],
        recordId: null,
      };
    }
    const recordId = inserted.id as string;

    // -------- Fast Check 1: Database Connectivity (5s budget) --------
    const c1 = await runCheck("db_connectivity", async () => {
      const q = (async () =>
        supabaseAdmin
          .from("sessions")
          .select("id, updated_at")
          .order("updated_at", { ascending: false })
          .limit(5))();
      const { error } = await withTimeout(q, 5_000, "sessions query");
      if (error) return { status: "fail", detail: error.message };
      return { status: "pass", detail: "5 most recent sessions fetched" };
    });

    // -------- Fast Check 2: Claude API Health (10s budget) --------
    const c2 = await runCheck("claude_api_health", async () => {
      const reply = await withTimeout(
        callClaude({
          systemPrompt:
            "You are a health-check probe. Reply with exactly the single word READY and nothing else.",
          userMessage: "ping",
          maxTokens: 64000,
          skipUniversalWrapper: true,
          model: "claude-haiku-4-5",
        }),
        10_000,
        "Claude probe",
      );
      const normalised = reply.trim().toUpperCase();
      if (!normalised.includes("READY")) {
        return { status: "fail", detail: `Unexpected reply: "${reply.slice(0, 60)}"` };
      }
      return { status: "pass", detail: "READY received" };
    });

    // -------- Fast Check 3: Stage 9 EDT Guard Removed (v5.3) --------
    // In v5.3 the EDT banned-words enforcement clause was intentionally deleted
    // from the Stage 9 prompt (it was banning legitimate words like "permission"
    // — the exact word in Dan Murphy's benchmark proposition). This check now
    // PASSES when that clause is absent and FAILS only if it has been
    // reintroduced as an enforcement banned-list.
    const c3 = await runCheck("stage9_edt_guard_prompt", async () => {
      const prompt = STAGE_9_SYSTEM_PROMPT;
      // Detect the removed enforcement clause: a banned-list block that names
      // these tokens together as forbidden. Casual mentions of any single word
      // (e.g. "permission" appearing in example copy) do not count.
      const enforcementSignals: RegExp[] = [
        /banned[^.\n]{0,80}(earn|deserv|guilt|apolog|permission)/i,
        /forbidden[^.\n]{0,80}(earn|deserv|guilt|apolog|permission)/i,
        /must\s+not\s+(use|contain)[^.\n]{0,80}(earn|deserv|guilt|apolog|permission)/i,
        /EDT[\s\-_]*guard/i,
        /emotional\s+direction\s+test/i,
      ];
      const reintroduced = enforcementSignals.filter((r) => r.test(prompt));
      if (reintroduced.length > 0) {
        return {
          status: "fail",
          detail: `EDT enforcement clause has been reintroduced into Stage 9 prompt (v5.3 removed it). Matched ${reintroduced.length} enforcement signal(s).`,
        };
      }
      return {
        status: "pass",
        detail: "Stage 9 prompt is free of the v5.3-removed EDT banned-words enforcement clause.",
      };
    });

    // -------- Fast Check 4: Stage 12 Database Query Speed (2s budget) --------
    const c4 = await runCheck("stage12_query_speed", async () => {
      const q = (async () =>
        supabaseAdmin
          .from("sessions")
          .select("id, stage_11_output")
          .not("stage_11_output", "is", null)
          .order("updated_at", { ascending: false })
          .limit(1))();
      const { data, error } = await withTimeout(q, 2_000, "stage_11_output query");
      if (error) return { status: "fail", detail: error.message };
      if (!data || data.length === 0) {
        // No prior sessions yet — that is not a query-speed failure; just note it.
        return {
          status: "pass",
          detail: "Query completed (no prior Stage 11 output available to fetch)",
        };
      }
      return { status: "pass", detail: "Stage 11 output retrieved within 2s" };
    });

    // -------- Fast Check 5: Stage 17 Route Registration --------
    const c5 = await runCheck("stage17_route_registration", async () => {
      const detonationHasRoute =
        /createFileRoute\(["']\/detonation["']\)/.test(detonationSource) &&
        /function\s+DetonationRoute\s*\(/.test(detonationSource);
      const canvasHasNavHandler =
        /createFileRoute\(["']\/detonation_\/canvas["']\)/.test(detonationCanvasSource) &&
        /await\s+navigate\s*\(\s*\{\s*to:\s*["']\/detonation["']/.test(detonationCanvasSource);
      if (!detonationHasRoute) {
        return {
          status: "fail",
          detail: "detonation route or DetonationRoute component not declared",
        };
      }
      if (!canvasHasNavHandler) {
        return {
          status: "fail",
          detail: "await navigate({ to: '/detonation' }) not found in detonation_.canvas.tsx",
        };
      }
      return {
        status: "pass",
        detail: "detonation route registered and navigation handler present",
      };
    });

    const checks: FastCheckResult[] = [c1, c2, c3, c4, c5];
    const firstFailure = checks.find((c) => c.status === "fail") ?? null;
    const overall: "ready" | "issue_detected" = firstFailure ? "issue_detected" : "ready";
    const finishedAt = new Date();

    await supabaseAdmin
      .from("preflight_checks")
      .update({
        status: "complete",
        tier_one_results: checks as unknown as never,
        overall_result: overall,
        completed_at: finishedAt.toISOString(),
      })
      .eq("id", recordId);

    return {
      overall,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      firstFailureName: firstFailure ? firstFailure.name : null,
      checks,
      recordId,
    };
  });
