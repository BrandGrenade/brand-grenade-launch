// STAGE 20B DRIVER — the only place channel-strategy generations actually run.
//
// Same shape as intelligence-tick: the browser (startStage20b) only records
// the request (stage_20b_error = "__STAGE_20B_RUNNING__"); the bg_stage20b_wake
// trigger on sessions calls this endpoint via pg_net with a long timeout, and
// the endpoint claims ONE queued job and runs it to completion while streaming
// keep-alive bytes, so the invocation stays attached to a live connection for
// the whole run. Running the generation inside the start request instead sent
// no bytes for minutes; the idle connection was dropped on the published
// runtime and the worker was cancelled mid-stream, leaving the sentinel
// forever (JLR, 22 Oct 2026).
//
// Safe to call unauthenticated: it only picks up work an authenticated start
// already queued, and every claim is optimistic on the row's observed state so
// overlapping calls cannot double-run a job. Targeting a specific session
// (sessionId) requires the tick secret.

import { createFileRoute } from "@tanstack/react-router";

const KEEPALIVE_MS = 10_000;

export const Route = createFileRoute("/api/public/stage20b-tick")({
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

        const { claimNextStage20b, runClaimedStage20b } = await import("@/lib/stage20b-tick.server");

        const claimed = await claimNextStage20b({ only });
        if (!claimed) return Response.json({ claimed: null });

        const work = runClaimedStage20b(claimed);

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
              enc.encode(JSON.stringify({ claimed: { id: claimed.sessionId, attempt: claimed.attempt, ...result } }) + "\n"),
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
