import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { applyMandateToPrompt, checkMandateCompliance, runCreativeDirectorPass } from "./orchestrate.server";
import { JLR_CHANNEL_INSTRUCTIONS, JLR_ORCHESTRATION_ID, RECOVERY_ATTEMPTS, recoveryReady } from "./jlr-mandate-recovery";

type Row = Record<string, any>;
const db = supabaseAdmin as any;
const must = (r: { error?: { message: string } | null }) => { if (r.error) throw new Error(r.error.message); };

export async function recoverJlrMandate(userId: string, report: (message: string) => void) {
  const fetched = await db.from("stimulus_orchestrations").select("*").eq("id", JLR_ORCHESTRATION_ID).single();
  must(fetched);
  const orch = fetched.data as Row;
  if (!orch?.mandate_text || !String(orch.mandate_applied_at).startsWith("2026-10-26T04:15:02")) throw new Error("The saved mandate has changed; recovery stopped.");
  const previousRecovery = Array.isArray(orch.mandate_log) ? orch.mandate_log.at(-1) : null;
  if (orch.status !== "complete" || (orch.driver_status === "running" && (previousRecovery?.status === "running" || Date.now() - Date.parse(orch.driver_heartbeat_at || "") < 90_000))) throw new Error("Another orchestration operation is in progress.");
  const selected = await db.from("stimulus_prompts").select("*").eq("orchestration_id", orch.id).order("sort_order");
  must(selected);
  const rows = selected.data as Row[];
  const targets = rows.filter((p) => JLR_CHANNEL_INSTRUCTIONS[p.channel_name]);
  if (rows.length !== 9 || targets.length !== 4) throw new Error("Expected exactly nine channels and four recovery targets.");
  const at = new Date().toISOString();
  const priorLog = Array.isArray(orch.mandate_log) ? orch.mandate_log : [];
  const recovery: Row = { kind: "jlr_selective_recovery", at, actor: userId, mandate: orch.mandate_text, status: "running", before: rows, orchestrationBefore: orch, attempts: [], checks: [] };
  const claim = await db.from("stimulus_orchestrations").update({ driver_status: "running", driver_heartbeat_at: at, phase_note: "Mandate recovery: preparing four channels; five protected channels unchanged.", mandate_log: [...priorLog, recovery] }).eq("id", orch.id).eq("driver_status", orch.driver_status).eq("updated_at", orch.updated_at).select("id");
  must(claim);
  if (!claim.data?.length) throw new Error("The orchestration changed; recovery was not started.");
  const progress = async (message: string) => {
    report(message);
    must(await db.from("stimulus_orchestrations").update({ phase_note: message, driver_heartbeat_at: new Date().toISOString(), mandate_log: [...priorLog, recovery] }).eq("id", orch.id));
  };
  try {
    for (const [index, p] of targets.entries()) {
      // Today's notes and rewrites are ignored: start from the original channel
      // format, with the saved mandate and the user's explicit channel device.
      let prompt = p.initial_prompt || p.working_prompt || p.final_prompt;
      let checks = { verdict: "absent", carrier: "", reason: "No completed generation." };
      const history = Array.isArray(p.revision_log) ? [...p.revision_log] : [];
      history.push({ kind: "mandate_recovery_backup", at, actor: userId, before: p });
      for (let attempt = 1; attempt <= RECOVERY_ATTEMPTS; attempt++) {
        await progress(`Mandate recovery ${index + 1}/4: ${p.channel_name} — generation ${attempt}/3.`);
        const binding = `${orch.mandate_text}\n\nBINDING CHANNEL IMPLEMENTATION:\n${JLR_CHANNEL_INSTRUCTIONS[p.channel_name]}\n\nThe mandate replaces conflicting old devices. Remove published-standard documents, badge rituals, hands-only framing and compulsory editorial findings. Do not use any prior user rewrite notes.${attempt > 1 ? `\nPrevious compliance failure to resolve: ${checks.reason}` : ""}`;
        prompt = await applyMandateToPrompt({ mandate: binding, channelName: p.channel_name, lensName: p.lens_name, prompt });
        await progress(`Mandate recovery ${index + 1}/4: ${p.channel_name} — checking generation ${attempt}/3.`);
        checks = await checkMandateCompliance({ mandate: `${orch.mandate_text}\n\nCHANNEL IMPLEMENTATION:\n${JLR_CHANNEL_INSTRUCTIONS[p.channel_name]}`, channelName: p.channel_name, lensName: p.lens_name, prompt });
        const version = { kind: "mandate_recovery_version", at: new Date().toISOString(), actor: userId, attempt, prompt, compliance: checks };
        history.push(version);
        recovery.attempts.push({ promptId: p.id, channel: p.channel_name, ...version });
        must(await db.from("stimulus_prompts").update({ working_prompt: prompt, final_prompt: prompt, status: "active", rejected_at: null, rejected_reason: null, wad_notes: null, wad_status: "passed", gate_two_notes: null, gate_two_approved: false, gate_two_approved_at: null, gate_two_approved_by: null, gate_two_snapshot: null, mandate_compliance: checks.verdict, mandate_carrier: checks.carrier || checks.reason, mandate_checked_at: new Date().toISOString(), revision_log: history, error: null }).eq("id", p.id).eq("orchestration_id", orch.id));
        if (checks.verdict === "present") break;
      }
    }
    const refreshed = await db.from("stimulus_prompts").select("*").eq("orchestration_id", orch.id).order("sort_order");
    must(refreshed);
    const all = refreshed.data as Row[];
    for (const [i, p] of all.entries()) {
      await progress(`Mandate recovery: checking all nine channels — ${i + 1}/9, ${p.channel_name}.`);
      const check = await checkMandateCompliance({ mandate: orch.mandate_text, channelName: p.channel_name, lensName: p.lens_name, prompt: p.final_prompt || p.working_prompt || "" });
      recovery.checks.push({ channel: p.channel_name, ...check });
      // The five protected rows are deliberately read-only, including metadata.
      if (JLR_CHANNEL_INSTRUCTIONS[p.channel_name]) must(await db.from("stimulus_prompts").update({ mandate_compliance: check.verdict, mandate_carrier: check.carrier || check.reason, mandate_checked_at: new Date().toISOString() }).eq("id", p.id));
    }
    const session = await db.from("sessions").select("brand_name, selected_smp, stage_18_detonation_line").eq("id", orch.session_id).single();
    must(session);
    const registry = await db.from("stimulus_signatures").select("*").eq("orchestration_id", orch.id).eq("status", "active");
    must(registry);
    await progress("Mandate recovery: Creative Director reviewing all nine channels; no protected prompts are being changed.");
    const cd = await runCreativeDirectorPass({ brandName: session.data.brand_name || "Jaguar", smp: session.data.selected_smp || "", detonationLine: session.data.stage_18_detonation_line || "", prompts: all.map((p) => ({ id: p.id, channelName: p.channel_name, lensName: p.lens_name, prompt: p.final_prompt || p.working_prompt || "" })), crossRefs: [], registry: (registry.data || []).map((s: Row) => ({ name: s.name, category: s.category, description: s.description, sourceChannel: s.source_channel || "—" })), revisionNote: `The saved binding mandate is in force. Four previously absent channels were repaired. Judge all nine as a set without rewriting or changing any channel. Editorial and creator independence is retained.\n${orch.mandate_text}` });
    recovery.cd = cd;
    recovery.status = "complete";
    recovery.ready = recoveryReady(recovery.checks, cd.cohesion);
    const failed = recovery.checks.filter((c: Row) => c.verdict !== "present").map((c: Row) => `${c.channel}: ${c.verdict} — ${c.reason}`);
    const message = recovery.ready ? "All 9 channels carry the mandate; CD cohesion passed. Gate Two is ready for your sign-offs and confirmation." : `Gate Two remains blocked. ${failed.join(" | ")}${cd.cohesion !== "pass" ? ` CD: ${cd.reasoning}` : ""}`;
    must(await db.from("stimulus_orchestrations").update({ cd_output: cd.reasoning, cd_status: cd.cohesion === "pass" ? "passed" : "flagged", driver_status: "idle", gate_two_confirmed: false, gate_two_confirmed_at: null, phase_note: message, error: recovery.ready ? null : message, mandate_log: [...priorLog, recovery] }).eq("id", orch.id));
    report(message);
    return { ready: recovery.ready, message, checks: recovery.checks, cd };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Recovery failed";
    recovery.status = "failed";
    recovery.error = message;
    await db.from("stimulus_orchestrations").update({ driver_status: "failed", phase_note: `Mandate recovery stopped: ${message}`, error: message, mandate_log: [...priorLog, recovery] }).eq("id", orch.id);
    throw e;
  }
}