import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({ domain: z.string().min(1), jobId: z.string().min(1) });

export type SupervisionState = {
  state: string;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  nextAttemptAt: string | null;
  needsHuman: boolean;
} | null;

/**
 * Read the reliability layer's view of one job: how many automatic recovery
 * attempts have been spent, whether another is pending, and whether the run
 * has been escalated because automated recovery is exhausted.
 */
export const getSupervisionState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => Input.parse(i))
  .handler(async ({ data, context }): Promise<SupervisionState> => {
    const { data: row } = await context.supabase
      .from("job_supervision" as never)
      .select("state, attempts, last_error, next_attempt_at")
      .eq("domain", data.domain)
      .eq("job_id", data.jobId)
      .maybeSingle();
    if (!row) return null;
    const r = row as unknown as {
      state: string;
      attempts: number;
      last_error: string | null;
      next_attempt_at: string | null;
    };
    const { findDomain } = await import("@/lib/reliability/registry.server");
    return {
      state: r.state,
      attempts: r.attempts ?? 0,
      maxAttempts: findDomain(data.domain)?.maxAttempts ?? 3,
      lastError: r.last_error,
      nextAttemptAt: r.next_attempt_at,
      needsHuman: r.state === "escalated",
    };
  });
