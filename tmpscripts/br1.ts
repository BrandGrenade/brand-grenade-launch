import { supabaseAdmin } from "@/integrations/supabase/client.server";
const { data } = await supabaseAdmin.from("briefing_room_workspaces")
  .select("id,brand_name,updated_at,last_error,diagnosis,truths,relevance,tensions,raw_brief")
  .order("updated_at",{ascending:false}).limit(5);
for (const r of data ?? []) console.log(r.id, r.brand_name, r.updated_at, "brief:"+(r.raw_brief?.length??0),
  "d:"+!!r.diagnosis, "t:"+!!r.truths, "r:"+!!r.relevance, "x:"+!!r.tensions, "err:", r.last_error);
