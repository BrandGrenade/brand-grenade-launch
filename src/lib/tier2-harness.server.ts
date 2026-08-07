// Detached Check 14 harness.
//
// Runs the Stage 20 → 20B → 21 → Check 14 (runtime layer) chain entirely
// server-side, one step per invocation, driven by a pg_cron tick against
// /api/public/hooks/tier2-harness. Nothing about it depends on a browser
// session, a preview tab, or the build sandbox staying alive: state lives in
// public.tier2_harness_runs and each tick picks up wherever the last one
// stopped.
//
// It fast-forwards by cloning a donor session that already reached Stage 19,
// then regenerating only the three stages Check 14 actually inspects.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callClaude } from "./claude.server";
import { withPhase2Formatting } from "./phase2-shared";
import { STAGE_20_MASTER_DETONATION_BRIEF_PROMPT } from "./stage20-master-detonation-brief-prompt";
import { STAGE_20B_CHANNEL_STRATEGY_PROMPT } from "./stage20b-prompt";
import { buildStage20UserMessage } from "./stage20.functions";
import { buildStage20bUserMessage } from "./stage20b.functions";
import { generateOne } from "./stage21.functions";
import { assertSmpVerbatimCarriage, flattenStrings } from "./smp-carriage";

type Phase = "stage20" | "stage20b" | "stage21" | "check14" | "done" | "failed";

const DEFAULT_AUDIENCE = {
  audienceAsHumans:
    "Mid-career Australian professionals, 30-50, time-poor, sceptical of category advertising, high trust in peer proof.",
  dayInTheirLife:
    "Commute, back-to-back meetings, decisions made in gaps between other obligations, phone-first evenings.",
  influenceMap:
    "Peers and colleagues first, category press second, brand-owned channels last.",
  decisionJourney:
    "Trigger event, quick shortlist built from memory, one comparison pass, decision made under time pressure.",
  psychologicalProfile:
    "Wants to be seen as having made the defensible choice; fears being caught out having chosen badly.",
  channelUniverseAndBudget:
    "Mid-weight budget. Online video, social, audio, OOH in metro, owned CRM. No TV.",
};

const HARNESS_CHANNELS: Array<{ channel: string; role: string }> = [
  { channel: "Online Video", role: "Lead channel — carries the idea in full" },
];

function log(run: { log: unknown }, line: string) {
  const prev = Array.isArray(run.log) ? (run.log as string[]) : [];
  return [...prev, `${new Date().toISOString()} ${line}`].slice(-200);
}

