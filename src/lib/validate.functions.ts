import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { ValidateBriefSchema } from './validate-mode';

const SourceInput=z.object({sessionId:z.string().uuid(),version:z.number().int().min(1),subjectBrand:z.string().trim().min(1)});
export const getValidateSource=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(i=>SourceInput.parse(i)).handler(async({data,context})=>{
  const {loadValidateSource}=await import('./validate.server');
  return loadValidateSource(context.supabase,data,context.userId);
});
export const saveValidateAssessment=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(i=>SourceInput.extend({brief:ValidateBriefSchema}).parse(i)).handler(async({data,context})=>{
  const {assembleValidateAssessment}=await import('./validate.server');
  return assembleValidateAssessment(context.supabase,data,context.userId);
});