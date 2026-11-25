import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
export const Route = createFileRoute('/api/public/projection-tick')({ server: { handlers: { POST: async ({request}) => {
  const parsed = z.object({ jobId: z.string().uuid() }).safeParse(await request.json().catch(()=>null));
  if (!parsed.success) return new Response('Invalid job',{status:400});
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data } = await supabaseAdmin.from('bg_projection_jobs').select('wake_token').eq('id',parsed.data.jobId).maybeSingle();
  if (!data || request.headers.get('x-projection-token') !== data.wake_token) return new Response('Unauthorized',{status:401});
  const { runProjection } = await import('@/lib/exploration/projection.server');
  const enc = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({ async start(c) {
    const emit = (v: object) => { try { c.enqueue(enc.encode(JSON.stringify(v)+'\n')); } catch { /* disconnected */ } };
    const timer = setInterval(()=>emit({keepalive:true}),10000);
    try { emit({done:true,...await runProjection(parsed.data.jobId,emit)}); }
    catch(e) { emit({error:e instanceof Error ? e.message : String(e)}); }
    finally { clearInterval(timer); try { c.close(); } catch { /* closed */ } }
  } });
  return new Response(body,{headers:{'content-type':'application/x-ndjson','cache-control':'no-store'}});
} } } });