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

async function stage3() {
  const { STAGE_3_SYSTEM_PROMPT, buildStage3UserMessage } = await import("../src/lib/stage3-prompt");
  const { countSections } = await import("../src/lib/count-helpers");
  const { trimStage1ForDownstream } = await import("../src/lib/context-trim");
  const s = await session();
  const userMessage = buildStage3UserMessage({
    brandName: s.brand_name,
    category: s.category,
    sanitisedBrief: trimStage1ForDownstream(s.stage_1_output ?? ""),
    cmm: s.stage_2_output ?? "",
  });
  const t0 = Date.now();
  const out = await callClaude({
    systemPrompt: STAGE_3_SYSTEM_PROMPT,
    userMessage,
    maxTokens: 64000,
    stageLabel: "Stage 3 (opus5.5 migration check)",
    stageNumber: "3",
    stageName: "Strategic Frameworks",
  });
  writeFileSync("/tmp/opus55/stage3-55.md", out);
  const sections = countSections(out, 0);
  const headings = (out.match(/^## .+$/gm) ?? []).length;
  const req = ["**The opportunity:**", "**What this excludes:**", "**Why it is available:**"];
  const perBlock = req.map((r) => (out.split(r).length - 1));
  console.log(`[3] ${(Date.now() - t0) / 1000}s chars=${out.length} headings=${headings} countSections=${sections}`);
  console.log(`[3] labels: opportunity=${perBlock[0]} excludes=${perBlock[1]} available=${perBlock[2]}`);
  console.log(`[3] starts-with-heading=${out.trimStart().startsWith("## ")}`);
  console.log(`[3] VERDICT=${headings >= 3 && headings <= 6 && perBlock.every((n) => n === headings) && out.trimStart().startsWith("## ") ? "PASS" : "FAIL"}`);
  console.log(out.slice(0, 700));
}
if (mode === "3") await stage3();

async function stage4() {
  const { STAGE_4_SYSTEM_PROMPT, buildStage4UserMessage } = await import("../src/lib/stage4-prompt");
  const { countSections } = await import("../src/lib/count-helpers");
  const { trimStage1ForDownstream } = await import("../src/lib/context-trim");
  const { resolveModel } = await import("../src/lib/model-policy");
  const { data: s } = await supabaseAdmin.from("sessions").select("brand_name, category, stage_1_output, stage_2_output, stage_3_output").eq("id", SESSION_ID).single();
  const expected = countSections(s!.stage_3_output, 4);
  const t0 = Date.now();
  const out = await callClaude({
    systemPrompt: STAGE_4_SYSTEM_PROMPT,
    userMessage: buildStage4UserMessage({ brandName: s!.brand_name, category: s!.category, sanitisedBrief: trimStage1ForDownstream(s!.stage_1_output ?? ""), cmm: s!.stage_2_output ?? "", constraintMatrix: s!.stage_3_output ?? "", constraintSetCount: expected }),
    maxTokens: 64000, stageLabel: "Stage 4 (opus5.5 migration check)", stageNumber: "4", stageName: "Strategic Universes",
  });
  writeFileSync("/tmp/opus55/stage4-55.md", out);
  const blocks = out.split(/^## /m).slice(1);
  const heads = blocks.length;
  const withTension = blocks.filter((b) => /^>\s/m.test(b)).length;
  const withRule = blocks.filter((b) => /^---\s*$/m.test(b)).length;
  console.log(`[4] model=${resolveModel("4")} ${(Date.now() - t0) / 1000}s chars=${out.length}`);
  console.log(`[4] frameworks-in=${expected} universes=${heads} tension-lines=${withTension} dividers=${withRule} starts-with-heading=${out.trimStart().startsWith("## ")}`);
  console.log(`[4] VERDICT=${heads >= 3 && heads <= 6 && heads === expected && withTension === heads && out.trimStart().startsWith("## ") ? "PASS" : "FAIL"}`);
  console.log(out.slice(0, 900));
}
if (mode === "4") await stage4();

async function stage4cmp(model: string, tag: string) {
  const { STAGE_4_SYSTEM_PROMPT, buildStage4UserMessage } = await import("../src/lib/stage4-prompt");
  const { countSections } = await import("../src/lib/count-helpers");
  const { trimStage1ForDownstream } = await import("../src/lib/context-trim");
  const { data: s } = await supabaseAdmin.from("sessions").select("brand_name, category, stage_1_output, stage_2_output, stage_3_output").eq("id", SESSION_ID).single();
  const expected = countSections(s!.stage_3_output, 4);
  const t0 = Date.now();
  const out = await callClaude({
    systemPrompt: STAGE_4_SYSTEM_PROMPT,
    userMessage: buildStage4UserMessage({ brandName: s!.brand_name, category: s!.category, sanitisedBrief: trimStage1ForDownstream(s!.stage_1_output ?? ""), cmm: s!.stage_2_output ?? "", constraintMatrix: s!.stage_3_output ?? "", constraintSetCount: expected }),
    maxTokens: 64000, model, effort: "high", stageLabel: `Stage 4 (${tag})`, stageNumber: "4", stageName: "Strategic Universes",
  });
  writeFileSync(`/tmp/opus55/stage4-${tag}.md`, out);
  const blocks = out.split(/^## /m).slice(1);
  console.log(`[4:${tag}] ${(Date.now() - t0) / 1000}s chars=${out.length} expected=${expected} universes=${blocks.length} tension=${blocks.filter((b) => /^>\s/m.test(b)).length}`);
}
if (mode === "4-opus5") await stage4cmp("claude-opus-5", "opus5-high");
if (mode === "4-opus55") await stage4cmp("claude-opus-5-5", "opus55-high");

async function stage4bcmp(model: string, tag: string) {
  const { STAGE_4B_SYSTEM_PROMPT, buildStage4bUserMessage } = await import("../src/lib/stage4b-prompt");
  const { trimStage1ForDownstream } = await import("../src/lib/context-trim");
  const { data: s } = await supabaseAdmin.from("sessions").select("brand_name, category, stage_1_output").eq("id", SESSION_ID).single();
  const t0 = Date.now();
  const out = await callClaude({
    systemPrompt: STAGE_4B_SYSTEM_PROMPT,
    userMessage: buildStage4bUserMessage({ brandName: s!.brand_name, category: s!.category, sanitisedBrief: trimStage1ForDownstream(s!.stage_1_output ?? "") }),
    maxTokens: 64000, model, effort: "high", stageLabel: `Stage 4B (${tag})`, stageNumber: "4b", stageName: "Asset Mining & Product Facts",
  });
  writeFileSync(`/tmp/opus55/stage4b-${tag}.md`, out);
  const bullets = (out.match(/^\s*[-*•] /gm) ?? []).length;
  console.log(`[4b:${tag}] ${(Date.now() - t0) / 1000}s chars=${out.length} starts=${out.startsWith("# ASSET MINING AND PRODUCT FACTS")} partOne=${/part one/i.test(out)} partTwo=${/part two/i.test(out)} partThree=${/part three/i.test(out)} real=${(out.match(/real fact/gi) ?? []).length} perceived=${(out.match(/perceived fact/gi) ?? []).length} bullets=${bullets}`);
}
if (mode === "4b-opus5") await stage4bcmp("claude-opus-5", "opus5-high");
if (mode === "4b-opus55") await stage4bcmp("claude-opus-5-5", "opus55-high");
