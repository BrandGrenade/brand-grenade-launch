import { supabaseAdmin as sb } from '@/integrations/supabase/client.server';
import { callClaude, type ClaudeUsage } from '../claude.server';
import { STAGE_10_SYSTEM_PROMPT } from '../stage10-prompt';
import { buildProjection, projectionInstructions, PROJECTION_METHOD, SCORER_PROMPT_VERSION, type Baseline } from './projection';

function checked<T>(r: { data: T; error: { message: string } | null }): NonNullable<T> { if (r.error) throw new Error(`PROJECTION_SAVE_FAILED: ${r.error.message}`); if (r.data === null || r.data === undefined) throw new Error('PROJECTION_RECORD_MISSING'); return r.data; }
export async function queueProjection(clientId: string, baseline: Baseline, change: { type: string; description: string },wake=true) {
  const row = checked(await sb.from('bg_projection_jobs').insert({ bg_client_id: clientId, baseline_job_id: baseline.job_id, baseline_snapshot: baseline as never, proposed_change: change,status:wake?'queued':'running' }).select('id').single());
  return row.id;
}
export async function readProjection(id: string, clientId?: string) {
  let q = sb.from('bg_projection_jobs').select('id,bg_client_id,status,error,baseline_snapshot,proposed_change,created_at').eq('id',id);
  if (clientId) q = q.eq('bg_client_id',clientId);
  const jr = await q.maybeSingle();
  if (jr.error) throw new Error(`PROJECTION_READ_FAILED: ${jr.error.message}`);
  const job = jr.data;
  if (!job) throw new Error('PROJECTION_NOT_FOUND');
  const rr = await sb.from('bg_modelled_projections').select('id,output').eq('job_id',id).maybeSingle();
  if(rr.error)throw new Error(`PROJECTION_READ_FAILED: ${rr.error.message}`);
  return { job, result:rr.data };
}
export async function runProjection(id: string, emit: (v: object) => void) {
  const job = checked(await sb.from('bg_projection_jobs').select('*').eq('id',id).single());
  if (job.status === 'complete' || job.status === 'failed') return { status: job.status, error: job.error };
  if (job.lease_until && Date.parse(job.lease_until)>Date.now()) return { status: 'running' };
  const lease = crypto.randomUUID();
  let q = sb.from('bg_projection_jobs').update({ status: 'running', lease_token: lease, lease_until: new Date(Date.now()+240000).toISOString() }).eq('id',id).eq('status',job.status);
  q = job.lease_token ? q.eq('lease_token',job.lease_token) : q.is('lease_token',null);
  const won = checked(await q.select('id'));
  if (!won.length) return { status: 'running' };
  const heartbeat = setInterval(() => { void sb.from('bg_projection_jobs').update({ lease_until: new Date(Date.now()+240000).toISOString() }).eq('id',id).eq('lease_token',lease).then(() => {}); },30000);
  try {
    const baseline = job.baseline_snapshot as unknown as Baseline;
    const change = job.proposed_change as { type: string; description: string };
    const saved = checked(await sb.from('bg_projection_attempts').select('attempt,raw_output,error').eq('job_id',id).order('attempt'));
    let last = saved.at(-1)?.error ?? '';
    for (const attempt of saved) {
      if (!attempt.raw_output) continue;
      try { const out = buildProjection(baseline,change,JSON.parse(attempt.raw_output),new Date().toISOString()); await publish(out); return {status:'complete'}; } catch { /* a later attempt may be readable */ }
    }
    for (let attempt = saved.length+1; attempt<=3; attempt++) {
      emit({ status: 'running', attempt });
      let raw = ''; let usage: ClaudeUsage | null = null; let error: string | null = null; let out: ReturnType<typeof buildProjection> | null = null;
      try {
        raw = await callClaude({ systemPrompt: STAGE_10_SYSTEM_PROMPT, userMessage: projectionInstructions(baseline,change)+`\nReturn bare JSON only.${last ? ` Previous validation error: ${last}` : ''}`, stageNumber: '10', stageLabel: 'Modelled change projection', maxTokens: 12000, onUsage: u => { usage=u; } });
        raw = raw.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'');
        out = buildProjection(baseline,change,JSON.parse(raw),new Date().toISOString());
      } catch (e) { error = e instanceof Error ? e.message : String(e); last = error; }
      checked(await sb.from('bg_projection_attempts').insert({ job_id: id, attempt, raw_output: raw, error, usage: usage as never }).select('id'));
      if (out) { await publish(out); emit({status:'complete'}); return {status:'complete'}; }
      if (/credit|balance|billing|unauthorized|invalid.*key|refusal/i.test(last)) break;
    }
    throw new Error(`PROJECTION_PLATFORM_ERROR: ${last || 'attempt budget exhausted'}`);
    async function publish(out: ReturnType<typeof buildProjection>) {
      const active = checked(await sb.from('bg_projection_jobs').select('lease_token').eq('id',id).single());
      if (active.lease_token !== lease) throw new Error('PROJECTION_LEASE_LOST');
      checked(await sb.from('bg_modelled_projections').insert({ job_id: id, baseline_job_id: baseline.job_id, baseline_version: baseline.version, output: out as never, method_version: PROJECTION_METHOD, scorer_prompt_version: SCORER_PROMPT_VERSION }).select('id'));
      checked(await sb.from('bg_projection_jobs').update({ status: 'complete', lease_until: null }).eq('id',id).eq('lease_token',lease).select('id'));
    }
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    checked(await sb.from('bg_projection_jobs').update({ status: 'failed', error, lease_until: null }).eq('id',id).eq('lease_token',lease).select('id'));
    emit({ status: 'failed', error }); return {status:'failed',error};
  } finally { clearInterval(heartbeat); }
}