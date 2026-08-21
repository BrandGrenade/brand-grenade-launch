// Server-only implementation of territory-level revision for the
// Intelligence Lab. A single territory object is regenerated against a
// free-text human redirect and spliced back into the stored report, so a
// targeted correction never costs a full session re-run.

import { streamClaude } from "./claude.server";
import { parseJsonLenient } from "./loc/json-sanitize";
import { buildSystemPrompt } from "./intelligence/system-prompt";
import { buildFeedbackInjection } from "./feedback-injection";

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 12000;
const TEMPERATURE = 0.4;

interface ReportShape {
  territories?: Array<Record<string, unknown> & { id: string }>;
  [key: string]: unknown;
}

export async function reviseTerritoryRun(args: {
  sessionId: string;
  territoryId: string;
  instructions: string;
}): Promise<{ success: boolean; error?: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { sessionId, territoryId } = args;

  const write = async (patch: Record<string, unknown>) => {
    try {
      await supabaseAdmin.from("intelligence_sessions").update(patch as never).eq("id", sessionId);
    } catch {
      /* best effort */
    }
  };

  const { data: row } = await supabaseAdmin
    .from("intelligence_sessions")
    .select("id, brand_name, category, final_report, report_metadata")
    .eq("id", sessionId)
    .maybeSingle();
  if (!row?.final_report) {
    await write({ status: "complete", stage_status: "complete:10", last_error: "No report to revise" });
    return { success: false, error: "No report to revise" };
  }

  let report: ReportShape;
  try {
    report = JSON.parse(row.final_report) as ReportShape;
  } catch {
    await write({ status: "complete", stage_status: "complete:10", last_error: "Stored report is not valid JSON" });
    return { success: false, error: "Stored report is not valid JSON" };
  }
  const territories = Array.isArray(report.territories) ? report.territories : [];
  const index = territories.findIndex((t) => t?.id === territoryId);
  if (index < 0) {
    await write({ status: "complete", stage_status: "complete:10", last_error: "Territory not found" });
    return { success: false, error: "Territory not found" };
  }
  const target = territories[index]!;

  const meta =
    row.report_metadata && typeof row.report_metadata === "object" && !Array.isArray(row.report_metadata)
      ? (row.report_metadata as Record<string, unknown>)
      : {};
  const briefType = String(meta["brief_type"] ?? "commercial").toLowerCase() === "government"
    ? "government"
    : "commercial";

  const previous = JSON.stringify(target, null, 2);
  const injection = buildFeedbackInjection({
    feedback: args.instructions,
    previousOutput: previous.slice(0, 40000),
    stageLabel: "Intelligence Lab territory",
  });

  const otherNames = territories
    .filter((_, i) => i !== index)
    .map((t) => `- ${String(t?.["name"] ?? t?.id ?? "")}`)
    .join("\n");

  const userMessage = `${injection.prefix}TERRITORY REVISION REQUEST

Brand: ${row.brand_name ?? "Not specified"}
Category: ${row.category ?? "Not specified"}
Brief type: ${briefType}

You are revising ONE territory from an existing Strategic Territory Intelligence Report.
Other territories in the report (do not duplicate or drift into them):
${otherNames || "(none)"}

Return a SINGLE JSON object for this territory only, using EXACTLY the same
key structure and enum vocabulary as the object below. Keep the "id" value
unchanged ("${territoryId}"). Preserve any field the human direction does not
require changing, but rewrite every field the direction affects — including
downstream reasoning, scores, rationales and the prebrief.

CURRENT TERRITORY OBJECT:
${previous}
${injection.suffix}

Return ONLY the revised JSON object. No preamble, no markdown fences.`;

  let accumulated = "";
  try {
    const stream = streamClaude({
      systemPrompt: buildSystemPrompt(briefType as "commercial" | "government"),
      userMessage,
      maxTokens: MAX_TOKENS,
      model: MODEL,
      temperature: TEMPERATURE,
      skipUniversalWrapper: true,
      stageLabel: "Intelligence Engine — Territory revision",
      stageNumber: "IE-R",
      stageName: "Intelligence Territory Revision",
    });
    for await (const delta of stream) {
      accumulated += delta;
      if (accumulated.length % 4000 < 40) await write({ updated_at: new Date().toISOString() });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Streaming error";
    await write({ status: "complete", stage_status: "complete:10", last_error: `Territory revision failed: ${message}` });
    return { success: false, error: message };
  }

  const stripped = accumulated
    .trim()
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  let revised: Record<string, unknown> | null = null;
  try {
    revised = parseJsonLenient(stripped) as Record<string, unknown>;
  } catch {
    revised = null;
  }
  if (!revised || typeof revised !== "object" || Array.isArray(revised)) {
    await write({
      status: "complete",
      stage_status: "complete:10",
      last_error: "Territory revision returned unparseable JSON — original territory kept",
    });
    return { success: false, error: "Unparseable revision" };
  }

  revised["id"] = territoryId;
  const nextTerritories = [...territories];
  nextTerritories[index] = revised as Record<string, unknown> & { id: string };
  const nextReport: ReportShape = { ...report, territories: nextTerritories };

  const revisionLog = Array.isArray(meta["territory_revisions"])
    ? (meta["territory_revisions"] as unknown[])
    : [];
  revisionLog.push({
    territory_id: territoryId,
    instructions: args.instructions.slice(0, 4000),
    at: new Date().toISOString(),
  });

  await write({
    final_report: JSON.stringify(nextReport),
    status: "complete",
    stage_status: "complete:10",
    last_error: null,
    report_metadata: { ...meta, territory_revisions: revisionLog.slice(-50) },
  });
  return { success: true };
}
