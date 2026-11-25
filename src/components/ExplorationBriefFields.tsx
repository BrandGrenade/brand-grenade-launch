import {useEffect,useState} from 'react';
import {useServerFn} from '@tanstack/react-start';
import {listExplorationBaselines} from '@/lib/exploration/exploration.functions';
import {ExplorationBriefSchema,type ExplorationBrief} from '@/lib/exploration/modes';
export function ExplorationBriefFields({mode,brand,value,onChange}:{mode:'headroom'|'turnaround';brand:string;value:Record<string,string>;onChange:(v:Record<string,string>,brief:ExplorationBrief|null)=>void}) {
  const read=useServerFn(listExplorationBaselines);
  const [baselines,setBaselines]=useState<{id:string;proposition:string;version:number|null;market:string}[]>([]);
  const [error,setError]=useState('');
  useEffect(()=>{let live=true;setBaselines([]);if(!brand.trim())return;void read({data:{brand}}).then(r=>{if(live){setBaselines(r);setError(r.length?'':'No current position for brand × market');}}).catch(e=>{if(live)setError(String(e));});return()=>{live=false;};},[brand,read]);
  const update=(key:string,v:string)=>{const next={...value,[key]:v};const parsed=ExplorationBriefSchema.safeParse({...next,mode});onChange(next,parsed.success?parsed.data:null);};
  const fields=mode==='headroom'?[['growthAmbition','Growth ambition'],['timeHorizon','Time horizon'],['constraints','Constraints (capital, category, geography)'],['categoriesAndMarkets','Categories and markets to test']]:[['performanceSymptoms','Performance symptoms'],['marketsAndChannels','Markets and channels'],['knownCommercialFactors','Known commercial factors'],['partnerHypotheses','Partner-supplied hypotheses']];
  return <div className="grid gap-3 sm:grid-cols-2">
    <label className="text-sm font-semibold sm:col-span-2">Current-position baseline<select aria-label="Current-position baseline" className="input-base mt-2 w-full" value={value['baselineJobId']??''} onChange={e=>update('baselineJobId',e.target.value)}><option value="">Select saved baseline</option>{baselines.map(b=><option key={b.id} value={b.id}>{b.proposition} · v{b.version} · {b.market}</option>)}</select></label>
    <label className="text-sm font-semibold">Requested market<input aria-label="Requested market" className="input-base mt-2 w-full" value={value['market']??''} onChange={e=>update('market',e.target.value)}/></label>
    {fields.map(([key,label])=>key&&label?<label key={key} className="text-sm font-semibold">{label}<textarea aria-label={label} rows={3} className="input-base mt-2 w-full" value={value[key]??''} onChange={e=>update(key,e.target.value)}/></label>:null)}
    {error&&<p role="alert" className="text-sm text-destructive sm:col-span-2">{error}</p>}
  </div>;
}