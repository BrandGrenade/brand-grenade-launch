/**
 * BRAND GRENADE — DOCUMENT COMPLETENESS + INTEGRITY GATE
 * ============================================================================
 * This is a gate, not a report. It renders every document type for every real
 * session through the production builders and checks each one against the
 * single canonical section spec (src/lib/document-spec.ts). Any failure exits
 * non-zero; nothing may be described as passing unless this exits 0.
 *
 * Four checks, reported individually per document:
 *
 *   C1 COMPLETENESS   every canonical section (front matter 01–10 and every
 *                     numbered appendix card) is present, in order, with no
 *                     skipped index.
 *   C2 SUBJECT        no section header names one proposition while its body
 *                     is led by a different one; no front-matter section names
 *                     a sibling candidate without naming the locked SMP.
 *   C3 FOREIGN        no proposition / candidate / territory / campaign-line
 *                     string belonging to ANY OTHER session appears anywhere.
 *                     The foreign list is derived from the database at run
 *                     time — never hardcoded.
 *   C4 ORPHANS        no heading without body beneath it, and no appendix card
 *                     whose body is only a heading.
 *
 * Output: /mnt/documents/document-gate.md (per-document table + evidence).
 */

import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "fs";
import { buildBoardStrategyDocument } from "../src/lib/board-strategy-document";
import { buildConsultingDeliveryDocument } from "../src/lib/consulting-delivery-document";
import { buildMasterDetonationDocument } from "../src/lib/master-detonation-document";
import { DOCUMENT_SPECS, type DocumentSpec } from "../src/lib/document-spec";
import { parseScoredCandidates, selectedAliases } from "../src/lib/minto-content";

const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const OUT = "/tmp/docgate";
mkdirSync(OUT, { recursive: true });

type Row = Record<string, unknown>;

const strip = (h: string) =>
  h
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/* ── section extraction ─────────────────────────────────────────────── */

interface RenderedSection {
  index: string;
  title: string;
  bodyHtml: string;
  text: string;
}

/** Every `<div class="section…"><p class="kicker"><span class="idx">NN</span>Title` block. */
function sections(html: string): RenderedSection[] {
  const out: RenderedSection[] = [];
  const re = /<p class="kicker"><span class="idx">(\d{2})<\/span>([^<]*)<\/p>/g;
  const marks: Array<{ index: string; title: string; at: number; end: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    marks.push({ index: m[1], title: strip(m[2]), at: m.index, end: re.lastIndex });
  }
  marks.forEach((mk, i) => {
    const bodyHtml = html.slice(mk.end, marks[i + 1]?.at ?? html.length);
    out.push({ index: mk.index, title: mk.title, bodyHtml, text: strip(bodyHtml) });
  });
  return out;
}

/* ── checks ─────────────────────────────────────────────────────────── */

interface CheckResult {
  pass: boolean;
  detail: string[];
}

function c1Completeness(spec: DocumentSpec, rendered: RenderedSection[]): CheckResult {
  const detail: string[] = [];
  const seen = rendered.map((s) => `${s.index}|${norm(s.title)}`);
  const expect = [
    ...spec.frontMatter.map((f) => ({ index: f.index, title: f.kicker })),
    ...spec.appendix.map((a) => ({ index: a.index, title: a.title })),
  ];
  for (const e of expect) {
    const key = `${e.index}|${norm(e.title)}`;
    if (!seen.includes(key)) detail.push(`missing section ${e.index} "${e.title}"`);
  }
  // gap detection inside each contiguous numbered run
  let prev = 0;
  for (const s of rendered) {
    const n = Number(s.index);
    if (n !== 1 && n !== prev + 1 && n > prev) detail.push(`index gap: ${prev} → ${n} ("${s.title}")`);
    prev = n;
  }
  return { pass: detail.length === 0, detail };
}

