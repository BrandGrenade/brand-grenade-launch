// FULL CREATIVE SHOWCASE — the single campaign presentation.
//
// Not a bundle of per-channel exports. One payload with four parts:
//   1. The Foundation      — locked idea, campaign line, why it wins.
//   2. The Six Expressions — each channel as an expression of the foundation,
//                            with the Campaign Signature Registry elements it
//                            actually carries called out.
//   3. Proof of Coherence  — the Orchestration Engine's real CD verdict.
//   4. Full detail         — content creation input prompts + offline briefs.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSessionAccess } from "@/lib/auth-helpers.server";
import { cleanProposition } from "@/lib/clean-proposition";
import { sameTextAuthority } from "@/lib/document-source-authority";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;
const db = supabaseAdmin as unknown as { from: (t: string) => any };

export type ShowcaseSignature = {
  category: string;
  name: string;
  description: string;
  status: string;
};

export type ShowcaseChannel = {
  channelName: string;
  adaptation: string;
  offlineBrief: string | null;
  generatedAt: string | null;
  gateOneConfirmed: boolean;
  fidelity: { verdict: string; score: number; reasoning: string; lineVerbatim: boolean } | null;
  carries: { name: string; category: string; description: string; evidence: string }[];
  crossRefs: { suggestion: string; rationale: string }[];
  cdNote: string | null;
};

export type CreativeShowcase = {
  brandName: string;
  category: string;
  smp: string;
  detonationLine: string;
  foundation: {
    idea: string;
    line: string;
    lens: string | null;
    lockedAt: string | null;
    instinctBrief: string | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ratings: any;
    ratingTotal: number | null;
  };
  signatures: ShowcaseSignature[];
  channels: ShowcaseChannel[];
  coherence: {
    hasOrchestration: boolean;
    cdStatus: string | null;
    cdOutput: string;
    registryVersion: number | null;
    gateTwoConfirmed: boolean;
    gateTwoConfirmedAt: string | null;
    gateTwoNotes: string | null;
    rejected: { channelName: string; lensName: string; reason: string; at: string | null }[];
  };
};

/** Tokens worth matching for a signature — the distinctive words in its name. */
function signatureTokens(name: string): string[] {
  return name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4 && !STOP.has(w));
}
const STOP = new Set([
  "the", "and", "with", "that", "this", "from", "into", "your", "their", "brand",
  "campaign", "line", "idea", "signature", "element", "motif", "rule",
]);

/**
 * Evidence that a channel genuinely carries a registry signature. Strict on
 * purpose — a weak keyword coincidence would turn the coherence claim into
 * decoration. Full-name match scores highest; otherwise most of the
 * distinctive words must be present.
 */
function evidenceFor(text: string, name: string): { evidence: string; strength: number } | null {
  const tokens = signatureTokens(name);
  if (tokens.length === 0) return null;
  const lower = text.toLowerCase();
  const full = name.toLowerCase();
  if (lower.includes(full)) {
    const i = lower.indexOf(full);
    return { evidence: text.slice(Math.max(0, i - 90), i + full.length + 110).trim(), strength: 100 };
  }
  const hits = tokens.filter((t) => lower.includes(t));
  const ratio = hits.length / tokens.length;
  if (hits.length < 2 || ratio < 0.6) return null;
  const i = lower.indexOf(hits[0]);
  return { evidence: text.slice(Math.max(0, i - 90), i + 160).trim(), strength: Math.round(ratio * 90) };
}


