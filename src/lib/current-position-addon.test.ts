import {describe,it,expect} from 'vitest';
import {baselineAtVersion,parseBaseline,terminalBaselineError,INFINITI_PROPOSITION} from './current-position-addon';
import {handleAccess,type Db,type LogEntry} from './access/core';

const line=INFINITI_PROPOSITION;
const dimension={score:7,justification:'Saved evidence, explicitly unverified'};
const raw10={smp:line,field_name:'Infiniti baseline',fame:dimension,truth_strength:dimension,competitive_impossibility:{...dimension,competitor:'Lexus',competitor_claim:'Saved Japanese precision positioning'},brand_permission:{...dimension,evidence:'Saved 2023 refresh'},clean_air:{...dimension,occupier:'Lexus',occupying_claim:'Saved precision claim'},commercial_precedent:{...dimension,precedents:[]}};
const cp=parseBaseline('10',JSON.stringify(raw10),line,{derivation_label:'BG-derived'});
const R='3470f1ad-b322-4230-8e3d-bf0072e95b7a',C='11111111-1111-4111-8111-111111111111';
function database():Db {
  return {listClients:async()=>[],ensureClient:async()=>{throw new Error('not allowed');},attachClient:async()=>{throw new Error('not allowed');},resolveClient:async()=>C,resolveEngagement:async()=>null,listLinkedRuns:async()=>[],actorName:async()=>null,claims:async()=>[],stimulus:async()=>({directions:[],prompts:[],orchestrations:[]}),
    findRun:async()=>({table:'sessions',id:R,row:{bg_client_id:C,link_status:'linked',brief_type:'campaign',locked_at:'2026-10-26',stage_10_output:'Exact saved Campaign prose',stage_10_structured:{scores:[{smp:'Jaguar line'}],current_position:null}}}),
    versions:async()=>Array.from({length:96},(_,i)=>({field:'__boundary',version_no:i+1,content:null,reason:'history',created_at:new Date(Date.UTC(2026,0,1)+i*1000).toISOString()})),
    baselineJobs:async()=>[{status:'complete',published_version:97,results:{'10':cp}}]};
}
const call=(version:number,output_id='stage10_current_position',db=database())=>handleAccess(db,{id:'key',scope:'hub_tools'},{request:'get_output',params:{client_ref:'hub-jlr',run_id:R,version,output_id}},{scope:null,key_id:null,client_ref:null,run_id:null,request:null,output_id:null} as LogEntry);

describe('version-aware current-position add-on',()=>{
  it('serves the new valuation only at v97, retaining the v96 Brief', async () => {
    const db = database();
    const find = db.findRun;
    db.findRun = async id => { const run = await find(id); return run ? { ...run, row: { ...run.row, stage_16_valuation_output: 'Exact v96 Brief' } } : null; };
    db.baselineJobs = async () => [{ status: 'complete', published_version: 97, results: { '10': cp }, valuation_document: 'v97 Infiniti baseline Brief' }];
    expect((await call(96, 'stage16.valuation', db)).content).toEqual({ text: 'Exact v96 Brief' });
    expect((await call(97, 'stage16.valuation', db)).content).toMatchObject({ text: 'v97 Infiniti baseline Brief', baseline_version: 97 });
  });
  it('never exposes v97 baseline on v96, including null predecessors',async()=>{
    const before=await call(96);expect(before.content_status).toBe('not_produced');expect(before.content).toBeNull();
    const after=await call(97);expect(after.content_status).toBe('structured');expect(after.content).toMatchObject({line,derivation_label:'BG-derived',subject_brand:'Infiniti',excluded_from_selection:true});
  });
  it('preserves Campaign prose and candidate scores while adding only the baseline at v97',async()=>{
    const before=await call(96,'stage10'),after=await call(97,'stage10');
    expect((after.content as any).text).toBe('Exact saved Campaign prose');expect((after.content as any).record.scores).toEqual((before.content as any).record.scores);
    expect((before.content as any).record.current_position).toBeNull();expect((after.content as any).record.current_position.line).toBe(line);
  });
  it('ordinary Campaign runs without an add-on remain not produced',async()=>{
    const db=database();db.baselineJobs=async()=>[];expect((await call(97,'stage10_current_position',db)).content_status).toBe('not_produced');
  });
  it('rejects invalid scores instead of silently producing a baseline',()=>{expect(()=>parseBaseline('10',JSON.stringify({...raw10,fame:{...dimension,score:11}}),line,{})).toThrow();});
  it('rejects a rewritten current proposition',()=>{expect(()=>parseBaseline('10',JSON.stringify({...raw10,smp:'A different proposition'}),line,{})).toThrow('Baseline proposition was changed');});
  it('requires named competitive occupancy evidence when the rubric requires it',()=>{expect(()=>parseBaseline('10',JSON.stringify({...raw10,competitive_impossibility:{...dimension,competitor:null,competitor_claim:null}}),line,{})).toThrow('Named competitor required');});
  it('keeps BG-derived separate from client-supplied and leaves unavailable dates null',()=>{expect(cp).toMatchObject({derivation_label:'BG-derived',evidence_label:'Unverified',source_date:null});});
  it('uses the saved subject brand, source and date for a general client baseline',()=>{
    const parsed=parseBaseline('10',JSON.stringify(raw10),line,{subject_brand:'Marlowe Motor Company',derivation_label:'Client-supplied',proposition_source:'Signed client brief',proposition_source_date:'2026-10-30'});
    expect(parsed).toMatchObject({subject_brand:'Marlowe Motor Company',derivation_label:'Client-supplied',evidence_label:'Client-supplied',source:'Signed client brief',source_date:'2026-10-30',line});
  });
  it('denials, refusals and credit exhaustion are terminal, transient 429 is not',()=>{for(const message of ['HTTP 402 credits exhausted','403 denied','401 configuration','content refusal'])expect(terminalBaselineError(message)).toBe(true);expect(terminalBaselineError('429 rate limited')).toBe(false);});
  it('failed or unpublished results cannot leak through the access point',()=>{expect(baselineAtVersion([{status:'failed',published_version:97},{status:'running',published_version:null}],97)).toBeNull();});
  it('Stage 11 requires all eight tests',()=>{expect(()=>parseBaseline('11',JSON.stringify({smp:line,tests:{T1:{result:'HOLDS',rationale:'evidence'}}}),line,{})).toThrow();});
  it('Stage 13 requires all six credibility dimensions',()=>{expect(()=>parseBaseline('13',JSON.stringify({credibility:{product_truth_alignment:dimension},most_vulnerable:'product_truth_alignment'}),line,{})).toThrow();});
  it('other-client linking does not authorize baseline access',async()=>{const db=database();db.resolveClient=async()=>'22222222-2222-4222-8222-222222222222';await expect(call(97,'stage10_current_position',db)).rejects.toThrow('Not found');});
});