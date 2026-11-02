import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { ValidateBriefSchema, type ValidateBrief } from './validate-mode';
import { baselineAtVersion } from './current-position-addon';
import { assembleValidateOutputs, checkpointsOf, sourceKindOf } from './validate-run';

type Row = Record<string, unknown>;
type Source={sessionId:string;version:number;subjectBrand:string};

async function currentVersion(sb:SupabaseClient<Database>,sessionId:string){
  const {data:meta,error:ve}=await sb.from('run_output_versions').select('created_at').eq('run_table','sessions').eq('run_id',sessionId);
  if(ve)throw new Error(`VALIDATE_VERSION_READ_FAILED: ${ve.message}`);
  return new Set((meta??[]).map(r=>r.created_at)).size+1;
}
async function originalOf(sb:SupabaseClient<Database>,session:Row){
  if(typeof session.test_copy_of!=='string')return null;
  const {data}=await sb.from('sessions').select('id,brand_name,bg_client_id').eq('id',session.test_copy_of).maybeSingle();
  return (data as Row|null)??null;
}

export async function loadValidateSource(sb:SupabaseClient<Database>,args:Source,actor:string) {
  // The caller's RLS read is the authorization boundary; never read via admin first.
  const {data:session,error}=await sb.from('sessions').select('*').eq('id',args.sessionId).single();
  if(error||!session)throw new Error('VALIDATE_SOURCE_ACCESS_DENIED');
  if(!session.locked_at)throw new Error('VALIDATE_SOURCE_NOT_LOCKED');
  const current=await currentVersion(sb,args.sessionId);
  if(args.version!==current)throw new Error('VALIDATE_SOURCE_CURRENT_VERSION_REQUIRED');
  const {data:jobs,error:je}=await sb.from('current_position_addon_jobs').select('id,status,published_version,results,source_manifest,proposition').eq('session_id',args.sessionId).eq('status','complete');
  if(je)throw new Error(`VALIDATE_BASELINE_READ_FAILED: ${je.message}`);
  const subject=args.subjectBrand.trim().toLocaleLowerCase();
  const eligible=(jobs??[]).filter(j=>{
    const manifest=j.source_manifest;
    if(!manifest || typeof manifest!=='object' || Array.isArray(manifest))return false;
    return typeof manifest.subject_brand==='string'&&manifest.subject_brand.trim().toLocaleLowerCase()===subject;
  });
  const baseline=baselineAtVersion(eligible,args.version);
  if(!baseline)throw new Error('VALIDATE_SAME_BRAND_BASELINE_NOT_AVAILABLE');
  const manifest=baseline.source_manifest as Row;
  if(!baseline.results || typeof baseline.results!=='object' || Array.isArray(baseline.results))throw new Error('VALIDATE_BASELINE_RESULT_INVALID');
  const results=baseline.results as Row;
  return {sessionId:args.sessionId,version:args.version,subjectBrand:String(manifest.subject_brand),baselineJobId:String(baseline.id),proposition:String(baseline.proposition),sourceKind:sourceKindOf(manifest),results,manifest,checkpoints:checkpointsOf(session as Row),actor,session:session as Row,original:await originalOf(sb,session as Row)};
}

/** Route (a): add-on on an existing locked run. */
export async function assembleValidateAssessment(sb:SupabaseClient<Database>,args:Source&{brief:ValidateBrief},actor:string) {
  const source=await loadValidateSource(sb,args,actor);
  if(args.brief.currentProposition!==source.proposition)throw new Error('VALIDATE_PROPOSITION_CHANGED: the saved baseline must match the supplied proposition exactly');
  const outputs=assembleValidateOutputs({runId:args.sessionId,version:args.version,brief:args.brief,entryPath:'addon',session:source.session,original:source.original,job:{proposition:source.proposition,results:source.results,source_manifest:source.manifest}});
  const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
  const {data:id,error}=await supabaseAdmin.rpc('bg_append_validate_assessment_v2',{_session:args.sessionId,_version:args.version,_actor:actor,_baseline:source.baselineJobId,_brand:source.subjectBrand,_brief:args.brief as never,_outputs:outputs as never,_entry:'addon'});
  if(error)throw new Error(`VALIDATE_ASSESSMENT_SAVE_FAILED: ${error.message}`);
  return {id,outputs};
}

/** Route (b): new Validate run, assembled by the background runner after the baseline publishes. */
export async function assembleNewRunAssessment(jobId:string){
  const {supabaseAdmin:sb}=await import('@/integrations/supabase/client.server');
  const {data:job,error}=await sb.from('current_position_addon_jobs').select('*').eq('id',jobId).single();
  if(error||!job)throw new Error('VALIDATE_BASELINE_READ_FAILED');
  const {data:session,error:se}=await sb.from('sessions').select('*').eq('id',job.session_id).single();
  if(se||!session)throw new Error('VALIDATE_SOURCE_READ_FAILED');
  const brief=ValidateBriefSchema.parse(session.validate_brief);
  const version=await currentVersion(sb,job.session_id);
  const outputs=assembleValidateOutputs({runId:job.session_id,version,brief,entryPath:'new',session:session as Row,original:await originalOf(sb,session as Row),job:{proposition:job.proposition,results:job.results as Row,source_manifest:job.source_manifest as Row}});
  const {data:id,error:ae}=await sb.rpc('bg_append_validate_assessment_v2',{_session:job.session_id,_version:version,_actor:job.actor_id,_baseline:job.id,_brand:String((job.source_manifest as Row).subject_brand),_brief:session.validate_brief as never,_outputs:outputs as never,_entry:'new'});
  if(ae)throw new Error(`VALIDATE_ASSESSMENT_SAVE_FAILED: ${ae.message}`);
  return {id,version};
}
