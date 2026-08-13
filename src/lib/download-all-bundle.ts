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
import { buildExecSummaryDocument } from "./exec-summary-document";
import { buildConsultingDeliveryDocument } from "./consulting-delivery-document";
import { buildDocument00AMinto } from "./intelligence/doc-00A-minto";
import { fetchExecSummaryIntel } from "./exec-summary-intel";
import { supabase } from "@/integrations/supabase/client";
import { normalizeBrand } from "./brand-register";
import {
  generateDocument00APdf,
  type IntelligenceReport,
} from "./intelligence/pdf-00A";

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
  const raw =
    session.updated_at ||
    session.created_at ||
    new Date().toISOString();
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
  pdf: Blob | null;
  input: Parameters<typeof buildDocument00AMinto>[0] | null;
}

async function fetchDocument00A(brand: string): Promise<Doc00AResult> {
  const key = normalizeBrand(brand);
  const empty: Doc00AResult = { pdf: null, input: null };
  if (!key) return empty;
  try {
    const res = await supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from("intelligence_sessions" as any)
      .select(
        "id,brand_name,category,status,updated_at,completed_at,final_report,report_metadata",
      )
      .order("updated_at", { ascending: false })
      .limit(500);
    if (res.error) return empty;
    const rows = ((res.data ?? []) as unknown) as Array<{
      brand_name: string | null;
      category: string | null;
      status: string | null;
      updated_at: string | null;
      completed_at: string | null;
      final_report: string | null;
      report_metadata: unknown;
    }>;
    const match = rows.find(
      (r) => normalizeBrand(r.brand_name) === key && r.status === "complete",
    );
    if (!match || !match.final_report) return empty;
    let report: IntelligenceReport;
    try {
      report = JSON.parse(match.final_report) as IntelligenceReport;
    } catch {
      return empty;
    }
    const meta = match.report_metadata;
    const briefType =
      meta && typeof meta === "object" && !Array.isArray(meta) &&
      (meta as Record<string, unknown>).brief_type === "government"
        ? "government"
        : "commercial";
    const input = {
      brandName: match.brand_name || brand,
      category: match.category ?? "",
      briefType,
      completedAt: match.completed_at ?? match.updated_at,
      report,
    };
    return { pdf: await generateDocument00APdf(input), input };
  } catch (e) {
    console.error("[bundle] Document 00A PDF failed", e);
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
  const zip = new JSZip();
  const included: string[] = [];
  const skipped: string[] = [];

  const brand = session.brand_name ?? "Untitled Brand";
  const clientSlug = sanitizeSegment(brand);
  const runDate = pickRunDate(session);

  const tryAdd = (
    path: string,
    build: () => string | null | undefined,
    label: string,
  ) => {
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
  onProgress?.("Building Strategy Executive Summary…");
  const execIntel = await fetchExecSummaryIntel(brand);
  // Same extra columns the Deliverables card loads, so both paths build the
  // identical document.
  const execExtra = await (async () => {
    try {
      const res = await supabase
        .from("sessions")
        .select(
          "brief_text, stage_2_output, stage_3_output, stage_4_output, loc_engine_outputs, loc_status, loc_decision_packages, stage_22_distinctive_assets",
        )
        .eq("id", session.id)
        .maybeSingle();
      return (res.data as Record<string, unknown> | null) ?? {};
    } catch {
      return {};
    }
  })();
  tryAdd(
    "Strategy_Executive_Summary.html",
    () => buildExecSummaryDocument({ ...session, ...execExtra }, execIntel),
    "Building Strategy Executive Summary…",
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
  const doc00A = await fetchDocument00A(brand);
  if (doc00A.pdf) {
    zip.file("Strategic_Territory_Intelligence_Report.pdf", doc00A.pdf);
    included.push("Strategic_Territory_Intelligence_Report.pdf");
  } else {
    skipped.push("Strategic_Territory_Intelligence_Report.pdf");
  }
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
