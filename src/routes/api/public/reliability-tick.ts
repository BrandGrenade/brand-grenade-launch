// PLATFORM RELIABILITY TICK
//
// One endpoint, scheduled every minute by pg_cron, that supervises EVERY
// long-running background job domain registered in
// `src/lib/reliability/registry.server.ts`:
//
//   timeout detection -> auto-retry with backoff -> dead-man's-switch ->
//   escalate to a human only once the retry budget is spent.
//
// Bounded per run (slice budget) so a single tick can never fan out
// unboundedly, and idempotent: attempt bookkeeping lives in
// public.job_supervision, so overlapping ticks cannot double-retry a job
// (the backoff window is claimed before recovery starts).
//
// Callable only with the shared tick secret.

import { createFileRoute } from "@tanstack/react-router";

const SLICE_BUDGET_MS = 50_000;

export const Route = createFileRoute("/api/public/reliability-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const accepted = [
          process.env["RELIABILITY_TICK_SECRET"],
          process.env["SWEEP_TICK_SECRET"],
        ].filter(Boolean) as string[];
        if (!accepted.length) return new Response("Not configured", { status: 503 });
        const provided =
          request.headers.get("x-reliability-secret") ?? request.headers.get("x-sweep-secret");
        if (!provided || !accepted.includes(provided))
          return new Response("Unauthorized", { status: 401 });

        const url = new URL(request.url);
        const force = url.searchParams.get("force") === "1";
        const onlyDomain = url.searchParams.get("domain");
        const onlyJobId = url.searchParams.get("jobId") ?? undefined;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { JOB_DOMAINS } = await import("@/lib/reliability/registry.server");
        const { superviseDomain } = await import("@/lib/reliability/supervisor.server");

        const deadline = Date.now() + SLICE_BUDGET_MS;
        const results = [];

        for (const domain of JOB_DOMAINS) {
          if (onlyDomain && domain.name !== onlyDomain) continue;
          if (Date.now() > deadline) break;
          const r = await superviseDomain(supabaseAdmin as never, domain, {
            force,
            onlyJobId,
            deadline,
          });
          results.push(...r);
        }

        return Response.json({ checked: results.length, results });
      },
    },
  },
});
