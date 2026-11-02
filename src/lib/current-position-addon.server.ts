import { effectiveDerivation } from './validate-mode';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { BASELINE_STAGES, BASELINE_ERRORS, parseBaseline, terminalBaselineError, type BaselineStage } from './current-position-addon';
import { STAGE_10_SYSTEM_PROMPT } from './stage10-prompt';
import { STAGE_11_SYSTEM_PROMPT } from './stage11-prompt';
import { STAGE_13_SYSTEM_PROMPT } from './stage13-prompt';
import { callClaude } from './claude.server';

const sb = supabaseAdmin;
async function checked<T>(operation: () => PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  let message = '';
  for (let attempt=0;attempt<3;attempt++) {
    const r=await operation(); if (!r.error) return r.data; message=r.error.message;
    if(attempt<2) await new Promise(r=>setTimeout(r,500*(attempt+1)));
  }
  throw new Error(`${BASELINE_ERRORS.save}: ${message}`);
}

type Row=Record<string,unknown>;
const mentions=(text:string,brand:string,width=900,limit=6)=>{
  const out:string[]=[];const lower=text.toLocaleLowerCase();const b=brand.toLocaleLowerCase();let i=lower.indexOf(b);
  while(i>=0&&out.length<limit){out.push(text.slice(Math.max(0,i-width/3),i+width));i=lower.indexOf(b,i+width);}
  return out;
};

/** Saved research for any client/run/brand. Read-only; shared by both Validate routes. */
export async function gatherBaselineEvidence(sessionId:string,subjectBrand:string){
  const session=await checked(()=>sb.from('sessions').select('id,brand_name,category,brief_text,bg_client_id,test_copy_of').eq('id',sessionId).single());
  if(!session)throw new Error(`${BASELINE_ERRORS.evidence}: run not found`);
  let clientId=session.bg_client_id as string|null;
  if(!clientId&&session.test_copy_of){const o=await checked(()=>sb.from('sessions').select('bg_client_id').eq('id',session.test_copy_of as string).single());clientId=(o?.bg_client_id as string|null)??null;}
  const brief=mentions(session.brief_text??'',subjectBrand);
  const source_runs:Row[]=[{run_id:sessionId,kind:'run_brief'}];
  let evidence:Row[]=[];let lab_context:string[]=[];
  if(clientId){
    const synths=await checked(()=>sb.from('synthesiser_runs').select('id,created_at').eq('bg_client_id',clientId!).is('archived_at',null).order('created_at',{ascending:false}).limit(3));
    for(const r of synths??[]){
      const claims=await checked(()=>sb.from('synthesiser_claims').select('position,heading,claim_text,label,source,source_date').eq('synthesiser_run_id',r.id).order('position'));
      const hit=(claims??[]).filter(c=>c.claim_text.toLocaleLowerCase().includes(subjectBrand.toLocaleLowerCase()));
      if(hit.length){source_runs.push({run_id:r.id,kind:'synthesiser'});evidence=evidence.concat(hit.slice(0,60));}
    }
    const labs=await checked(()=>sb.from('intelligence_sessions').select('id').eq('bg_client_id',clientId!).is('archived_at',null).limit(5));
    for(const l of labs??[]){
      const v=await checked(()=>sb.from('intelligence_report_versions').select('id,final_report,created_at').eq('session_id',l.id).order('created_at',{ascending:false}).limit(1));
      const rep=v?.[0];const ex=rep?.final_report?mentions(rep.final_report,subjectBrand,1500,3):[];
      if(rep&&ex.length){source_runs.push({run_id:l.id,kind:'intelligence_lab',snapshot_id:rep.id,snapshot_recorded_at:rep.created_at});lab_context=lab_context.concat(ex);}
    }
  }
  return {category:session.category,source_runs,brief_excerpts:brief,evidence:evidence.slice(0,80),lab_context:lab_context.join('\n…\n').slice(0,9000),
    date_limitations:'Snapshot/save dates are not source publication dates; claims keep their saved labels and source_date values.'};
}

