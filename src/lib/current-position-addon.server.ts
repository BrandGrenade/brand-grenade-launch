import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { BASELINE_STAGES, BASELINE_ERRORS, INFINITI_PROPOSITION, parseBaseline, terminalBaselineError, type BaselineStage } from './current-position-addon';
import { STAGE_10_SYSTEM_PROMPT } from './stage10-prompt';
import { STAGE_11_SYSTEM_PROMPT } from './stage11-prompt';
import { STAGE_13_SYSTEM_PROMPT } from './stage13-prompt';
import { callClaude } from './claude.server';

const sb = supabaseAdmin;
const SESSION = '3470f1ad-b322-4230-8e3d-bf0072e95b7a';
const SYNTH = '8ac87434-3bad-4921-b605-0b57acb26f54';
const LAB = '4740d024-9ce8-4757-905b-91767ce2dff0';
const LAB_V1 = 'e18524c5-b52d-4e17-8216-c162d5440398';

async function checked<T>(operation: () => PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  let message = '';
  for (let attempt=0;attempt<3;attempt++) {
    const r=await operation(); if (!r.error) return r.data; message=r.error.message;
    if(attempt<2) await new Promise(r=>setTimeout(r,500*(attempt+1)));
  }
  throw new Error(`${BASELINE_ERRORS.save}: ${message}`);
}

export async function queueInfinitiBaseline(actor: string) {
  const [claims, history] = await Promise.all([
    checked(()=>sb.from('synthesiser_claims').select('position,heading,claim_text,label,source,source_date').eq('synthesiser_run_id',SYNTH).order('position')),
    checked(()=>sb.from('intelligence_report_versions').select('id,final_report,created_at,reason').eq('session_id',LAB).eq('id',LAB_V1).single()),
  ]);
  if(!history)throw new Error(`${BASELINE_ERRORS.evidence}: saved v1 report not found`);
  const report=history.final_report ?? '';
  const position=report.indexOf("Infiniti brand's existing positioning");
  const refresh=(claims ?? []).find(c=>c.claim_text.includes("Infiniti's 2023 brand refresh"));
  const audience=(claims ?? []).find(c=>c.claim_text.includes('Infiniti')&&c.claim_text.includes('Sep 2021'));
  if(position<0 || !refresh || !audience) throw new Error(`${BASELINE_ERRORS.evidence}: saved v1 positioning and dated supporting claims not found`);
  const excerpts=(claims ?? []).filter(c=>/infiniti/i.test(c.claim_text));
  const manifest={derivation_label:'BG-derived',subject_brand:'Infiniti',proposition:INFINITI_PROPOSITION,
    derivation_note:'A synthesis of the saved Japanese precision/omotenashi positioning and ownership-experience evidence, not an official tagline or independently verified present-day brand promise.',
    source_runs:[{run_id:SYNTH,version:1},{run_id:LAB,version:1,snapshot_id:LAB_V1,snapshot_recorded_at:history.created_at}],
    positioning_quote:report.slice(position,report.indexOf('creates a potential',position)),
    dated_support:[{...audience,date_precision:'September 2021 (in claim; publication day unavailable)'},{...refresh,date_precision:'2023 (in claim; publication day unavailable)'}],
    evidence:excerpts,date_limitations:'source_date fields are null; snapshot/save dates are not source publication dates.',
    lab_context:report.slice(Math.max(0,position-600),position+3500)};
  return checked(()=>sb.rpc('bg_queue_current_position_addon',{_session:SESSION,_version:96,_actor:actor,_proposition:INFINITI_PROPOSITION,_manifest:manifest}));
}

export async function loadBaseline(jobId: string) {
  const job=await checked(()=>sb.from('current_position_addon_jobs').select('*').eq('id',jobId).single());
  if(!job)throw new Error('BASELINE_JOB_NOT_FOUND');
  return job;
}

