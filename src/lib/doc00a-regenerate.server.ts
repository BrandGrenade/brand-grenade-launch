// BRAND GRENADE — DOCUMENT 00A REGENERATION (reconciliation run)
// ============================================================================
// Why this exists: Document 00A is rendered live from
// intelligence_sessions.final_report, so "regenerating" it only ever reprinted
// the same stored report. Downstream work — territory absorption, exclusions
// agreed in the Briefing Room, human-corrected evidence — never flowed back,
// so the only way to get an accurate 00A was to hand-patch the output. A
// hand-patched deliverable has no run reference and no traceability, which is
// the whole point of the document.
//
// This module performs a genuine platform run: the current report is
// reconciled, territory by territory, against the session's current downstream
// state, and written back with its own run reference. Nothing is edited by
// hand and nothing is silently dropped — a territory whose reconciliation
// fails to parse is kept verbatim and reported as kept.
//
// It runs as a sequence of small calls rather than one whole-report call: a
// full report is far larger than a single completion can return, and a single
// call would silently thin the parts it did not have room for.

import { streamClaude } from "./claude.server";
import { parseJsonLenient } from "./loc/json-sanitize";
import { buildSystemPrompt } from "./intelligence/system-prompt";
import { CLAIM_LANGUAGE_RULES } from "./intelligence/claim-language";

const MODEL = "claude-sonnet-4-6";
const TERRITORY_MAX_TOKENS = 16000;
const SUMMARY_MAX_TOKENS = 4000;
const TEMPERATURE = 0.3;

type Loose = Record<string, unknown>;

interface ReportShape {
  executive_summary?: string;
  completeness_assessment?: unknown;
  territories?: Array<Loose & { id: string }>;
  recommended_primary_territory_id?: string;
  [key: string]: unknown;
}

export interface Doc00ARegenerationResult {
  success: boolean;
  error?: string;
  runRef?: string;
  revision?: number;
  rewritten?: string[];
  kept?: string[];
}

const strip = (s: string): string =>
  s
    .trim()
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

function asObject(v: unknown): Loose {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Loose) : {};
}

/**
 * Everything the session currently knows downstream of the report. This is the
 * material the stored report has NOT seen: the brief as it now stands, and
 * every piece of evidence a human corrected, added or removed by hand.
 */
