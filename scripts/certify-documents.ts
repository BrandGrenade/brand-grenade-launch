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
import { contentIntegrityFindings, splitSections, type IntegrityOptions } from "../src/lib/content-integrity";
import { DOCUMENT_SPECS, type DocumentSpec } from "../src/lib/document-spec";
import { checkDocumentStructure } from "../src/lib/document-gate";
import { SUMMARY_SCHEMA } from "../src/lib/summary-gate";
import { parseScoredCandidates } from "../src/lib/minto-content";


const norm = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

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
  /** The same certification context the builder itself enforces. */
  opts?: IntegrityOptions;
  /** Canonical spec, when the document has one — drives PRESENT and PLACED. */
  spec?: DocumentSpec;
}

/** Proposition / line names owned by a session, used for the SOURCED check. */
function ownedNames(row: Row): string[] {
  return [
    String(row.selected_smp ?? ""),
    String(row.locked_campaign_line ?? ""),
    String(row.locked_big_idea ?? ""),
    ...parseScoredCandidates(String(row.stage_10_output ?? "")).map((c) => c.name),
  ]
    .map((s) => s.trim())
    .filter((s) => s.length > 14);
}

/** Minto documents compare counts across their front matter only. */
const mintoOpts = (spec: { frontMatter: Array<{ index: string }>; appendix: Array<{ index: string }> }): IntegrityOptions => ({
  narrativeSections: spec.frontMatter.map((f) => f.index),
  transcriptSections: spec.appendix.map((a) => a.index),
});

/** Stage-transcript documents: counts belong to the model output, not assembly. */
const transcriptOpts: IntegrityOptions = { narrativeSections: [] };

