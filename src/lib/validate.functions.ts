import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { ValidateBriefSchema } from './validate-mode';

const SourceInput=z.object({sessionId:z.string().uuid(),version:z.number().int().min(1),subjectBrand:z.string().trim().min(1)});
export const getValidateSource=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(i=>SourceInput.parse(i)).handler(async({data,context})=>{
  const {loadValidateSource}=await import('./validate.server');
  const source=await loadValidateSource(context.supabase,data,context.userId);
  const {session:_s,original:_o,...rest}=source;void _s;void _o;
  return {...rest,results:JSON.stringify(source.results),manifest:JSON.stringify(source.manifest),checkpoints:JSON.stringify(source.checkpoints)};
});
export const saveValidateAssessment=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(i=>SourceInput.extend({brief:ValidateBriefSchema}).parse(i)).handler(async({data,context})=>{
  const {assembleValidateAssessment}=await import('./validate.server');
  const result=await assembleValidateAssessment(context.supabase,data,context.userId);
  return {id:result.id,outputs:JSON.stringify(result.outputs)};
});
const QueueInput=z.object({sessionId:z.string().uuid(),version:z.number().int().min(1),subjectBrand:z.string().trim().min(1).max(200),proposition:z.string().trim().min(1).max(2000),
  derivationLabel:z.enum(['BG-derived','Client-supplied','Owner-stated (public)']),source:z.string().trim().min(1).max(1000),sourceDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),suppliedBy:z.string().trim().min(1).max(300),sourceQuote:z.string().trim().max(4000).optional()});
/** Route (a) add-on for any client, locked run and brand. */
export const queueValidateBaseline=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(i=>QueueInput.parse(i)).handler(async({data,context})=>{
  const {data:admin,error}=await context.supabase.rpc('bg_is_admin',{_uid:context.userId});
  if(error||admin!==true)throw new Error('BASELINE_ACCESS_DENIED: admin only');
  const {queueBaseline}=await import('./current-position-addon.server');
  return {jobId:String(await queueBaseline(context.userId,data))};
});
export const getValidateJobs=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(i=>z.object({sessionId:z.string().uuid()}).parse(i)).handler(async({data,context})=>{
  const {data:jobs,error}=await context.supabase.from('current_position_addon_jobs').select('id,status,entry_path,source_version,published_version,completed_stages,error_code,error_message,created_at,proposition,source_manifest->>subject_brand').eq('session_id',data.sessionId).order('created_at');
  if(error)throw new Error(`BASELINE_READ_FAILED: ${error.message}`);
  const {data:assessments,error:ae}=await context.supabase.from('validate_assessments').select('id,run_version,assessment_revision,subject_brand,entry_path,outputs,created_at').eq('session_id',data.sessionId).order('created_at');
  if(ae)throw new Error(`VALIDATE_ASSESSMENT_READ_FAILED: ${ae.message}`);
  return {jobs:JSON.stringify(jobs??[]),assessments:JSON.stringify(assessments??[])};
});
