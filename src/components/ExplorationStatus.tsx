import {useEffect,useState} from 'react';
import {useServerFn} from '@tanstack/react-start';
import {getExplorationStatus} from '@/lib/exploration/exploration.functions';
export function ExplorationStatus({sessionId,onReady}:{sessionId:string;onReady:(v:boolean)=>void}) {
  const read=useServerFn(getExplorationStatus);
  const [state,setState]=useState<{outputs:string;job:{status:string;error:string|null}|null}|null>(null);
  const [error,setError]=useState('');
  useEffect(()=>{let live=true;const tick=async()=>{try{const r=await read({data:{sessionId}});if(live){setState(r);onReady(r.outputs!=='null');}}catch(e){if(live)setError(String(e));}};void tick();const t=setInterval(()=>void tick(),8000);return()=>{live=false;clearInterval(t);};},[read,sessionId,onReady]);
  return <section className="mt-3 text-sm"><p>Assessment: {state?.job?.status??'pending'}</p>{(error||state?.job?.error)&&<p role="alert" className="text-destructive">{error||state?.job?.error}</p>}{state?.outputs&&state.outputs!=='null'&&<details><summary>Saved assessment</summary><pre className="mt-2 whitespace-pre-wrap break-words text-xs">{JSON.stringify(JSON.parse(state.outputs),null,2)}</pre></details>}</section>;
}