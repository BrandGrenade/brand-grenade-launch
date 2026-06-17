// Pipeline gate — enforces "Platform Not Verified" rules on the New Pipeline
// Run button. Reads the most recent Tier Two check; allows a run only when
// the latest completed check is < 24h old AND overall_result = 'ready'.
// Otherwise the caller must explicitly override; the override is persisted
// to preflight_checks (check_type='pipeline_run_override') with timestamp,
// reason, and the user id.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export type PipelineGateStatus = {
  allowed: boolean;
  reason: "ready" | "no_check" | "stale" | "failed" | "running";
  message: string;
  lastCheck: {
    id: string;
    startedAt: string;
    completedAt: string | null;
    status: string;
    overallResult: "ready" | "issue_detected" | null;
    ageMs: number | null;
  } | null;
};

export const getPipelineGate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<PipelineGateStatus> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const finish = (result: PipelineGateStatus): PipelineGateStatus => {
      console.info("[PipelineGate] getPipelineGate result", JSON.stringify(result));
      return result;
    };
    const { data, error } = await supabaseAdmin
      .from("preflight_checks")
      .select("id, started_at, completed_at, status, overall_result")
      .eq("check_type", "full")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);

    if (!data) {
      return finish({
        allowed: false,
        reason: "no_check",
        message:
          "Platform Not Verified — no Tier Two integrity check has ever been run. Run a System Check first.",
        lastCheck: null,
      });
    }

    const startedAt = data.started_at as string;
    const completedAt = (data.completed_at as string | null) ?? null;
    const overall = (data.overall_result as "ready" | "issue_detected" | null) ?? null;
    const status = data.status as string;
    const ageMs = completedAt ? Date.now() - new Date(completedAt).getTime() : null;

    const lastCheck = {
      id: data.id as string,
      startedAt,
      completedAt,
      status,
      overallResult: overall,
      ageMs,
    };

    if (status === "running") {
      return finish({
        allowed: false,
        reason: "running",
        message: "Platform Not Verified — a Tier Two check is currently in progress.",
        lastCheck,
      });
    }
    if (status !== "complete" || overall !== "ready") {
      return finish({
        allowed: false,
        reason: "failed",
        message:
          "Platform Not Verified — the last Tier Two integrity check did not pass. Re-run System Check or override.",
        lastCheck,
      });
    }
    if (ageMs !== null && ageMs > TWENTY_FOUR_HOURS_MS) {
      const hours = Math.floor(ageMs / (60 * 60 * 1000));
      return finish({
        allowed: false,
        reason: "stale",
        message: `Platform Not Verified — last Tier Two check was ${hours}h ago (must be within 24h). Re-run System Check or override.`,
        lastCheck,
      });
    }
    return finish({
      allowed: true,
      reason: "ready",
      message: "Platform Verified.",
      lastCheck,
    });
  });

const OverrideInput = z.object({
  reason: z.string().min(4).max(1000),
});

export const logPipelineRunOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => OverrideInput.parse(i))
  .handler(async ({ data, context }): Promise<{ id: string; timestamp: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const nowIso = new Date().toISOString();
    const { data: row, error } = await supabaseAdmin
      .from("preflight_checks")
      .insert({
        check_type: "pipeline_run_override",
        status: "complete",
        started_by: context.userId,
        completed_at: nowIso,
        override_used: true,
        override_timestamp: nowIso,
        override_reason: data.reason,
      })
      .select("id")
      .single();
    if (error || !row) {
      throw new Error(`Failed to log pipeline-run override: ${error?.message ?? "no row"}`);
    }
    return { id: row.id as string, timestamp: nowIso };
  });
