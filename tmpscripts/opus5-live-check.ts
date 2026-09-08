// Live verification: run one real pipeline stage prompt through the shared
// callClaude path with NO explicit model — i.e. the new DEFAULT_MODEL
// (claude-opus-5). Uses the Dan Murphy's session inputs for Stage 11.
import { callClaude } from "../src/lib/claude.server";
import {
  STAGE_11_SYSTEM_PROMPT,
  buildStage11UserMessage,
} from "../src/lib/stage11-prompt";
import { countPropositions } from "../src/lib/count-helpers";
import { createClient } from "@supabase/supabase-js";

const SESSION_ID = "c5142f1d-a381-44aa-9b88-c21875cc7996";

async function main() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase env missing");
  const sb = createClient(url, key);
  const { data: s, error } = await sb
    .from("sessions")
    .select("brand_name, category, stage_2_output, stage_8_output, stage_10_output, is_preflight_test")
    .eq("id", SESSION_ID)
    .single();
  if (error || !s) throw new Error(`session fetch failed: ${error?.message}`);
  if (!s.stage_10_output) throw new Error("no stage_10_output");

  const userMessage = buildStage11UserMessage({
    brandName: s.brand_name,
    category: s.category,
    stage10Output: s.stage_10_output,
    cmm: s.stage_2_output ?? "",
    propositionCount: countPropositions(s.stage_8_output ?? s.stage_10_output),
    isPreflight: s.is_preflight_test === true,
  });

  console.log(`[check] calling Stage 11 via DEFAULT_MODEL (no model arg) for ${s.brand_name}...`);
  const t0 = Date.now();
  const output = await callClaude({
    systemPrompt: STAGE_11_SYSTEM_PROMPT,
    userMessage,
    maxTokens: 64000,
    stageLabel: "Stage 11 (opus-5 live check)",
    stageNumber: "11",
    stageName: "Integrity Testing",
    // no sessionId: read-only, nothing written to the sessions table
  });
  const dur = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[check] PASS duration_s=${dur} chars=${output.length}`);
  console.log("[check] first 300 chars:\n" + output.slice(0, 300));
}

main().catch((e) => {
  console.error("[check] FAIL", e instanceof Error ? e.message : e);
  process.exit(1);
});