function example(stage: BaselineStage) {
  if(stage==='10') return '{"smp":"<exact proposition>","field_name":"Current position","fame":{"score":1,"justification":"evidence"},"truth_strength":{"score":1,"justification":"evidence"},"competitive_impossibility":{"score":1,"justification":"evidence","competitor":"named rival","competitor_claim":"claim and evidence label"},"brand_permission":{"score":1,"justification":"evidence","evidence":"source"},"clean_air":{"score":1,"justification":"evidence","occupier":"named rival","occupying_claim":"claim and evidence label"},"commercial_precedent":{"score":1,"justification":"evidence","precedents":[]}}';
  if(stage==='11') return '{"smp":"<exact proposition>","field_name":"Current position","iconic_tier":false,"tests":{"T1":{"result":"HOLDS","rationale":"evidence"},"T2":{"result":"HOLDS","rationale":"evidence"},"T3":{"result":"WOBBLES","rationale":"evidence"},"T4":{"result":"HOLDS","rationale":"evidence"},"T5":{"result":"WOBBLES","rationale":"evidence","counter_line":"line","classification":"COMPETES-FOR-TERRITORY"},"T6":{"result":"WOBBLES","rationale":"evidence"},"T7":{"result":"WOBBLES","rationale":"evidence","misreading":"misreading","guard_rail":"guard rail"},"T8":{"result":"N/A","rationale":null}},"verdict":"VALIDATED — EXPOSED","fatal":[],"flags":[],"exposure_note":"note","strategic_note":null,"rewrite":null,"iconic_final":"N/A"}';
  return '{"credibility":{"product_truth_alignment":{"score":1,"justification":"evidence"},"audience_permission":{"score":1,"justification":"evidence"},"tonal_compatibility":{"score":1,"justification":"evidence"},"behavioural_capacity":{"score":1,"justification":"evidence"},"cultural_authority":{"score":1,"justification":"evidence"},"historical_consistency":{"score":1,"justification":"evidence"}},"most_vulnerable":"historical_consistency"}';
}

function assess(stage: BaselineStage,args:Omit<Parameters<typeof callClaude>[0],'stageNumber'>) {
  if(stage==='10')return callClaude({...args,stageNumber:'10'});
  if(stage==='11')return callClaude({...args,stageNumber:'11'});
  return callClaude({...args,stageNumber:'13'});
}

