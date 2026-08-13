import { createClient } from "@supabase/supabase-js";
import { buildPhase1Document } from "../src/lib/phase1-document-builder";
const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const { data: s } = await sb.from("sessions").select("*").eq("id","6ab4ea96-7c3a-4e0a-91a9-24b601752b35").single();
for (const f of ["consulting","board","client"]) {
  try {
    const d = buildPhase1Document(s as never, f as never).replace(/<[^>]+>/g," ");
    console.log(f, /Real power never announces/i.test(d));
  } catch(e){ console.log(f, "ERR", (e as Error).message); }
}
const { data: docs } = await sb.from("repository_documents").select("id, title, updated_at").limit(20);
console.log(docs);
