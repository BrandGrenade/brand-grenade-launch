import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

const Body=z.object({sessionId:z.string().uuid(),version:z.number().int().min(1),subjectBrand:z.string().trim().min(1).max(200),proposition:z.string().trim().min(1).max(2000),
  derivationLabel:z.enum(['BG-derived','Client-supplied']),source:z.string().trim().min(1).max(1000),sourceDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),suppliedBy:z.string().trim().min(1).max(300),derivationNote:z.string().max(2000).optional()});

export const Route=createFileRoute('/api/public/current-position-addon')({server:{handlers:{POST:async({request})=>{
  const token=request.headers.get('authorization')?.replace(/^Bearer /i,'');
  if(!token)return new Response('Sign in required',{status:401});
  const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
  const {data,error}=await supabaseAdmin.auth.getUser(token);
  if(error||!data.user)return new Response('Sign in required',{status:401});
  const {data:admin,error:roleError}=await supabaseAdmin.rpc('bg_is_admin',{_uid:data.user.id});
  if(roleError||admin!==true)return new Response('Forbidden',{status:403});
  const body=Body.safeParse(await request.json().catch(()=>null));
  if(!body.success)return Response.json({error:'Invalid add-on request',issues:body.error.issues},{status:400});
  const {queueBaseline}=await import('@/lib/current-position-addon.server');
  try{return Response.json({jobId:await queueBaseline(data.user.id,body.data)},{headers:{'cache-control':'no-store'}});}
  catch(e){return Response.json({error:e instanceof Error?e.message:String(e)},{status:422});}
}}}});
