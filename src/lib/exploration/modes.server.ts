import {supabaseAdmin as sb} from '@/integrations/supabase/client.server';
import {callClaude} from '../claude.server';
import {brandId} from '../access/foundations';
import {ExplorationBriefSchema,HeadroomResult,TurnaroundResult,buildModeOutputs} from './modes';
import {queueProjection,runProjection,readProjection} from './projection.server';
import {type Baseline} from './projection';
import {zodToJsonSchema} from 'zod-to-json-schema';
const check=<T,>(r:{data:T;error:{message:string}|null}):NonNullable<T>=>{if(r.error)throw new Error(r.error.message);if(r.data==null)throw new Error('EXPLORATION_RECORD_MISSING');return r.data;};
export async function runExplorationJob(id:string,emit:(v:object)=>void){
  const job=check(await sb.from('bg_exploration_jobs').select('*').eq('id',id).single());
  if(job.status==='complete'||job.status==='failed')return {status:job.status,error:job.error};
  if(job.lease_until&&Date.parse(job.lease_until)>Date.now())return {status:'running'};
  const lease=crypto.randomUUID();
  let q=sb.from('bg_exploration_jobs').update({status:'running',lease_token:lease,lease_until:new Date(Date.now()+240000).toISOString()}).eq('id',id).eq('status',job.status);
  q=job.lease_token?q.eq('lease_token',job.lease_token):q.is('lease_token',null);
  if(!check(await q.select('id')).length)return {status:'running'};
  const timer=setInterval(()=>{void sb.from('bg_exploration_jobs').update({lease_until:new Date(Date.now()+240000).toISOString()}).eq('id',id).eq('lease_token',lease).then(()=>{});},30000);
  try{
    const s=check(await sb.from('sessions').select('*').eq('id',job.session_id).single());
    const brief=ExplorationBriefSchema.parse(s.exploration_brief);
    if(!s.checkpoint_a_confirmed||!s.checkpoint_b_confirmed||!s.checkpoint_c_confirmed||!s.stage_13_output)throw new Error('EXPLORATION_CHECKPOINT_NOT_CONFIRMED');
    const base=check(await sb.from('current_position_addon_jobs').select('*').eq('id',brief.baselineJobId).single());
    if(!base.published_version||base.status!=='complete')throw new Error('No current position for brand × market');
    const manifest=base.source_manifest as Record<string,unknown>;
    const market=String(manifest['market']??'global');
    const baseline:Baseline={job_id:base.id,session_id:base.session_id,version:base.published_version,brand_id:brandId(s.brand_name),market,requested_market:brief.market,missing_inputs:market.toLowerCase()!==brief.market.toLowerCase()?['market-specific baseline']:[],record:(base.results as Record<string,unknown>)['10'] as Record<string,unknown>,manifest,evidence_refs:[`current_position_addon_jobs:${base.id}:results.10`]};
    const versionRows=check(await sb.from('run_output_versions').select('created_at').eq('run_table','sessions').eq('run_id',s.id));
    const version=new Set(versionRows.map(r=>r.created_at)).size+1;
    const stageEvidence=Object.fromEntries(Object.entries(s).filter(([k,v])=>/^stage_(?:[1-9]|1[0-3])(?:b)?_output$/.test(k)&&v));
    const schema=brief.mode==='headroom'?HeadroomResult:TurnaroundResult;
    const schemaJson=JSON.stringify(zodToJsonSchema(schema));
    const attempts=check(await sb.from('bg_exploration_attempts').select('attempt,raw_output,error').eq('job_id',id).order('attempt'));
    let result:unknown=null;let last=attempts.at(-1)?.error??'';
    for(const a of attempts){if(!a.raw_output)continue;try{result=schema.parse(JSON.parse(a.raw_output));break;}catch{/* retain failed attempt */}}
    for(let attempt=attempts.length+1;!result&&attempt<=3;attempt++){
      let raw='';let error:string|null=null;
      try{emit({status:'running',phase:'assessment',attempt});raw=await callClaude({systemPrompt:'Brand Grenade evidence-bound exploratory analysis. Only the supplied saved evidence may support findings. Return JSON only. Partner hypotheses are not evidence. Separate evidence, hypotheses, modelled interpretation, supported causes and unresolved questions. No unsupported causal attribution, revenue, dollar upside, numerical alternative selection score or certainty of success. Each liked/bought axis needs its own measured evidence and period; otherwise established:false, positive:null, confidence:insufficient. No inference between axes. Each brand fix requires a modelled change projection; commercial problems need a named team and no substitute brand fix.',userMessage:`MODE BRIEF: ${JSON.stringify(brief)}\nCURRENT BASELINE: ${JSON.stringify(baseline)}\nSAVED STAGES: ${JSON.stringify(stageEvidence)}\nHeadroom alternatives: evaluate white space, brand permission/associations, distinction, constraints, confidence; choose exactly one credible alternative with qualitative reasons, keep every principal alternative and its disposition. Band meanings: constrained=limited space/barriers; moderate=additional space with meaningful conditions; substantial=considerable supported achievable space; transformational=materially different opportunity needing significant change, investment/commitment, not certainty.\nReturn exactly this JSON schema: ${schemaJson}\n${last?`Previous validation error: ${last}`:''}`,stageNumber:'13',stageLabel:`${brief.mode} final assessment`,maxTokens:20000});raw=raw.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'');result=schema.parse(JSON.parse(raw));}catch(e){error=String(e);last=error;}
      check(await sb.from('bg_exploration_attempts').insert({job_id:id,attempt,raw_output:raw,error}).select('id'));
      if(/credit|balance|billing|refusal|invalid.*key/i.test(last)&&!result)break;
    }
    if(!result)throw new Error(`EXPLORATION_PLATFORM_ERROR: ${last}`);
    const changes=brief.mode==='headroom'?HeadroomResult.parse(result).alternatives.filter(a=>a.disposition==='selected').map(a=>a.position):TurnaroundResult.parse(result).findings.filter(f=>f.brand_fix).map(f=>String(f.brand_fix));
    const projections:unknown[]=[];
    for(const description of changes){
      emit({phase:'projection',description});
      const pid=await queueProjection(String(s.bg_client_id),baseline,{type:'reposition',description},false);
      const p=await runProjection(pid,emit);
      if(p.status!=='complete')throw new Error(`EXPLORATION_PROJECTION_FAILED: ${p.error??p.status}`);
      projections.push((await readProjection(pid)).result?.output);
    }
    const outputs=buildModeOutputs({brief,runId:s.id,version,brandId:brandId(s.brand_name),market,baseline:baseline.record,result,projections,createdAt:new Date().toISOString(),checkpoints:{A:true,B:true,C:true}});
    const active=check(await sb.from('bg_exploration_jobs').select('lease_token').eq('id',id).single());
    if(active.lease_token!==lease)throw new Error('EXPLORATION_LEASE_LOST');
    check(await sb.from('bg_exploration_assessments').insert({session_id:s.id,baseline_job_id:base.id,run_version:version,outputs:outputs as never}).select('id'));
    check(await sb.from('bg_exploration_jobs').update({status:'complete',lease_until:null}).eq('id',id).eq('lease_token',lease).select('id'));
    emit({status:'complete'});return {status:'complete'};
  }catch(e){const error=String(e);check(await sb.from('bg_exploration_jobs').update({status:'failed',error,lease_until:null}).eq('id',id).eq('lease_token',lease).select('id'));emit({status:'failed',error});return {status:'failed',error};}finally{clearInterval(timer);}
}