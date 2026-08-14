// CREATIVE STIMULUS ENGINE — server-side sweep driver.
//
// The 37-lens sweep used to be driven by a `while` loop in the browser: one
// fetch per batch of three, sequentially, for ~13 batches (~7 minutes). Any
// tab close, navigation, laptop sleep, or single failed fetch killed the loop
// mid-way and left the run frozen at whatever count it had reached — the exact
// "stalled at 24/37, status still `generating`, no error recorded" failure.
//
// Generation now runs on the server inside `scheduleBackground()`, so it
// survives the client disconnecting, writes a `last_batch_at` heartbeat after
// every batch, retries transient batch failures, and marks the run `failed`
// with a real message when it genuinely cannot continue.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callClaude } from "@/lib/claude.server";
import { getLens } from "./lenses";
import {
  BIG_IDEA_SYSTEM_PROMPT,
  buildBigIdeaUserMessage,
  parseBigIdeaResponse,
  type PriorTension,
} from "./big-idea-prompt";

export type Grounding = {
  brandName: string;
  category: string;
  smp: string;
  detonationLine: string;
  truths: string;
  strategicEvidence: string;
};

/**
 * A sweep is considered abandoned when no batch has landed within this window.
 *
 * Kept deliberately short. Each background invocation now runs for a bounded
 * budget and then returns, so a healthy sweep lands a batch every ~60-90s and
 * the client re-kicks the next slice. A long window would make a genuinely
 * dead invocation look alive for minutes.
 */
export const SWEEP_STALL_MS = 150 * 1000;

/**
 * Wall-clock budget for ONE background invocation. Serverless invocations do
 * not reliably survive the ~7 minutes a full 37-lens sweep takes, which is how
 * runs ended up frozen at `generating` with nothing recorded. Each invocation
 * therefore does as much as it can inside the budget, leaves the run in a
 * resumable state, and the watching client (or the next resume call) starts
 * the following slice.
 */
const DRIVE_BUDGET_MS = 60 * 1000;

/** How many times a lens that produced nothing usable is retried on its own. */
const MAX_FAILED_RETRY_ROUNDS = 2;

export async function loadGrounding(sessionId: string): Promise<Grounding> {
  const { data, error } = await supabaseAdmin
    .from("sessions")
    .select(
      "brand_name, category, selected_smp, stage_18_detonation_line, truth_product, truth_consumer, truth_cultural, stage_1_output, stage_2_output",
    )
    .eq("id", sessionId)
    .single();
  if (error || !data) throw new Error(`Session not found: ${error?.message ?? "no row"}`);

  const truths = [
    data.truth_product ? `PRODUCT TRUTH: ${data.truth_product}` : "",
    data.truth_consumer ? `CONSUMER TRUTH: ${data.truth_consumer}` : "",
    data.truth_cultural ? `CULTURAL TRUTH: ${data.truth_cultural}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const strategicEvidence = [
    data.stage_1_output ? `ANCHORED STRATEGIC TENSION (Stage 1)\n${data.stage_1_output}` : "",
    data.stage_2_output
      ? `DISCRIMINATORS, THORPE CANDIDATES AND MOTIVATORS (Stage 2)\n${data.stage_2_output}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 14000);

  return {
    brandName: data.brand_name ?? "—",
    category: data.category ?? "—",
    smp: (data.selected_smp ?? "").trim(),
    detonationLine: (data.stage_18_detonation_line ?? "").trim(),
    truths,
    strategicEvidence,
  };
}

async function markBatchLanded(runId: string): Promise<void> {
  await supabaseAdmin
    .from("stimulus_runs")
    .update({ last_batch_at: new Date().toISOString() })
    .eq("id", runId);
}

