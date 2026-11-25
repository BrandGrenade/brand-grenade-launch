import {createFileRoute} from '@tanstack/react-router';
import {z} from 'zod';
export const Route=createFileRoute('/api/public/exploration-tick')({server:{handlers:{POST:async({request})=>{
  const input=z.object({jobId:z.string().uuid()}).safeParse(await request.json().catch(()=>null));
  if(!input.success)return new Response('Invalid job',{status:400});
  const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
  const {data:job}=await supabaseAdmin.from('bg_exploration_jobs').select('wake_token').eq('id',input.data.jobId).maybeSingle();
  if(!job||request.headers.get('x-exploration-token')!==job.wake_token)return new Response('Unauthorized',{status:401});
  const {runExplorationJob}=await import('@/lib/exploration/modes.server');
  const enc=new TextEncoder();const body=new ReadableStream<Uint8Array>({async start(c){const emit=(v:object)=>{try{c.enqueue(enc.encode(JSON.stringify(v)+'\n'));}catch{/* closed */}};const t=setInterval(()=>emit({keepalive:true}),10000);try{emit({done:true,...await runExplorationJob(input.data.jobId,emit)});}catch(e){emit({error:String(e)});}finally{clearInterval(t);try{c.close();}catch{/* closed */}}}});
  return new Response(body,{headers:{'content-type':'application/x-ndjson','cache-control':'no-store'}});
}}}});