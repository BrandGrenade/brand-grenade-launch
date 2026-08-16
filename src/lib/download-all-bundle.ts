// Client-side "Download All" zip bundler for the Deliverables page.
// Phase 1: repackages already-generated content only. No new AI passes.
// Missing files are silently omitted; the zip is still produced.

import JSZip from "jszip";
import { buildPhase1Document, type Phase1Session } from "./phase1-document-builder";
import {
  buildPhase2Document,
  buildAllPhase2,
  type Phase2Session,
} from "./phase2-document-generator";
import { buildFullRunDocument, type FullRunSession } from "./full-run-document";
import { buildConsultingDeliveryDocument } from "./consulting-delivery-document";
import { buildDocument00AMinto } from "./intelligence/doc-00A-minto";
import { supabase } from "@/integrations/supabase/client";
import type { IntelligenceReport } from "./intelligence/doc-00A-types";
import { resolveLiveDocumentSession } from "./document-live-source";
import { intelligenceSourceIdFromBrief } from "./document-source-authority";
import { buildSummaryDocument } from "./summary-document";
import { fetchSummaryExtras } from "./summary-data";

export type BundleSession = Phase1Session &
  Phase2Session &
  FullRunSession & {
    id: string;
    brand_name: string | null;
    updated_at?: string | null;
    created_at?: string | null;
  };

