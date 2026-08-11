// CREATIVE STIMULUS ENGINE — BIG IDEA SWEEP (architecture revision).
//
// Sequence: ONE 37-lens sweep per session, run against the verbatim SMP before
// any channel brief exists → Tissue Check → Gate One → one winning idea and
// one winning line locked → only then channel-specific briefs.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSessionAccess } from "@/lib/auth-helpers.server";
import { callClaude } from "./claude.server";
import { STIMULUS_LENSES, getLens } from "./stimulus/lenses";
import {
  BIG_IDEA_SYSTEM_PROMPT,
  buildBigIdeaUserMessage,
  parseBigIdeaResponse,
  type PriorTension,
} from "./stimulus/big-idea-prompt";

export const BIG_IDEA_CHANNEL_LABEL = "Campaign big idea (pre-channel)";

type Grounding = {
  brandName: string;
  category: string;
  smp: string;
  detonationLine: string;
  truths: string;
  strategicEvidence: string;
};

async function loadGrounding(sessionId: string): Promise<Grounding> {
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

async function assertRunAccess(runId: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from("stimulus_runs")
    .select("id, session_id, run_mode, smp, status")
    .eq("id", runId)
    .single();
  if (error || !data) throw new Error("Stimulus run not found");
  await assertSessionAccess(data.session_id, userId);
  return data as { id: string; session_id: string; run_mode: string; smp: string; status: string };
}

/** Starts (or reuses) the session's single pre-channel big idea sweep. */
export const startBigIdeaRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ sessionId: z.string().uuid(), force: z.boolean().default(false) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertSessionAccess(data.sessionId, context.userId);
    const g = await loadGrounding(data.sessionId);
    if (!g.smp)
      throw new Error(
        "This session has no approved SMP yet. The big idea sweep answers the SMP verbatim — select one in the Strategy Pipeline first.",
      );

    if (!data.force) {
      const { data: existing } = await supabaseAdmin
        .from("stimulus_runs")
        .select("id")
        .eq("session_id", data.sessionId)
        .eq("run_mode", "big_idea")
        .order("created_at", { ascending: false })
        .limit(1);
      if (existing && existing.length > 0) return { runId: existing[0].id, reused: true as const };
    }

    const { data: run, error: runErr } = await supabaseAdmin
      .from("stimulus_runs")
      .insert({
        session_id: data.sessionId,
        created_by: context.userId,
        run_mode: "big_idea",
        channel_name: BIG_IDEA_CHANNEL_LABEL,
        channel_brief: "",
        smp: g.smp,
        status: "generating",
      })
      .select("id")
      .single();
    if (runErr || !run) throw new Error(`Failed to create big idea run: ${runErr?.message}`);

    const rows = STIMULUS_LENSES.map((l, i) => ({
      run_id: run.id,
      lens_id: l.id,
      lens_name: l.name,
      sort_order: i,
      status: "pending",
    }));
    const { error: dErr } = await supabaseAdmin.from("stimulus_directions").insert(rows);
    if (dErr) throw new Error(`Failed to seed lenses: ${dErr.message}`);

    return { runId: run.id, reused: false as const };
  });

/** Generates the next batch of pending lenses for a big idea run. */
export const generateBigIdeaBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({ runId: z.string().uuid(), batchSize: z.number().int().min(1).max(6).default(3) })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const run = await assertRunAccess(data.runId, context.userId);

    const { data: pending, error } = await supabaseAdmin
      .from("stimulus_directions")
      .select("id, lens_id")
      .eq("run_id", run.id)
      .eq("status", "pending")
      .order("sort_order", { ascending: true })
      .limit(data.batchSize);
    if (error) throw new Error(error.message);

    if (!pending || pending.length === 0) {
      await supabaseAdmin
        .from("stimulus_runs")
        .update({ status: "tissue_check", error: null })
        .eq("id", run.id);
      return { done: true as const, generated: 0, remaining: 0 };
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

        while (hit?.idea?.trim() && hit.collisions.length > 0 && lens && regens < MAX_COLLISION_REGENS) {
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
  });

