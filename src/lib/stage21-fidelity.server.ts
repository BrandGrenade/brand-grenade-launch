// CHANNEL FIDELITY CHECK
//
// Holds every generated Stage 21 channel brief against the decided Lead
// locked campaign big idea and reports drift BEFORE the briefs reach
// any downstream consumer — the Creative Stimulus Engine in particular.
//
// Same discipline as the Lens Fidelity check in the stimulus layer: it does
// not rewrite anything, it judges and flags.

import { callClaude } from "./claude.server";

export type {
  FidelityVerdict,
  ChannelFidelityResult,
  FidelityReport,
} from "./stage21-fidelity-types";
import type {
  FidelityVerdict,
  ChannelFidelityResult,
  FidelityReport,
} from "./stage21-fidelity-types";

const FIDELITY_SYSTEM = `You are the Executive Creative Director's fidelity check.

A single Lead Creative Expression has been decided for this campaign. Every channel brief is required to ADAPT that decided idea to its own moment and medium. No channel brief is permitted to independently reinterpret the proposition.

You are given the Lead Creative Expression and ONE channel brief. Judge only one thing: has this brief adapted the decided idea, or has it gone off and interpreted the proposition for itself?

Judge MEANING, not vocabulary. A brief that repeats the proposition's words while inverting its meaning is a failure, not a pass. The Lead Creative Expression names a specific misreading the system must never make — if this brief has slid into that misreading, that is a break regardless of how well written it is.

Verdicts:
- "pass" — the brief is a faithful adaptation. The feeling at the end, the meaning, and the non-negotiables survive.
- "drift" — recognisably the same idea, but weakened, narrowed, or partially reinterpreted. Fixable with a rewrite of specific sections.
- "break" — the brief is executing a different idea, or has landed in the named misreading. It must not propagate.

Be strict. A brief that is merely strategically consistent with the proposition but is not adapting THIS idea is at best a drift.

Return ONLY a JSON object, no prose, no code fences:
{
  "verdict": "pass" | "drift" | "break",
  "score": 0-10,
  "reasoning": "two to four sentences, plain language, specific and quotable",
  "missing": ["exact text of each non-negotiable this brief fails to carry"],
  "misreading_evidence": "quote or describe where the brief slid into the named misreading, or empty string if it did not"
}`;

function extractJson<T>(text: string): T {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("Fidelity check returned no JSON object");
  return JSON.parse(text.slice(start, end + 1)) as T;
}

function clampScore(n: unknown): number {
  const v = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return Math.max(0, Math.min(10, Math.round(v)));
}

async function checkOne(args: {
  sessionId: string;
  channel: string;
  brief: string;
  leadExpression: string;
}): Promise<ChannelFidelityResult> {
  const checkedAt = new Date().toISOString();
  try {
    const text = await callClaude({
      systemPrompt: FIDELITY_SYSTEM,
      userMessage: [
        "THE DECIDED LEAD CREATIVE EXPRESSION — the thing every channel must adapt",
        args.leadExpression.trim(),
        "",
        "————",
        "",
        `CHANNEL BRIEF UNDER REVIEW — ${args.channel}`,
        args.brief.trim(),
      ].join("\n"),
      maxTokens: 2000,
      sessionId: args.sessionId,
      stageLabel: `Fidelity check (${args.channel})`,
      stageNumber: "21F",
      stageName: "Channel Fidelity Check",
    });
    const p = extractJson<{
      verdict?: string;
      score?: number;
      reasoning?: string;
      missing?: unknown;
      misreading_evidence?: string;
    }>(text);
    const verdict: FidelityVerdict =
      p.verdict === "break" ? "break" : p.verdict === "drift" ? "drift" : "pass";
    return {
      channel: args.channel,
      verdict,
      score: clampScore(p.score),
      reasoning: (p.reasoning ?? "").trim(),
      missing: Array.isArray(p.missing)
        ? p.missing.filter((m): m is string => typeof m === "string" && m.trim().length > 0)
        : [],
      misreadingEvidence: (p.misreading_evidence ?? "").trim(),
      checkedAt,
    };
  } catch (e) {
    // A failed check must never silently read as a pass.
    return {
      channel: args.channel,
      verdict: "drift",
      score: 0,
      reasoning: `Fidelity check could not complete: ${
        e instanceof Error ? e.message : String(e)
      }. Treat this brief as unverified.`,
      missing: [],
      misreadingEvidence: "",
      checkedAt,
    };
  }
}

/**
 * Runs the fidelity check over every channel brief. Sequential, to stay inside
 * the same rate-limit envelope Stage 21 generation already respects.
 */
export async function runChannelFidelityCheck(args: {
  sessionId: string;
  leadExpression: string | null;
  outputs: Record<string, string>;
}): Promise<FidelityReport> {
  const checkedAt = new Date().toISOString();
  let lead = args.leadExpression?.trim() ?? "";

  // Standard: the Creative Stimulus sweep's locked big idea and campaign line
  // ARE the thing every channel must adapt (this replaced the retired Stage
  // 20L Lead Creative Expression). leadExpression is only ever passed
  // explicitly for legacy sessions.
  if (!lead) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: s } = await supabaseAdmin
      .from("sessions")
      .select("locked_big_idea, locked_campaign_line, locked_big_idea_lens")
      .eq("id", args.sessionId)
      .single();
    if (s?.locked_big_idea?.trim()) {
      lead = [
        `LOCKED CAMPAIGN BIG IDEA (Creative Stimulus sweep, lens: ${s.locked_big_idea_lens ?? "—"})`,
        s.locked_big_idea.trim(),
        "",
        "LOCKED CAMPAIGN LINE — every channel brief must carry this line verbatim:",
        (s.locked_campaign_line ?? "").trim() || "—",
      ].join("\n");
    }
  }

  if (!lead) {
    return {
      checkedAt,
      leadExpressionPresent: false,
      results: Object.keys(args.outputs).map((channel) => ({
        channel,
        verdict: "drift" as const,
        score: 0,
        reasoning:
          "No campaign big idea is locked for this session, so these briefs each interpreted the proposition independently. Lock one in the Creative Stimulus Engine, then regenerate.",
        missing: [],
        misreadingEvidence: "",
        checkedAt,
      })),
    };
  }

  const results: ChannelFidelityResult[] = [];
  for (const [channel, brief] of Object.entries(args.outputs)) {
    results.push(
      await checkOne({ sessionId: args.sessionId, channel, brief, leadExpression: lead }),
    );
    await new Promise((r) => setTimeout(r, 1000));
  }
  return { checkedAt, leadExpressionPresent: true, results };
}
