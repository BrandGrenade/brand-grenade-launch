import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { buildValidateOutputs, type ValidateBrief } from './validate-mode';
import { baselineAtVersion } from './current-position-addon';

type Source={sessionId:string;version:number;subjectBrand:string};
export async function loadValidateSource(sb:SupabaseClient<Database>,args:Source,actor:string) {
  // The caller's RLS read is the authorization boundary; never read via admin first.
  const {data:session,error}=await sb.from('sessions').select('*').eq('id',args.sessionId).single();
  if(error||!session)throw new Error('VALIDATE_SOURCE_ACCESS_DENIED');
  if(!session.locked_at)throw new Error('VALIDATE_SOURCE_NOT_LOCKED');
  const {data:meta,error:ve}=await sb.from('run_output_versions').select('created_at').eq('run_table','sessions').eq('run_id',args.sessionId);
  if(ve)throw new Error(`VALIDATE_VERSION_READ_FAILED: ${ve.message}`);
  const current=new Set((meta??[]).map(r=>r.created_at)).size+1;
  if(args.version>current)throw new Error('VALIDATE_SOURCE_VERSION_NOT_FOUND');
  const {data:jobs,error:je}=await sb.from('current_position_addon_jobs').select('id,status,published_version,results,source_manifest,proposition').eq('session_id',args.sessionId).eq('status','complete');
  if(je)throw new Error(`VALIDATE_BASELINE_READ_FAILED: ${je.message}`);
  const subject=args.subjectBrand.trim().toLocaleLowerCase();
  const eligible=(jobs??[]).filter(j=>{
    const manifest=j.source_manifest as Record<string,unknown>;
    return typeof manifest.subject_brand==='string'&&manifest.subject_brand.trim().toLocaleLowerCase()===subject;
  });
  const baseline=baselineAtVersion(eligible,args.version);
  // Same-brand eligibility comes from the saved assessment manifest, never a
  // typed client name or arbitrary browser-written link.
  if(!baseline)throw new Error('VALIDATE_SAME_BRAND_BASELINE_NOT_AVAILABLE');
  const manifest=baseline.source_manifest as Record<string,unknown>;
  const results=baseline.results as Record<string,unknown>;
  const sourceKind=manifest.derivation_label==='Client-supplied'?'client':manifest.derivation_label==='BG-derived'?'BG-derived':'unverified';
  const checkpoints=Object.fromEntries(['a','b','c'].map(k=>[k,{confirmed:(session as Record<string,unknown>)[`checkpoint_${k}_confirmed`]??false,by:(session as Record<string,unknown>)[`checkpoint_${k}_confirmed_by`]??null,at:(session as Record<string,unknown>)[`checkpoint_${k}_confirmed_at`]??null}]));
  return {sessionId:args.sessionId,version:args.version,subjectBrand:args.subjectBrand,baselineJobId:String(baseline.id),proposition:String(baseline.proposition),sourceKind,results,manifest,checkpoints,actor};
}

export async function assembleValidateAssessment(sb:SupabaseClient<Database>,args:Source&{brief:ValidateBrief},actor:string) {
  const source=await loadValidateSource(sb,args,actor);
  if(args.brief.currentProposition!==source.proposition)throw new Error('VALIDATE_PROPOSITION_CHANGED: the saved baseline must match the supplied proposition exactly');
  const provenance=Array.isArray(source.manifest.evidence)?source.manifest.evidence.filter((r):r is Record<string,unknown>=>!!r&&typeof r==='object'):[];
  const outputs=buildValidateOutputs({runId:args.sessionId,version:args.version,brief:args.brief,input:{sourceKind:source.sourceKind as 'client'|'BG-derived'|'unverified',baseline:source.results,bestAlternativeComposite:null},provenance,checkpoints:source.checkpoints});
  // Privileged append only after authorized source read. Fingerprint and
  // revision allocation are row-locked in the database function.
  const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
  const {data:id,error}=await supabaseAdmin.rpc('bg_append_validate_assessment',{_session:args.sessionId,_version:args.version,_actor:actor,_baseline:source.baselineJobId,_brand:args.subjectBrand,_brief:args.brief as never,_outputs:outputs as never});
  if(error)throw new Error(`VALIDATE_ASSESSMENT_SAVE_FAILED: ${error.message}`);
  return {id,outputs};
}