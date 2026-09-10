import { supabaseAdmin as db } from "@/integrations/supabase/client.server";
import { recordInitialAttempt } from "@/lib/stimulus/regenerate.server";
import { fidelityBlockReason } from "@/lib/stage21-fidelity-gate";

// ---- Item 7: reload path reads the persisted override -----------------------
const SESSION_COLS_FIDELITY = "id, stage_21_fidelity, stage_21_fidelity_override";
const { data: withFid } = await db
  .from("sessions")
  .select(SESSION_COLS_FIDELITY)
  .not("stage_21_fidelity", "is", null)
  .limit(50);
console.log("sessions carrying a fidelity report:", withFid?.length ?? 0);
const anyOverride = (withFid ?? []).find((r) => r.stage_21_fidelity_override);
console.log("override column readable via page select:", anyOverride ? "yes (real override found)" : "column present, no stored override yet");

// Simulate the reload: write an override, re-read with the page's select, assert unblocked.
const target = (withFid ?? []).find((r) => {
  const rep = r.stage_21_fidelity as { results?: { verdict: string }[] } | null;
  return rep?.results?.some((x) => x.verdict === "break");
}) ?? (withFid ?? [])[0];
if (target) {
  const before = target.stage_21_fidelity_override;
  const report = target.stage_21_fidelity as { checkedAt: string; results?: { verdict: string; channel: string }[] };
  const broken = (report?.results ?? []).filter((r) => r.verdict === "break").map((r) => r.channel);
  console.log(`test session ${target.id.slice(0,8)} broken channels: ${broken.length ? broken.join(", ") : "none"}`);
  console.log("block reason BEFORE override:", fidelityBlockReason(report as never, before as never)?.slice(0, 70) ?? "none");
  const override = { kind: "stage_21_fidelity_override", reason: "Automated Tier 2 reload test", overriddenBy: "tier2-test", channels: broken, reportCheckedAt: report?.checkedAt, at: new Date().toISOString() };
  await db.from("sessions").update({ stage_21_fidelity_override: override as never }).eq("id", target.id);
  const { data: reloaded } = await db.from("sessions").select(SESSION_COLS_FIDELITY).eq("id", target.id).single();
  console.log("override survives reload select:", !!reloaded?.stage_21_fidelity_override);
  console.log("block reason AFTER reload:", fidelityBlockReason(reloaded!.stage_21_fidelity as never, reloaded!.stage_21_fidelity_override as never) ?? "none — progression allowed");
  await db.from("sessions").update({ stage_21_fidelity_override: before as never }).eq("id", target.id);
  console.log("restored original override value");
}

// ---- Item 8: original take banked as Attempt 1 ------------------------------
const { data: dirs } = await db
  .from("stimulus_directions")
  .select("id, run_id, direction, campaign_line, rationale, active_attempt_id")
  .eq("status", "generated")
  .not("direction", "is", null)
  .limit(400);
let picked: (typeof dirs)[number] | undefined;
for (const d of dirs ?? []) {
  const { count } = await db.from("stimulus_direction_attempts").select("id", { count: "exact", head: true }).eq("direction_id", d.id);
  if (!count) { picked = d; break; }
}
if (!picked) console.log("no attempt-free direction available to test");
else {
  const prevActive = picked.active_attempt_id;
  const id = await recordInitialAttempt({
    directionId: picked.id, runId: picked.run_id, direction: picked.direction!,
    campaignLine: picked.campaign_line, rationale: picked.rationale,
  });
  const { data: rows } = await db.from("stimulus_direction_attempts").select("id, attempt_no, origin, direction").eq("direction_id", picked.id);
  const { data: dirAfter } = await db.from("stimulus_directions").select("active_attempt_id").eq("id", picked.id).single();
  console.log("\nAttempt 1 written:", rows?.length === 1 && rows[0].attempt_no === 1 && rows[0].origin === "initial");
  console.log("text matches the original generation:", rows?.[0]?.direction === picked.direction);
  console.log("marked active:", dirAfter?.active_attempt_id === id);
  const again = await recordInitialAttempt({ directionId: picked.id, runId: picked.run_id, direction: "SHOULD NOT OVERWRITE" });
  const { data: rows2 } = await db.from("stimulus_direction_attempts").select("id, direction").eq("direction_id", picked.id);
  console.log("idempotent (no duplicate, no overwrite):", rows2?.length === 1 && rows2[0].direction === picked.direction && again === id);
  await db.from("stimulus_directions").update({ active_attempt_id: prevActive }).eq("id", picked.id);
  await db.from("stimulus_direction_attempts").delete().eq("direction_id", picked.id);
  console.log("test rows cleaned up");
}
