// Stage 20B — Channel Strategy and Audience Intelligence (RPC wrappers).
//
// The generation is long-running, so the UI starts it in the background
// (`startStage20b`) and polls `loadStage20b` until the output lands. The
// synchronous `runStage20b` is retained for the automated harnesses.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSessionAccess } from "@/lib/auth-helpers.server";
import { STAGE_20B_RUNNING, type Stage20bAudienceInput } from "./stage20b.server";

export type { Stage20bAudienceInput } from "./stage20b.server";

const STAGE_20B_STALE_MS = 8 * 60 * 1000;

const AudienceInput = z.object({
  audienceAsHumans: z.string().trim().min(1).max(8000),
  dayInTheirLife: z.string().trim().min(1).max(8000),
  influenceMap: z.string().trim().min(1).max(8000),
  decisionJourney: z.string().trim().min(1).max(8000),
  psychologicalProfile: z.string().trim().min(1).max(8000),
  channelUniverseAndBudget: z.string().trim().min(1).max(8000),
});

const RunInput = z.object({
  sessionId: z.string().uuid(),
  audienceInput: AudienceInput,
  redirect: z.string().trim().max(4000).optional(),
});

/** Kicks the channel strategy off in the background and returns immediately. */
export const startStage20b = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => RunInput.parse(i))
  .handler(async ({ data, context }) => {
    await assertSessionAccess(data.sessionId, context.userId);
    const { requireConfirmedSelection } = await import("./checkpoint-gate");
    await requireConfirmedSelection(data.sessionId, "F");

    const { loadStage20bSession, assertStage20bReady, generateStage20b } = await import(
      "./stage20b.server"
    );
    assertStage20bReady(await loadStage20bSession(data.sessionId));

    await supabaseAdmin
      .from("sessions")
      .update({
        version_reason: "rerun: stage 20b",
        version_actor: context.userId,
        stage_20b_output: null,
        stage_20b_error: STAGE_20B_RUNNING,
        stage_20b_audience_input: data.audienceInput as never,
      })
      .eq("id", data.sessionId);

    // Run the generation inside this request, not via scheduleBackground:
    // work handed to ctx.waitUntil is cancelled ~30s after the response
    // returns on this platform, which killed every Stage 20B job silently and
    // left the __STAGE_20B_RUNNING__ sentinel forever — blocking Stages 21
    // and 22 (the "Stage 22 hang"). The client polls loadStage20b while this
    // request is open; a dropped connection leaves the sentinel, which the
    // poll loop's stale-recovery path restarts.
    const output = await generateStage20b({
      sessionId: data.sessionId,
      audienceInput: data.audienceInput,
      ...(data.redirect ? { redirect: data.redirect } : {}),
    });

    return { started: true as const, output };
  });

/** Synchronous run — used by the automated Tier Two / preflight harnesses. */
export const runStage20b = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => RunInput.parse(i))
  .handler(async ({ data, context }) => {
    await assertSessionAccess(data.sessionId, context.userId);
    const { requireConfirmedSelection } = await import("./checkpoint-gate");
    await requireConfirmedSelection(data.sessionId, "F");
    const { generateStage20b } = await import("./stage20b.server");
    const output = await generateStage20b({
      sessionId: data.sessionId,
      audienceInput: data.audienceInput,
      ...(data.redirect ? { redirect: data.redirect } : {}),
    });
    return { output, audienceInput: data.audienceInput };
  });

export const loadStage20b = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ sessionId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSessionAccess(data.sessionId, context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("sessions")
      .select("stage_20b_output, stage_20b_error, stage_20b_audience_input, updated_at")
      .eq("id", data.sessionId)
      .single();
    if (error) throw new Error(error.message);
    const storedError = (row?.stage_20b_error as string | null) ?? null;
    // Prefix match: the tick claims the sentinel by appending ":claimed:<n>".
    const running = storedError?.startsWith(STAGE_20B_RUNNING) === true;
    return {
      output: (row?.stage_20b_output as string | null) ?? null,
      error: running ? null : storedError,
      running,
      stale:
        running &&
        Date.now() - Date.parse((row?.updated_at as string | null) ?? "") > STAGE_20B_STALE_MS,
      audienceInput:
        (row?.stage_20b_audience_input as Stage20bAudienceInput | null) ?? null,
    };
  });

export const saveStage20bInput = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        sessionId: z.string().uuid(),
        audienceInput: AudienceInput.partial(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertSessionAccess(data.sessionId, context.userId);
    const { error } = await supabaseAdmin
      .from("sessions")
      .update({ stage_20b_audience_input: data.audienceInput as never })
      .eq("id", data.sessionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const clearStage20b = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ sessionId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSessionAccess(data.sessionId, context.userId);
    const { error } = await supabaseAdmin
      .from("sessions")
      .update({ version_reason: "cleared: stage 20b", version_actor: context.userId, stage_20b_output: null, stage_20b_error: null } as never)
      .eq("id", data.sessionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