/**
 * Race a stage call against a soft deadline. Without this, a worker that is
 * killed for exceeding its execution budget produces no error at all — the
 * catch block never runs and the run row just shows a stale claim.
 */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} exceeded soft deadline of ${ms}ms`)), ms),
    ),
  ]);
}


/** Clone a donor session up to Stage 19 into a fresh harness session. */
export async function seedHarnessRun(donorSessionId: string) {
  const { data: donor, error } = await supabaseAdmin
    .from("sessions")
    .select("*")
    .eq("id", donorSessionId)
    .single();
  if (error || !donor) throw new Error(`Donor session not found: ${error?.message ?? "no row"}`);

  const clone: Record<string, unknown> = { ...(donor as Record<string, unknown>) };
  delete clone["id"];
  delete clone["created_at"];
  delete clone["updated_at"];
  clone["brand_name"] = `Check14 Harness — ${new Date().toISOString().slice(0, 16)}`;
  clone["stage_20_output"] = null;
  clone["stage_20_approved"] = false;
  clone["stage_20b_output"] = null;
  clone["stage_21_outputs"] = null;
  clone["stage_21_fidelity"] = null;
  clone["stage_20_error"] = null;
  clone["stage_20b_error"] = null;
  clone["stage_21_error"] = null;

  const { data: fresh, error: insErr } = await supabaseAdmin
    .from("sessions")
    .insert(clone as never)
    .select("id")
    .single();
  if (insErr || !fresh) throw new Error(`Could not clone donor session: ${insErr?.message}`);

  const { data: run, error: runErr } = await supabaseAdmin
    .from("tier2_harness_runs")
    .insert({
      session_id: fresh.id,
      donor_session_id: donorSessionId,
      phase: "stage20",
      status: "running",
      log: [`${new Date().toISOString()} seeded from donor ${donorSessionId}`] as never,
    })
    .select("*")
    .single();
  if (runErr) throw new Error(runErr.message);
  return run;
}

/**
 * Advance the oldest live harness run by exactly one phase. Safe to call
 * every minute: a claim update guarantees only one tick works a run at a
 * time, and a stale claim (>4 min without a heartbeat) is reclaimed.
 *
 * The attempt counter and an "in-flight" marker are written at claim time,
 * BEFORE the model call — a tick that dies mid-flight (worker timeout, OOM)
 * never reaches the catch block, so post-hoc error capture records nothing.
 */
export async function tickHarness() {
  const staleBefore = new Date(Date.now() - 4 * 60_000).toISOString();
  const { data: candidates } = await supabaseAdmin
    .from("tier2_harness_runs")
    .select("*")
    .eq("status", "running")
    .order("created_at", { ascending: true })
    .limit(5);
  const run = (candidates ?? []).find(
    (r) => !r.claimed_at || r.claimed_at < staleBefore,
  );
  if (!run) return { worked: false, reason: "no claimable run" };

  const attemptNo = (run.attempts ?? 0) + 1;
  if (attemptNo > 6) {
    await supabaseAdmin
      .from("tier2_harness_runs")
      .update({
        status: "failed",
        phase: "failed",
        claimed_at: null,
        result_detail:
          run.result_detail ?? `gave up after ${run.attempts} attempts at phase ${run.phase}`,
        log: log(run, `gave up after ${run.attempts} attempts at phase ${run.phase}`) as never,
      })
      .eq("id", run.id);
    return { worked: false, reason: "attempt budget exhausted" };
  }

  const claimedAt = new Date().toISOString();
  const claimQuery = supabaseAdmin
    .from("tier2_harness_runs")
    .update({
      claimed_at: claimedAt,
      attempts: attemptNo,
      result_detail: `in-flight: phase ${run.phase}, attempt ${attemptNo}, claimed ${claimedAt}`,
      log: log(run, `claim: phase ${run.phase}, attempt ${attemptNo}`) as never,
    })
    .eq("id", run.id);
  const { data: claimed } = await (run.claimed_at
    ? claimQuery.eq("claimed_at", run.claimed_at)
    : claimQuery.is("claimed_at", null)
  )
    .select("id")
    .maybeSingle();
  if (!claimed) return { worked: false, reason: "claim lost" };


  const sessionId = run.session_id;
  try {
    const { data: s, error } = await supabaseAdmin
      .from("sessions")
      .select("*")
      .eq("id", sessionId)
      .single();
    if (error || !s) throw new Error(`Harness session missing: ${error?.message}`);

    let nextPhase: Phase = run.phase as Phase;
    let note = "";

    if (!s.stage_20_output) {
      const output = await withTimeout(
        callClaude({
          systemPrompt: withPhase2Formatting(STAGE_20_MASTER_DETONATION_BRIEF_PROMPT),
          userMessage: buildStage20UserMessage(s as never),
          maxTokens: 64000,
          sessionId,
          stageLabel: "Stage 20 (harness)",
          stageNumber: "20",
          stageName: "Master Detonation Brief",
        }),
        220_000,
        "Stage 20",
      );

      await supabaseAdmin
        .from("sessions")
        .update({ stage_20_output: output, stage_20_approved: true })
        .eq("id", sessionId);
      nextPhase = "stage20b";
      note = `Stage 20 written (${output.length} chars)`;
    } else if (!s.stage_20b_output) {
      const audience =
        (s.stage_20b_audience_input as typeof DEFAULT_AUDIENCE | null) ?? DEFAULT_AUDIENCE;
      const output = await withTimeout(
        callClaude({
          systemPrompt: withPhase2Formatting(STAGE_20B_CHANNEL_STRATEGY_PROMPT),
          userMessage: buildStage20bUserMessage(s as never, audience as never),
          maxTokens: 64000,
          sessionId,
          stageLabel: "Stage 20B (harness)",
          stageNumber: "20B",
          stageName: "Channel Strategy",
        }),
        220_000,
        "Stage 20B",
      );

      await supabaseAdmin
        .from("sessions")
        .update({ stage_20b_output: output, stage_20b_audience_input: audience as never })
        .eq("id", sessionId);
      nextPhase = "stage21";
      note = `Stage 20B written (${output.length} chars)`;
    } else if (!s.stage_21_outputs || Object.keys(s.stage_21_outputs).length === 0) {
      const outputs: Record<string, string> = {};
      for (const c of HARNESS_CHANNELS) {
        outputs[c.channel] = await generateOne(
          sessionId,
          c.channel,
          c.role,
          s.stage_20b_output as string,
          s as never,
          "",
        );
      }
      await supabaseAdmin
        .from("sessions")
        .update({ stage_21_outputs: outputs as never })
        .eq("id", sessionId);
      nextPhase = "check14";
      note = `Stage 21 written for ${Object.keys(outputs).join(", ")}`;
    } else {
      const detail = assertSmpVerbatimCarriage(s.selected_smp, [
        { label: "Stage 20", output: s.stage_20_output },
        { label: "Stage 20B", output: s.stage_20b_output },
        { label: "Stage 21 (all channel briefs)", output: flattenStrings(s.stage_21_outputs) },
      ]);
      await supabaseAdmin
        .from("tier2_harness_runs")
        .update({
          phase: "done",
          status: "passed",
          result_detail: detail,
          claimed_at: null,
          log: log(run, `Check 14 runtime layer PASSED — ${detail}`) as never,
        })
        .eq("id", run.id);
      return { worked: true, phase: "done", detail };
    }

    await supabaseAdmin
      .from("tier2_harness_runs")
      .update({
        phase: nextPhase,
        claimed_at: null,
        attempts: 0,
        result_detail: note,
        log: log(run, note) as never,
      })
      .eq("id", run.id);
    return { worked: true, phase: nextPhase, note };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error && e.stack ? ` | ${e.stack.split("\n").slice(0, 4).join(" ")}` : "";
    const giveUp = attemptNo >= 6;
    await supabaseAdmin
      .from("tier2_harness_runs")
      .update({
        claimed_at: null,
        status: giveUp ? "failed" : "running",
        phase: giveUp ? "failed" : run.phase,
        result_detail: `phase ${run.phase} attempt ${attemptNo} failed: ${msg}${stack}`.slice(0, 4000),
        log: log(run, `error (attempt ${attemptNo}) at ${run.phase}: ${msg}`) as never,
      })
      .eq("id", run.id);
    return { worked: true, error: msg, attempts: attemptNo, giveUp };
  }

}