function jobsFor(row: Row): DocJob[] {
  const jobs: DocJob[] = [
    { label: "Board Strategy Recommendation", build: (r) => buildBoardStrategyDocument(r as never), opts: mintoOpts(DOCUMENT_SPECS.board_strategy), spec: DOCUMENT_SPECS.board_strategy },
    { label: "Consulting Delivery", build: (r) => buildConsultingDeliveryDocument(r as never), opts: mintoOpts(DOCUMENT_SPECS.consulting_delivery), spec: DOCUMENT_SPECS.consulting_delivery },
    { label: "Master Detonation Brief (Minto)", build: (r) => buildMasterDetonationDocument(r as never), opts: mintoOpts(DOCUMENT_SPECS.master_detonation), spec: DOCUMENT_SPECS.master_detonation },
    { label: "Agency Strategy Platform", build: (r) => buildPhase1Document(r as never, "agency"), opts: transcriptOpts },
    { label: "Brand Strategy Workshop Guide", build: (r) => buildPhase1Document(r as never, "workshop"), opts: transcriptOpts },
    { label: "Full Pipeline Record", build: (r) => buildFullRunDocument(r as never), opts: transcriptOpts },
  ];
  if (row.stage_18_selected_detonation)
    jobs.push({ label: "The Detonation", build: (r) => buildPhase2Document(r as never, "the_detonation"), opts: transcriptOpts });
  if (row.stage_19_output)
    jobs.push({ label: "Activation Architecture", build: (r) => buildPhase2Document(r as never, "activation_architecture"), opts: transcriptOpts });
  if (row.stage_20_output)
    jobs.push({ label: "Master Detonation Brief", build: (r) => buildPhase2Document(r as never, "master_brief"), opts: mintoOpts(DOCUMENT_SPECS.master_detonation), spec: DOCUMENT_SPECS.master_detonation });
  if (row.stage_22_brand_architecture)
    jobs.push({ label: "Brand Architecture", build: (r) => buildPhase2Document(r as never, "brand_architecture"), opts: transcriptOpts });
  const channels = (row.stage_21_outputs ?? {}) as Record<string, string>;
  for (const ch of Object.keys(channels))
    jobs.push({
      label: `Channel Detonation Brief — ${ch}`,
      build: (r) => buildPhase2Document(r as never, "channel_brief", ch),
      opts: transcriptOpts,
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

  const foreign = live.filter((r) => r.id !== row.id).flatMap(ownedNames);

  const all: Array<{ label: string; run: () => string; opts?: IntegrityOptions; spec?: DocumentSpec }> = [
    ...(extras
      ? [
          {
            label: "Brand Strategy and Creative Intelligence Summary",
            run: () => buildSummaryDocument(row as never, extras),
            opts: {
              narrativeSections: Array.from({ length: 20 }, (_, i) => String(i + 1).padStart(2, "0")),
              schemaSections: SUMMARY_SCHEMA,
            },
          },

        ]
      : []),
    ...jobs.map((j) => ({ label: j.label, run: () => j.build(row, {}), opts: j.opts, spec: j.spec })),
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
    const findings = contentIntegrityFindings(html, doc.opts ?? {});
    const bySection = new Map<string, typeof findings>();
    for (const f of findings) {
      const list = bySection.get(f.section) ?? [];
      list.push(f);
      bySection.set(f.section, list);
    }

    // Structural half — PRESENT and CORRECTLY PLACED — from the same runtime
    // gate the builder itself runs, so the report cannot disagree with it.
    const spec = doc.spec;
    const structural = spec ? checkDocumentStructure(html, spec) : [];
    const canonical = spec
      ? new Set([...spec.frontMatter.map((f) => f.index), ...spec.appendix.map((a) => a.index)])
      : null;

    // SOURCED — nothing in the section belongs to another session.
    const foreignHits = (text: string) => foreign.filter((f) => norm(text).includes(norm(f)));

    const lines: string[] = [];
    const renderedIdx = new Set(sections.map((s) => s.index));

    // PRESENT is a document-level check as well: a canonical section that the
    // builder never rendered has no section row to fail, so it is reported here.
    const missing = canonical
      ? [...canonical].filter((i) => !renderedIdx.has(i))
      : [];
    for (const i of missing) {
      sectionsFailed++;
      lines.push(`- section ${i} — **FAILED**`, `    - PRESENT: canonical section ${i} was not rendered`);
    }

    for (const sec of sections) {
      sectionsChecked++;
      const key = sec.index ? `${sec.index} "${sec.title}"` : `"${sec.title}"`;
      const fs = bySection.get(key) ?? [];
      const struct = structural.filter((s) => s.includes(`section ${sec.index}`));
      const placedFail = struct.filter((s) => /runs on into|orphan heading|selection artifact/.test(s));
      // PRESENT — the section exists, is canonical when a spec exists, and has
      // a body. Evaluated, never assumed.
      const presentFail: string[] = [];
      if (canonical && sec.index && !canonical.has(sec.index) && !/^contents$/i.test(sec.title))
        presentFail.push(`section ${sec.index} "${sec.title}" is not part of the canonical structure`);
      if (!sec.text.trim()) presentFail.push(`section ${sec.index} renders with no body`);
      const foreignFail = foreignHits(sec.text);

      const byCriterion = new Map<string, string[]>();
      const add = (c: string, msg: string) => byCriterion.set(c, [...(byCriterion.get(c) ?? []), msg]);
      for (const f of fs) add(f.criterion, `${f.detail}${f.quote ? ` — “${f.quote.replace(/\n/g, " ")}”` : ""}`);
      for (const s of placedFail) add("PLACED", s);
      for (const s of presentFail) add("PRESENT", s);
      for (const s of foreignFail) add("SOURCED", `content belonging to another session — “${s}”`);

      // Every criterion reports the check that actually ran. Nothing defaults
      // to a pass, and a criterion with no applicable check says so.
      const words = sec.text.split(/\s+/).filter(Boolean).length;
      const results: Array<[string, string]> = [
        ["PRESENT", `rendered${canonical ? (canonical.has(sec.index) ? " at its canonical index" : "") : ""}, ${words} words`],
        ["COMPLETE", `no empty body, orphan heading, cut sentence or trailing ellipsis`],
        ["SOURCED", foreign.length ? `no match against ${foreign.length} foreign-session markers` : "not checked — no other sessions to compare against"],
        ["PLACED", spec ? "structural gate: no bleed, orphan or selection artifact; no foreign heading" : "no canonical spec — heading-overlap check only"],
        ["CLEAN", "no metadata label, UUID, timestamp, unrendered markdown or telemetry"],
        ["CONSISTENT", doc.opts?.narrativeSections?.length === 0 ? "not checked — stage transcript" : "stated counts reconcile across narrative sections"],
        ["PROMISED", `numeric claims reconciled against ${(sec.html.match(/<li\b|<h[34]\b|<tr\b|<blockquote\b/gi) ?? []).length} rendered items`],
        ["VOICE", "no first-person system commentary outside quoted verbatim"],
        ["DUPLICATE", "no paragraph, list item, heading or table cell repeated"],
        ["SCHEMA", doc.opts?.schemaSections?.[sec.index] ? "all declared fields present with real values" : "not checked — no field schema declared"],
        ["DISPOSITION", "eliminated items reconciled against the disposition section"],
        ["CHECKPOINT", "checkpoint count reconciled against verdict language"],
      ];

      const anyFail = byCriterion.size > 0;
      if (!anyFail) {
        lines.push(`- ${key} — CERTIFIED`);
        for (const [c, how] of results) lines.push(`    - ${c}: pass — ${how}`);
        continue;
      }
      sectionsFailed++;
      lines.push(`- ${key} — **FAILED**`);
      for (const [c, how] of results) {
        const fails = byCriterion.get(c);
        if (fails) for (const f of fails) lines.push(`    - ${c}: **fail** — ${f}`);
        else lines.push(`    - ${c}: pass — ${how}`);
      }
    }
    if (findings.length || structural.length || missing.length) docsFailed++;
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
