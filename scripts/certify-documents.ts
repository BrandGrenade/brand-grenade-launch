/**
 * BRAND GRENADE — PLATFORM DOCUMENT CERTIFICATION
 * ============================================================================
 * Renders EVERY document type for EVERY certifiable session through the
 * production builders and certifies each rendered section against the eight
 * criteria: present, complete, sourced, correctly placed, clean, internally
 * consistent, no unfulfilled promises, correct voice.
 *
 * Report: /mnt/documents/document-certification.md — per session, per
 * document, per section, certified or failed with the quoted defect.
 * Exit code is non-zero when anything fails.
 *
 * Usage: bun scripts/certify-documents.ts [brand filter…] [--report-only]
 */

import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "fs";
import { buildBoardStrategyDocument } from "../src/lib/board-strategy-document";
import { buildConsultingDeliveryDocument } from "../src/lib/consulting-delivery-document";
import { buildMasterDetonationDocument } from "../src/lib/master-detonation-document";
import { buildSummaryDocument } from "../src/lib/summary-document";
import { buildPhase1Document } from "../src/lib/phase1-document-builder";
import { buildPhase2Document } from "../src/lib/phase2-document-generator";
import { buildFullRunDocument } from "../src/lib/full-run-document";
import { summaryExtras } from "./summary-extras";
import { contentIntegrityFindings, splitSections } from "../src/lib/content-integrity";

const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const OUT = "/tmp/certify";
mkdirSync(OUT, { recursive: true });

type Row = Record<string, any>;

const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));

const { data: rows, error } = await sb.from("sessions").select("*").order("created_at");
if (error) throw error;

/** The closed, certifiable set: real client sessions that carry a locked SMP. */
const live = ((rows ?? []) as Row[]).filter(
  (r) =>
    !r.is_preflight_test &&
    String(r.selected_smp ?? "").trim() &&
    !/preflight|harness|testbrand/i.test(String(r.brand_name ?? "")),
);

interface DocJob {
  label: string;
  build: (row: Row, extra: Row) => string;
}

function jobsFor(row: Row): DocJob[] {
  const jobs: DocJob[] = [
    { label: "Board Strategy Recommendation", build: (r) => buildBoardStrategyDocument(r as never) },
    { label: "Consulting Delivery", build: (r) => buildConsultingDeliveryDocument(r as never) },
    { label: "Master Detonation Brief (Minto)", build: (r) => buildMasterDetonationDocument(r as never) },
    { label: "Agency Strategy Platform", build: (r) => buildPhase1Document(r as never, "agency") },
    { label: "Brand Strategy Workshop Guide", build: (r) => buildPhase1Document(r as never, "workshop") },
    { label: "Full Pipeline Record", build: (r) => buildFullRunDocument(r as never) },
  ];
  if (row.stage_18_selected_detonation)
    jobs.push({ label: "The Detonation", build: (r) => buildPhase2Document(r as never, "the_detonation") });
  if (row.stage_19_output)
    jobs.push({ label: "Activation Architecture", build: (r) => buildPhase2Document(r as never, "activation_architecture") });
  if (row.stage_20_output)
    jobs.push({ label: "Master Detonation Brief", build: (r) => buildPhase2Document(r as never, "master_brief") });
  if (row.stage_22_brand_architecture)
    jobs.push({ label: "Brand Architecture", build: (r) => buildPhase2Document(r as never, "brand_architecture") });
  const channels = (row.stage_21_outputs ?? {}) as Record<string, string>;
  for (const ch of Object.keys(channels))
    jobs.push({
      label: `Channel Detonation Brief — ${ch}`,
      build: (r) => buildPhase2Document(r as never, "channel_brief", ch),
    });
  return jobs;
}

const report: string[] = [
  "# Brand Grenade — platform document certification",
  "",
  `Generated ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`,
  "",
  "A section is CERTIFIED only when it is present, complete, correctly placed, clean,",
  "internally consistent, free of unfulfilled promises and written in client voice.",
  "",
];

let sectionsChecked = 0;
let sectionsFailed = 0;
let docsFailed = 0;
let docsChecked = 0;

for (const row of live) {
  const brand = String(row.brand_name);
  if (only.length && !only.some((o) => brand.toLowerCase().includes(o.toLowerCase()))) continue;

  report.push(`## ${brand}`, "", `Session \`${row.id}\` · stage ${row.current_stage}`, "");

  const jobs = jobsFor(row);

  // The Summary needs its creative extras, read exactly as Deliverables does.
  let extras: any = null;
  try {
    extras = await summaryExtras(sb, row, live.filter((r) => r.id !== row.id));
  } catch (e) {
    report.push(`- Summary extras unavailable: ${(e as Error).message}`, "");
  }

  const all: Array<{ label: string; run: () => string }> = [
    ...(extras
      ? [
          {
            label: "Brand Strategy and Creative Intelligence Summary",
            run: () => buildSummaryDocument(row as never, extras),
          },
        ]
      : []),
    ...jobs.map((j) => ({ label: j.label, run: () => j.build(row, {}) })),
  ];

  for (const doc of all) {
    docsChecked++;
    report.push(`### ${doc.label}`, "");
    let html = "";
    try {
      html = doc.run();
    } catch (e) {
      docsFailed++;
      report.push(`**BLOCKED — this document did not pass its build-time gate.**`, "", "```", String((e as Error).message).slice(0, 4000), "```", "");
      continue;
    }
    writeFileSync(`${OUT}/${row.id}__${doc.label.replace(/[^A-Za-z0-9]+/g, "_")}.html`, html);

    const sections = splitSections(html);
    const findings = contentIntegrityFindings(html);
    const bySection = new Map<string, typeof findings>();
    for (const f of findings) {
      const list = bySection.get(f.section) ?? [];
      list.push(f);
      bySection.set(f.section, list);
    }

    const lines: string[] = [];
    for (const sec of sections) {
      sectionsChecked++;
      const key = sec.index ? `${sec.index} "${sec.title}"` : `"${sec.title}"`;
      const fs = bySection.get(key) ?? [];
      if (!fs.length) {
        lines.push(`- ${key} — CERTIFIED`);
        continue;
      }
      sectionsFailed++;
      lines.push(`- ${key} — **FAILED**`);
      for (const f of fs)
        lines.push(`    - ${f.criterion}: ${f.detail}${f.quote ? `\n      > ${f.quote.replace(/\n/g, " ")}` : ""}`);
    }
    if (findings.length) docsFailed++;
    report.push(...lines, "");
  }
}

report.splice(
  6,
  0,
  `**${docsChecked} documents · ${docsChecked - docsFailed} clean · ${docsFailed} with failures · ` +
    `${sectionsChecked} sections · ${sectionsFailed} failed**`,
  "",
);

mkdirSync("/mnt/documents", { recursive: true });
writeFileSync("/mnt/documents/document-certification.md", report.join("\n"));
console.log(report.join("\n").slice(0, 20000));
console.log(
  `\nSUMMARY: ${docsChecked} documents, ${docsFailed} with failures; ${sectionsChecked} sections, ${sectionsFailed} failed.`,
);
if (docsFailed) process.exit(1);
