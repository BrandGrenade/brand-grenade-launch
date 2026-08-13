// SWEEP WATCHDOG — server-side tick for the 37-lens big idea sweep.
//
// The sweep is driven in bounded background slices. Slices are normally kicked
// by the watching browser, but a sweep must not depend on a browser being open
// at all. This endpoint advances every big idea run that still has pending
// lenses and whose heartbeat has gone quiet, so an abandoned run always
// finishes on its own.
//
// Callable only with the shared tick secret.

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/sweep-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["SWEEP_TICK_SECRET"];
        if (!secret) return new Response("Not configured", { status: 503 });
        if (request.headers.get("x-sweep-secret") !== secret)
          return new Response("Unauthorized", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { driveBigIdeaSweep, SWEEP_STALL_MS } = await import(
          "@/lib/stimulus/big-idea-sweep.server"
        );

        // `force` skips the quiet-heartbeat guard so the watchdog can also be
        // used to push a healthy run through consecutive slices back-to-back.
        const force = new URL(request.url).searchParams.get("force") === "1";

        const { data: runs } = await supabaseAdmin
          .from("stimulus_runs")
          .select("id, status, last_batch_at")
          .eq("run_mode", "big_idea")
          .in("status", ["generating", "failed"]);

        const advanced: string[] = [];
        for (const run of runs ?? []) {
          const { count } = await supabaseAdmin
            .from("stimulus_directions")
            .select("id", { count: "exact", head: true })
            .eq("run_id", run.id)
            .in("status", ["pending", "failed"]);
          if (!count) continue;

          const beat = run.last_batch_at ? Date.parse(run.last_batch_at) : 0;
          if (!force && run.status === "generating" && Date.now() - beat < SWEEP_STALL_MS)
            continue;

          await supabaseAdmin
            .from("stimulus_runs")
            .update({ status: "generating", error: null, last_batch_at: new Date().toISOString() })
            .eq("id", run.id);
          // Awaited, not backgrounded: the caller's request keeps this slice
          // alive, which is the whole point of an external watchdog.
          await driveBigIdeaSweep(run.id);
          advanced.push(run.id);
        }

        return Response.json({ advanced });
      },
    },
  },
});
