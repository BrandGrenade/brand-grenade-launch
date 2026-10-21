/**
 * JLR Stage 9 LOC batch re-run (recovery for failed batches).
 *
 * The three Stage 9 LOC distinctiveness batches for session
 * 3470f1ad-b322-4230-8e3d-bf0072e95b7a failed on Anthropic credit balance and
 * all 13 LOC candidates were force-rejected "not assessed". This script:
 *   1. Dumps stages 9-12 + LOC columns to /tmp/jlr/backup-<ts>.json (backup).
 *   2. Re-runs ONLY runStage9LocBatches with the same inputs runStage9 used.
 *   3. Splices the new LOC section into stage_9_output, replacing the failed
 *      section (everything from the LOC section heading to end of column).
 *   4. Verifies the new ledger accounts for all 13 candidates with real
 *      verdicts (no "not assessed" rows) BEFORE writing.
 *   5. Updates sessions with version_reason/version_actor so the
 *      bg_version_and_lock trigger snapshots the previous stage_9_output.
 *
 * Stage 9 core output, Stage 10, Stage 11 and Stage 12 are not touched.
 *
 * Usage: bun tmpscripts/jlr-loc-rerun.ts [--write]
 * Without --write it runs the batches and prints the new section + usage but
 * does not touch the database.
 */
import { writeFileSync } from "node:fs";
import { supabaseAdmin } from "../src/integrations/supabase/client.server";
import {
  runStage9LocBatches,
  extractLocCandidates,
  LOC_STAGE9_SECTION_HEADING,
} from "../src/lib/stage9-loc-batch.server";
import { competitorOwnedConditionalStage9Words } from "../src/lib/stage9-banned-words";
import { parseLocDispositions } from "../src/lib/loc/stage9-disposition-apply";
import type { ClaudeUsage } from "../src/lib/claude.server";

const SESSION_ID = "3470f1ad-b322-4230-8e3d-bf0072e95b7a";
const WRITE = process.argv.includes("--write");

const { data: session, error } = await supabaseAdmin
  .from("sessions")
  .select(
    "id, user_id, brand_name, category, brief_text, brief_type, stage_2_output, stage_7_output, stage_9_output, stage_9_leftofcentre_output, stage_10_output, stage_11_output, stage_12_output, loc_decision_packages, stage_amendments",
  )
  .eq("id", SESSION_ID)
  .single();
if (error || !session) throw new Error(`Session not found: ${error?.message}`);

// ── 1. Backup ──────────────────────────────────────────────────────────────
const backupPath = `/tmp/jlr/backup-${Date.now()}.json`;
writeFileSync(
  backupPath,
  JSON.stringify(
    {
      backed_up_at: new Date().toISOString(),
      session_id: SESSION_ID,
      stage_9_output: session.stage_9_output,
      stage_9_leftofcentre_output: session.stage_9_leftofcentre_output,
      stage_10_output: session.stage_10_output,
      stage_11_output: session.stage_11_output,
      stage_12_output: session.stage_12_output,
      loc_decision_packages: session.loc_decision_packages,
    },
    null,
    2,
  ),
);
console.log(`[backup] stages 9-12 + loc_decision_packages written to ${backupPath}`);

const amendments = (session.stage_amendments ?? {}) as Record<string, { feedback?: string }>;
if (amendments["9"]?.feedback) {
  console.log(`[note] a Stage 9 amendment note exists and will be injected, as in a normal Stage 9 run.`);
}

// ── 2. Re-run the three LOC batches ────────────────────────────────────────
const candidates = extractLocCandidates(session.loc_decision_packages);
console.log(`[loc] ${candidates.length} candidates extracted from loc_decision_packages`);
if (candidates.length === 0) throw new Error("No LOC candidates found — aborting.");

const competitorOwned = competitorOwnedConditionalStage9Words({
  brandName: session.brand_name,
  briefText: session.brief_text ?? "",
  stage2Output: session.stage_2_output ?? "",
});

const usage: Array<{ label: string; usage: ClaudeUsage }> = [];
const SAVED = "/tmp/jlr/loc-section-new.txt";
const useSaved = process.argv.includes("--use-saved");
const section = useSaved
  ? (await import("node:fs")).readFileSync(SAVED, "utf8")
  : await runStage9LocBatches({
  sessionId: SESSION_ID,
  brandName: session.brand_name,
  category: session.category,
  cmm: session.stage_2_output ?? "",
  stage7DominantSignal: session.stage_7_output ?? undefined,
  candidates,
  competitorOwnedConditionalWords: competitorOwned,
  onUsage: (u, label) => usage.push({ label, usage: u }),
});

