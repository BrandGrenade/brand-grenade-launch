// Stage 16 driver — claims and runs Document Assembly generations.
//
// Same shape as stage20b-tick / stage22-tick: a document format is several
// multi-minute model calls. The tick route streams keep-alive bytes for the
// whole run, so the invocation stays attached to a live connection (the wake
// trigger's pg_net call, or the browser's) instead of being cancelled
// mid-stream on the published runtime.
//
// Claim protocol on sessions.stage_16_error (see stage16.server.ts):
//   "__STAGE_16_RUNNING__:<format>"                 — queued, unclaimed
//   "__STAGE_16_RUNNING__:<format>:claimed:<n>"     — claimed, attempt n; updated_at is the heartbeat
//   anything else                                   — terminal error, not running
//
// A claimed row whose heartbeat has been quiet for CLAIM_QUIET_MS may be
// re-claimed (the worker died mid-run). After MAX_CLAIMS attempts the row is
// failed terminally instead of looping forever.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  STAGE_16_RUNNING,
  generateStage16Format,
  parseStage16Sentinel,
} from "./stage16.server";
import type { Stage16Format } from "./stage16-sections";

export const STAGE_16_CLAIM_QUIET_MS = 3 * 60_000;
export const STAGE_16_MAX_CLAIMS = 3;
const HEARTBEAT_MS = 45_000;

type CandidateRow = {
  id: string;
  updated_at: string | null;
  stage_16_error: string | null;
};

export type Stage16Claim = { sessionId: string; format: Stage16Format; attempt: number };

/**
 * Claims one queued Stage 16 job. Returns null when nothing is claimable.
 * The claim is optimistic on the row's observed sentinel + updated_at, so
 * overlapping ticks cannot double-run a job.
 */
export async function claimNextStage16(opts: { only?: string | null } = {}): Promise<Stage16Claim | null> {
  let q = supabaseAdmin
    .from("sessions")
    .select("id, updated_at, stage_16_error")
    .like("stage_16_error", `${STAGE_16_RUNNING}%`)
    .order("updated_at", { ascending: true })
    .limit(5);
  if (opts.only) q = q.eq("id", opts.only);
  const { data: rows } = await q;

  for (const row of (rows ?? []) as CandidateRow[]) {
    const s = parseStage16Sentinel(row.stage_16_error);
    const quietMs = Date.now() - (row.updated_at ? Date.parse(row.updated_at) : 0);

    if (s.claimed) {
      // A live claimant heartbeats updated_at well inside this window.
      if (quietMs < STAGE_16_CLAIM_QUIET_MS) continue;
      if (s.attempt >= STAGE_16_MAX_CLAIMS) {
        await supabaseAdmin
          .from("sessions")
          .update({
            stage_16_error:
              "Document Assembly could not be completed after several automatic attempts. Open the Deliverables page and generate the document again.",
          })
          .eq("id", row.id)
          .eq("stage_16_error", row.stage_16_error as string);
        continue;
      }
    }

    if (!s.format) {
      await supabaseAdmin
        .from("sessions")
        .update({
          stage_16_error:
            "Document Assembly was queued without a document format. Generate the document again from the Deliverables page.",
        })
        .eq("id", row.id)
        .eq("stage_16_error", row.stage_16_error as string);
      continue;
    }

    const attempt = s.attempt + 1;
    const claimedSentinel = `${STAGE_16_RUNNING}:${s.format}:claimed:${attempt}`;
    const { data: won } = await supabaseAdmin
      .from("sessions")
      .update({ stage_16_error: claimedSentinel })
      .eq("id", row.id)
      .eq("stage_16_error", row.stage_16_error as string)
      .eq("updated_at", row.updated_at as string)
      .select("id");
    if (!won?.length) continue;

    return { sessionId: row.id, format: s.format, attempt };
  }
  return null;
}

/** Runs a claimed job to completion, heartbeating updated_at so no other tick re-claims it. */
export async function runClaimedStage16(claim: Stage16Claim): Promise<{ ok: boolean; error?: string }> {
  const sentinel = `${STAGE_16_RUNNING}:${claim.format}:claimed:${claim.attempt}`;
  const heartbeat = setInterval(() => {
    void supabaseAdmin
      .from("sessions")
      .update({ stage_16_error: sentinel })
      .eq("id", claim.sessionId)
      .like("stage_16_error", `${STAGE_16_RUNNING}%`)
      .then(() => {});
  }, HEARTBEAT_MS);
  try {
    // Drain the shared generator; per-section persistence happens inside it.
    // keepSentinel keeps the row claimed across those writes.
    const gen = generateStage16Format({
      sessionId: claim.sessionId,
      format: claim.format,
      keepSentinel: sentinel,
    });
    for await (const _event of gen) {
      /* events are for the streaming browser path; the tick discards them */
    }
    return { ok: true };
  } catch (e) {
    // generateStage16Format already persisted the partial output and error.
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearInterval(heartbeat);
  }
}
