import { createFileRoute } from '@tanstack/react-router';

export const Route=createFileRoute('/api/public/current-position-addon')({server:{handlers:{POST:async({request})=>{
  const token=request.headers.get('authorization')?.replace(/^Bearer /i,'');
  if(!token)return new Response('Sign in required',{status:401});
  const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
  const {data,error}=await supabaseAdmin.auth.getUser(token);
  if(error||!data.user)return new Response('Sign in required',{status:401});
  const {data:admin,error:roleError}=await supabaseAdmin.rpc('bg_is_admin',{_uid:data.user.id});
  if(roleError||admin!==true)return new Response('Forbidden',{status:403});
  const {queueInfinitiBaseline}=await import('@/lib/current-position-addon.server');
  try{return Response.json({jobId:await queueInfinitiBaseline(data.user.id)},{headers:{'cache-control':'no-store'}});}
  catch(e){return Response.json({error:e instanceof Error?e.message:String(e)},{status:422});}
}}}});