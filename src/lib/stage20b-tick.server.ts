// Stage 20B driver — claims and runs channel-strategy generations.
//
// Why a tick: the generation is a single multi-minute streamed model call.
// Running it inside the startStage20b server-function request sends no bytes
// until completion, so on the published runtime the idle connection is dropped
// and the worker invocation is cancelled mid-stream — silently, leaving the
// __STAGE_20B_RUNNING__ sentinel forever (JLR, 22 Oct 2026). The tick route
// streams keep-alive bytes for the whole run, so the invocation stays attached
// to a live connection (the wake trigger's pg_net call, or the browser's).
//
// Claim protocol on sessions.stage_20b_error:
//   "__STAGE_20B_RUNNING__"                 — queued, unclaimed (set by startStage20b)
//   "__STAGE_20B_RUNNING__:claimed:<n>"     — claimed, attempt n; updated_at is the heartbeat
//   anything else                           — terminal error, not running
//
// A claimed row whose heartbeat has been quiet for CLAIM_QUIET_MS may be
// re-claimed (the worker died mid-run). After MAX_CLAIMS attempts the row is
// failed terminally instead of looping forever.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { STAGE_20B_RUNNING, type Stage20bAudienceInput } from "./stage20b.server";

export const STAGE_20B_CLAIM_QUIET_MS = 3 * 60_000;
export const STAGE_20B_MAX_CLAIMS = 3;
const HEARTBEAT_MS = 45_000;

const AUDIENCE_KEYS: Array<keyof Stage20bAudienceInput> = [
  "audienceAsHumans",
  "dayInTheirLife",
  "influenceMap",
  "decisionJourney",
  "psychologicalProfile",
  "channelUniverseAndBudget",
];

export type Stage20bSentinel = { running: boolean; claimed: boolean; attempt: number };

export function parseStage20bSentinel(err: string | null): Stage20bSentinel {
  if (!err || !err.startsWith(STAGE_20B_RUNNING)) return { running: false, claimed: false, attempt: 0 };
  const m = err.match(/:claimed:(\d+)$/);
  return { running: true, claimed: Boolean(m), attempt: m ? parseInt(m[1], 10) : 0 };
}

function validAudienceInput(a: unknown): a is Stage20bAudienceInput {
  if (!a || typeof a !== "object" || Array.isArray(a)) return false;
  return AUDIENCE_KEYS.every(
    (k) => typeof (a as Record<string, unknown>)[k] === "string" && ((a as Record<string, string>)[k] ?? "").trim().length > 0,
  );
}

type CandidateRow = {
  id: string;
  updated_at: string | null;
  stage_20b_error: string | null;
  stage_20b_audience_input: unknown;
};

export type Stage20bClaim = { sessionId: string; audienceInput: Stage20bAudienceInput; attempt: number };

/**
 * Claims one queued Stage 20B job. Returns null when nothing is claimable.
 * The claim is optimistic on the row's observed sentinel + updated_at, so
 * overlapping ticks cannot double-run a job.
 */
export async function claimNextStage20b(opts: { only?: string | null } = {}): Promise<Stage20bClaim | null> {
  let q = supabaseAdmin
    .from("sessions")
    .select("id, updated_at, stage_20b_error, stage_20b_audience_input")
    .like("stage_20b_error", `${STAGE_20B_RUNNING}%`)
    .is("stage_20b_output", null)
    .order("updated_at", { ascending: true })
    .limit(5);
  if (opts.only) q = q.eq("id", opts.only);
  const { data: rows } = await q;

  for (const row of (rows ?? []) as CandidateRow[]) {
    const s = parseStage20bSentinel(row.stage_20b_error);
    const quietMs = Date.now() - (row.updated_at ? Date.parse(row.updated_at) : 0);

    if (s.claimed) {
      // A live claimant heartbeats updated_at well inside this window.
      if (quietMs < STAGE_20B_CLAIM_QUIET_MS) continue;
      if (s.attempt >= STAGE_20B_MAX_CLAIMS) {
        await supabaseAdmin
          .from("sessions")
          .update({
            stage_20b_error:
              "The channel strategy could not be completed after several automatic attempts. Open Stage 20B and run it again.",
          })
          .eq("id", row.id)
          .eq("stage_20b_error", row.stage_20b_error as string);
        continue;
      }
    }

    const attempt = s.attempt + 1;
    const claimedSentinel = `${STAGE_20B_RUNNING}:claimed:${attempt}`;
    const { data: won } = await supabaseAdmin
      .from("sessions")
      .update({ stage_20b_error: claimedSentinel })
      .eq("id", row.id)
      .eq("stage_20b_error", row.stage_20b_error as string)
      .eq("updated_at", row.updated_at as string)
      .select("id");
    if (!won?.length) continue;

    if (!validAudienceInput(row.stage_20b_audience_input)) {
      await supabaseAdmin
        .from("sessions")
        .update({
          stage_20b_error:
            "Stage 20B is missing its audience intelligence inputs. Open Stage 20B, complete the six fields, and run it again.",
        })
        .eq("id", row.id);
      continue;
    }

    return { sessionId: row.id, audienceInput: row.stage_20b_audience_input, attempt };
  }
  return null;
}

/** Runs a claimed job to completion, heartbeating updated_at so no other tick re-claims it. */
export async function runClaimedStage20b(claim: Stage20bClaim): Promise<{ ok: boolean; error?: string }> {
  const sentinel = `${STAGE_20B_RUNNING}:claimed:${claim.attempt}`;
  const heartbeat = setInterval(() => {
    void supabaseAdmin
      .from("sessions")
      .update({ stage_20b_error: sentinel })
      .eq("id", claim.sessionId)
      .like("stage_20b_error", `${STAGE_20B_RUNNING}%`)
      .is("stage_20b_output", null)
      .then(() => {});
  }, HEARTBEAT_MS);
  try {
    const { generateStage20b } = await import("./stage20b.server");
    await generateStage20b({ sessionId: claim.sessionId, audienceInput: claim.audienceInput });
    return { ok: true };
  } catch (e) {
    // generateStage20b already wrote the real error to stage_20b_error.
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearInterval(heartbeat);
  }
}
