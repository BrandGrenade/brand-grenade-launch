import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/sweep-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const input = await request.json().catch(() => null);
        const runId = input?.runId;
        if (typeof runId !== "string" || !/^[0-9a-f-]{36}$/i.test(runId)) return new Response("Invalid run", { status: 400 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: job } = await supabaseAdmin.from("stimulus_sweep_jobs").select("wake_token").eq("run_id", runId).maybeSingle();
        const secret = process.env["SWEEP_TICK_SECRET"];
        const admin = Boolean(secret) && request.headers.get("x-sweep-secret") === secret;
        const wake = job && request.headers.get("x-sweep-job-token") === job.wake_token;
        if (!admin && !wake) return new Response("Unauthorized", { status: 401 });
        const { claimSweepJob, runSweepJob } = await import("@/lib/stimulus/sweep-job.server");
        const claimed = await claimSweepJob(runId);
        if (!claimed) return Response.json({ claimed: false });
        const encoder = new TextEncoder();
        const body = new ReadableStream<Uint8Array>({
          async start(controller) {
            const timer = setInterval(() => { try { controller.enqueue(encoder.encode(" \n")); } catch { /* connection closed */ } }, 10_000);
            try {
              controller.enqueue(encoder.encode(" \n"));
              const result = await runSweepJob(claimed);
              controller.enqueue(encoder.encode(JSON.stringify(result) + "\n"));
              controller.close();
            } catch (error) { controller.error(error); }
            finally { clearInterval(timer); }
          },
        });
        return new Response(body, { headers: { "content-type": "application/x-ndjson", "cache-control": "no-store, no-transform" } });
      },
    },
  },
});