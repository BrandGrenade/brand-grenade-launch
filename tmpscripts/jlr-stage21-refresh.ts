// One-off: refresh the JLR Stage 21 briefs that broke the fidelity gate,
// regenerated from the locked idea 05 with each channel's Gate Two-approved
// prompt bound as a redirect. Mirrors retryStage21 in
// src/lib/stage21.functions.ts (same generateOne, same merge-and-save, same
// fidelity recheck). Old brief versions are preserved by the
// bg_version_and_lock trigger into run_output_versions.
// Usage: NODE_PATH=node_modules bun tmpscripts/jlr-stage21-refresh.ts

import { supabaseAdmin } from "../src/integrations/supabase/client.server";
import { generateOne } from "../src/lib/stage21.functions";
import {
  extractStage20BChannelEntries,
  extractStage19ChannelEntries,
} from "../src/lib/phase2-shared";
import { runChannelFidelityCheck } from "../src/lib/stage21-fidelity.server";

const SESSION_ID = "3470f1ad-b322-4230-8e3d-bf0072e95b7a";
const GAP_MS = 2000; // STAGE21_CHANNEL_GAP_MS

const BROKEN = [
  "Search and the Published-standard Destination",
  "Large-format Roadside and Commuter Outdoor",
  "Quality Print and Its Digital Editions, Carrying the Published Standard as Long Copy",
];

const SELECT = [
  "brand_name", "category", "selected_smp",
  "stage_18_selected_detonation", "stage_18_detonation_line",
  "stage_19_output", "stage_20_output",
  "locked_big_idea", "locked_campaign_line", "locked_big_idea_lens",
  "stage_20b_output",
  "truth_product", "truth_consumer", "truth_cultural",
  "stage_21_outputs",
].join(", ");

type Session21 = Record<string, unknown> & {
  stage_19_output: string | null;
  stage_20b_output: string | null;
  stage_21_outputs: Record<string, string> | null;
};

async function loadSession(): Promise<Session21> {
  const { data, error } = await supabaseAdmin
    .from("sessions")
    .select(SELECT)
    .eq("id", SESSION_ID)
    .single();
  if (error || !data) throw new Error(`Session load failed: ${error?.message}`);
  return data as unknown as Session21;
}

async function gateTwoPrompts(): Promise<Record<string, string>> {
  const { data: orchs, error } = await supabaseAdmin
    .from("stimulus_orchestrations")
    .select("id")
    .eq("session_id", SESSION_ID);
  if (error) throw new Error(error.message);
  const ids = (orchs ?? []).map((o) => o.id as string);
  if (ids.length === 0) throw new Error("No stimulus orchestration for session");
  const { data: prompts, error: pErr } = await supabaseAdmin
    .from("stimulus_prompts")
    .select("channel_name, final_prompt")
    .in("orchestration_id", ids)
    .eq("gate_two_approved", true);
  if (pErr) throw new Error(pErr.message);
  const out: Record<string, string> = {};
  for (const p of prompts ?? []) {
    if (p.channel_name && p.final_prompt) out[p.channel_name as string] = p.final_prompt as string;
  }
  return out;
}

function redirectFor(channel: string, gateTwoPrompt: string): string {
  if (!gateTwoPrompt) return "";
  return [
    `BINDING CHANNEL EXECUTION — GATE TWO-APPROVED DIRECTION FOR ${channel}.`,
    "This channel's execution approach was developed through the Creative Stimulus Engine and approved at Gate Two by the Creative Director. It defines HOW this channel carries the locked campaign big idea. Your brief must execute exactly this approach — same mechanic, same structure, same reveal order. You may not substitute a different mechanic or reinterpret the idea for this channel's convenience.",
    "",
    gateTwoPrompt,
  ].join("\n");
}

type FidelityResults = { results?: Array<{ channel: string; verdict: string; score: number }> };

async function refreshChannels(channels: string[]): Promise<string[]> {
  const s = await loadSession();
  const entries20b = extractStage20BChannelEntries(s.stage_20b_output);
  const all = entries20b.length > 0
    ? entries20b
    : extractStage19ChannelEntries(s.stage_19_output);
  const targets = all.filter((e) => channels.includes(e.name));
  const missing = channels.filter((c) => !targets.some((t) => t.name === c));
  if (missing.length > 0) throw new Error(`No channel entries for: ${missing.join(", ")}`);

  const prompts = await gateTwoPrompts();
  const merged: Record<string, string> = { ...(s.stage_21_outputs ?? {}) };
  for (const [i, e] of targets.entries()) {
    const redirect = redirectFor(e.name, prompts[e.name] ?? "");
    const result = await generateOne(
      SESSION_ID, e.name, e.role, e.content, s as never, redirect,
    );
    merged[e.name] = result;
    console.log(`generated ${e.name}: ${result.length} chars`);
    if (i < targets.length - 1) await new Promise((r) => setTimeout(r, GAP_MS));
  }

  const { error: saveErr } = await supabaseAdmin
    .from("sessions")
    .update({ stage_21_outputs: merged, stage_21_error: null, stage_21_fidelity: null })
    .eq("id", SESSION_ID);
  if (saveErr) throw new Error(`Save failed: ${saveErr.message}`);

  const report = await runChannelFidelityCheck({
    sessionId: SESSION_ID,
    leadExpression: null,
    outputs: merged,
  });
  const { error: fErr } = await supabaseAdmin
    .from("sessions")
    .update({ stage_21_fidelity: report as never, stage_21_fidelity_override: null })
    .eq("id", SESSION_ID);
  if (fErr) throw new Error(`Fidelity save failed: ${fErr.message}`);

  const results = (report as FidelityResults).results ?? [];
  for (const r of results) console.log(`  ${r.verdict.padEnd(6)} ${r.score}  ${r.channel}`);
  return results.filter((r) => r.verdict === "break").map((r) => r.channel);
}

let toFix = BROKEN;
// Initial refresh + up to two retries for any brief that still breaks.
for (let attempt = 1; attempt <= 3 && toFix.length > 0; attempt++) {
  console.log(`--- attempt ${attempt}: refreshing ${toFix.length} brief(s)`);
  toFix = await refreshChannels(toFix);
}
if (toFix.length > 0) {
  console.log(`STILL BREAKING AFTER RETRIES: ${toFix.join(", ")}`);
  process.exit(1);
}
console.log("ALL CLEAR — no break verdicts remain");