export const getCreativeShowcase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ sessionId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<CreativeShowcase> => {
    await assertSessionAccess(data.sessionId, context.userId);

    const { data: session } = await db
      .from("sessions")
      .select(
        "brand_name, category, selected_smp, stage_18_detonation_line, locked_big_idea, locked_campaign_line, locked_big_idea_lens, locked_big_idea_at, locked_big_idea_run_id",
      )
      .eq("id", data.sessionId)
      .single();
    if (!session?.locked_big_idea?.trim())
      throw new Error("No winning idea is locked for this session yet.");

    // The run and winning directions are authoritative. sessions.locked_* is
    // only a denormalised cache and may lag a re-lock.
    let authoritativeIdea = session.locked_big_idea as string;
    let authoritativeLine = (session.locked_campaign_line as string) ?? "";
    let authoritativeLens = (session.locked_big_idea_lens as string) ?? null;
    let authoritativeLockedAt = (session.locked_big_idea_at as string) ?? null;

    // ---------------------------------------------------------- foundation
    let instinctBrief: string | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let ratings: any = null;
    if (session.locked_big_idea_run_id) {
      const { data: run } = await db
        .from("stimulus_runs")
        .select("session_id, winning_direction_id, winning_line_direction_id, winning_line, locked_at")
        .eq("id", session.locked_big_idea_run_id)
        .eq("session_id", data.sessionId)
        .maybeSingle();
      if (run?.winning_direction_id) {
        const { data: dir } = await db
          .from("stimulus_directions")
          .select("run_id, direction, lens_name, instinct_brief, ratings")
          .eq("id", run.winning_direction_id)
          .eq("run_id", session.locked_big_idea_run_id)
          .maybeSingle();
        instinctBrief = (dir?.instinct_brief as string) ?? null;
        ratings = dir?.ratings ?? null;
        authoritativeIdea = (dir?.direction as string) ?? authoritativeIdea;
        authoritativeLens = (dir?.lens_name as string) ?? authoritativeLens;
        authoritativeLockedAt = (run.locked_at as string) ?? authoritativeLockedAt;
        if (run.winning_line_direction_id) {
          const { data: lineDir } = await db
            .from("stimulus_directions")
            .select("run_id, campaign_line")
            .eq("id", run.winning_line_direction_id)
            .eq("run_id", session.locked_big_idea_run_id)
            .maybeSingle();
          authoritativeLine =
            (lineDir?.campaign_line as string) ??
            (run.winning_line as string) ??
            authoritativeLine;
        }
      }
    }
    let ratingTotal: number | null = null;
    if (ratings && typeof ratings === "object") {
      const scores = Object.values(ratings as AnyRow)
        .filter((v) => v && typeof v === "object" && typeof (v as AnyRow).score === "number")
        .map((v) => (v as AnyRow).score as number);
      if (scores.length) ratingTotal = scores.reduce((a, b) => a + b, 0);
    }

    // ------------------------------------------------------------ channels
    const { data: runs } = await db
      .from("stimulus_runs")
      .select("id, channel_name, run_mode, gate_one_confirmed, created_at, locked_big_idea_at_generation, locked_line_at_generation")
      .eq("session_id", data.sessionId)
      .in("run_mode", ["channel_adaptation", "offline_creative_brief"])
      .order("created_at", { ascending: false });
    const allRuns = (runs ?? []) as AnyRow[];

    const newestAdapt = new Map<string, AnyRow>();
    const newestBrief = new Map<string, AnyRow>();
    for (const r of allRuns) {
      if (
        !sameTextAuthority(r.locked_big_idea_at_generation as string | null, authoritativeIdea) ||
        !sameTextAuthority(r.locked_line_at_generation as string | null, authoritativeLine)
      ) continue;
      const bucket = r.run_mode === "channel_adaptation" ? newestAdapt : newestBrief;
      if (!bucket.has(r.channel_name)) bucket.set(r.channel_name, r);
    }

    const runIds = [...newestAdapt.values(), ...newestBrief.values()].map((r) => r.id as string);
    const { data: dirs } = runIds.length
      ? await db
          .from("stimulus_directions")
          .select("run_id, direction, line_check, sort_order")
          .in("run_id", runIds)
      : { data: [] };
    const textByRun = new Map<string, AnyRow>();
    for (const d of ((dirs ?? []) as AnyRow[])) {
      if (!textByRun.has(d.run_id)) textByRun.set(d.run_id, d);
    }

    // --------------------------------------------------------- coherence
    const { data: orchs } = await db
      .from("stimulus_orchestrations")
      .select("*")
      .eq("session_id", data.sessionId)
      .order("updated_at", { ascending: false });
    const orchRows = (orchs ?? []) as AnyRow[];
    const orch = orchRows.find((o) => o.gate_two_confirmed) ?? orchRows[0] ?? null;

    let signatures: ShowcaseSignature[] = [];
    let promptRows: AnyRow[] = [];
    let crossRefRows: AnyRow[] = [];
    if (orch) {
      const [{ data: sigs }, { data: prompts }, { data: refs }] = await Promise.all([
        db.from("stimulus_signatures").select("*").eq("orchestration_id", orch.id),
        db.from("stimulus_prompts").select("*").eq("orchestration_id", orch.id),
        db.from("stimulus_cross_refs").select("*").eq("orchestration_id", orch.id),
      ]);
      signatures = ((sigs ?? []) as AnyRow[]).map((s) => ({
        category: s.category as string,
        name: s.name as string,
        description: (s.description as string) ?? "",
        status: (s.status as string) ?? "active",
      }));
      promptRows = (prompts ?? []) as AnyRow[];
      crossRefRows = ((refs ?? []) as AnyRow[]).filter((c) => c.status === "accepted");
    }
    const promptByChannel = new Map<string, AnyRow>();
    for (const p of promptRows) if (!promptByChannel.has(p.channel_name)) promptByChannel.set(p.channel_name, p);

    const channels: ShowcaseChannel[] = [];
    for (const [channelName, run] of newestAdapt) {
      const d = textByRun.get(run.id as string);
      const adaptation = ((d?.direction as string) ?? "").trim();
      if (!adaptation) continue;
      const briefRun = newestBrief.get(channelName);
      const offlineBrief = briefRun
        ? (((textByRun.get(briefRun.id as string)?.direction as string) ?? "").trim() || null)
        : null;
      const lc = d?.line_check as AnyRow | null;
      const fidelity =
        lc && lc.kind === "channel_adaptation_fidelity"
          ? {
              verdict: String(lc.verdict ?? ""),
              score: Number(lc.score ?? 0),
              reasoning: String(lc.reasoning ?? ""),
              lineVerbatim: Boolean(lc.lineVerbatim ?? lc.line_verbatim),
            }
          : null;

      const haystack = `${adaptation}\n${offlineBrief ?? ""}`;
      const carries = signatures
        .map((s) => {
          const hit = evidenceFor(haystack, s.name);
          return hit
            ? {
                name: s.name,
                category: s.category,
                description: s.description,
                evidence: hit.evidence,
                strength: hit.strength,
              }
            : null;
        })
        .filter((v): v is NonNullable<typeof v> => v !== null)
        .sort((a, b) => b.strength - a.strength)
        .slice(0, 6)
        .map(({ strength: _s, ...rest }) => rest);


      const prompt = promptByChannel.get(channelName);
      channels.push({
        channelName,
        adaptation,
        offlineBrief,
        generatedAt: (run.created_at as string) ?? null,
        gateOneConfirmed: Boolean(run.gate_one_confirmed),
        fidelity,
        carries,
        crossRefs: crossRefRows
          .filter((c) => prompt && c.prompt_id === prompt.id)
          .map((c) => ({ suggestion: c.suggestion as string, rationale: (c.rationale as string) ?? "" })),
        cdNote: prompt ? ((prompt.cd_note as string) ?? null) : null,
      });
    }
    channels.sort((a, b) => a.channelName.localeCompare(b.channelName));

    return {
      brandName: (session.brand_name as string) ?? "—",
      category: (session.category as string) ?? "—",
      smp: cleanProposition(session.selected_smp as string | null),
      detonationLine: (session.stage_18_detonation_line as string) ?? "",
      foundation: {
         idea: authoritativeIdea,
         line: authoritativeLine,
         lens: authoritativeLens,
         lockedAt: authoritativeLockedAt,
        instinctBrief,
        ratings,
        ratingTotal,
      },
      signatures,
      channels,
      coherence: {
        hasOrchestration: Boolean(orch),
        cdStatus: orch ? ((orch.cd_status as string) ?? null) : null,
        cdOutput: orch ? ((orch.cd_output as string) ?? "") : "",
        registryVersion: orch ? ((orch.registry_version as number) ?? null) : null,
        gateTwoConfirmed: Boolean(orch?.gate_two_confirmed),
        gateTwoConfirmedAt: orch?.gate_two_confirmed_at ?? null,
        gateTwoNotes: orch ? ((orch.gate_two_notes as string) ?? null) : null,
        rejected: promptRows
          .filter((p) => p.status !== "active")
          .map((p) => ({
            channelName: p.channel_name as string,
            lensName: (p.lens_name as string) ?? "",
            reason: (p.rejected_reason as string) ?? "",
            at: p.rejected_at ?? null,
          })),
      },
    };
  });