export async function runBaselineJob(jobId:string, emit:(value:object)=>void) {
  let job=await loadBaseline(jobId);
  const manifest=job.source_manifest as Record<string,unknown>;
  const subjectBrand=typeof manifest.subject_brand==='string' ? manifest.subject_brand : 'Infiniti';
  const category=typeof manifest.category==='string' ? manifest.category : 'premium automotive';
  if(job.status==='complete'||job.status==='failed'||job.status==='paused') return {status:job.status,error:job.error_message,version:job.published_version};
  if(job.status==='running'&&job.lease_until&&Date.parse(job.lease_until)>Date.now()) return {status:'running'};
  const lease=crypto.randomUUID();
  const won=await checked(()=>{
    const claim=sb.from('current_position_addon_jobs').update({status:'running',lease_token:lease,lease_until:new Date(Date.now()+180000).toISOString(),heartbeat_at:new Date().toISOString()}).eq('id',jobId).eq('status',job.status);
    return (job.lease_token ? claim.eq('lease_token',job.lease_token):claim.is('lease_token',null)).select('id');
  });
  if(!won?.length)return {status:'running'};
  let heartbeatError:string|null=null;
  const timer=setInterval(()=>{ void checked(()=>sb.from('current_position_addon_jobs').update({heartbeat_at:new Date().toISOString(),lease_until:new Date(Date.now()+180000).toISOString()}).eq('id',jobId).eq('lease_token',lease)).catch(e=>{heartbeatError=String(e);}); },30000);
  try {
    for(const stage of BASELINE_STAGES) {
      job=await loadBaseline(jobId);
      if(job.completed_stages.includes(stage))continue;
      if(job.status!=='running'||job.lease_token!==lease)throw new Error('BASELINE_LEASE_LOST');
      const previous=await checked(()=>sb.from('current_position_addon_attempts').select('attempt').eq('job_id',jobId).eq('stage',stage));
      const first=(previous ?? []).length+1;
      let last=''; let saved=false;
      for(let attempt=first;attempt<=3;attempt++) {
        emit({stage,attempt,message:`Assessing ${subjectBrand} current position — Stage ${stage}`});
        const record=await checked(()=>sb.from('current_position_addon_attempts').insert({job_id:jobId,stage,attempt}).select('id').single());
        if(!record)throw new Error(`${BASELINE_ERRORS.save}: attempt record was not returned`);
        let raw='';
        try {
          const prompt=stage==='10'?STAGE_10_SYSTEM_PROMPT:stage==='11'?STAGE_11_SYSTEM_PROMPT:STAGE_13_SYSTEM_PROMPT;
          raw=await assess(stage,{systemPrompt:prompt+'\nADD-ON OUTPUT OVERRIDE: return ONLY the single JSON baseline object specified below, no candidate set, prose document, new proposition or downstream action.',
            userMessage:`BRAND: ${subjectBrand}\nCATEGORY: ${category}\nEXACT CURRENT PROPOSITION (${manifest.derivation_label ?? 'BG-derived'}): ${job.proposition}\nAssess only this baseline under the unchanged rubric. Do not rewrite the proposition or generate alternatives. Use only evidence for ${subjectBrand} below; keep unverified/client-supplied qualifiers and explicitly identify missing evidence. Do not import another brand's product truths, heritage or performance. Competitor positioning not documented must be labelled a hypothesis, never a verified occupancy claim. Missing evidence is a limitation, not proof of a false claim.\nSOURCE MANIFEST:\n${JSON.stringify(job.source_manifest)}\nPRIOR BASELINE ASSESSMENTS:\n${JSON.stringify(job.results)}\nReturn JSON in this exact shape (scores/justifications are examples, replace them with your assessment):\n${example(stage)}\n${last?`Previous response failed schema validation: ${last}. Repair the schema, not the proposition.`:''}`,
            stageLabel:`${subjectBrand} baseline ${stage}`,model:'claude-opus-5',maxTokens:64000,effort:'high',skipUniversalWrapper:true});
          const result=parseBaseline(stage,raw,job.proposition,job.source_manifest as Record<string,unknown>);
          if(heartbeatError)throw new Error(heartbeatError);
          await checked(()=>sb.from('current_position_addon_attempts').update({raw_output:raw,result}).eq('id',record.id));
          const results={...(job.results as Record<string,unknown>),[stage]:result};
          await checked(()=>sb.from('current_position_addon_jobs').update({results:results as never,completed_stages:[...job.completed_stages,stage]}).eq('id',jobId).eq('lease_token',lease));
          emit({stage,complete:true,message:`Stage ${stage} structured assessment saved`});saved=true;break;
        }catch(e){
          last=e instanceof Error?e.message:String(e);
          await checked(()=>sb.from('current_position_addon_attempts').update({raw_output:raw,error_code:BASELINE_ERRORS.validation,error_message:last}).eq('id',record.id));
          if(terminalBaselineError(last)||/BASELINE_STRUCTURED_SAVE_FAILED/.test(last))throw e;
          if(!/JSON|Baseline proposition|Named |Zod|invalid|Required|score|justification|expected|incomplete|max_tokens|429|50[0234]|timeout|network/i.test(last))throw e;
          if(attempt<3)await new Promise(r=>setTimeout(r,5000*attempt));
        }
      }
      if(!saved)throw new Error(`${BASELINE_ERRORS.validation}: Stage ${stage}: ${last||'attempt budget exhausted'}`);
    }
    const version=await checked(()=>sb.rpc('bg_publish_current_position_addon',{_job:jobId,_lease:lease}));
    emit({complete:true,version,message:`All three assessments published at v${version}; Campaign content unchanged`});
    return {status:'complete',version};
  }catch(e){
    const message=e instanceof Error?e.message:String(e);const paused=terminalBaselineError(message);
    const code=message.match(/BASELINE_[A-Z_]+/)?.[0]??(paused?'BASELINE_PROVIDER_BLOCKED':BASELINE_ERRORS.generation);
    await checked(()=>sb.from('current_position_addon_jobs').update({status:paused?'paused':'failed',error_code:code,error_message:message,lease_until:null}).eq('id',jobId).eq('lease_token',lease));
    emit({error_code:code,error:message});return {status:paused?'paused':'failed',error_code:code,error:message};
  }finally{clearInterval(timer);}
}