/** Generates the next batch of pending lenses. Pure server logic, no auth. */
export async function runBigIdeaBatch(
  runId: string,
  batchSize = 3,
): Promise<{ done: boolean; generated: number; remaining: number }> {
  const { data: run, error: runErr } = await supabaseAdmin
    .from("stimulus_runs")
    .select("id, session_id, smp, creative_guidance, creative_guidance_target")
    .eq("id", runId)
    .single();
  if (runErr || !run) throw new Error("Stimulus run not found");

  const { data: pending, error } = await supabaseAdmin
    .from("stimulus_directions")
    .select("id, lens_id, generation_attempts")
    .eq("run_id", run.id)
    .eq("status", "pending")
    .order("sort_order", { ascending: true })
    .limit(batchSize);
  if (error) throw new Error(error.message);

  if (!pending || pending.length === 0) {
    await supabaseAdmin
      .from("stimulus_runs")
      .update({ status: "tissue_check", error: null })
      .eq("id", run.id);
    return { done: true, generated: 0, remaining: 0 };
  }

  const g = await loadGrounding(run.session_id);
  const lenses = pending
    .map((p) => getLens(p.lens_id))
    .filter((l): l is NonNullable<typeof l> => Boolean(l));

  // Every root tension already produced in this sweep. The in-sweep collision
  // check compares against the FULL prior set, not just this batch.
  const { data: priorRows } = await supabaseAdmin
    .from("stimulus_directions")
    .select("lens_id, lens_name, root_tension, guidance_alignment")
    .eq("run_id", run.id)
    .eq("status", "generated")
    .not("root_tension", "is", null)
    .order("sort_order", { ascending: true });
  const priorTensions: PriorTension[] = (priorRows ?? [])
    .filter((r) => (r.root_tension ?? "").trim())
    .map((r) => ({
      lensId: r.lens_id,
      lensName: r.lens_name,
      rootTension: (r.root_tension ?? "").trim(),
    }));

  // Compliance arithmetic is computed server-side from stored alignments, so
  // correction is driven by real counts rather than the model's recollection.
  const guidanceText = (run.creative_guidance ?? "").trim();
  const { count: totalLenses } = await supabaseAdmin
    .from("stimulus_directions")
    .select("id", { count: "exact", head: true })
    .eq("run_id", run.id);
  const { count: pendingTotal } = await supabaseAdmin
    .from("stimulus_directions")
    .select("id", { count: "exact", head: true })
    .eq("run_id", run.id)
    .eq("status", "pending");
  const generatedSoFar = (priorRows ?? []).length;
  const alignedSoFar = (priorRows ?? []).filter(
    (r) => (r.guidance_alignment ?? "") === "aligned",
  ).length;
  const guidance: CreativeGuidance | null = guidanceText
    ? {
        text: guidanceText,
        target: run.creative_guidance_target ?? null,
        totalLenses: totalLenses ?? 37,
        generated: generatedSoFar,
        aligned: alignedSoFar,
        remaining: Math.max((pendingTotal ?? 0) - pending.length, 0),
      }
    : null;
  // Alignment landed inside this batch counts toward the ledger for the
  // single-lens recovery and regeneration calls that follow it.
  let alignedRunning = alignedSoFar;
  let generatedRunning = generatedSoFar;
  const liveGuidance = (): CreativeGuidance | null =>
    guidance ? { ...guidance, aligned: alignedRunning, generated: generatedRunning } : null;


  // Regeneration is a LOOP, not a one-shot retry: each regenerated idea is
  // re-tested against the full prior set (including ideas accepted earlier in
  // this same batch), so a rewrite that dodges lens A but lands on lens B is
  // caught rather than waved through.
  const MAX_COLLISION_REGENS = 2;

  try {
    const raw = await callClaude({
      systemPrompt: BIG_IDEA_SYSTEM_PROMPT,
      userMessage: buildBigIdeaUserMessage({
        ...g,
        smp: run.smp || g.smp,
        lenses,
        priorTensions,
      }),
      skipUniversalWrapper: true,
      maxTokens: 8000,
      temperature: 1,
      sessionId: run.session_id,
      stageLabel: "Creative Stimulus — big idea sweep",
    });
    const parsed = parseBigIdeaResponse(raw);
    for (const p of pending) {
      let hit = parsed[p.lens_id];
      let regens = 0;
      const lens = getLens(p.lens_id);

      // A batched response occasionally drops (or truncates) one lens block.
      // That is a parse miss, not a creative failure, so the lens gets its own
      // single-lens call before it is ever recorded as failed.
      if (!hit?.idea?.trim() && lens) {
        try {
          const soloRaw = await callClaude({
            systemPrompt: BIG_IDEA_SYSTEM_PROMPT,
            userMessage: buildBigIdeaUserMessage({
              ...g,
              smp: run.smp || g.smp,
              lenses: [lens],
              priorTensions,
            }),
            skipUniversalWrapper: true,
            maxTokens: 3000,
            temperature: 1,
            sessionId: run.session_id,
            stageLabel: "Creative Stimulus — single-lens recovery",
          });
          const solo = parseBigIdeaResponse(soloRaw)[p.lens_id];
          if (solo?.idea?.trim()) hit = solo;
        } catch (soloErr) {
          console.error("[big-idea-solo]", p.lens_id, soloErr);
        }
      }

      while (
        hit?.idea?.trim() &&
        hit.collisions.length > 0 &&
        lens &&
        regens < MAX_COLLISION_REGENS
      ) {
        regens += 1;
        const note = [
          `Lens ${p.lens_id} produced an idea whose root tension was "${hit.rootTension || "(unstated)"}".`,
          `It collided with: ${hit.collisions
            .map((c) => `${c.lensId}${c.why ? ` — ${c.why}` : ""}`)
            .join("; ")}.`,
          `This is regeneration attempt ${regens} of ${MAX_COLLISION_REGENS}.`,
        ].join(" ");
        const regenRaw = await callClaude({
          systemPrompt: BIG_IDEA_SYSTEM_PROMPT,
          userMessage: buildBigIdeaUserMessage({
            ...g,
            smp: run.smp || g.smp,
            lenses: [lens],
            priorTensions,
            regenerationNote: note,
          }),
          skipUniversalWrapper: true,
          maxTokens: 3000,
          temperature: 1,
          sessionId: run.session_id,
          stageLabel: "Creative Stimulus — collision regeneration",
        });
        const again = parseBigIdeaResponse(regenRaw)[p.lens_id];
        if (!again?.idea?.trim()) break;
        hit = again;
      }

      const unresolved = (hit?.collisions ?? []).length > 0;
      await supabaseAdmin
        .from("stimulus_directions")
        .update(
          hit?.idea?.trim()
            ? {
                direction: hit.idea.trim(),
                campaign_line: hit.line || null,
                // Field 2 only exists when a master line was locked at
                // generation time. Never store a pairing without recording
                // which master line it was written against.
                expression_under_master: g.detonationLine
                  ? hit.expressionUnderMaster || null
                  : null,
                master_line_at_generation: g.detonationLine || null,
                rationale: hit.rationale || null,
                root_tension: hit.rootTension || null,
                convergence: {
                  source: "in_sweep",
                  verdict: unresolved ? "COLLIDES" : "CLEAR",
                  collidesWith: hit.collisions.map((c) => c.lensId),
                  why: hit.collisions.map((c) => c.why).filter(Boolean).join(" · "),
                  regenerations: regens,
                } as never,
                convergence_regen_count: regens,
                status: "generated",
                error: null,
              }
            : {
                status: "failed",
                error:
                  "This lens returned no usable idea after a batch pass and a single-lens retry.",
                generation_attempts:
                  ((p as { generation_attempts?: number }).generation_attempts ?? 0) + 1,
              },
        )
        .eq("id", p.id);

      if (hit?.idea?.trim() && (hit.rootTension || "").trim())
        priorTensions.push({
          lensId: p.lens_id,
          lensName: lens?.name ?? p.lens_id,
          rootTension: hit.rootTension.trim(),
        });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Big idea generation failed";
    await supabaseAdmin.from("stimulus_runs").update({ error: msg }).eq("id", run.id);
    throw e instanceof Error ? e : new Error(msg);
  }

  await markBatchLanded(run.id);

  const remaining = await countByStatus(run.id, "pending");
  if (remaining === 0) await finishOrRequeue(run.id);
  return { done: remaining === 0, generated: pending.length, remaining };
}

async function countByStatus(runId: string, status: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from("stimulus_directions")
    .select("id", { count: "exact", head: true })
    .eq("run_id", runId)
    .eq("status", status);
  return count ?? 0;
}

/**
 * A sweep is only finished when all 37 lenses hold real content. Lenses that
 * failed are put back in the queue (bounded rounds) rather than left as silent
 * empty cards — "Not generated." must never be a terminal state reached by
 * accident.
 */
async function finishOrRequeue(runId: string): Promise<void> {
  const { data: failed } = await supabaseAdmin
    .from("stimulus_directions")
    .select("id, generation_attempts")
    .eq("run_id", runId)
    .eq("status", "failed");

  const retryable = (failed ?? []).filter(
    (r) => ((r as { generation_attempts?: number }).generation_attempts ?? 0) < MAX_FAILED_RETRY_ROUNDS,
  );

  if (retryable.length > 0) {
    await supabaseAdmin
      .from("stimulus_directions")
      .update({ status: "pending", error: null })
      .in(
        "id",
        retryable.map((r) => r.id),
      );
    await supabaseAdmin
      .from("stimulus_runs")
      .update({ status: "generating", error: null, last_batch_at: new Date().toISOString() })
      .eq("id", runId);
    return;
  }

  await supabaseAdmin
    .from("stimulus_runs")
    .update({ status: "tissue_check", error: null })
    .eq("id", runId);
}

/**
 * Runs batches until every lens has generated, OR until this invocation's
 * wall-clock budget is spent — whichever comes first. A partially-completed
 * slice leaves the run `generating` with a fresh heartbeat, so the watching
 * client (or any later resume call) simply starts the next slice. Nothing
 * depends on one serverless invocation surviving the full ~7 minute sweep.
 */
export async function driveBigIdeaSweep(
  runId: string,
  batchSize = 3,
  budgetMs = DRIVE_BUDGET_MS,
): Promise<void> {
  let consecutiveFailures = 0;
  const startedAt = Date.now();
  let complete = false;

  for (let guard = 0; guard < 60; guard++) {
    if (Date.now() - startedAt > budgetMs) {
      // Budget spent mid-sweep: hand off cleanly to the next invocation.
      await markBatchLanded(runId);
      return;
    }

    // Stop if a human (or a newer drive) took the run out of `generating`.
    const { data: run } = await supabaseAdmin
      .from("stimulus_runs")
      .select("status")
      .eq("id", runId)
      .single();
    if (!run || (run.status !== "generating" && run.status !== "failed")) return;

    try {
      const { done } = await runBigIdeaBatch(runId, batchSize);
      consecutiveFailures = 0;
      if (done) {
        // `done` means no pending rows; finishOrRequeue may have re-queued
        // failed lenses, in which case the loop keeps going.
        const stillPending = await countByStatus(runId, "pending");
        if (stillPending === 0) {
          complete = true;
          break;
        }
      }
    } catch (e) {
      consecutiveFailures += 1;
      const msg = e instanceof Error ? e.message : "Batch failed";
      if (consecutiveFailures >= 3) {
        await supabaseAdmin
          .from("stimulus_runs")
          .update({
            status: "failed",
            error: `Sweep stopped after 3 consecutive batch failures — ${msg}`,
          })
          .eq("id", runId);
        return;
      }
      // Transient (model timeout / 503). Pause, keep the heartbeat fresh, retry.
      await markBatchLanded(runId);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }

  if (!complete) return;

  // Sweep complete — build the full-set convergence ledger in the same
  // background invocation so it never depends on the browser staying open.
  try {
    const { buildLedgerForRun } = await import("./convergence-ledger-run.server");
    await buildLedgerForRun(runId);
  } catch (e) {
    console.error("[big-idea-ledger]", e);
  }
}
