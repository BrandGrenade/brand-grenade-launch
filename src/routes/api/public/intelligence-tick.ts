// INTELLIGENCE WATCHDOG — server-side recovery tick for Intelligence Lab runs.
//
// Failure class: `runIntelligenceAnalysis` writes a durable dispatch marker
// (status=running / stage_status=queued) inside the request, then hands the
// multi-minute streamed model call to ctx.waitUntil(). If that background
// invocation is dropped (worker torn down before the continuation is picked
// up), nothing ever runs and the row sits on `queued` forever with no error.
//
// This endpoint reclaims any row that is stuck on `queued`, or whose
// heartbeat (updated_at) has gone quiet mid-stream, and runs it to completion
// inside the caller's request — no browser involvement at all.
//
// Callable only with the shared tick secret.

import { createFileRoute } from "@tanstack/react-router";

const QUEUED_STALE_MS = 60_000;

export const Route = createFileRoute("/api/public/intelligence-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["SWEEP_TICK_SECRET"];
        if (!secret) return new Response("Not configured", { status: 503 });
        if (request.headers.get("x-sweep-secret") !== secret)
          return new Response("Unauthorized", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { executeIntelligenceRun, STALE_RUN_MS } = await import(
          "@/lib/intelligence.functions"
        );

        const url = new URL(request.url);
        const only = url.searchParams.get("sessionId");
        const force = url.searchParams.get("force") === "1";

        let q = supabaseAdmin
          .from("intelligence_sessions")
          .select("id, user_id, status, stage_status, updated_at")
          .eq("status", "running");
        if (only) q = q.eq("id", only);
        const { data: rows } = await q;

        const results: Array<{ id: string; outcome: string }> = [];
        for (const row of rows ?? []) {
          const quietFor = Date.now() - (row.updated_at ? Date.parse(row.updated_at) : 0);
          const isQueued = row.stage_status === "queued";
          const threshold = isQueued ? QUEUED_STALE_MS : STALE_RUN_MS;
          if (!force && quietFor < threshold) continue;

          // A stalled territory revision must NOT be escalated into a full
          // re-run — the stored report is still valid. Release it instead.
          if (row.stage_status?.startsWith("revising:")) {
            await supabaseAdmin
              .from("intelligence_sessions")
              .update({
                status: "complete",
                stage_status: "complete:10",
                last_error: "Watchdog: territory revision stalled — original territory kept",
              } as never)
              .eq("id", row.id);
            results.push({ id: row.id, outcome: "revision-released" });
            continue;
          }


          // Awaited on purpose: the watchdog's own request keeps the run alive.
          const r = await executeIntelligenceRun(
            supabaseAdmin as never,
            row.user_id,
            row.id,
            true,
          );
          if (!r.success) {
            await supabaseAdmin
              .from("intelligence_sessions")
              .update({ status: "failed", last_error: `Watchdog: ${r.error}` })
              .eq("id", row.id);
          }
          results.push({ id: row.id, outcome: r.success ? "completed" : `failed: ${r.error}` });
        }

        return Response.json({ checked: rows?.length ?? 0, results });
      },
    },
  },
});
