// One-off: drive JLR Stage 16 through the background runner, one format at a
// time. Queues each missing format via the __STAGE_16_RUNNING__ sentinel
// (the bg_stage16_wake trigger fires the published /api/public/stage16-tick
// route, which claims, heartbeats and runs it), polls until the format's
// output column is filled or a real error lands, then queues the next.
// Usage: NODE_PATH=node_modules nohup bun tmpscripts/jlr-stage16-orchestrate.ts &

import { supabaseAdmin } from "../src/integrations/supabase/client.server";

const SESSION_ID = "3470f1ad-b322-4230-8e3d-bf0072e95b7a";
const FORMATS = [
  ["vision", "stage_16_vision_output"],
  ["consulting", "stage_16_consulting_output"],
  ["agency", "stage_16_agency_output"],
  ["workshop", "stage_16_workshop_output"],
  ["valuation", "stage_16_valuation_output"],
] as const;

const POLL_MS = 30_000;
const FORMAT_TIMEOUT_MS = 30 * 60_000;

async function row() {
  const { data, error } = await supabaseAdmin
    .from("sessions")
    .select("stage_16_error, stage_16_vision_output, stage_16_consulting_output, stage_16_agency_output, stage_16_workshop_output, stage_16_valuation_output")
    .eq("id", SESSION_ID)
    .single();
  if (error || !data) throw new Error(error?.message ?? "no row");
  return data as unknown as Record<string, string | null>;
}

for (const [format, column] of FORMATS) {
  let r = await row();
  if (r[column]) {
    console.log(`skip ${format}: already has output (${r[column]!.length} chars)`);
    continue;
  }
  // Queue only if not already queued/claimed for this format.
  if (r.stage_16_error !== `__STAGE_16_RUNNING__:${format}` &&
      r.stage_16_error !== `__STAGE_16_RUNNING__:${format}:claimed:1` &&
      r.stage_16_error !== `__STAGE_16_RUNNING__:${format}:claimed:2` &&
      r.stage_16_error !== `__STAGE_16_RUNNING__:${format}:claimed:3`) {
    const { error } = await supabaseAdmin
      .from("sessions")
      .update({ stage_16_error: `__STAGE_16_RUNNING__:${format}` })
      .eq("id", SESSION_ID)
      .is(column, null);
    if (error) throw new Error(`queue ${format} failed: ${error.message}`);
    console.log(`queued ${format}`);
  } else {
    console.log(`already queued ${format}`);
  }

  const started = Date.now();
  for (;;) {
    await new Promise((res) => setTimeout(res, POLL_MS));
    r = await row();
    if (r[column]) {
      console.log(`done ${format}: ${r[column]!.length} chars`);
      break;
    }
    const err = r.stage_16_error ?? "";
    if (err && !err.startsWith("__STAGE_16_RUNNING__")) {
      console.log(`ERROR ${format}: ${err}`);
      process.exit(1);
    }
    if (Date.now() - started > FORMAT_TIMEOUT_MS) {
      console.log(`TIMEOUT ${format}: still ${err || "no status"} after 30min`);
      process.exit(1);
    }
  }
}
console.log("ALL FORMATS COMPLETE");
