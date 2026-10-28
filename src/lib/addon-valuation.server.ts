import { supabaseAdmin as sb } from '@/integrations/supabase/client.server';
import { buildAddonValuation } from './addon-valuation';
import { recoverSavedStage } from './saved-stage-records';
import { baselineAtVersion } from './current-position-addon';

async function checked<T>(fn: () => PromiseLike<{ data: T; error: { message: string } | null }>) {
  let message = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fn();
    if (!r.error) return r.data;
    message = r.error.message;
    if (attempt < 2) await new Promise(r => setTimeout(r, 250 * (attempt + 1)));
  }
  throw new Error(`VALUATION_DOCUMENT_SAVE_FAILED: ${message}`);
}

export async function regenerateAddonValuation(sessionId: string, version: number) {
  const jobs = await checked(() => sb.from('current_position_addon_jobs').select('*').eq('session_id', sessionId).eq('status', 'complete'));
  const job = baselineAtVersion(jobs ?? [], version);
  if (!job || typeof job.id !== 'string' || job.published_version !== version) throw new Error('VALUATION_BASELINE_VERSION_NOT_FOUND');
  if (job.valuation_document) return { version, characters: String(job.valuation_document).length, cached: true };
  try {
    const session = await checked(() => sb.from('sessions').select('stage_16_valuation_output,stage_10_structured,stage_10_output').eq('id', sessionId).single());
    if (!session) throw new Error('VALUATION_SOURCE_BRIEF_MISSING');
    const candidates = session.stage_10_structured ?? recoverSavedStage('10', session.stage_10_output ?? '');
    const document = buildAddonValuation(session.stage_16_valuation_output ?? '', job, candidates);
    const saved = await checked(() => sb.from('current_position_addon_jobs').update({ valuation_document: document, valuation_document_error: null, valuation_document_saved_at: new Date().toISOString() }).eq('id', job.id as string).is('valuation_document', null).select('valuation_document').maybeSingle());
    if (!saved) throw new Error('VALUATION_DOCUMENT_SAVE_CONFLICT');
    return { version, characters: document.length, cached: false };
  } catch (e) {
    const message = `VALUATION_DOCUMENT_ASSEMBLY_FAILED: ${e instanceof Error ? e.message : String(e)}`;
    await checked(() => sb.from('current_position_addon_jobs').update({ valuation_document_error: message }).eq('id', job.id as string).is('valuation_document', null));
    throw new Error(message);
  }
}

export async function readAddonValuation(sessionId: string) {
  const jobs = await checked(() => sb.from('current_position_addon_jobs').select('status,published_version,valuation_document,valuation_document_error').eq('session_id', sessionId).eq('status', 'complete').order('published_version', { ascending: false }).limit(1));
  const job = jobs?.[0];
  if (job?.valuation_document_error) throw new Error(job.valuation_document_error);
  return job?.valuation_document ? { text: job.valuation_document, version: job.published_version } : null;
}