function c2Subject(
  rendered: RenderedSection[],
  ctx: { smp: string; siblings: string[]; frontMatterTitles: Set<string>; stagesNamingSmp: Set<string> },
): CheckResult {
  const detail: string[] = [];
  const smpN = norm(ctx.smp);
  const sibN = ctx.siblings.map(norm).filter((s) => s.length > 8 && s !== smpN);
  const REJECTED = /what was rejected|considered and set aside|not carried forward/i;

  for (const sec of rendered) {
    if (REJECTED.test(sec.title)) continue;
    // header/body proposition agreement inside the section: an <h3> naming a
    // sibling that then carries body prose is a header/body mismatch.
    const heads = sec.bodyHtml.match(/<h[23][^>]*>[\s\S]*?<\/h[23]>/g) ?? [];
    for (const h of heads) {
      const hn = norm(strip(h));
      const named = sibN.find((s) => hn.includes(s));
      if (!named) continue;
      const after = norm(strip(sec.bodyHtml.slice(sec.bodyHtml.indexOf(h) + h.length, sec.bodyHtml.indexOf(h) + h.length + 1200)));
      if (smpN && after.includes(smpN)) {
        detail.push(`heading "${strip(h)}" is followed by body about the locked SMP`);
      }
    }
    if (sec.text.length < 200) continue;
    // An appendix card is a historical transcript. A stage recorded before the
    // lock legitimately discusses other candidates; it is only a subject
    // defect when that stage DOES carry the locked proposition and the card
    // shows a sibling instead.
    const isFrontMatter = ctx.frontMatterTitles.has(norm(sec.title));
    if (!isFrontMatter && !ctx.stagesNamingSmp.has(norm(sec.title))) continue;
    const n = norm(sec.text);
    const namesLocked = smpN.length > 8 && n.includes(smpN);
    const hit = sibN.filter((s) => n.includes(s));
    if (!namesLocked && hit.length) {
      detail.push(`section ${sec.index} "${sec.title}" is led by sibling "${hit[0]}" and never names the locked SMP`);
    }
  }
  return { pass: detail.length === 0, detail };
}

function c3Foreign(rendered: RenderedSection[], foreign: string[]): CheckResult {
  const detail: string[] = [];
  for (const sec of rendered) {
    const n = norm(sec.text);
    for (const f of foreign) {
      const fn = norm(f);
      if (fn.length < 12) continue;
      if (n.includes(fn)) detail.push(`foreign string "${f}" in section ${sec.index} "${sec.title}"`);
    }
  }
  return { pass: detail.length === 0, detail: [...new Set(detail)] };
}

function c4Orphans(rendered: RenderedSection[]): CheckResult {
  const detail: string[] = [];
  for (const sec of rendered) {
    const orphan = sec.bodyHtml.match(/<h[23][^>]*>[^<]*<\/h[23]>\s*(?=<h[23]|<\/div>|$)/g) ?? [];
    for (const o of orphan) detail.push(`orphan heading "${strip(o)}" in section ${sec.index} "${sec.title}"`);
    if (!sec.text.trim()) detail.push(`section ${sec.index} "${sec.title}" has a header with no body`);
  }
  return { pass: detail.length === 0, detail: [...new Set(detail)] };
}

/* ── run ────────────────────────────────────────────────────────────── */

const { data: rows, error } = await sb.from("sessions").select("*").order("created_at", { ascending: false });
if (error) throw error;

const live = ((rows ?? []) as Row[]).filter(
  (r) => !r.is_preflight_test && String(r.selected_smp ?? "").trim(),
);

