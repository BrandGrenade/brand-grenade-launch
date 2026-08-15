// SMP SCORE WATCHDOG — standing guarantee that no session carries a
// selected/locked proposition without its own current Stage 10 score.
//
// Every write path already fires the score guarantee inline (selection,
// downstream stage entry, document render). This endpoint is the backstop:
// it sweeps every session whose selected proposition has no matching score
// block — including propositions refined by an older build, or by a path
// added later — and scores them.
//
// Callable only with the shared tick secret.

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/smp-score-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["SWEEP_TICK_SECRET"];
        if (!secret) return new Response("Not configured", { status: 503 });
        if (request.headers.get("x-sweep-secret") !== secret)
          return new Response("Unauthorized", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { hasIndependentScore, ensureSmpScored } = await import(
          "@/lib/rescore-smp.server"
        );

        const url = new URL(request.url);
        const only = url.searchParams.get("sessionId");
        const limit = Math.min(Number(url.searchParams.get("limit") ?? 5) || 5, 20);
        // force=1 re-scores sessions that already carry a score block — used
        // when the Stage 10 evidence anchors themselves have changed.
        const force = url.searchParams.get("force") === "1";

        let q = supabaseAdmin
          .from("sessions")
          .select("id, brand_name, selected_smp, stage_10_output")
          .not("selected_smp", "is", null)
          .not("stage_10_output", "is", null)
          .order("updated_at", { ascending: false })
          .limit(200);
        if (only) q = q.eq("id", only);
        const { data: rows } = await q;

        const scored: { id: string; brand: string; result: unknown }[] = [];
        for (const r of rows ?? []) {
          if (scored.length >= limit) break;
          const smp = (r.selected_smp ?? "").trim();
          if (!smp) continue;
          if (!force && hasIndependentScore(r.stage_10_output ?? "", smp)) continue;
          scored.push({
            id: r.id,
            brand: r.brand_name,
            result: await ensureSmpScored(r.id, force),
          });
        }

        return Response.json({ checked: rows?.length ?? 0, scored });
      },
    },
  },
});
