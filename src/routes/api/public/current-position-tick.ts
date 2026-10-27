import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

export const Route=createFileRoute('/api/public/current-position-tick')({server:{handlers:{POST:async({request})=>{
  const input=z.object({jobId:z.string().uuid()}).safeParse(await request.json().catch(()=>null));
  if(!input.success)return new Response('Invalid job',{status:400});
  const {loadBaseline,runBaselineJob}=await import('@/lib/current-position-addon.server');
  const job=await loadBaseline(input.data.jobId);
  const wake=request.headers.get('x-baseline-token');
  const tickSecret=process.env['SWEEP_TICK_SECRET'];
  if(wake!==job.wake_token&&(!tickSecret||request.headers.get('x-sweep-secret')!==tickSecret))return new Response('Unauthorized',{status:401});
  const enc=new TextEncoder();
  const body=new ReadableStream<Uint8Array>({async start(controller){
    const emit=(value:object)=>{try{controller.enqueue(enc.encode(JSON.stringify(value)+'\n'));}catch{/* observer disconnected */}};
    const timer=setInterval(()=>emit({keepalive:true}),10000);
    try{emit({jobId:job.id,status:job.status});emit({done:true,...await runBaselineJob(job.id,emit)});}
    catch(e){emit({done:true,error_code:'BASELINE_RUNNER_FAILED',error:e instanceof Error?e.message:String(e)});}
    finally{clearInterval(timer);try{controller.close();}catch{/* closed */}}
  }});
  return new Response(body,{headers:{'content-type':'application/x-ndjson','cache-control':'no-store'}});
}}}});