/** Independent on-strategy check across every campaign line in the run. */
export const checkBigIdeaLines = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ runId: z.string().uuid(), recheck: z.boolean().default(false) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const run = await assertRunAccess(data.runId, context.userId);
    const g = await loadGrounding(run.session_id);

    const { data: rows, error } = await supabaseAdmin
      .from("stimulus_directions")
      .select("id, lens_name, campaign_line, line_check")
      .eq("run_id", run.id)
      .not("campaign_line", "is", null);
    if (error) throw new Error(error.message);

    const todo = (rows ?? [])
      .filter((r) => (r.campaign_line ?? "").trim() && (data.recheck || !r.line_check))
      .map((r) => ({ id: r.id, lensName: r.lens_name, line: (r.campaign_line ?? "").trim() }));
    if (todo.length === 0) return { checked: 0 };

    const { checkCampaignLines } = await import("./stimulus/line-check.server");
    let checked = 0;
    for (let i = 0; i < todo.length; i += 12) {
      const slice = todo.slice(i, i + 12);
      const result = await checkCampaignLines({
        sessionId: run.session_id,
        brandName: g.brandName,
        category: g.category,
        smp: run.smp || g.smp,
        lines: slice,
      });
      for (const [id, check] of Object.entries(result)) {
        await supabaseAdmin
          .from("stimulus_directions")
          .update({ line_check: check as never })
          .eq("id", id);
        checked += 1;
      }
    }
    return { checked };
  });

/** Locks exactly one winning idea and one winning line for the whole campaign. */
export const lockWinningIdea = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        runId: z.string().uuid(),
        directionId: z.string().uuid(),
        lineDirectionId: z.string().uuid(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const run = await assertRunAccess(data.runId, context.userId);

    const { data: rows, error } = await supabaseAdmin
      .from("stimulus_directions")
      .select("id, lens_name, direction, campaign_line")
      .eq("run_id", run.id)
      .in("id", [data.directionId, data.lineDirectionId]);
    if (error) throw new Error(error.message);
    const idea = rows?.find((r) => r.id === data.directionId);
    const lineRow = rows?.find((r) => r.id === data.lineDirectionId);
    if (!idea) throw new Error("Winning idea not found in this run");
    if (!lineRow?.campaign_line?.trim()) throw new Error("Chosen line is empty");

    const lockedAt = new Date().toISOString();
    const { error: rErr } = await supabaseAdmin
      .from("stimulus_runs")
      .update({
        winning_direction_id: idea.id,
        winning_line_direction_id: lineRow.id,
        winning_line: lineRow.campaign_line.trim(),
        locked_at: lockedAt,
        status: "idea_locked",
      })
      .eq("id", run.id);
    if (rErr) throw new Error(rErr.message);

    const { error: sErr } = await supabaseAdmin
      .from("sessions")
      .update({
        locked_big_idea: idea.direction ?? "",
        locked_campaign_line: lineRow.campaign_line.trim(),
        locked_big_idea_lens: idea.lens_name,
        locked_big_idea_at: lockedAt,
        locked_big_idea_run_id: run.id,
      })
      .eq("id", run.session_id);
    if (sErr) throw new Error(sErr.message);

    return {
      lockedAt,
      line: lineRow.campaign_line.trim(),
      lens: idea.lens_name,
      pairedFromOtherLens: lineRow.id !== idea.id,
    };
  });

export const unlockWinningIdea = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ runId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const run = await assertRunAccess(data.runId, context.userId);
    await supabaseAdmin
      .from("stimulus_runs")
      .update({
        winning_direction_id: null,
        winning_line_direction_id: null,
        winning_line: null,
        locked_at: null,
        status: "tissue_check",
      })
      .eq("id", run.id);
    await supabaseAdmin
      .from("sessions")
      .update({
        locked_big_idea: null,
        locked_campaign_line: null,
        locked_big_idea_lens: null,
        locked_big_idea_at: null,
        locked_big_idea_run_id: null,
      })
      .eq("id", run.session_id);
    return { ok: true };
  });
