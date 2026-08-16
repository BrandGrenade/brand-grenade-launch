import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "fs";
import {
  buildJaguarSummaryDocument,
  type JaguarCreativeExtras,
} from "../src/lib/jaguar-summary-document";

const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const id = process.argv[2] ?? "6ab4ea96-7c3a-4e0a-91a9-24b601752b35";

const { data: s, error } = await sb.from("sessions").select("*").eq("id", id).maybeSingle();
if (error || !s) {
  console.error("session load failed", error);
  process.exit(1);
}

const { data: runs } = await sb
  .from("stimulus_runs")
  .select("id, creative_guidance, created_at")
  .eq("session_id", id);
const runIds = (runs ?? []).map((r: any) => r.id);

const { data: dirs } = await sb
  .from("stimulus_directions")
  .select("id, lens_name, campaign_line, expression_under_master, rating_status, ratings")
  .in("run_id", runIds.length ? runIds : ["00000000-0000-0000-0000-000000000000"]);

const all = dirs ?? [];
const rated = all.filter((d: any) => d.rating_status === "rated");
const lockedLine = (s as any).locked_campaign_line?.trim();
const lockedLens = (s as any).locked_big_idea_lens?.trim();

const rating = (d: any, k: string, f = "rating") => d.ratings?.[k]?.[f] ?? null;
const shortlist = rated.map((d: any) => ({
  lens: d.lens_name,
  line: d.campaign_line,
  expression: d.expression_under_master,
  ambition: rating(d, "creative_ambition"),
  fame: rating(d, "fame"),
  compliance: rating(d, "strategic_compliance"),
  winner: d.campaign_line?.trim() === lockedLine && d.lens_name?.trim() === lockedLens,
}));

const winner = rated.find(
  (d: any) => d.campaign_line?.trim() === lockedLine && d.lens_name?.trim() === lockedLens,
);
const winnerReasons = winner
  ? [
      { title: "Creative ambition", detail: rating(winner, "creative_ambition", "judgement") },
      { title: "Fame potential", detail: rating(winner, "fame", "rationale") },
      { title: "Uniqueness", detail: rating(winner, "creative_uniqueness", "verdict") },
      { title: "Brand glue", detail: rating(winner, "brand_glue", "reusable_asset") },
    ].filter((r) => r.detail)
  : [];

const { count: promptCount } = await sb
  .from("stimulus_prompts")
  .select("id", { count: "exact", head: true })
  .in(
    "orchestration_id",
    (
      (
        await sb.from("stimulus_orchestrations").select("id").eq("session_id", id)
      ).data ?? []
    ).map((o: any) => o.id),
  );

const raw21 = (s as any).stage_21_outputs;
const channels =
  raw21 && typeof raw21 === "object" && !Array.isArray(raw21)
    ? Object.entries(raw21 as Record<string, string>).map(([name, body]) => {
        const sentence =
          String(body)
            .split("\n")
            .map((l) => l.trim())
            .find((l) => l.length > 60 && !l.startsWith("#")) ?? "";
        return { name, role: sentence.split(/(?<=\.)\s/)[0] ?? null };
      })
    : [];

const extras: JaguarCreativeExtras = {
  lensesSwept: new Set(all.map((d: any) => d.lens_name)).size || 37,
  directionsGenerated: all.length,
  directionsRated: rated.length,
  promptsWritten: promptCount ?? 0,
  guidance: (runs ?? []).map((r: any) => r.creative_guidance).find(Boolean) ?? null,
  shortlist,
  winnerReasons,
  channels,
  researchSources: 0,
};

mkdirSync("/tmp/browser/jaguar", { recursive: true });
const html = buildJaguarSummaryDocument(s as never, extras);
writeFileSync("/tmp/browser/jaguar/summary.html", html);
console.log("written", html.length, "chars; shortlist", shortlist.length, "channels", channels.length);