function sanitizeSegment(s: string): string {
  return (s || "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "Untitled";
}

function safeFilename(s: string): string {
  // Filesystem-safe but keep spaces/dashes readable inside folders.
  return (s || "").replace(/[\\/:*?"<>|]+/g, "_").trim() || "Untitled";
}

function pickRunDate(session: BundleSession): string {
  const raw = session.updated_at || session.created_at || new Date().toISOString();
  return new Date(raw).toISOString().slice(0, 10);
}

function extractBody(html: string): string {
  const m = html.match(/<div class="page">([\s\S]*?)<\/div>\s*<script>/);
  return m ? m[1] : html;
}

function buildBoardStrategyBundle(session: BundleSession): string | null {
  try {
    const phase1 = buildPhase1Document(session, "consulting");
    const phase2 = buildAllPhase2(session);
    const brand = session.brand_name ?? "Untitled Brand";
    const merged = phase1.replace(
      /<div class="page">[\s\S]*?<\/div>\s*<script>/,
      `<div class="page"><div class="part-label">PHASE 1</div>${extractBody(phase1)}<div class="doc-break"></div><div class="part-label">PHASE 2</div>${extractBody(phase2)}</div><script>`,
    );
    return merged.replace(
      /<title>[^<]*<\/title>/,
      `<title>Board Strategy Recommendation — ${brand.replace(/</g, "&lt;")}</title>`,
    );
  } catch (e) {
    console.error("[bundle] Board Strategy build failed", e);
    return null;
  }
}

interface Doc00AResult {
  input: Parameters<typeof buildDocument00AMinto>[0] | null;
}

async function fetchDocument00A(briefText: string | null | undefined): Promise<Doc00AResult> {
  const sourceId = intelligenceSourceIdFromBrief(briefText);
  const empty: Doc00AResult = { input: null };
  if (!sourceId) return empty;
  try {
    const res = await supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from("intelligence_sessions" as any)
      .select("id,brand_name,category,status,updated_at,completed_at,final_report,report_metadata")
      .eq("id", sourceId)
      .eq("status", "complete")
      .maybeSingle();
    if (res.error) return empty;
    const match = res.data as unknown as {
      id: string;
      brand_name: string | null;
      category: string | null;
      status: string | null;
      updated_at: string | null;
      completed_at: string | null;
      final_report: string | null;
      report_metadata: unknown;
    } | null;
    if (!match || !match.final_report) return empty;
    let report: IntelligenceReport;
    try {
      report = JSON.parse(match.final_report) as IntelligenceReport;
    } catch {
      return empty;
    }
    const meta = match.report_metadata;
    const briefType =
      meta &&
      typeof meta === "object" &&
      !Array.isArray(meta) &&
      (meta as Record<string, unknown>).brief_type === "government"
        ? "government"
        : "commercial";
    const input: Parameters<typeof buildDocument00AMinto>[0] = {
      sourceRunId: match.id,
      brandName: match.brand_name || "Untitled Brand",
      category: match.category ?? "",
      briefType,
      completedAt: match.completed_at ?? match.updated_at,
      report,
    };
    return { input };
  } catch (e) {
    console.error("[bundle] Document 00A build failed", e);
    return empty;
  }
}

export interface BundleResult {
  filename: string;
  included: string[];
  skipped: string[];
}

export async function buildAndDownloadBundle(
  session: BundleSession,
  onProgress?: (label: string) => void,
): Promise<BundleResult> {
  session = await resolveLiveDocumentSession(session);
  const zip = new JSZip();
  const included: string[] = [];
  const skipped: string[] = [];

  const brand = session.brand_name ?? "Untitled Brand";
  const clientSlug = sanitizeSegment(brand);
  const runDate = pickRunDate(session);

  const tryAdd = (path: string, build: () => string | null | undefined, label: string) => {
    onProgress?.(label);
    try {
      const content = build();
      if (content && content.trim()) {
        zip.file(path, content);
        included.push(path);
      } else {
        skipped.push(path);
      }
    } catch (e) {
      console.error(`[bundle] ${path} failed`, e);
      skipped.push(path);
    }
  };

  // Root — Board Strategy Recommendation (merged Phase 1 + Phase 2)
  tryAdd(
    "Board_Strategy_Recommendation.html",
    () => buildBoardStrategyBundle(session),
    "Building Board Strategy Recommendation…",
  );

  // Root — Strategy Executive Summary (synthesis of stored data only)
  onProgress?.("Building Brand Strategy and Creative Intelligence Summary…");
  const execIntel = await fetchExecSummaryIntel(
    typeof session.brief_text === "string" ? session.brief_text : null,
  );
  // Same extra columns the Deliverables card loads, so both paths build the
  // identical document.
  const execExtra = await (async () => {
    try {
      const res = await supabase
        .from("sessions")
        .select(
          "brief_text, stage_2_output, stage_3_output, stage_4_output, loc_engine_outputs, loc_status, loc_decision_packages, stage_22_output, stage_22_brand_architecture, stage_22_distinctive_assets, locked_big_idea_run_id, locked_big_idea, locked_campaign_line, locked_big_idea_lens, locked_big_idea_at, selection_rationale, updated_at",
        )
        .eq("id", session.id)
        .maybeSingle();
      return (res.data as Record<string, unknown> | null) ?? {};
    } catch {
      return {};
    }
  })();
  const summarySession = { ...session, ...execExtra };
  const jaguarExtras = session.id === JAGUAR_REBUILD_SESSION_ID
    ? await fetchJaguarSummaryExtras(summarySession)
    : null;
  tryAdd(
    "Brand_Strategy_and_Creative_Intelligence_Summary.html",
    () => jaguarExtras
      ? buildJaguarSummaryDocument(summarySession, jaguarExtras)
      : buildExecSummaryDocument(summarySession, execIntel),
    "Building Brand Strategy and Creative Intelligence Summary…",
  );

  // Root — Consulting Delivery (canonical ten-section template)
  tryAdd(
    "Consulting_Delivery.html",
    () => buildConsultingDeliveryDocument({ ...session, ...execExtra } as never),
    "Building Consulting Delivery…",
  );

  // Root — Document 00A (real PDF from Intelligence Lab, plus the structured
  // ten-section HTML version rendered from the same report).
  onProgress?.("Fetching Strategic Territory Intelligence Report…");
  const doc00A = await fetchDocument00A(
    typeof session.brief_text === "string" ? session.brief_text : null,
  );
  if (doc00A.input) {
    tryAdd(
      "Strategic_Territory_Intelligence_Report.html",
      () => buildDocument00AMinto(doc00A.input!),
      "Building Strategic Territory Intelligence Report…",
    );
  } else {
    skipped.push("Strategic_Territory_Intelligence_Report.html");
  }

  // Creative & Activation folder
  const creative = "Creative & Activation";
  if (session.stage_18_selected_detonation) {
    tryAdd(
      `${creative}/The_Detonation.html`,
      () => buildPhase2Document(session, "the_detonation"),
      "Building The Detonation…",
    );
  } else {
    skipped.push(`${creative}/The_Detonation.html`);
  }
  if (session.stage_19_output) {
    tryAdd(
      `${creative}/Activation_Architecture.html`,
      () => buildPhase2Document(session, "activation_architecture"),
      "Building Activation Architecture…",
    );
  } else {
    skipped.push(`${creative}/Activation_Architecture.html`);
  }
  if (session.stage_20_output) {
    tryAdd(
      `${creative}/Master_Detonation_Brief.html`,
      () => buildPhase2Document(session, "master_brief"),
      "Building Master Detonation Brief…",
    );
  } else {
    skipped.push(`${creative}/Master_Detonation_Brief.html`);
  }

  const channels = session.stage_21_outputs ?? {};
  for (const key of Object.keys(channels)) {
    const filename = `${safeFilename(key).replace(/\s+/g, "_")}.html`;
    tryAdd(
      `${creative}/Channel_Briefs/${filename}`,
      () => buildPhase2Document(session, "channel_brief", key),
      `Building channel brief: ${key}…`,
    );
  }

  // Supporting Documents folder
  const support = "Supporting Documents";
  tryAdd(
    `${support}/Full_Pipeline_Record.html`,
    () => buildFullRunDocument(session),
    "Building Full Pipeline Record…",
  );
  tryAdd(
    `${support}/Agency_Strategy_Platform.html`,
    () => buildPhase1Document(session, "agency"),
    "Building Agency Strategy Platform…",
  );
  tryAdd(
    `${support}/Brand_Strategy_Workshop_Guide.html`,
    () => buildPhase1Document(session, "workshop"),
    "Building Brand Strategy Workshop Guide…",
  );
  if (session.stage_22_brand_architecture) {
    tryAdd(
      `${support}/Brand_Architecture.html`,
      () => buildPhase2Document(session, "brand_architecture"),
      "Building Brand Architecture…",
    );
  } else {
    skipped.push(`${support}/Brand_Architecture.html`);
  }

  // Creative Engine (Room 04) — the orchestrated, tool-specific prompt set and
  // the lens sweep behind it. Resolved live from their own records.
  onProgress?.("Building Creative Engine exports…");
  try {
    const [{ getFullFinishedExport, getRawIdeaExportBatch }, { buildFullFinishedExport, buildRawIdeaBatchExport }] =
      await Promise.all([
        import("./stimulus-gate-two.functions"),
        import("./stimulus-export"),
      ]);

    const { data: orchs } = await supabase
      .from("stimulus_orchestrations")
      .select("id,status,gate_two_confirmed,updated_at")
      .eq("session_id", session.id)
      .order("updated_at", { ascending: false });
    const orch =
      (orchs ?? []).find((o) => o.gate_two_confirmed) ??
      (orchs ?? []).find((o) => o.status === "complete") ??
      null;
    if (orch) {
      const data = await getFullFinishedExport({ data: { orchestrationId: orch.id } });
      const { html } = buildFullFinishedExport(data);
      zip.file("Creative Engine/Orchestration_Prompt_Set.html", html);
      included.push("Creative Engine/Orchestration_Prompt_Set.html");
    } else {
      skipped.push("Creative Engine/Orchestration_Prompt_Set.html");
    }

    const { data: runs } = await supabase
      .from("stimulus_runs")
      .select("id")
      .eq("session_id", session.id)
      .eq("run_mode", "big_idea");
    const runIds = (runs ?? []).map((r) => r.id);
    if (runIds.length) {
      const { data: dirs } = await supabase
        .from("stimulus_directions")
        .select("id,sort_order,gate_one_approved,direction")
        .in("run_id", runIds)
        .order("sort_order", { ascending: true });
      const all = (dirs ?? []).filter((d) => (d.direction ?? "").trim().length > 0);
      const sweep = all.slice(0, 40).map((d) => d.id);
      const shortlist = all.filter((d) => d.gate_one_approved).slice(0, 40).map((d) => d.id);
      if (sweep.length) {
        const data = await getRawIdeaExportBatch({ data: { directionIds: sweep } });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { html } = buildRawIdeaBatchExport(data as any);
        zip.file("Creative Engine/Lens_Sweep_Raw_Ideas.html", html);
        included.push("Creative Engine/Lens_Sweep_Raw_Ideas.html");
      } else {
        skipped.push("Creative Engine/Lens_Sweep_Raw_Ideas.html");
      }
      if (shortlist.length) {
        const data = await getRawIdeaExportBatch({ data: { directionIds: shortlist } });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { html } = buildRawIdeaBatchExport(data as any);
        zip.file("Creative Engine/Shortlist_Gate_One.html", html);
        included.push("Creative Engine/Shortlist_Gate_One.html");
      } else {
        skipped.push("Creative Engine/Shortlist_Gate_One.html");
      }
    } else {
      skipped.push("Creative Engine/Lens_Sweep_Raw_Ideas.html");
      skipped.push("Creative Engine/Shortlist_Gate_One.html");
    }
  } catch (e) {
    console.error("[bundle] Creative Engine exports failed", e);
    skipped.push("Creative Engine/Orchestration_Prompt_Set.html");
  }

  // Creative Showcase — the locked idea presented whole (foundation, channel
  // expressions, CD cohesion verdict, prompts and offline briefs).
  onProgress?.("Building Full Creative Showcase…");
  try {
    const [{ getCreativeShowcase }, { buildCreativeShowcase }] = await Promise.all([
      import("./creative-showcase.functions"),
      import("./creative-showcase-document"),
    ]);
    const data = await getCreativeShowcase({ data: { sessionId: session.id } });
    const { html } = buildCreativeShowcase(data);
    zip.file("Creative Engine/Full_Creative_Showcase.html", html);
    included.push("Creative Engine/Full_Creative_Showcase.html");
  } catch {
    skipped.push("Creative Engine/Full_Creative_Showcase.html");
  }

  onProgress?.("Compressing…");
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  const filename = `Brand_Grenade_${clientSlug}_Run_${runDate}.zip`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5_000);

  return { filename, included, skipped };
}
