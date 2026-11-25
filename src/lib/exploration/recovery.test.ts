import {beforeEach,describe,expect,it,vi} from 'vitest';
import {DIMENSIONS} from '../access/foundations';
import type {Baseline} from './projection';

const mocks=vi.hoisted(()=>({from:vi.fn(),rpc:vi.fn(),model:vi.fn()}));
vi.mock('@/integrations/supabase/client.server',()=>({supabaseAdmin:{from:mocks.from,rpc:mocks.rpc}}));
vi.mock('../claude.server',()=>({callClaude:mocks.model}));
import {runProjection} from './projection.server';
import {explorationDomains} from './recovery.server';

const baseline:Baseline={job_id:'baseline',session_id:'source',version:97,brand_id:'infiniti',market:'global',requested_market:'UK',missing_inputs:['market-specific baseline'],record:{composite:39,code_verdict:'ELIMINATED',...Object.fromEntries(DIMENSIONS.map(([k])=>[k,{score:5}]))},manifest:{},evidence_refs:['saved']};
const raw=JSON.stringify({resulting_position:'Modelled position',assumptions:[],conditions:[],dimensions:Object.fromEntries(DIMENSIONS.map(([k])=>[k,{score:7,reason:'Saved evidence',evidence_refs:['saved'],confidence:'medium',risks:[],conditions:[]}]))});
function chain(result:unknown){const q:any={};for(const key of ['select','eq','is','in','update','order','single','insert'])q[key]=vi.fn(()=>q);q.then=(resolve:(v:unknown)=>void)=>Promise.resolve({data:result,error:null}).then(resolve);return q;}
beforeEach(()=>vi.clearAllMocks());
describe('durable projection recovery',()=>{
 it('terminal failure never restarts paid work',async()=>{
  mocks.from.mockReturnValue(chain({status:'failed',error:'credit exhausted'}));
  expect(await runProjection('job',()=>{})).toEqual({status:'failed',error:'credit exhausted'});expect(mocks.model).not.toHaveBeenCalled();
 });
 it('an active lease refuses a duplicate worker',async()=>{
  mocks.from.mockReturnValueOnce(chain({status:'running',lease_until:new Date(Date.now()+240000).toISOString()})).mockReturnValueOnce(chain([]));
  expect(await runProjection('job',()=>{})).toEqual({status:'running'});expect(mocks.model).not.toHaveBeenCalled();expect(mocks.rpc).not.toHaveBeenCalled();
 });
 it('an interrupted saved attempt publishes without another model call',async()=>{
  mocks.from.mockReturnValueOnce(chain({status:'running',lease_until:'2000-01-01',lease_token:'expired',baseline_snapshot:baseline,proposed_change:{type:'rename',description:'Rename'}})).mockReturnValueOnce(chain([])).mockReturnValueOnce(chain([{id:'job'}])).mockReturnValueOnce(chain([{attempt:1,raw_output:raw,error:null}]));
  mocks.rpc.mockResolvedValue({data:'record',error:null});
  expect(await runProjection('job',()=>{})).toEqual({status:'complete'});expect(mocks.model).not.toHaveBeenCalled();expect(mocks.rpc).toHaveBeenCalledWith('bg_publish_projection',expect.objectContaining({_job:'job',_output:expect.objectContaining({content:expect.objectContaining({projected_composite:63})})}));
 });
 it('a completed record repairs its job marker without appending again',async()=>{
  mocks.from.mockReturnValueOnce(chain({status:'running'})).mockReturnValueOnce(chain([{id:'saved-record'}])).mockReturnValueOnce(chain([{id:'job'}]));
  expect(await runProjection('job',()=>{})).toEqual({status:'complete'});expect(mocks.rpc).not.toHaveBeenCalled();expect(mocks.model).not.toHaveBeenCalled();
 });
 it('a publication failure on a valid saved answer never generates another answer',async()=>{
  mocks.from.mockReturnValueOnce(chain({status:'running',lease_until:'2000-01-01',lease_token:'expired',baseline_snapshot:baseline,proposed_change:{type:'rename',description:'Rename'}})).mockReturnValueOnce(chain([])).mockReturnValueOnce(chain([{id:'job'}])).mockReturnValueOnce(chain([{attempt:1,raw_output:raw,error:null}])).mockReturnValueOnce(chain([{id:'job'}]));
  mocks.rpc.mockResolvedValue({data:null,error:{message:'PROJECTION_LEASE_LOST'}});
  expect(await runProjection('job',()=>{})).toMatchObject({status:'failed',error:'PROJECTION_SAVE_FAILED: PROJECTION_LEASE_LOST'});
  expect(mocks.model).not.toHaveBeenCalled();
 });
 it('a lost compare-and-set lease exits without scoring',async()=>{
  mocks.from.mockReturnValueOnce(chain({status:'queued',baseline_snapshot:baseline})).mockReturnValueOnce(chain([])).mockReturnValueOnce(chain([]));
  expect(await runProjection('job',()=>{})).toEqual({status:'running'});expect(mocks.model).not.toHaveBeenCalled();
 });
 for(const name of ['projection','exploration'])it(`${name} recovery fences the expired lease and only requeues`,async()=>{
  const domain=explorationDomains.find(d=>d.name===name);if(!domain?.recover)throw new Error('Domain missing');
  const q=chain([]);const admin={from:vi.fn(()=>q)};
  await domain.recover(admin,{jobId:'job',quietMs:300001,row:{status:'running',lease_token:'expired'}});
  expect(q.update).toHaveBeenCalledWith({status:'queued',lease_token:null,lease_until:null});expect(q.eq).toHaveBeenCalledWith('lease_token','expired');expect(domain.maxTotalAttempts).toBe(2);expect(mocks.model).not.toHaveBeenCalled();
 });
});