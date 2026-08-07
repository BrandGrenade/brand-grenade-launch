import { createClient } from "@supabase/supabase-js";
import { assertSmpVerbatimCarriage, flattenStrings } from "./src/lib/smp-carriage";
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const ids = ["ab7aa6f2-e880-4100-acfc-1e9ec27d2ece","ab5bc5db-49c9-4c07-b603-522d711d83ac","df8a6e1d-4fa2-4a4c-a1c6-d6a35486b925","08fbc851-9b4d-4511-b5bc-b274228a13f9","42142616-3fbc-414e-8a9e-2ebdddf45dd8"];
for (const id of ids) {
  const { data: row } = await sb.from("sessions").select("brand_name, selected_smp, stage_20_output, stage_20b_output, stage_21_outputs").eq("id", id).single();
  if (!row) { console.log(id, "no row"); continue; }
  try {
    const d = assertSmpVerbatimCarriage(row.selected_smp, [
      { label: "Stage 20", output: row.stage_20_output },
      { label: "Stage 20B", output: row.stage_20b_output },
      { label: "Stage 21 (all channel briefs)", output: flattenStrings(row.stage_21_outputs) },
    ]);
    console.log("PASS", row.brand_name, "|", JSON.stringify(row.selected_smp), "|", d);
  } catch (e:any) { console.log("FAIL", row.brand_name, "|", JSON.stringify(row.selected_smp), "|", e.message); }
}
