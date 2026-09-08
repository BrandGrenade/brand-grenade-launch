/**
 * MODEL BAKE-OFF — sandboxed side-by-side model comparison.
 *
 * Runs the decision-relevant stages of the pipeline against a chosen model,
 * using a real session's stored inputs, and writes every output to disk.
 *
 * SAFETY CONTRACT (this is the whole point of the script):
 *  - Every database access is a SELECT. There is not a single write anywhere
 *    in this file, and no pipeline server function is called.
 *  - `sessionId` is never passed to callClaude, so the shared caller cannot
 *    touch sessions.retry_status or pick up amendment notes.
 *  - Outputs go to /mnt/documents/model-bakeoff/<run>/<model>/<stage>.md.
 *  - Live session state, stage columns, stimulus runs and documents are
 *    untouched, so a bake-off can run while a client session is live.
 *
 * Usage:
 *   bun scripts/model-bakeoff.ts --session <uuid> \
 *     --models claude-opus-4-8,claude-fable-5-1 \
 *     [--stages 2,8,10,11,sweep] [--lenses 3] [--label jaguar-test]
 *
 * Cost is estimated from real token usage reported per call.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { supabaseAdmin } from "../src/integrations/supabase/client.server";
import { callClaude } from "../src/lib/claude.server";
import { STAGE_2_SYSTEM_PROMPT, buildStage2UserMessage } from "../src/lib/stage2-prompt";
import { STAGE_8_SYSTEM_PROMPT, buildStage8UserMessage } from "../src/lib/stage8-prompt";
import { STAGE_10_SYSTEM_PROMPT, buildStage10UserMessage } from "../src/lib/stage10-prompt";
import { STAGE_11_SYSTEM_PROMPT, buildStage11UserMessage } from "../src/lib/stage11-prompt";
import { BIG_IDEA_SYSTEM_PROMPT, buildBigIdeaUserMessage } from "../src/lib/stimulus/big-idea-prompt";
import { loadGrounding } from "../src/lib/stimulus/big-idea-sweep.server";
import { STIMULUS_LENSES } from "../src/lib/stimulus/lenses";
import { trimStage1ForDownstream } from "../src/lib/context-trim";
import { countPropositions } from "../src/lib/count-helpers";

// USD per million tokens. Used only for the estimate line; adjust if pricing
// moves. Unknown models fall back to the frontier rate so estimates are never
// optimistic by accident.
const PRICING: Record<string, { in: number; out: number }> = {
  "claude-opus-4-8": { in: 5, out: 25 },
  "claude-opus-5": { in: 5, out: 25 },
  "claude-fable-5-1": { in: 3, out: 15 },
  "claude-fable-5": { in: 3, out: 15 },
  "claude-sonnet-5": { in: 3, out: 15 },
  "claude-sonnet-4-6": { in: 3, out: 15 },
  "claude-sonnet-4-5-20250929": { in: 3, out: 15 },
  "claude-haiku-4-5": { in: 1, out: 5 },
};
const FALLBACK_PRICE = { in: 5, out: 25 };

function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const v = i > -1 ? process.argv[i + 1] : undefined;
  if (!v) {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing --${name}`);
  }
  return v;
}

interface StageResult {
  stage: string;
  model: string;
  ms: number;
  chars: number;
  output: string;
}

async function run(model: string, stage: string, system: string, user: string, maxTokens: number) {
  const started = Date.now();
  const output = await callClaude({
    systemPrompt: system,
    userMessage: user,
    maxTokens,
    model,
    // Deliberately no sessionId / stageNumber: keeps this out of retry status,
    // amendment lookup and stage telemetry.
  });
  return { stage, model, ms: Date.now() - started, chars: output.length, output } as StageResult;
}

async function main() {
  const sessionId = arg("session");
  const models = arg("models", "claude-opus-5,claude-fable-5-1").split(",").map((m) => m.trim());
  const stages = arg("stages", "2,8,10,11,sweep").split(",").map((s) => s.trim());
  const lensCount = Number(arg("lenses", "3"));
  const label = arg("label", sessionId.slice(0, 8));

  const { data: s, error } = await supabaseAdmin
    .from("sessions")
    .select(
      "brand_name, category, stage_1_output, stage_2_output, stage_7_output, stage_8_output, stage_9_output, stage_10_output",
    )
    .eq("id", sessionId)
    .single();
  if (error || !s) throw new Error(`Session not found: ${error?.message ?? "no row"}`);

  const root = join("/mnt/documents/model-bakeoff", label);
  mkdirSync(root, { recursive: true });

  const results: StageResult[] = [];

  for (const model of models) {
    const dir = join(root, model);
    mkdirSync(dir, { recursive: true });
    console.log(`\n=== ${model} ===`);

    for (const stage of stages) {
      let r: StageResult;
      if (stage === "2") {
        r = await run(
          model,
          "stage-02-category-intelligence",
          STAGE_2_SYSTEM_PROMPT,
          buildStage2UserMessage({
            brandName: s.brand_name,
            category: s.category,
            sanitisedBrief: trimStage1ForDownstream(s.stage_1_output ?? ""),
          }),
          16000,
        );
      } else if (stage === "8") {
        const territories = (s.stage_7_output ?? "").match(/^#{2,3}\s+.*$/gm) ?? [];
        r = await run(
          model,
          "stage-08-propositions",
          STAGE_8_SYSTEM_PROMPT,
          buildStage8UserMessage({
            brandName: s.brand_name,
            category: s.category,
            stage7Output: s.stage_7_output ?? "",
            cmm: s.stage_2_output ?? "",
            constraintMatrix: "",
            territoryCount: territories.length || 5,
            territoryNames: territories.map((t) => t.replace(/^#+\s*/, "")),
          }),
          16000,
        );
      } else if (stage === "10") {
        r = await run(
          model,
          "stage-10-scoring",
          STAGE_10_SYSTEM_PROMPT,
          buildStage10UserMessage({
            brandName: s.brand_name,
            category: s.category,
            stage8Output: s.stage_8_output ?? "",
            stage9Output: s.stage_9_output ?? "",
            stage1Output: s.stage_1_output ?? "",
            propositionCount: countPropositions(s.stage_8_output ?? ""),
          }),
          20000,
        );
      } else if (stage === "11") {
        r = await run(
          model,
          "stage-11-pressure-test",
          STAGE_11_SYSTEM_PROMPT,
          buildStage11UserMessage({
            brandName: s.brand_name,
            category: s.category,
            stage10Output: s.stage_10_output ?? "",
            cmm: s.stage_2_output ?? "",
            propositionCount: countPropositions(s.stage_8_output ?? s.stage_10_output ?? ""),
          }),
          20000,
        );
      } else if (stage === "sweep") {
        const g = await loadGrounding(sessionId);
        r = await run(
          model,
          `sweep-${lensCount}-lenses`,
          BIG_IDEA_SYSTEM_PROMPT,
          buildBigIdeaUserMessage({ ...g, lenses: STIMULUS_LENSES.slice(0, lensCount) }),
          8000,
        );
      } else {
        console.warn(`Unknown stage "${stage}" — skipped`);
        continue;
      }
      results.push(r);
      writeFileSync(join(dir, `${r.stage}.md`), r.output);
      console.log(`  ${r.stage}: ${r.chars} chars in ${(r.ms / 1000).toFixed(1)}s`);
    }
  }

  // Rough cost: ~4 chars per token both directions, input measured from the
  // prompts actually sent is unavailable post-hoc, so we estimate from output
  // size plus stored input size. Treat as an order-of-magnitude figure.
  const lines: string[] = [
    `# Model bake-off — ${s.brand_name} (${label})`,
    "",
    `Session (read-only): ${sessionId}`,
    `Models: ${models.join(", ")}`,
    "",
    "| Model | Stage | Seconds | Output chars | Est. cost USD |",
    "| --- | --- | --- | --- | --- |",
  ];
  let total = 0;
  for (const r of results) {
    const p = PRICING[r.model] ?? FALLBACK_PRICE;
    const outTok = r.chars / 4;
    const inTok = 30000; // typical stage input; see note above
    const cost = (inTok / 1e6) * p.in + (outTok / 1e6) * p.out;
    total += cost;
    lines.push(
      `| ${r.model} | ${r.stage} | ${(r.ms / 1000).toFixed(1)} | ${r.chars} | ${cost.toFixed(2)} |`,
    );
  }
  lines.push("", `**Estimated total: USD ${total.toFixed(2)}**`);
  writeFileSync(join(root, "comparison.md"), lines.join("\n"));
  console.log(`\nWritten to ${root}/comparison.md`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