export type QueueBaselineArgs={sessionId:string;version:number;subjectBrand:string;proposition:string;derivationLabel:'BG-derived'|'Client-supplied'|'Owner-stated (public)';sourceQuote?:string;source:string;sourceDate:string|null;suppliedBy:string;derivationNote?:string};
/** Route (a): any client, locked run and brand. Admin verification is repeated in the database. */
export async function queueBaseline(actor:string,a:QueueBaselineArgs){
  const ev=await gatherBaselineEvidence(a.sessionId,a.subjectBrand);
  if(!ev.brief_excerpts.length&&!ev.evidence.length&&!ev.lab_context)throw new Error(`${BASELINE_ERRORS.evidence}: no saved research for ${a.subjectBrand} on this run or its client`);
  const effective=effectiveDerivation(a.derivationLabel,{source:a.source,date:a.sourceDate,quote:a.sourceQuote});
  const manifest={derivation_label:effective==='unverified'?'BG-derived':effective,requested_derivation_label:a.derivationLabel,proposition_source_quote:a.sourceQuote??null,subject_brand:a.subjectBrand.trim(),proposition:a.proposition,proposition_source:a.source,proposition_source_date:a.sourceDate,supplied_by:a.suppliedBy,
    derivation_note:a.derivationNote??null,entry_path:'addon',...ev};
  return checked(()=>sb.rpc('bg_queue_current_position_addon',{_session:a.sessionId,_version:a.version,_actor:actor,_proposition:a.proposition,_manifest:manifest as never}));
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
  if(typeof manifest.subject_brand!=='string'||!manifest.subject_brand.trim())throw new Error(`${BASELINE_ERRORS.evidence}: subject brand missing`);
  const subjectBrand=manifest.subject_brand;
  let category=typeof manifest.category==='string' ? manifest.category : 'unspecified';
  if(job.status==='complete'||job.status==='failed'||job.status==='paused') return {status:job.status,error:job.error_message,version:job.published_version};
  if(job.status==='running'&&job.lease_until&&Date.parse(job.lease_until)>Date.now()) return {status:'running'};
  const lease=crypto.randomUUID();
  const won=await checked(()=>{
    const claim=sb.from('current_position_addon_jobs').update({status:'running',lease_token:lease,lease_until:new Date(Date.now()+180000).toISOString(),heartbeat_at:new Date().toISOString()}).eq('id',jobId).eq('status',job.status);
    return (job.lease_token ? claim.eq('lease_token',job.lease_token):claim.is('lease_token',null)).select('id');
  });
  if(!won?.length)return {status:'running'};
  if(job.entry_path==='new'&&manifest.evidence_pending===true){
    // New Validate run: gather the run's own saved research and bind to the locked version.
    const ev=await gatherBaselineEvidence(job.session_id,subjectBrand);category=ev.category??category;
    const {evidence_pending:_p,...rest}=manifest;void _p;
    await checked(()=>sb.rpc('bg_rebind_validate_job',{_job:jobId,_manifest:{...rest,...ev} as never}));
  }
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
      // Re-read saved unreadable attempts first (no model call) before spending a new one.
      const unread=await checked(()=>sb.from('current_position_addon_attempts').select('id,raw_output').eq('job_id',jobId).eq('stage',stage).is('result',null).not('raw_output','is',null).order('attempt'));
      for(const a of unread ?? []){
        try{const result=parseBaseline(stage,String(a.raw_output),job.proposition,job.source_manifest as Record<string,unknown>);
          await checked(()=>sb.from('current_position_addon_attempts').update({result}).eq('id',a.id));
          await checked(()=>sb.from('current_position_addon_jobs').update({results:{...(job.results as Record<string,unknown>),[stage]:result} as never,completed_stages:[...job.completed_stages,stage]}).eq('id',jobId).eq('lease_token',lease));
          emit({stage,complete:true,message:`Stage ${stage} recovered from a saved response`});saved=true;break;}catch{/* keep looking */}
      }
      if(saved)continue;
      for(let attempt=first;attempt<=3;attempt++) {
        emit({stage,attempt,message:`Assessing ${subjectBrand} current position — Stage ${stage}`});
        const record=await checked(()=>sb.from('current_position_addon_attempts').insert({job_id:jobId,stage,attempt}).select('id').single());
        if(!record)throw new Error(`${BASELINE_ERRORS.save}: attempt record was not returned`);
        let raw='';
        try {
          const prompt=stage==='10'?STAGE_10_SYSTEM_PROMPT:stage==='11'?STAGE_11_SYSTEM_PROMPT:STAGE_13_SYSTEM_PROMPT;
          raw=await assess(stage,{systemPrompt:prompt+'\nADD-ON OUTPUT OVERRIDE: return ONLY the single JSON baseline object specified below, no candidate set, prose document, new proposition or downstream action.',
            userMessage:`BRAND: ${subjectBrand}\nCATEGORY: ${category}\nEXACT CURRENT PROPOSITION (${String((job.source_manifest as Row).derivation_label)}): ${job.proposition}\nAssess only this baseline under the unchanged rubric. Do not rewrite the proposition or generate alternatives. Use only evidence for ${subjectBrand} below; keep unverified/client-supplied qualifiers and explicitly identify missing evidence. Do not import another brand's product truths, heritage or performance. Competitor positioning not documented must be labelled a hypothesis, never a verified occupancy claim. Missing evidence is a limitation, not proof of a false claim.\nSOURCE MANIFEST:\n${JSON.stringify(job.source_manifest)}\nPRIOR BASELINE ASSESSMENTS:\n${JSON.stringify(job.results)}\nReturn JSON in this exact shape (scores/justifications are examples, replace them with your assessment):\n${example(stage)}\n${last?`Previous response failed schema validation: ${last}. Repair the schema, not the proposition.`:''}`,
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
    emit({complete:true,version,message:`All three assessments published at v${version}; original outputs unchanged`});
    if(job.entry_path==='new'){
      const {assembleNewRunAssessment}=await import('./validate.server');
      let last='';
      for(let a=0;a<3;a++){try{const r=await assembleNewRunAssessment(jobId);emit({validate:'complete',...r});return {status:'complete',version,assessment:r.id};}catch(e){last=e instanceof Error?e.message:String(e);await new Promise(r=>setTimeout(r,1000*(a+1)));}}
      await checked(()=>sb.from('current_position_addon_jobs').update({error_code:'VALIDATE_ASSESSMENT_SAVE_FAILED',error_message:last}).eq('id',jobId));
      emit({error_code:'VALIDATE_ASSESSMENT_SAVE_FAILED',error:last});return {status:'complete',version,error_code:'VALIDATE_ASSESSMENT_SAVE_FAILED',error:last};
    }
    return {status:'complete',version};
  }catch(e){
    const message=e instanceof Error?e.message:String(e);const paused=terminalBaselineError(message);
    const code=message.match(/BASELINE_[A-Z_]+/)?.[0]??(paused?'BASELINE_PROVIDER_BLOCKED':BASELINE_ERRORS.generation);
    await checked(()=>sb.from('current_position_addon_jobs').update({status:paused?'paused':'failed',error_code:code,error_message:message,lease_until:null}).eq('id',jobId).eq('lease_token',lease));
    emit({error_code:code,error:message});return {status:paused?'paused':'failed',error_code:code,error:message};
  }finally{clearInterval(timer);}
}