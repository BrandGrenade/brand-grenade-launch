// Item 5 live check: the real >40-direction export path, end to end, against a
// real session's stored sweep — validator, data fetch and document build.
import { z } from "zod";
import { supabaseAdmin as db } from "@/integrations/supabase/client.server";
import { buildRawIdeaBatchExport, type RawIdeaBatchExport } from "@/lib/stimulus-export";

const OLD = z.object({ directionIds: z.array(z.string().uuid()).min(1).max(40) });
const NEW = z.object({ directionIds: z.array(z.string().uuid()).min(1).max(1000) });

const session = "6ab4ea96-7c3a-4e0a-91a9-24b601752b35";
const { data: runs } = await db.from("stimulus_runs").select("id, session_id, channel_name, smp").eq("session_id", session);
const runIds = (runs ?? []).map((r) => r.id);
const { data: dirs } = await db.from("stimulus_directions").select("*").in("run_id", runIds).not("direction", "is", null);
const ids = (dirs ?? []).map((d) => d.id);
console.log("real directions in this session's sweep:", ids.length);

console.log("OLD validator:", OLD.safeParse({ directionIds: ids }).success ? "accepted" : "REJECTED — this was the bug");
console.log("NEW validator:", NEW.safeParse({ directionIds: ids }).success ? "accepted" : "rejected");

const runById = new Map((runs ?? []).map((r) => [r.id, r]));
const { data: s } = await db.from("sessions").select("brand_name, category").eq("id", session).single();
const payload = {
  brandName: s?.brand_name ?? "—", category: s?.category ?? "—",
  channelName: [...new Set((dirs ?? []).map((d) => runById.get(d.run_id)?.channel_name))].filter(Boolean).join(" · "),
  smp: runById.get(dirs![0].run_id)?.smp ?? "",
  directions: (dirs ?? []).map((d: Record<string, unknown>) => ({
    lensId: d.lens_id, lensName: d.lens_name, text: d.direction ?? "", instinctBrief: d.instinct_brief ?? "",
    tissueStatus: d.status, ratings: d.ratings ?? null, ratingStatus: d.rating_status ?? null,
    campaignLine: d.campaign_line ?? null, rationale: d.rationale ?? null,
  })),
} as unknown as RawIdeaBatchExport;
const { filename, html } = buildRawIdeaBatchExport(payload);
console.log(`built: ${filename} — ${html.length} chars, ${(html.match(/page-break|class="lens"/g) ?? []).length} lens blocks`);
