// ORCHESTRATION WATCHDOG — server-side tick for Room 04 Step 4.
//
// The orchestration state machine is normally advanced by a detached
// ctx.waitUntil() driver, and failing that by the watching browser. Both can
// die: Cloudflare can kill a waitUntil invocation mid-phase, and a browser on
// another page cannot pump anything. This endpoint advances every stalled
// orchestration from the server, awaited inside the request, and self-chains
// until the run is complete — so a run finishes with no browser open at all.
//
// Callable only with the shared tick secret.

import { createFileRoute } from "@tanstack/react-router";

const STALE_MS = 90_000;
const SLICE_BUDGET_MS = 45_000;

export const Route = createFileRoute("/api/public/orchestration-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["SWEEP_TICK_SECRET"];
        if (!secret) return new Response("Not configured", { status: 503 });
        if (request.headers.get("x-sweep-secret") !== secret)
          return new Response("Unauthorized", { status: 401 });

        const url = new URL(request.url);
        const force = url.searchParams.get("force") === "1";
        const only = url.searchParams.get("id");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { orchestrationStep } = await import("@/lib/stimulus/orchestration-core.server");

        let q = supabaseAdmin
          .from("stimulus_orchestrations")
          .select("id, session_id, status, driver_status, driver_heartbeat_at")
          .not("status", "in", '("complete")');
        if (only) q = q.eq("id", only);
        const { data: rows } = await q;

        const advanced: { id: string; steps: number; phase?: string; error?: string }[] = [];
        const started = Date.now();

        for (const row of (rows ?? []) as Record<string, string>[]) {
          if (row.driver_status === "cancelled") continue;
          const beat = row.driver_heartbeat_at ? Date.parse(row.driver_heartbeat_at) : 0;
          if (!force && !only && Date.now() - beat < STALE_MS) continue;

          // The step machine needs the owning user for brand asset rules and
          // the access assertion; take it from the session row.
          const { data: session } = await supabaseAdmin
            .from("sessions")
            .select("user_id")
            .eq("id", row.session_id)
            .maybeSingle();
          const userId = (session as { user_id?: string } | null)?.user_id;
          if (!userId) continue;

          await supabaseAdmin
            .from("stimulus_orchestrations")
            .update({
              driver_status: "running",
              driver_heartbeat_at: new Date().toISOString(),
              error: null,
            })
            .eq("id", row.id);

          let steps = 0;
          let phase: string | undefined;
          try {
            for (;;) {
              const r = await orchestrationStep(row.id, userId);
              steps += 1;
              phase = r.phase;
              if (r.done) {
                await supabaseAdmin
                  .from("stimulus_orchestrations")
                  .update({
                    driver_status: "idle",
                    driver_heartbeat_at: new Date().toISOString(),
                  })
                  .eq("id", row.id);
                break;
              }
              if (Date.now() - started > SLICE_BUDGET_MS) break;
            }
            advanced.push({ id: row.id, steps, phase });
          } catch (e) {
            const message = e instanceof Error ? e.message : "Orchestration tick failed";
            await supabaseAdmin
              .from("stimulus_orchestrations")
              .update({ driver_status: "failed", error: message })
              .eq("id", row.id);
            advanced.push({ id: row.id, steps, error: message });
          }

          if (Date.now() - started > SLICE_BUDGET_MS) break;
        }

        // Self-chain: if anything is still mid-run, kick another slice without
        // waiting for it, so the machine keeps stepping unattended.
        const unfinished = advanced.some((a) => a.phase && a.phase !== "complete" && !a.error);
        if (unfinished) {
          const next = new URL(url.toString());
          next.searchParams.set("force", "1");
          void fetch(next.toString(), {
            method: "POST",
            headers: { "x-sweep-secret": secret },
          }).catch(() => {});
        }

        return Response.json({ advanced });
      },
    },
  },
});
