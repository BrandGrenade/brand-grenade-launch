// Stage 22 driver — claims and runs Brand Architecture generations.
//
// Same shape as stage20b-tick: the generation is two multi-minute model
// calls. Running them inside the runStage22 server-function request sends no
// bytes until completion, so on the published runtime the idle connection is
// dropped and the worker invocation is cancelled mid-stream — silently losing
// the output (JLR, 26 Oct 2026). The tick route streams keep-alive bytes for
// the whole run, so the invocation stays attached to a live connection (the
// wake trigger's pg_net call, or the browser's).
//
// Claim protocol on sessions.stage_22_error:
//   "__STAGE_22_RUNNING__"                 — queued, unclaimed (set by runStage22/regenerateStage22)
//   "__STAGE_22_RUNNING__:claimed:<n>"     — claimed, attempt n; updated_at is the heartbeat
//   anything else                          — terminal error, not running
//
// A claimed row whose heartbeat has been quiet for CLAIM_QUIET_MS may be
// re-claimed (the worker died mid-run). After MAX_CLAIMS attempts the row is
// failed terminally instead of looping forever.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { STAGE_22_RUNNING, parseStage22Sentinel } from "./stage22.functions";

export const STAGE_22_CLAIM_QUIET_MS = 3 * 60_000;
export const STAGE_22_MAX_CLAIMS = 3;
const HEARTBEAT_MS = 45_000;

type CandidateRow = {
  id: string;
  updated_at: string | null;
  stage_22_error: string | null;
};

export type Stage22Claim = { sessionId: string; attempt: number };

/**
 * Claims one queued Stage 22 job. Returns null when nothing is claimable.
 * The claim is optimistic on the row's observed sentinel + updated_at, so
 * overlapping ticks cannot double-run a job.
 */
export async function claimNextStage22(opts: { only?: string | null } = {}): Promise<Stage22Claim | null> {
  let q = supabaseAdmin
    .from("sessions")
    .select("id, updated_at, stage_22_error")
    .like("stage_22_error", `${STAGE_22_RUNNING}%`)
    .is("stage_22_output", null)
    .order("updated_at", { ascending: true })
    .limit(5);
  if (opts.only) q = q.eq("id", opts.only);
  const { data: rows } = await q;

  for (const row of (rows ?? []) as CandidateRow[]) {
    const s = parseStage22Sentinel(row.stage_22_error);
    const quietMs = Date.now() - (row.updated_at ? Date.parse(row.updated_at) : 0);

    if (s.claimed) {
      // A live claimant heartbeats updated_at well inside this window.
      if (quietMs < STAGE_22_CLAIM_QUIET_MS) continue;
      if (s.attempt >= STAGE_22_MAX_CLAIMS) {
        await supabaseAdmin
          .from("sessions")
          .update({
            stage_22_error:
              "Brand Architecture could not be completed after several automatic attempts. Open Stage 22 and run it again.",
          })
          .eq("id", row.id)
          .eq("stage_22_error", row.stage_22_error as string);
        continue;
      }
    }

    const attempt = s.attempt + 1;
    const claimedSentinel = `${STAGE_22_RUNNING}:claimed:${attempt}`;
    const { data: won } = await supabaseAdmin
      .from("sessions")
      .update({ stage_22_error: claimedSentinel })
      .eq("id", row.id)
      .eq("stage_22_error", row.stage_22_error as string)
      .eq("updated_at", row.updated_at as string)
      .select("id");
    if (!won?.length) continue;

    return { sessionId: row.id, attempt };
  }
  return null;
}

/** Runs a claimed job to completion, heartbeating updated_at so no other tick re-claims it. */
export async function runClaimedStage22(claim: Stage22Claim): Promise<{ ok: boolean; error?: string }> {
  const sentinel = `${STAGE_22_RUNNING}:claimed:${claim.attempt}`;
  const heartbeat = setInterval(() => {
    void supabaseAdmin
      .from("sessions")
      .update({ stage_22_error: sentinel })
      .eq("id", claim.sessionId)
      .like("stage_22_error", `${STAGE_22_RUNNING}%`)
      .is("stage_22_output", null)
      .then(() => {});
  }, HEARTBEAT_MS);
  try {
    const { generateStage22 } = await import("./stage22.functions");
    await generateStage22(claim.sessionId);
    return { ok: true };
  } catch (e) {
    // generateStage22 already wrote the real error to stage_22_error.
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearInterval(heartbeat);
  }
}
