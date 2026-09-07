import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "fs";
import { buildPhase1Document } from "../src/lib/phase1-document-builder";
const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const id = process.argv[2];
const { data: s } = await sb.from("sessions").select("*").eq("id", id).maybeSingle();
if (!s) { console.error("no session"); process.exit(1); }
writeFileSync("/tmp/dan/consulting.html", buildPhase1Document(s as never, "consulting"));
writeFileSync("/tmp/dan/agency.html", buildPhase1Document(s as never, "agency"));
writeFileSync("/tmp/dan/vision.md", (s as any).stage_16_vision_output ?? "");
console.log("ok");
