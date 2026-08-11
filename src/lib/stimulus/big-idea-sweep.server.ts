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

/** A sweep is considered abandoned when no batch has landed within this window. */
export const SWEEP_STALL_MS = 4 * 60 * 1000;

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
    .select("id, session_id, smp")
    .eq("id", runId)
    .single();
  if (runErr || !run) throw new Error("Stimulus run not found");

  const { data: pending, error } = await supabaseAdmin
    .from("stimulus_directions")
    .select("id, lens_id")
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
    .select("lens_id, lens_name, root_tension")
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
            : { status: "failed", error: "Lens produced no parseable big idea" },
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

  const { count } = await supabaseAdmin
    .from("stimulus_directions")
    .select("id", { count: "exact", head: true })
    .eq("run_id", run.id)
    .eq("status", "pending");
  const remaining = count ?? 0;
  if (remaining === 0)
    await supabaseAdmin
      .from("stimulus_runs")
      .update({ status: "tissue_check", error: null })
      .eq("id", run.id);
  return { done: remaining === 0, generated: pending.length, remaining };
}

/**
 * Runs batches until every lens has generated. Survives client disconnects
 * because the caller schedules it with `scheduleBackground()`.
 */
export async function driveBigIdeaSweep(runId: string, batchSize = 3): Promise<void> {
  let consecutiveFailures = 0;

  for (let guard = 0; guard < 60; guard++) {
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
      if (done) break;
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

  // Sweep complete — build the full-set convergence ledger in the same
  // background invocation so it never depends on the browser staying open.
  try {
    const { buildLedgerForRun } = await import("./convergence-ledger-run.server");
    await buildLedgerForRun(runId);
  } catch (e) {
    console.error("[big-idea-ledger]", e);
  }
}
