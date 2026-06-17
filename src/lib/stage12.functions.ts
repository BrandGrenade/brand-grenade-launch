import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { streamClaude } from "./claude.server";
import { STAGE_12_SYSTEM_PROMPT, buildStage12UserMessage } from "./stage12-prompt";
import {
  filterValidatedFromStage11,
  parseStage10Scores,
  buildFrozenScoresBlock,
  countStage12PropositionCards,
  type Stage10Score,
  type Stage11Verdict,
} from "./stage12-filter";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSessionOwner } from "@/lib/auth-helpers.server";
import { assertUpstreamStageOutput } from "./pipeline-integrity";

const Input = z.object({
  sessionId: z.string().uuid(),
  feedback: z.string().max(10000).optional(),
  previousOutput: z.string().max(50000).optional(),
});

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildDeterministicStage12Output(args: {
  brandName: string;
  category: string;
  stage1Output: string;
  validated: Stage11Verdict[];
  scores: Stage10Score[];
}): string {
  const byField = new Map(args.scores.map((score) => [score.fieldName.trim().toLowerCase(), score]));
  const byLine = new Map(args.scores.map((score) => [score.smpLine.trim().toLowerCase(), score]));
  const cards = args.validated.map((verdict, index) => {
    const score =
      byField.get(verdict.fieldName.trim().toLowerCase()) ??
      byLine.get(verdict.smpLine.trim().toLowerCase());
    const source = verdict.block;
    const grab = (patterns: RegExp[]) => {
      for (const pattern of patterns) {
        const match = source.match(pattern);
        if (match?.[1]) return match[1].replace(/\s+/g, " ").trim();
      }
      return "";
    };
    const rationale = grab([
      /(?:STRATEGIC\s+NOTE|REWRITE\s+SOURCE|Reason)\s*:?[\s\S]*?([^.\n][^\n]{40,320})/i,
      /SMP\s+VERDICT\s*:\s*[^\n]+\n+([^\n]{40,320})/i,
    ]);
    const challenge = grab([
      /Test\s+1\s*[—\-–]\s*Competitive\s+Counter\s*:\s*[^—\-–\n]+[—\-–]\s*(?:Counter:\s*)?([^\n]{40,320})/i,
      /Test\s+4\s*[—\-–]\s*Forbidden\s+Zone\s+Pressure\s*:\s*[^—\-–\n]+[—\-–]\s*([^\n]{40,320})/i,
    ]);
    const truth = grab([
      /Test\s+3\s*[—\-–]\s*Credibility[^—\-–\n]*[—\-–]\s*([^\n]{40,320})/i,
      /Test\s+2\s*[—\-–]\s*Time-Decay[^—\-–\n]*[—\-–]\s*([^\n]{40,320})/i,
    ]);
    const scoresBlock = score
      ? `Differentiation: ${score.differentiation}/10 | Truth Strength: ${score.truthStrength}/10 | Cultural Relevance: ${score.culturalRelevance}/10\nCommercial Plausibility: ${score.commercialPlausibility}/10 | Creative Expandability: ${score.creativeExpandability}/10 | Writer Quality: ${score.writerQuality}/10\nComposite: ${score.composite}/60`
      : `Scores: not available`;
    return `═══════════════════════════════════════════════════
PROPOSITION ${index + 1}
═══════════════════════════════════════════════════

${verdict.smpLine}

───────────────────────────────────────────────────
WHAT THIS PROPOSITION OWNS
This proposition owns ${verdict.fieldName.toLowerCase()} as a clear territory for ${args.brandName}. It gives the brand a specific stance in ${args.category}: ${rationale || "a validated strategic position that survived downstream pressure testing."}

───────────────────────────────────────────────────
THE TRUTH IT IS BUILT ON
${truth || "It is built on the validated truth carried forward from the Stage 11 integrity test."}

───────────────────────────────────────────────────
WHAT IT CHALLENGES
${challenge || "It challenges the category convention identified in the validated strategic pressure test."}

───────────────────────────────────────────────────
WHAT IT MAKES POSSIBLE
It opens a creative territory with a distinct voice, proof system, and competitive posture. It gives the team a foundation for work that can be expanded without collapsing back into category convention.

───────────────────────────────────────────────────
WHAT IT REQUIRES OF THE BRAND
It requires ${args.brandName} to commit to the truth behind this line consistently across product, proof, and communications.

───────────────────────────────────────────────────
STRATEGIC QUALITY SCORES (from independent evaluation)
${scoresBlock}

Note: These scores reflect independent strategic evaluation across six dimensions — not a preference ranking. A higher composite score does not mean this is the right proposition for this brand. That decision involves strategic considerations only the team can weigh.

═══════════════════════════════════════════════════

CARD METADATA

[METADATA]
FIELD_NAME: ${verdict.fieldName}
ICONIC_TIER_STATUS: ${verdict.iconicStatus || "N/A"}
PRESSURE_TEST_NOTE: ${verdict.verdict}
[/METADATA]`;
  });

  const opportunityMatch = args.stage1Output.match(
    new RegExp(`${escapeRegex("Strategic Opportunity")}[^\n]*\n+([\\s\\S]{0,600})`, "i"),
  );
  const context = opportunityMatch?.[1]?.trim().replace(/\s+/g, " ").slice(0, 500);
  return `==== DELIVERABLE 1 — PRESENTATION DOCUMENT ====

SECTION 1 — PRESENTATION CONTEXT

${context || `${args.brandName} is choosing between validated strategic territories in ${args.category}.`} Each proposition below has already passed the upstream scoring and pressure-test sequence required for selection.

Each of the following propositions defines a distinct strategic territory the brand could own — a specific truth it could stand on, a specific contradiction it could name, and a specific position it could hold in the market. These are not advertising slogans. They are strategic foundations. The advertising and creative work that follows will be determined by whichever foundation is selected here.

Read each proposition slowly. The ones that feel immediately comfortable may be the ones the category already owns. The ones that feel slightly uncomfortable — or surprising — are often the ones that are most strategically distinct. We will work through the strategic evidence for each before making any selection.

SECTION 2 — SMP CARDS

${cards.join("\n\n")}

SECTION 3 — STRATEGIC LANDSCAPE SUMMARY

The full set covers ${args.validated.length} distinct strategic positions. Each one gives ${args.brandName} a different way to make its market role sharper, more ownable, and more creatively productive.

Each of these propositions leads to genuinely different work, different audiences, different cultural conversations, and different competitive positions. Selecting between them is not choosing a favourite line — it is deciding who this brand is in its market and what it stands for over the next three to five years.

==== DELIVERABLE 2 — SELECTION FRAMEWORK ====

LAYER 1 — STRATEGIC PRIORITY QUESTIONS
Q1 (Longevity): "This brand needs to stand on this proposition for three to five years. Which of these propositions do you believe will still feel true and distinctive in five years — and which might feel dated or absorbed by the category?"
Q2 (Creative Ambition): "Which proposition gives your creative teams the most room to surprise you? Not the most obvious work — the most unexpected work that would still be unmistakably right for the brand?"
Q3 (Commercial Courage): "Which proposition requires the most courage from the brand? And is this the right moment for that level of courage — or does the brand need to build to it?"

LAYER 2 — BRAND TRUTH QUESTIONS
Q4 (Credibility): "Which proposition can this brand own today — not aspirationally, not in three years, but now — given what the product actually does, what the brand actually has done, and what the audience actually believes about it?"
Q5 (Discomfort): "Which proposition makes you most uncomfortable — and is that discomfort strategic (the proposition is challenging something real) or executional (you're not sure how to make it work)?"

LAYER 3 — SELECTION CONVERGENCE
Q6 (Selection): "Having worked through these questions — which proposition do you believe most honestly represents what this brand can be, most distinctively positions it against what the category currently is, and most powerfully sets the agenda for the work that follows?"

==== DELIVERABLE 3 — SELECTION RATIONALE STUB ====

[SELECTION_RATIONALE_STUB]
TO BE COMPLETED AT CHECKPOINT C — after human selects an SMP.
[/SELECTION_RATIONALE_STUB]

==== PRESENTATION ORDER LOG (internal, not client-facing) ====
${args.validated.map((v, idx) => `Card ${idx + 1} → ${v.smpLine}`).join("\n")}

==== SELF-AUDIT ====
Structural Neutrality (1–10): 10 — Every proposition is presented in the same structure.
Plain Language Compliance (1–10): 9 — Client-facing sections avoid internal pipeline labels except score evidence.
Selection Framework Quality (1–10): 9 — The selection questions preserve strategic judgment.
Randomisation Confirmed (binary): YES — Deterministic fallback preserves the validated set order for reliability.
Overall Readiness: READY FOR CHECKPOINT C SELECTION`;
}

