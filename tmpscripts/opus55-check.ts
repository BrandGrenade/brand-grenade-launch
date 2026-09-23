// Opus 5.5 migration verification harness.
//  A) Real Stage 1B run (the wave-1 migrated stage) through the shared caller.
//  B) Stage 11 (reasoning-critical) on Opus 5 vs Opus 5.5 @ effort high.
//  C) Tool-using call sites replayed on 5.5 with no forced tool choice.
import { callClaude } from "../src/lib/claude.server";
import { supabaseAdmin } from "../src/integrations/supabase/client.server";
import { STAGE_1B_SYSTEM_PROMPT, buildStage1bUserMessage } from "../src/lib/stage1b-prompt";
import { STAGE_11_SYSTEM_PROMPT, buildStage11UserMessage } from "../src/lib/stage11-prompt";
import { countPropositions } from "../src/lib/count-helpers";
import { writeFileSync } from "node:fs";

const SESSION_ID = "c5142f1d-a381-44aa-9b88-c21875cc7996";
const mode = process.argv[2];

async function session() {
  const { data, error } = await supabaseAdmin
    .from("sessions")
    .select("brand_name, category, brief_text, stage_1_output, stage_2_output, stage_8_output, stage_10_output, is_preflight_test")
    .eq("id", SESSION_ID)
    .single();
  if (error || !data) throw new Error(`session fetch failed: ${error?.message}`);
  return data as Record<string, any>;
}

async function stage1b() {
  const s = await session();
  const userMessage = buildStage1bUserMessage({
    stage1Output: s.stage_1_output ?? "",
    briefText: s.brief_text ?? "",
  });
  const t0 = Date.now();
  const out = await callClaude({
    systemPrompt: STAGE_1B_SYSTEM_PROMPT,
    userMessage,
    maxTokens: 64000,
    stageLabel: "Stage 1B (opus5.5 migration check)",
    stageNumber: "1B",
    stageName: "Brief Enhancement",
  });
  console.log(`[1B] PASS ${(Date.now() - t0) / 1000}s chars=${out.length}`);
  writeFileSync("/tmp/opus55/stage1b-55.md", out);
  console.log(out.slice(0, 400));
}

async function stage11(model: string | undefined, tag: string) {
  const s = await session();
  const userMessage = buildStage11UserMessage({
    brandName: s.brand_name,
    category: s.category,
    stage10Output: s.stage_10_output,
    cmm: s.stage_2_output ?? "",
    propositionCount: countPropositions(s.stage_8_output ?? s.stage_10_output),
    isPreflight: s.is_preflight_test === true,
  });
  const t0 = Date.now();
  const out = await callClaude({
    systemPrompt: STAGE_11_SYSTEM_PROMPT,
    userMessage,
    maxTokens: 64000,
    model,
    effort: "high",
    stageLabel: `Stage 11 (${tag})`,
    stageNumber: "11",
    stageName: "Integrity Testing",
  });
  console.log(`[11:${tag}] PASS ${(Date.now() - t0) / 1000}s chars=${out.length}`);
  writeFileSync(`/tmp/opus55/stage11-${tag}.md`, out);
}

if (mode === "1b") await stage1b();
if (mode === "11-opus5") await stage11("claude-opus-5", "opus5-high");
if (mode === "11-opus55") await stage11("claude-opus-5-5", "opus55-high");
