import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';
import { explorationSummaryOutOfDate, headroomSelectedAlternative } from './modes';
export const listExplorationBaselines = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(i=>z.object({brand:z.string().trim().min(1)}).parse(i)).handler(async({data,context})=>{
  const {data:rows,error} = await context.supabase.from('current_position_addon_jobs').select('id,session_id,proposition,published_version,source_manifest,results').eq('status','complete').not('published_version','is',null);
  if(error) throw new Error(`BASELINE_READ_FAILED: ${error.message}`);
  if(!rows?.length)return [];
  const {data:sources,error:se}=await context.supabase.from('sessions').select('id,test_copy_of,is_preflight_test').in('id',rows.map(r=>r.session_id));
  if(se)throw new Error(`BASELINE_READ_FAILED: ${se.message}`);
  const production=new Set((sources??[]).filter(s=>!s.test_copy_of&&!s.is_preflight_test).map(s=>s.id));
  return rows.filter(r=>production.has(r.session_id)&&String((r.source_manifest as Record<string,unknown>)['subject_brand']).toLowerCase()===data.brand.toLowerCase() && (r.results as Record<string,any>)['10']?.status==='scored').map(r=>({id:r.id,proposition:r.proposition,version:r.published_version,market:String((r.source_manifest as Record<string,unknown>)['market']??'global')}));
});
export const getExplorationStatus = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(i=>z.object({sessionId:z.string().uuid()}).parse(i)).handler(async({data,context})=>{
  const [assessmentResult,jobResult,sessionResult,versionResult]=await Promise.all([
    context.supabase.from('bg_exploration_assessments').select('outputs,created_at,run_version,selection_confirmed_at,selected_smp').eq('session_id',data.sessionId).order('created_at',{ascending:false}).limit(1).maybeSingle(),
    context.supabase.from('bg_exploration_jobs').select('id,status,error,generation').eq('session_id',data.sessionId).order('created_at',{ascending:false}).limit(1).maybeSingle(),
    context.supabase.from('sessions').select('selected_smp,checkpoint_c_confirmed_at,exploration_brief').eq('id',data.sessionId).single(),
    context.supabase.from('run_output_versions').select('created_at').eq('run_table','sessions').eq('run_id',data.sessionId),
  ]);
  if(assessmentResult.error)throw new Error(`EXPLORATION_READ_FAILED: ${assessmentResult.error.message}`);
  if(jobResult.error)throw new Error(`EXPLORATION_JOB_READ_FAILED: ${jobResult.error.message}`);
  if(sessionResult.error)throw new Error(`EXPLORATION_RUN_READ_FAILED: ${sessionResult.error.message}`);
  if(versionResult.error)throw new Error(`EXPLORATION_VERSION_READ_FAILED: ${versionResult.error.message}`);
  const r=assessmentResult.data;
  // Older immutable assessments predate selection provenance columns. Recover
  // their Checkpoint C identity read-only from the append-only decision record.
  if(r&&!r.selection_confirmed_at){
    const {data:confirmation,error}=await context.supabase.from('checkpoint_confirmations').select('confirmed_at,selected_smp').eq('session_id',data.sessionId).eq('checkpoint','c').lte('confirmed_at',r.created_at).order('confirmed_at',{ascending:false}).limit(1).maybeSingle();
    if(error)throw new Error(`EXPLORATION_SELECTION_READ_FAILED: ${error.message}`);
    r.selection_confirmed_at=confirmation?.confirmed_at??null;
    r.selected_smp=confirmation?.selected_smp??null;
  }
  const currentVersion=new Set((versionResult.data??[]).map(v=>v.created_at)).size+1;
  const current={selectionConfirmedAt:sessionResult.data.checkpoint_c_confirmed_at,selectedSmp:sessionResult.data.selected_smp,runVersion:currentVersion};
  const brief=sessionResult.data.exploration_brief;
  const explorationMode=brief&&typeof brief==='object'&&!Array.isArray(brief)?String((brief as Record<string,unknown>)['mode']??''):'';
  const selectionMismatch=!!r&&explorationMode==='headroom'&&headroomSelectedAlternative(r.outputs)!==sessionResult.data.selected_smp;
  const outOfDate=r?explorationSummaryOutOfDate({selectionConfirmedAt:r.selection_confirmed_at,selectedSmp:r.selected_smp,runVersion:r.run_version},current)||selectionMismatch:false;
  return {outputs:JSON.stringify(r?.outputs??null),job:jobResult.data,outOfDate,assessmentVersion:r?.run_version??null};
});