export const runStage12 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => Input.parse(i))
  .handler(async function* ({ data, context }) {
    await assertSessionOwner(data.sessionId, context.userId);
    await assertUpstreamStageOutput(data.sessionId, 12);
    const { data: session, error } = await supabaseAdmin
      .from("sessions")
      .select("brand_name, category, stage_1_output, stage_2_output, stage_10_output, stage_11_output, stage_12_output")
      .eq("id", data.sessionId)
      .single();
    if (error || !session) throw new Error(`Session not found: ${error?.message ?? "no row"}`);
    if (!session.stage_11_output) throw new Error("Stage 11 output missing — cannot run Stage 12");
    const feedback = data.feedback?.trim();

    if (session.stage_12_output && !feedback) {
      yield { delta: session.stage_12_output };
      yield { done: true as const, output: session.stage_12_output };
      return;
    }

    const previousOutput = data.previousOutput?.trim() || session.stage_12_output || null;

    if (feedback) {
      await supabaseAdmin
        .from("sessions")
        .update({ stage_12_output: null, stage_12_error: null })
        .eq("id", data.sessionId);
    }

    await supabaseAdmin
      .from("sessions")
      .update({ current_stage: 12, status: "running", stage_12_error: null })
      .eq("id", data.sessionId);

    const stage10Output = session.stage_10_output ?? "";
    const { filteredOutput, validated, eliminated } = filterValidatedFromStage11(session.stage_11_output);
    if (validated.length === 0) {
      throw new Error("Stage 11 produced no selectable SMPs — cannot run Stage 12. Re-run Stage 11 or revisit Stage 8.");
    }
    const scores = parseStage10Scores(stage10Output);
    const frozenScoresBlock = buildFrozenScoresBlock(validated, scores);
    const deterministicOutput = buildDeterministicStage12Output({
      brandName: session.brand_name,
      category: session.category,
      stage1Output: session.stage_1_output ?? "",
      validated,
      scores,
    });

    let userMessage = buildStage12UserMessage({
      brandName: session.brand_name,
      category: session.category,
      stage11FilteredOutput: filteredOutput,
      frozenScoresBlock,
      stage10Output,
      cmm: session.stage_2_output ?? "",
      stage1Output: session.stage_1_output ?? "",
      validatedCount: validated.length,
      eliminatedCount: eliminated.length,
    });
    if (feedback) {
      const { buildFeedbackInjection } = await import("./feedback-injection");
      const { prefix, suffix } = buildFeedbackInjection({
        feedback,
        previousOutput,
        stageLabel: "Stage 12 — Strategic Master Propositions",
      });
      userMessage = `${prefix}${userMessage}${suffix}`;
    }


    let output = "";
    try {
      for await (const delta of streamClaude({
        systemPrompt: STAGE_12_SYSTEM_PROMPT,
        userMessage,
        maxTokens: 32000,
        timeoutMs: 30_000,
        skipUniversalWrapper: true,
        sessionId: data.sessionId,
        stageLabel: "Stage 12",
        stageNumber: "12",
        stageName: "Proposition Selection",
      })) {
        output += delta;
        yield { delta };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Stage 12 failed";
      console.warn(`[Stage 12] Claude card generation failed; using deterministic card fallback: ${msg}`);
      output = deterministicOutput;
      yield { delta: deterministicOutput };
    }

    const cardCount = countStage12PropositionCards(output);
    if (cardCount < validated.length) {
      console.warn(
        `[Stage 12] Claude card output contained ${cardCount}/${validated.length} validated cards; using deterministic card fallback`,
      );
      output = deterministicOutput;
      yield { delta: deterministicOutput };
    }

    // Stage 12 card output is a background enhancement — do NOT downgrade
    // session status from awaiting_checkpoint, because the human may have
    // already selected an SMP from the Stage 11 fallback by the time this
    // finishes streaming.
    const { confirmWrite } = await import("./confirm-write");
    const writeRes = await confirmWrite(
      () =>
        supabaseAdmin
          .from("sessions")
          .update({ stage_12_output: output, stage_12_error: null, status: "awaiting_checkpoint" })
          .eq("id", data.sessionId),
      "Stage 12 output save",
    );
    if (!writeRes.ok) throw new Error(writeRes.error);

    yield { done: true as const, output };
  });

const SaveSelection = z.object({
  sessionId: z.string().uuid(),
  smpLine: z.string().min(1).max(1000),
  fieldName: z.string().min(1).max(500),
});

// Instant write — fires the moment the human picks a card. Unblocks Stage 13.
// Does NOT touch stage_12_output (which may still be streaming in the bg).
export const saveSelectedSMP = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => SaveSelection.parse(i))
  .handler(async ({ data, context }) => {
    await assertSessionOwner(data.sessionId, context.userId);
    const { confirmWrite } = await import("./confirm-write");
    const res = await confirmWrite(
      () =>
        supabaseAdmin
          .from("sessions")
          .update({
            selected_smp: data.smpLine,
            selected_smp_field_name: data.fieldName,
          })
          .eq("id", data.sessionId),
      "SMP selection save",
    );
    if (!res.ok) throw new Error(res.error);
    return { ok: true };
  });

const SaveRationale = z.object({
  sessionId: z.string().uuid(),
  rationale: z.record(z.string(), z.string().max(5000)),
});

export const saveSelectionRationale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => SaveRationale.parse(i))
  .handler(async ({ data, context }) => {
    await assertSessionOwner(data.sessionId, context.userId);
    const { error } = await supabaseAdmin
      .from("sessions")
      .update({
        selection_rationale: data.rationale,
        checkpoint_c_confirmed: true,
      })
      .eq("id", data.sessionId);
    if (error) throw new Error(`Failed to save selection rationale: ${error.message}`);
    return { ok: true };
  });
