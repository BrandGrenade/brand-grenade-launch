// Item 6 — Route LOC candidates through the SAME Stage 9 distinctiveness /
// ownership logic the Funnel (Stage 8) output already passes through.
//
// Shape: BATCHED, not one enlarged call. LOC candidates are chunked and each
// chunk is sent as its own Stage 9 pass, in parallel, using the identical
// STAGE_9_SYSTEM_PROMPT and identical rubric. Results are merged and ranked
// alongside the Funnel batch afterwards. This keeps token budget and wall
// clock inside safe limits while putting both sources on equal footing.

import { streamClaude } from "./claude.server";
import { STAGE_9_SYSTEM_PROMPT } from "./stage9-prompt";
import {
  UNIVERSAL_BANNED_STAGE9_LIST,
  CONDITIONALLY_BANNED_STAGE9_LIST,
} from "./stage9-banned-words";

export const LOC_STAGE9_SECTION_HEADING =
  "==== LEFT-OF-CENTRE CANDIDATES — STAGE 9 DISTINCTIVENESS PASS (same rubric as Funnel batch) ====";

/** Max LOC candidates per Stage 9 call. Keeps each pass inside token budget. */
export const LOC_STAGE9_BATCH_SIZE = 5;

export type LocCandidate = {
  engine: string;
  proposition: string;
  descriptor?: string;
  anchor?: string | null;
};

