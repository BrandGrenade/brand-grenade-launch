// STAGE 16 DRIVER — runs queued Document Assembly generations in the background.
//
// Same shape as stage20b-tick: the browser (startStage16) only records the
// request (stage_16_error = "__STAGE_16_RUNNING__:<format>"); the
// bg_stage16_wake trigger on sessions calls this endpoint via pg_net with a
// long timeout, and the endpoint claims ONE queued job and runs it to
// completion while streaming keep-alive bytes, so the invocation stays
// attached to a live connection for the whole run.
//
// Safe to call unauthenticated: it only picks up work an authenticated start
// already queued, and every claim is optimistic on the row's observed state so
// overlapping calls cannot double-run a job. Targeting a specific session
// (sessionId) requires the tick secret.

import { createFileRoute } from "@tanstack/react-router";

const KEEPALIVE_MS = 10_000;

export const Route = createFileRoute("/api/public/stage16-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const only = url.searchParams.get("sessionId");
        if (only) {
          const secret = process.env["SWEEP_TICK_SECRET"];
          if (!secret || request.headers.get("x-sweep-secret") !== secret)
            return new Response("Unauthorized", { status: 401 });
        }

        const { claimNextStage16, runClaimedStage16 } = await import("@/lib/stage16-tick.server");

        const claimed = await claimNextStage16({ only });
        if (!claimed) return Response.json({ claimed: null });

        const work = runClaimedStage16(claimed);

        // Stream keep-alive bytes so this invocation stays attached to a live
        // connection for the whole run, then the final result line.
        const enc = new TextEncoder();
        const body = new ReadableStream<Uint8Array>({
          async start(controller) {
            const timer = setInterval(() => {
              try {
                controller.enqueue(enc.encode(" \n"));
              } catch {
                /* closed */
              }
            }, KEEPALIVE_MS);
            controller.enqueue(enc.encode(" \n"));
            const result = await work;
            clearInterval(timer);
            controller.enqueue(
              enc.encode(
                JSON.stringify({
                  claimed: { id: claimed.sessionId, format: claimed.format, attempt: claimed.attempt, ...result },
                }) + "\n",
              ),
            );
            controller.close();
          },
        });
        return new Response(body, {
          headers: { "content-type": "application/x-ndjson", "cache-control": "no-store" },
        });
      },
    },
  },
});