if (!section.trim()) throw new Error("LOC batch run returned an empty section — aborting.");

// ── 3. Verify the new section before any write ─────────────────────────────
if (/batch \d+ of \d+ failed/i.test(section)) {
  throw new Error("A batch failed again — section still contains a failure marker. Aborting without writing.");
}
if (/not assessed/i.test(section)) {
  throw new Error("Section still contains 'not assessed' rejection rows. Aborting without writing.");
}
const ledger = parseLocDispositions(section);
console.log(`[verify] ledger rows parsed: ${ledger.size} / ${candidates.length}`);
for (let i = 1; i <= candidates.length; i++) {
  const d = ledger.get(i);
  console.log(`  LOC-${i}: ${d?.verdict ?? "MISSING"}${d?.line ? ` — ${d.line.slice(0, 80)}` : ""}${d?.reason ? ` (${d.reason.slice(0, 60)})` : ""}`);
}
if (ledger.size !== candidates.length) {
  throw new Error(`Ledger incomplete (${ledger.size}/${candidates.length}) — aborting without writing.`);
}

// ── 4. Splice into stage_9_output ──────────────────────────────────────────
const oldOutput = session.stage_9_output ?? "";
const headingIdx = oldOutput.indexOf(LOC_STAGE9_SECTION_HEADING.trim());
if (headingIdx === -1) throw new Error("LOC section heading not found in stage_9_output — aborting.");
const newOutput = `${oldOutput.slice(0, headingIdx).replace(/\s+$/, "")}${section}`;

// Confirm the splice changed ONLY the LOC section.
const coreBefore = oldOutput.slice(0, headingIdx);
if (!newOutput.startsWith(coreBefore.replace(/\s+$/, ""))) {
  throw new Error("Splice would alter the Stage 9 core output — aborting.");
}
console.log(`[splice] core preserved: ${coreBefore.length} chars; old LOC section ${oldOutput.length - headingIdx} chars -> new ${section.length} chars`);

// ── 5. Token usage ─────────────────────────────────────────────────────────
let tin = 0, tout = 0, tcr = 0, tcc = 0;
for (const { label, usage: u } of usage) {
  console.log(`[usage] ${label}: in=${u.inputTokens} out=${u.outputTokens} cache_read=${u.cacheReadInputTokens} cache_write=${u.cacheCreationInputTokens}`);
  tin += u.inputTokens; tout += u.outputTokens; tcr += u.cacheReadInputTokens; tcc += u.cacheCreationInputTokens;
}
console.log(`[usage] TOTAL: in=${tin} out=${tout} cache_read=${tcr} cache_write=${tcc}`);

if (!WRITE) {
  console.log("\n[dry-run] no database write. Re-run with --write to apply.");
  writeFileSync("/tmp/jlr/loc-section-new.txt", section);
  console.log("[dry-run] new LOC section saved to /tmp/jlr/loc-section-new.txt");
  process.exit(0);
}

// ── 6. Write (trigger snapshots the old stage_9_output) ────────────────────
const { error: updErr } = await supabaseAdmin
  .from("sessions")
  .update({
    stage_9_output: newOutput,
    version_reason: "rerun: stage 9 LOC batches only (credit-balance failure recovery)",
    version_actor: session.user_id,
  } as never)
  .eq("id", SESSION_ID);
if (updErr) throw new Error(`Update failed: ${updErr.message}`);
console.log("[write] stage_9_output updated; previous version snapshotted by bg_version_and_lock.");

// Readback verification.
const { data: check } = await supabaseAdmin
  .from("sessions")
  .select("stage_9_output, stage_10_output, stage_11_output, stage_12_output")
  .eq("id", SESSION_ID)
  .single();
const readback = check?.stage_9_output ?? "";
const readbackLedger = parseLocDispositions(readback);
console.log(`[readback] stage_9_output ${readback.length} chars; ledger rows: ${readbackLedger.size}`);
console.log(`[readback] stage 10/11/12 unchanged: ${
  check?.stage_10_output === session.stage_10_output &&
  check?.stage_11_output === session.stage_11_output &&
  check?.stage_12_output === session.stage_12_output
}`);
const { data: versions } = await supabaseAdmin
  .from("run_output_versions")
  .select("field, version_no, reason, created_at")
  .eq("run_table", "sessions")
  .eq("run_id", SESSION_ID)
  .eq("field", "stage_9_output")
  .order("version_no", { ascending: false })
  .limit(3);
console.log("[readback] stage_9_output versions:", JSON.stringify(versions));
