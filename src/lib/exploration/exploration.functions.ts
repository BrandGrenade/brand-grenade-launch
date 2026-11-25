import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';
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
  const {data:r,error}=await context.supabase.from('bg_exploration_assessments').select('outputs,created_at').eq('session_id',data.sessionId).order('created_at',{ascending:false}).limit(1).maybeSingle();
  if(error)throw new Error(`EXPLORATION_READ_FAILED: ${error.message}`);
  const {data:jobs,error:je}=await context.supabase.from('bg_exploration_jobs').select('id,status,error').eq('session_id',data.sessionId).order('created_at',{ascending:false}).limit(1).maybeSingle();
  if(je)throw new Error(`EXPLORATION_JOB_READ_FAILED: ${je.message}`);
  return {outputs:JSON.stringify(r?.outputs??null),job:jobs};
});