async function downstreamDigest(
  supabaseAdmin: {
    from: (t: string) => {
      select: (c: string) => {
        eq: (
          k: string,
          v: string,
        ) => {
          order: (
            c: string,
            o: { ascending: boolean },
          ) => { limit: (n: number) => Promise<{ data: unknown }> };
        };
      };
    };
  },
  userId: string,
  brandName: string,
): Promise<{ text: string; workspaceIds: string[] }> {
  try {
    const { data } = await supabaseAdmin
      .from("briefing_room_workspaces")
      .select("id, brand_name, raw_brief, truths, selected_frame, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(20);
    const rows = (Array.isArray(data) ? data : []) as Array<{
      id: string;
      brand_name: string | null;
      raw_brief: string | null;
      truths: unknown;
      selected_frame: string | null;
    }>;
    const brand = brandName.trim().toLowerCase();
    const mine = rows.filter((r) => (r.brand_name ?? "").trim().toLowerCase() === brand);
    if (!mine.length) return { text: "", workspaceIds: [] };

    const parts: string[] = [];
    const ids: string[] = [];
    for (const ws of mine.slice(0, 2)) {
      ids.push(ws.id);
      if (ws.raw_brief?.trim()) {
        parts.push(
          `BRIEF AS IT NOW STANDS (Briefing Room workspace ${ws.id.slice(0, 8)}):\n${ws.raw_brief
            .trim()
            .slice(0, 12000)}`,
        );
      }
      const truths = Array.isArray(ws.truths) ? (ws.truths as Loose[]) : [];
      const edited = truths.filter((t) => t?.["human_corrected"] || t?.["human_added"]);
      if (edited.length) {
        parts.push(
          `HUMAN-CORRECTED EVIDENCE (authoritative — overrides anything in the report that contradicts it):\n` +
            edited
              .map((t) => {
                const text = String(t["text"] ?? t["truth"] ?? "").trim();
                const src = String(t["correction_source"] ?? "").trim();
                const note = String(t["correction_note"] ?? "").trim();
                return `- ${text}${src ? `\n  Source: ${src}` : ""}${note ? `\n  Why corrected: ${note}` : ""}`;
              })
              .join("\n"),
        );
      }
      if (ws.selected_frame?.trim()) {
        parts.push(`SELECTED STRATEGIC FRAME DOWNSTREAM: ${ws.selected_frame.trim()}`);
      }
    }
    return { text: parts.join("\n\n"), workspaceIds: ids };
  } catch {
    return { text: "", workspaceIds: [] };
  }
}

export async function regenerateDocument00ARun(args: {
  sessionId: string;
  /** Operator directives for this regeneration (absorptions, exclusions, corrections). */
  instructions?: string;
  /** Restrict the rewrite to these territory ids; default is every territory. */
  territoryIds?: string[];
}): Promise<Doc00ARegenerationResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { sessionId } = args;
  const instructions = (args.instructions ?? "").trim();

  const write = async (patch: Loose) => {
    try {
      await supabaseAdmin.from("intelligence_sessions").update(patch as never).eq("id", sessionId);
    } catch {
      /* best effort */
    }
  };

  const { snapshotIntelligenceReport } = await import("./intelligence-versions.server");
  await snapshotIntelligenceReport(sessionId, "before-doc00a-regeneration");

  const { data: row } = await supabaseAdmin
    .from("intelligence_sessions")
    .select("id, user_id, brand_name, category, final_report, report_metadata")
    .eq("id", sessionId)
    .maybeSingle();

  const fail = async (error: string): Promise<Doc00ARegenerationResult> => {
    await write({ status: "complete", stage_status: "complete:10", last_error: error });
    return { success: false, error };
  };

  if (!row?.final_report) return fail("No report to regenerate");

  let report: ReportShape;
  try {
    report = JSON.parse(row.final_report) as ReportShape;
  } catch {
    return fail("Stored report is not valid JSON");
  }
  const territories = Array.isArray(report.territories) ? report.territories : [];
  if (!territories.length) return fail("Report contains no territories");

  const meta = asObject(row.report_metadata);
  const briefType =
    String(meta["brief_type"] ?? "commercial").toLowerCase() === "government"
      ? "government"
      : "commercial";
  const systemPrompt = `${buildSystemPrompt(briefType)}\n${CLAIM_LANGUAGE_RULES}`;

  const brandName = row.brand_name ?? "Not specified";
  const digest = await downstreamDigest(
    supabaseAdmin as never,
    row.user_id as string,
    brandName,
  );

  const targetIds = args.territoryIds?.length
    ? new Set(args.territoryIds)
    : new Set(territories.map((t) => t.id));

  const context = [
    `Brand: ${brandName}`,
    `Category: ${row.category ?? "Not specified"}`,
    `Brief type: ${briefType}`,
    "",
    "TERRITORIES CURRENTLY IN THE REPORT:",
    territories
      .map(
        (t) =>
          `- ${t.id}: ${String(t["name"] ?? "")}${
            t.id === report.recommended_primary_territory_id ? "  [recommended primary]" : ""
          }`,
      )
      .join("\n"),
    digest.text ? `\n${digest.text}` : "",
    instructions ? `\nOPERATOR DIRECTIVES FOR THIS REGENERATION (authoritative):\n${instructions}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const rewritten: string[] = [];
  const kept: string[] = [];
  const next = [...territories];
  const total = territories.filter((t) => targetIds.has(t.id)).length + 1;
  let step = 0;

  await write({ status: "running", stage_status: `doc00a:0/${total}`, last_error: null });

  for (let i = 0; i < next.length; i++) {
    const territory = next[i]!;
    if (!targetIds.has(territory.id)) continue;
    step += 1;
    await write({ stage_status: `doc00a:${step}/${total}`, updated_at: new Date().toISOString() });

    const userMessage = `DOCUMENT 00A RECONCILIATION — ONE TERRITORY

${context}

You are reconciling ONE territory of an existing Strategic Territory Intelligence
Report against the session's CURRENT state, so the regenerated Document 00A is
accurate as of today. This is not a fresh invention and not a rewrite for its own
sake: preserve every finding that is still correct, verbatim where possible, and
change only what the current state requires.

Apply, in this order of authority:
1. The operator directives above.
2. The human-corrected evidence above — it overrides the report wherever they conflict.
3. The brief as it now stands.
4. CLAIM LANGUAGE DISCIPLINE, applied to every sentence you write or keep:
   absence findings must read as "No evidence was found in the inputs supplied
   of X"; every timeframe must carry "(modelled estimate, not measured)"; every
   white_space cell must carry an explicit "evidence_basis" of "observed",
   "inferred" or "absence_of_evidence".

Where this territory has absorbed another territory's ground, say so plainly in
the description and rationale, and reflect the wider scope in the scores and the
prebrief. Where a dimension has been excluded downstream, remove it — do not
soften it, do not leave a trace of it in the prebrief, must_include, or the
measurement framework.

IDENTITY RULE — this territory keeps its own identity. Never rename it to another
territory's name, and never rewrite it into a copy of another territory. If its
ground has been taken over by a different territory, keep its own name and set
"disposition" to "absorbed" with "absorbed_into" set to that territory's id; if it
is no longer a live option, set "disposition" to "retired". Otherwise set
"disposition" to "retained". Two territories with the same name is always wrong.

Return a SINGLE JSON object for this territory, with EXACTLY the same key
structure and enum vocabulary as the object below, "id" unchanged ("${territory.id}"),
plus "disposition" ("retained" | "absorbed" | "retired"), "absorbed_into" (id or
null) and "disposition_rationale" (one sentence).
No preamble, no markdown fences.

CURRENT TERRITORY OBJECT:
${JSON.stringify(territory, null, 2)}`;

    let accumulated = "";
    try {
      const stream = streamClaude({
        systemPrompt,
        userMessage,
        maxTokens: TERRITORY_MAX_TOKENS,
        model: MODEL,
        temperature: TEMPERATURE,
        skipUniversalWrapper: true,
        stageLabel: "Document 00A — territory reconciliation",
        stageNumber: "00A",
        stageName: "Document 00A Regeneration",
      });
      for await (const delta of stream) {
        accumulated += delta;
        if (accumulated.length % 4000 < 40) await write({ updated_at: new Date().toISOString() });
      }
    } catch (e) {
      kept.push(territory.id);
      console.error(`[doc00a:${sessionId}] territory ${territory.id} stream failed`, e);
      continue;
    }

    let parsed: Loose | null = null;
    try {
      parsed = parseJsonLenient(strip(accumulated)) as Loose;
    } catch {
      parsed = null;
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || !parsed["name"]) {
      // Never accept a thinner object than the one it replaces.
      kept.push(territory.id);
      continue;
    }
    parsed["id"] = territory.id;
    next[i] = parsed as Loose & { id: string };
    rewritten.push(territory.id);
  }

  // Dispositions. A territory the reconciliation reports as absorbed or retired
  // is no longer a live option and must not be printed as one — leaving it in
  // is exactly the "five independent competing options" problem this run exists
  // to fix. It is retained in metadata, never deleted from the record.
  // A duplicate name is treated as an absorption regardless of what the
  // reconciliation claimed: two identical territories cannot both be live.
  const retiredLog: Array<{ id: string; name: string; disposition: string; into: string | null }> = [];
  const seenNames = new Map<string, string>();
  const live: Array<Loose & { id: string }> = [];
  for (const t of next) {
    const disposition = String(t["disposition"] ?? "retained").toLowerCase();
    const name = String(t["name"] ?? "").trim().toLowerCase();
    const duplicateOf = name ? seenNames.get(name) : undefined;
    const drop = disposition === "absorbed" || disposition === "retired" || Boolean(duplicateOf);
    if (drop && live.length) {
      retiredLog.push({
        id: t.id,
        name: String(t["name"] ?? ""),
        disposition: duplicateOf ? "absorbed" : disposition,
        into: duplicateOf ?? (t["absorbed_into"] ? String(t["absorbed_into"]) : null),
      });
      continue;
    }
    if (name) seenNames.set(name, t.id);
    live.push(t);
  }
  next.length = 0;
  next.push(...live);

  // Final pass: the report-level narrative, rebuilt over the reconciled set so
  // the summary cannot describe territories that no longer read that way.
  step += 1;
  await write({ stage_status: `doc00a:${step}/${total}` });

  let summary: Loose | null = null;
  try {
    const summaryMessage = `DOCUMENT 00A RECONCILIATION — REPORT NARRATIVE

${context}

The territories have just been reconciled. Rewrite the report-level narrative so
it describes the territories as they now read, with no contradiction between the
summary and any territory. State counts consistently: the report now carries
exactly ${next.length} live territor${next.length === 1 ? "y" : "ies"} — never
cite a different number.${
      retiredLog.length
        ? `\n\nNo longer live (absorbed or retired in this reconciliation; say so plainly, once):\n${retiredLog
            .map((r) => `- ${r.name} (${r.id}) — ${r.disposition}${r.into ? ` into ${r.into}` : ""}`)
            .join("\n")}`
        : ""
    }

RECONCILED TERRITORIES:
${next
  .map(
    (t) =>
      `${t.id}: ${String(t["name"] ?? "")}\n${String(t["description"] ?? "").slice(0, 1200)}\nVerdict: ${String(
        t["strategic_recommendation"] ?? "",
      )}\nGateway: ${String(asObject(t["timing_sequencing"])["is_gateway_territory"] ?? "false")}`,
  )
  .join("\n\n")}

Exactly one territory may be the gateway territory. If more than one is flagged
above, name the single correct one in "gateway_territory_id" and state why.

CLAIM LANGUAGE DISCIPLINE applies to every sentence.

Return ONLY this JSON object, no fences:
{
  "executive_summary": "string — 3-5 sentences",
  "recommended_primary_territory_id": "string — one of the ids above",
  "gateway_territory_id": "string — one of the ids above",
  "completeness_assessment": {
    "inputs_present": ["string"],
    "inputs_absent": ["string"],
    "confidence": "high" | "moderate" | "low",
    "gap_impact_notes": ["string"]
  }
}`;
    let acc = "";
    const stream = streamClaude({
      systemPrompt,
      userMessage: summaryMessage,
      maxTokens: SUMMARY_MAX_TOKENS,
      model: MODEL,
      temperature: TEMPERATURE,
      skipUniversalWrapper: true,
      stageLabel: "Document 00A — report narrative",
      stageNumber: "00A",
      stageName: "Document 00A Regeneration",
    });
    for await (const delta of stream) acc += delta;
    summary = parseJsonLenient(strip(acc)) as Loose;
  } catch {
    summary = null;
  }

  const nextReport: ReportShape = { ...report, territories: next };
  if (summary && typeof summary === "object") {
    const execSummary = String(summary["executive_summary"] ?? "").trim();
    if (execSummary) nextReport.executive_summary = execSummary;
    const primaryId = String(summary["recommended_primary_territory_id"] ?? "").trim();
    if (primaryId && next.some((t) => t.id === primaryId)) {
      nextReport.recommended_primary_territory_id = primaryId;
    }
    const completeness = asObject(summary["completeness_assessment"]);
    if (Object.keys(completeness).length) nextReport.completeness_assessment = completeness;

    // Gateway status is a report-level fact. Exactly one territory carries it,
    // decided here, so two territories can never badge themselves gateway.
    const gatewayId = String(summary["gateway_territory_id"] ?? "").trim();
    const resolvedGateway =
      gatewayId && next.some((t) => t.id === gatewayId)
        ? gatewayId
        : (nextReport.recommended_primary_territory_id ?? "");
    if (resolvedGateway) {
      nextReport.territories = next.map((t) => ({
        ...t,
        timing_sequencing: {
          ...asObject(t["timing_sequencing"]),
          is_gateway_territory: t.id === resolvedGateway,
        },
      })) as Array<Loose & { id: string }>;
    }
  }

  const log = Array.isArray(meta["doc00a_regenerations"])
    ? (meta["doc00a_regenerations"] as Loose[])
    : [];
  const revision = log.length + 1;
  const runRef = crypto.randomUUID();
  log.push({
    run_ref: runRef,
    revision,
    at: new Date().toISOString(),
    instructions: instructions.slice(0, 4000) || null,
    briefing_workspace_ids: digest.workspaceIds,
    territories_rewritten: rewritten,
    territories_kept: kept,
    territories_retired: retiredLog,
  });

  const primaryAfter =
    nextReport.territories?.find(
      (t) => t.id === nextReport.recommended_primary_territory_id,
    ) ?? nextReport.territories?.[0];

  await write({
    final_report: JSON.stringify(nextReport),
    status: "complete",
    stage_status: "complete:10",
    last_error: kept.length
      ? `Document 00A regenerated; ${kept.length} territor${kept.length === 1 ? "y was" : "ies were"} kept unchanged because reconciliation did not return usable output (${kept.join(", ")}).`
      : null,
    report_metadata: {
      ...meta,
      executive_summary: nextReport.executive_summary ?? null,
      completeness_assessment: nextReport.completeness_assessment ?? null,
      recommended_primary_territory_id: nextReport.recommended_primary_territory_id ?? null,
      territory_count: nextReport.territories?.length ?? 0,
      doc00a_regenerations: log.slice(-50),
      doc00a_revision: revision,
      doc00a_run_ref: runRef,
      doc00a_regenerated_at: new Date().toISOString(),
    },
    handoff_payload: (primaryAfter?.["prebrief_for_briefing_room"] ?? null) as never,
  });

  return { success: true, runRef, revision, rewritten, kept };
}
