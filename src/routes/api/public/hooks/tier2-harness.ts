// Detached Check 14 harness hook.
//
// Called by pg_cron every minute (tick) and once manually to seed a run.
// Authenticated with the project's anon key in the `apikey` header. Nothing
// here depends on a browser, a preview tab, or the build sandbox.

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Body = z.object({
  action: z.enum(["start", "tick", "status"]),
  donorSessionId: z.string().uuid().optional(),
});

export const Route = createFileRoute("/api/public/hooks/tier2-harness")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = request.headers.get("apikey");
        const accepted = [
          process.env["SUPABASE_ANON_KEY"],
          process.env["SUPABASE_PUBLISHABLE_KEY"],
          process.env["VITE_SUPABASE_PUBLISHABLE_KEY"],
        ].filter((v): v is string => Boolean(v));
        if (!key || !accepted.includes(key)) {
          return new Response(JSON.stringify({ error: "unauthorised" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        let parsed: z.infer<typeof Body>;
        try {
          parsed = Body.parse(await request.json());
        } catch {
          return new Response(JSON.stringify({ error: "bad request" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        try {
          const { seedHarnessRun, tickHarness } = await import("@/lib/tier2-harness.server");
          if (parsed.action === "start") {
            if (!parsed.donorSessionId) throw new Error("donorSessionId required");
            const run = await seedHarnessRun(parsed.donorSessionId);
            return Response.json({ ok: true, run });
          }
          if (parsed.action === "status") {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const { data } = await supabaseAdmin
              .from("tier2_harness_runs")
              .select("*")
              .order("created_at", { ascending: false })
              .limit(3);
            return Response.json({ ok: true, runs: data ?? [] });
          }
          const result = await tickHarness();
          return Response.json({ ok: true, result });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("[tier2-harness]", msg);
          return new Response(JSON.stringify({ ok: false, error: msg }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