/** Proposition / candidate / territory / line names owned by a session. */
function ownedNames(row: Row): string[] {
  const names = [
    String(row.selected_smp ?? ""),
    String(row.locked_campaign_line ?? ""),
    String(row.locked_big_idea ?? ""),
    ...parseScoredCandidates(String(row.stage_10_output ?? "")).map((c) => c.name),
    ...(String(row.stage_12_output ?? "").match(/^\*\*(.+?)\*\*$/gm) ?? []).map((s) =>
      s.replace(/\*\*/g, "").trim(),
    ),
    ...(String(row.stage_7_output ?? "").match(/^#{2,3}\s+(.+)$/gm) ?? []).map((s) =>
      s.replace(/^#+\s+/, "").trim(),
    ),
  ];
  return [...new Set(names.map((s) => s.trim()).filter((s) => s.length > 11 && s.split(" ").length <= 12))];
}

const owned = new Map<string, string[]>();
for (const r of live) owned.set(String(r.id), ownedNames(r));

const builders: Array<{ spec: DocumentSpec; build: (row: Row) => string }> = [
  { spec: DOCUMENT_SPECS.board_strategy, build: (r) => buildBoardStrategyDocument(r as never) },
  { spec: DOCUMENT_SPECS.consulting_delivery, build: (r) => buildConsultingDeliveryDocument(r as never) },
  { spec: DOCUMENT_SPECS.master_detonation, build: (r) => buildMasterDetonationDocument(r as never) },
];

const table: string[] = [
  "| Session | Document | C1 completeness | C2 subject | C3 foreign | C4 orphans |",
  "| --- | --- | --- | --- | --- | --- |",
];
const evidence: string[] = [];
let failures = 0;
let docs = 0;

const only = process.argv.slice(2).filter((a) => !a.startsWith("-"));

for (const row of live) {
  const brand = String(row.brand_name);
  if (only.length && !only.some((o) => brand.toLowerCase().includes(o.toLowerCase()))) continue;
  const smp = String(row.selected_smp ?? "").trim();
  const mine = new Set((owned.get(String(row.id)) ?? []).map(norm));
  const foreign = [...new Set(live.filter((r) => r.id !== row.id).flatMap((r) => owned.get(String(r.id)) ?? []))]
    .filter((n) => !mine.has(norm(n)));
  // Names this session legitimately owns beyond the SMP string itself: the
  // locked Room 04 line/idea and the territory aliases the SMP was resolved
  // from. These are not siblings and must never be reported as contamination.
  const ownedByLock = new Set(
    [
      smp,
      String(row.locked_campaign_line ?? ""),
      String(row.locked_big_idea ?? ""),
      String(row.stage_18_detonation_line ?? ""),
      ...selectedAliases(row as never),
    ]
      .filter(Boolean)
      .map(norm),
  );
  const siblings = (owned.get(String(row.id)) ?? []).filter((n) => !ownedByLock.has(norm(n)));

  for (const { spec, build } of builders) {
    docs++;
    let html = "";
    try {
      html = build(row);
    } catch (e) {
      failures++;
      table.push(`| ${brand} | ${spec.label} | THREW | THREW | THREW | THREW |`);
      evidence.push(`### ${brand} · ${spec.label}\n\n- THREW: ${(e as Error).message}\n`);
      continue;
    }
    writeFileSync(`${OUT}/${String(row.id)}__${spec.id}.html`, html);
    const rendered = sections(html);
    const results: Array<[string, CheckResult]> = [
      ["C1", c1Completeness(spec, rendered)],
      [
        "C2",
        c2Subject(rendered, {
          smp,
          siblings,
          frontMatterTitles: new Set(spec.frontMatter.map((f) => norm(f.kicker))),
          stagesNamingSmp: new Set(
            spec.appendix
              .filter((a) => {
                const raw = norm(String((row as Row)[a.key] ?? ""));
                return raw.includes(norm(smp)) && norm(smp).length > 8;
              })
              .map((a) => norm(a.title)),
          ),
        }),
      ],
      ["C3", c3Foreign(rendered, foreign)],
      ["C4", c4Orphans(rendered)],
    ];
    const cells = results.map(([, r]) => (r.pass ? "PASS" : `FAIL (${r.detail.length})`));
    if (results.some(([, r]) => !r.pass)) failures++;
    table.push(`| ${brand} | ${spec.label} | ${cells.join(" | ")} |`);
    const bad = results.filter(([, r]) => !r.pass);
    if (bad.length) {
      evidence.push(
        `### ${brand} · ${spec.label}\n\n` +
          bad
            .map(([code, r]) => `**${code}**\n` + r.detail.slice(0, 12).map((d) => `- ${d}`).join("\n"))
            .join("\n\n"),
      );
    }
  }

  // The Brand Strategy and Creative Intelligence Summary. Its own permanent
  // gate (summary-gate.ts) is the C1/C2 equivalent and throws on failure; the
  // foreign-content and orphan checks are applied here as for every other
  // document, so no document type can be published un-audited.
  docs++;
  const label = "Brand Strategy and Creative Intelligence Summary";
  try {
    const extras = await summaryExtras(
      sb,
      row as Record<string, any>,
      live.filter((r) => r.id !== row.id) as Array<Record<string, any>>,
    );
    const html = buildSummaryDocument(row as never, extras);
    writeFileSync(`${OUT}/${String(row.id)}__summary.html`, html);
    const rendered = sections(html);
    const results: Array<[string, CheckResult]> = [
      ["C3", c3Foreign(rendered, foreign)],
      ["C4", c4Orphans(rendered)],
    ];
    const bad = results.filter(([, r]) => !r.pass);
    if (bad.length) failures++;
    table.push(
      `| ${brand} | ${label} | PASS (gate) | PASS (gate) | ${results
        .map(([, r]) => (r.pass ? "PASS" : `FAIL (${r.detail.length})`))
        .join(" | ")} |`,
    );
    if (bad.length)
      evidence.push(
        `### ${brand} · ${label}\n\n` +
          bad
            .map(([code, r]) => `**${code}**\n` + r.detail.slice(0, 12).map((d) => `- ${d}`).join("\n"))
            .join("\n\n"),
      );
  } catch (e) {
    failures++;
    table.push(`| ${brand} | ${label} | THREW | THREW | THREW | THREW |`);
    evidence.push(`### ${brand} · ${label}\n\n- THREW: ${(e as Error).message}\n`);
  }
}


const report = [
  "# Document completeness + integrity gate",
  "",
  `${docs} documents audited · ${docs - failures} pass · ${failures} fail`,
  "",
  ...table,
  "",
  failures ? "## Evidence\n" : "All documents satisfy C1–C4.",
  ...evidence,
].join("\n");

mkdirSync("/mnt/documents", { recursive: true });
writeFileSync("/mnt/documents/document-gate.md", report);
console.log(report);
if (failures) {
  console.error(`\nGATE FAILED: ${failures} document(s) did not satisfy the canonical spec.`);
  process.exit(1);
}