async function collect(args: Parameters<typeof streamClaude>[0]): Promise<string> {
  let text = "";
  for await (const delta of streamClaude(args)) text += delta;
  return text;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function extractLocCandidates(packagesJson: unknown): LocCandidate[] {
  if (!Array.isArray(packagesJson)) return [];
  const out: LocCandidate[] = [];
  for (const p of packagesJson as Array<Record<string, unknown>>) {
    const eo = (p?.engineOutput ?? {}) as Record<string, unknown>;
    const proposition = String(eo.proposition ?? "").trim();
    if (!proposition) continue;
    out.push({
      engine: String(p?.engine ?? eo.engine ?? "loc"),
      proposition,
      descriptor: String(eo.descriptor ?? "").trim() || undefined,
      anchor: typeof eo.anchor === "string" ? eo.anchor : null,
    });
  }
  return out;
}

function buildBatchUserMessage(args: {
  brandName: string;
  category: string;
  cmm: string;
  stage7DominantSignal?: string;
  candidates: LocCandidate[];
  ids: string[];
  batchIndex: number;
  batchCount: number;
  competitorOwnedConditionalWords?: readonly string[];
}): string {
  const owned = args.competitorOwnedConditionalWords ?? [];
  const conditionalClause = owned.length
    ? `CONDITIONAL — banned for THIS brief because a named competitor already owns them (or the brief excludes them): ${owned.join(", ")}. Do NOT use these or any inflected form.`
    : `CONDITIONAL — no words from the conditional list (${CONDITIONALLY_BANNED_STAGE9_LIST}) are banned for this brief. They are allowed if the line genuinely needs them.`;

  const candidateBlock = args.candidates
    .map(
      (c, i) =>
        `${args.ids[i]} — SOURCE: LOC (${c.engine})\nLINE: "${c.proposition}"${
          c.descriptor ? `\nDESCRIPTOR: ${c.descriptor}` : ""
        }${c.anchor ? `\nANCHOR: ${c.anchor}` : ""}`,
    )
    .join("\n\n");

  const ledger = buildDispositionInstruction(
    args.candidates.map((c, i) => ({ id: args.ids[i]!, line: c.proposition })),
  );

  return `Brand: ${args.brandName}
Category: ${args.category}

==== PRE-COMPUTED BANNED TARGETS (avoid at generation time, not after) ====
UNIVERSAL — never allowed under any circumstance: ${UNIVERSAL_BANNED_STAGE9_LIST}.

${conditionalClause}

==== SOURCE OF THIS BATCH ====
These candidates come from the LEFT-OF-CENTRE engine track, not from Stage 8. They are treated with EXACTLY the same rubric as the Funnel batch: same definition of an SMP, same strategic-impossibility analysis, same five stress tests, same anti-convergence rule, same creative-function classification. No leniency and no penalty for their origin.

This is batch ${args.batchIndex + 1} of ${args.batchCount}. Assess ONLY the candidates in this batch. Do not invent additional propositions beyond these candidates and do not reference candidates you have not been shown.

==== LEFT-OF-CENTRE CANDIDATE PROPOSITIONS (raw material to interrogate) ====
${candidateBlock}

==== STAGE 7 — STRATEGIC TERRITORIES / DOMINANT SIGNAL ====
${args.stage7DominantSignal ?? "(not provided)"}

==== STAGE 2 — COMPETITIVE LANDSCAPE (CMM — USE THESE NAMED COMPETITORS IN THE IMPOSSIBILITY ANALYSIS) ====
${args.cmm}

For EACH candidate in this batch, run the full Stage 9 review. You may keep the candidate line unchanged if it survives the impossibility analysis at full strength, or rewrite it into a stronger active promise built on the same strategic territory. Reject a candidate outright when it cannot pass — state REJECTED and why, in one line.

For every SURVIVING proposition present, in this exact order:
1. THE SMP — one line, 4–12 words, an active promise.
2. SOURCE: LOC (<engine id>) — copy the engine id from the candidate.
3. THE FOUNDATION.
4. STRATEGIC-IMPOSSIBILITY ANALYSIS — one line per named competitor from Stage 2.
5. THE CREATIVE TERRITORY.
6. CREATIVE FUNCTION CLASSIFICATION — SELF-EXECUTING or PLATFORM with rationale.

Do NOT produce a ranking or a recommendation in this batch — ranking happens once, after all batches are merged.

${ledger}`;
}


/**
 * Run the Stage 9 distinctiveness pass over LOC candidates in parallel
 * batches. Never throws: a failed batch is reported inline so Stage 9 core
 * output is never lost.
 */
export async function runStage9LocBatches(args: {
  sessionId: string;
  brandName: string;
  category: string;
  cmm: string;
  stage7DominantSignal?: string;
  candidates: LocCandidate[];
  competitorOwnedConditionalWords?: readonly string[];
}): Promise<string> {
  const candidates = args.candidates.filter((c) => c.proposition);
  if (candidates.length === 0) return "";

  const batches = chunk(candidates, LOC_STAGE9_BATCH_SIZE);
  const results = await Promise.all(
    batches.map(async (batch, i) => {
      const userMessage = buildBatchUserMessage({
        brandName: args.brandName,
        category: args.category,
        cmm: args.cmm,
        stage7DominantSignal: args.stage7DominantSignal,
        candidates: batch,
        batchIndex: i,
        batchCount: batches.length,
        competitorOwnedConditionalWords: args.competitorOwnedConditionalWords,
      });
      try {
        const text = await collect({
          systemPrompt: STAGE_9_SYSTEM_PROMPT,
          userMessage,
          maxTokens: 16000,
          sessionId: args.sessionId,
          stageLabel: `Stage 9 LOC batch ${i + 1}/${batches.length}`,
          stageNumber: "9",
          stageName: "Distinctiveness Check (LOC batch)",
        });
        return text.trim();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(
          `[stage9-loc] session=${args.sessionId} batch=${i + 1}/${batches.length} failed: ${msg}`,
        );
        return `(LOC batch ${i + 1} of ${batches.length} failed: ${msg} — candidates in this batch were not assessed.)`;
      }
    }),
  );

  const body = results.filter(Boolean).join("\n\n");
  if (!body) return "";
  return `\n\n${LOC_STAGE9_SECTION_HEADING}\n${candidates.length} Left-of-Centre candidates assessed in ${batches.length} parallel batch(es) of up to ${LOC_STAGE9_BATCH_SIZE}, using the identical Stage 9 system prompt and rubric applied to the Funnel batch. Propositions below stand on equal footing with the Funnel propositions for Stage 10 scoring.\n\n${body}\n`;
}
