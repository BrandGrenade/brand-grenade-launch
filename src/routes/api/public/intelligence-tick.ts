// INTELLIGENCE DRIVER — the only place Intelligence Lab work actually runs.
//
// Why: an analysis is a multi-minute streamed model call. On the published
// runtime, work handed to ctx.waitUntil() is cancelled ~30s after the
// browser's request returns, so runs started that way froze at `running:0`
// and every "recovery" (also waitUntil) froze the same way (JLR, 19 Oct 2026).
//
// Now the browser only records the request (status=running, stage_status=
// queued, or revising:<id> with report_metadata.pending_revision). pg_cron
// calls this endpoint every minute with a long timeout; the endpoint claims
// ONE unowned job and runs it to completion while streaming keep-alive bytes,
// so the invocation stays attached to a live connection for the whole run.
//
// Safe to call unauthenticated: it only picks up queued work, or work whose
// heartbeat has been dead for STALE_RUN_MS, and every claim is optimistic on
// the row's observed state so overlapping calls cannot double-run a job.
// Targeting a specific session (sessionId / force) requires the tick secret.

import { createFileRoute } from "@tanstack/react-router";

const KEEPALIVE_MS = 10_000;
const REVISION_STALE_MS = 5 * 60_000;
const MAX_REVISION_ATTEMPTS = 2;

type Row = {
  id: string;
  user_id: string;
  status: string;
  stage_status: string | null;
  updated_at: string | null;
  retry_count: number | null;
  report_metadata: unknown;
};

type Claimed =
  | { kind: "analysis"; row: Row }
  | {
      kind: "revision";
      row: Row;
      territoryId: string;
      instructions: string;
      mode: "revise" | "replace";
    };

const quietFor = (iso: string | null) => Date.now() - (iso ? Date.parse(iso) : 0);

const metaOf = (row: Row): Record<string, any> =>
  row.report_metadata && typeof row.report_metadata === "object" && !Array.isArray(row.report_metadata)
    ? (row.report_metadata as Record<string, any>)
    : {};

async function claimNext(
  admin: any,
  staleRunMs: number,
  opts: { only?: string | null; force?: boolean },
): Promise<Claimed | null> {
  let q = admin
    .from("intelligence_sessions")
    .select("id, user_id, status, stage_status, updated_at, retry_count, report_metadata")
    .eq("status", "running")
    .order("updated_at", { ascending: true });
  if (opts.only) q = q.eq("id", opts.only);
  const { data: rows } = await q;

  for (const row of (rows ?? []) as Row[]) {
    const stage = row.stage_status ?? "";

    if (stage.startsWith("revising:")) {
      const meta = metaOf(row);
      const pending = meta["pending_revision"];
      const claimedAt = pending?.claimed_at ? Date.parse(pending.claimed_at) : 0;
      const owned = claimedAt && Date.now() - claimedAt < REVISION_STALE_MS;
      if (owned && !opts.force) continue;
      const attempts = Number(pending?.attempts ?? 0);
      const territoryId: string | undefined = pending?.territory_id ?? stage.split(":")[1];
      const instructions: string | undefined = pending?.instructions;
      if (!territoryId || !instructions || attempts >= MAX_REVISION_ATTEMPTS) {
        await admin
          .from("intelligence_sessions")
          .update({
            status: "complete",
            stage_status: "complete:10",
            last_error:
              "Territory revision could not be completed — the original territory was kept. Please request the revision again.",
          })
          .eq("id", row.id)
          .eq("stage_status", stage);
        continue;
      }
      const nextMeta = {
        ...meta,
        pending_revision: { ...pending, claimed_at: new Date().toISOString(), attempts: attempts + 1 },
      };
      const { data: won } = await admin
        .from("intelligence_sessions")
        .update({ report_metadata: nextMeta })
        .eq("id", row.id)
        .eq("updated_at", row.updated_at)
        .select("id");
      if (!won?.length) continue;
      return {
        kind: "revision",
        row,
        territoryId,
        instructions,
        mode: pending?.mode === "replace" ? "replace" : "revise",
      };
    }

    const isQueued = stage === "queued";
    if (!isQueued && !opts.force && quietFor(row.updated_at) < staleRunMs) continue;

    // Taking over a dead mid-stream run counts as a retry so a run that keeps
    // dying ends in a visible failure (MAX_RETRIES) instead of looping.
    const patch: Record<string, unknown> = { stage_status: "claimed" };
    if (!isQueued) patch["retry_count"] = (row.retry_count ?? 0) + 1;
    const { data: won } = await admin
      .from("intelligence_sessions")
      .update(patch)
      .eq("id", row.id)
      .eq("stage_status", stage)
      .eq("updated_at", row.updated_at)
      .select("id");
    if (!won?.length) continue;
    return { kind: "analysis", row };
  }
  return null;
}

export const Route = createFileRoute("/api/public/intelligence-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const only = url.searchParams.get("sessionId");
        const force = url.searchParams.get("force") === "1";
        if (only || force) {
          const secret = process.env["SWEEP_TICK_SECRET"];
          if (!secret || request.headers.get("x-sweep-secret") !== secret)
            return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { executeIntelligenceRun, STALE_RUN_MS } = await import("@/lib/intelligence.functions");

        const claimed = await claimNext(supabaseAdmin, STALE_RUN_MS, { only, force });
        if (!claimed) return Response.json({ claimed: null });

        const work = (async (): Promise<Record<string, unknown>> => {
          const id = claimed.row.id;
          try {
            if (claimed.kind === "revision") {
              const { reviseTerritoryRun } = await import("@/lib/intelligence-revise.server");
              const r = await reviseTerritoryRun({
                sessionId: id,
                territoryId: claimed.territoryId,
                instructions: claimed.instructions,
                mode: claimed.mode,
              });
              return { id, kind: "revision", outcome: r.success ? "completed" : `failed: ${r.error}` };
            }
            const r = await executeIntelligenceRun(supabaseAdmin as never, claimed.row.user_id, id, true);
            if (!r.success) {
              await supabaseAdmin
                .from("intelligence_sessions")
                .update({ status: "failed", last_error: r.error })
                .eq("id", id)
                .eq("status", "running");
            }
            return { id, kind: "analysis", outcome: r.success ? "completed" : `failed: ${r.error}` };
          } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            console.error(`[intelligence-tick:${id}]`, e);
            await supabaseAdmin
              .from("intelligence_sessions")
              .update({ status: "failed", last_error: `Run error: ${message}` })
              .eq("id", id)
              .eq("status", "running");
            return { id, kind: claimed.kind, outcome: `error: ${message}` };
          }
        })();

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
            controller.enqueue(enc.encode(JSON.stringify({ claimed: result }) + "\n"));
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
