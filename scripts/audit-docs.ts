/**
 * Provenance audit for every generated document, every real session.
 *
 * Why this replaces scripts/verify-docs.ts:
 * the previous harness only asked structural/lexical questions ("is there a
 * fallback marker?", "does the rejected section contain rejection words?",
 * "is a verdict token present?"). None of those questions can detect a
 * document that is fluent, complete and well-formed while describing the
 * wrong proposition. It also rendered documents through a different call path
 * than production, and it never compared output between runs, so a fix that
 * changed nothing still reported success.
 *
 * This harness audits identity and provenance:
 *   P1 UNTRACEABLE   every substantial rendered paragraph must be found,
 *                    verbatim (12-word shingle), inside this session's own
 *                    source columns or its explicitly linked intelligence
 *                    report. Anything else is foreign or invented text.
 *   P2 FOREIGN LINE  every headline/quote that reads as a proposition must be
 *                    the locked SMP or a candidate this session actually
 *                    generated.
 *   P3 WRONG SUBJECT any front-matter section where a sibling proposition is
 *                    named and the locked one is not.
 *   P4 SCAFFOLD      model bookkeeping promoted into a section.
 *   P5 FRAGMENT      a section that opens mid-sentence.
 *   P6 DRIFT         sha256 of each document vs the previous run, so "the fix
 *                    changed nothing" is visible instead of invisible.
 *
 * Output: /mnt/documents/document-audit.md (evidence, with quotes) and
 * /tmp/docaudit/hashes.json (drift baseline).
 */

import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { buildBoardStrategyDocument } from "../src/lib/board-strategy-document";
import { buildExecSummaryDocument } from "../src/lib/exec-summary-document";
import { buildConsultingDeliveryDocument } from "../src/lib/consulting-delivery-document";
import { buildMasterDetonationDocument } from "../src/lib/master-detonation-document";
import { buildDocument00AMinto } from "../src/lib/intelligence/doc-00A-minto";
import { intelligenceSourceIdFromBrief } from "../src/lib/document-source-authority";
import { PIPELINE_APPENDIX, parseScoredCandidates } from "../src/lib/minto-content";

const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const OUT = "/tmp/docaudit";
mkdirSync(OUT, { recursive: true });

/* ── text utilities ─────────────────────────────────────────────────── */

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

/** Shingles of N words, used for verbatim provenance lookup. */
function shingles(s: string, n = 12): string[] {
  const w = norm(s).split(" ").filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i + n <= w.length; i += Math.max(1, Math.floor(n / 2))) {
    out.push(w.slice(i, i + n).join(" "));
  }
  return out;
}

/* ── document rendering (production call path) ──────────────────────── */

type Row = Record<string, unknown>;

const SESSION_TEXT_COLUMNS = (row: Row) =>
  Object.entries(row)
    .filter(([k, v]) => typeof v === "string" && v.length > 40 && !/_url$|^id$/.test(k))
    .map(([, v]) => v as string);

/* Boilerplate the templates themselves write. Not evidence, not a defect. */
const TEMPLATE_PHRASES = [
  "the load-bearing evidence from each validation stage",
  "every stage output behind the recommendation above",
  "each stage is evidenced in the appendix",
  "weighted composite across six scoring dimensions",
  "no earlier proposition s score is substituted here",
  "brand grenade strategy intelligence system",
  "clears both stage 10 hard floors",
  "carried into the pipeline verbatim as the source document",
  "category belief structure shared silences and competitive positions audited in full",
  "the complete transcripts remain in the session record",
  "room 04 winning idea resolved from the locked run",
  "no room 04 winning idea was locked when this document was rendered",
  "this proposition was finalised after the stage 10 scoring pass",
  "the decision requested is a single one",
  "sign off releases the proposition to the detonation phase",
  "strategic stage outputs in the appendix are historical snapshots",
  "every downstream artefact territory activation architecture channel briefs",
  "is generated against this proposition",
];

const SCAFFOLD_PATTERNS: Array<[string, RegExp]> = [
  ["counter line", /\b(SMPS?|TESTS?|CANDIDATES?)\s+(RECEIVED|APPLIED|RETURNED)\s+(FROM|PER|BY|TO)\b/i],
  ["metadata block", /\[(METADATA|SELECTION_RATIONALE_STUB)\]/i],
  ["generation failure", /could not be generated|not available\b/i],
  ["self audit", /SELF[-\s]?AUDIT/i],
];

interface Finding {
  code: string;
  detail: string;
}

interface StringOccurrence {
  value: string;
  section: string;
  count: number;
  legitimateRejectedList: boolean;
}

function auditDocument(html: string, ctx: {
  smp: string;
  siblings: string[];
  owned: string[];
  corpusShingles: Set<string>;
  corpusText: string;
  /** Appendix stage titles whose source column actually contains the locked SMP. */
  stagesNamingSmp: Set<string>;
  probes?: string[];
}): Finding[] {
  const findings: Finding[] = [];
  const smpN = norm(ctx.smp);

  /* P1 — provenance of every substantial paragraph */
  const paras = html.match(/<p[^>]*>[\s\S]*?<\/p>/g) ?? [];
  for (const p of paras) {
    const t = strip(p);
    if (t.length < 140) continue;
    const n = norm(t);
    if (TEMPLATE_PHRASES.some((tp) => n.includes(tp))) continue;
    const sh = shingles(t);
    if (!sh.length) continue;
    const hits = sh.filter((s) => ctx.corpusShingles.has(s)).length;
    if (hits / sh.length < 0.5) {
      findings.push({
        code: "P1 UNTRACEABLE",
        detail: `only ${Math.round((hits / sh.length) * 100)}% of this paragraph is traceable to the session's own data: "${t.slice(0, 160)}…"`,
      });
    }
  }

  /* P2 — proposition-shaped headlines must belong to this session */
  const quotes = html.match(/<(blockquote|h1|h2|h3)[^>]*>[\s\S]*?<\/\1>/g) ?? [];
  for (const q of quotes) {
    const t = strip(q);
    const words = t.split(" ").length;
    if (words < 2 || words > 12) continue;
    if (!/[.!?]$/.test(t)) continue;
    const n = norm(t);
    if (!n || n === smpN) continue;
    if (ctx.siblings.some((s) => norm(s) === n)) continue;
    if (ctx.owned.some((s) => norm(s) && (norm(s) === n || norm(s).includes(n)))) continue;
    if (ctx.corpusText.includes(n)) continue;
    findings.push({ code: "P2 FOREIGN LINE", detail: `proposition-shaped line not owned by this session: "${t}"` });
  }

  /* P3 — wrong subject in a front-matter section */
  const secs = html.split(/<div class="section/).slice(1);
  let appendix = false;
  for (const sec of secs) {
    const t = strip(sec);
    if (t.length < 200) continue;
    // The rejected section names siblings on purpose.
    if (/what was rejected|considered and set aside|not carried forward/i.test(t.slice(0, 160))) continue;
    if (/Appendix|backing detail/i.test(t.slice(0, 140))) { appendix = true; continue; }
    // Appendix blocks carry a stage title from the shared appendix spec.
    const head = t
      .slice(0, 120)
      .replace(/^[^A-Za-z]*(?:keep-together|page-break)?"?>?\s*/i, "")
      .replace(/^\d+\s*/, "")
      .trim()
      .toLowerCase();
    if (PIPELINE_APPENDIX.some((d) => head.startsWith(d.title.toLowerCase()))) appendix = true;
    // Appendix blocks are historical transcripts. A stage that predates the
    // lock legitimately discusses other candidates; it is only a defect when
    // that stage DOES contain the locked proposition and the document showed
    // a sibling instead.
    if (appendix) {
      const stage = [...ctx.stagesNamingSmp].find((x) => head.startsWith(x.toLowerCase()));
      if (!stage) continue;
    }
    const n = norm(t);
    const namesLocked = smpN.length > 8 && n.includes(smpN);
    const sibs = ctx.siblings.filter((s) => norm(s).length > 8 && n.includes(norm(s)));
    if (!namesLocked && sibs.length) {
      findings.push({
        code: "P3 WRONG SUBJECT",
        detail: `section names "${sibs[0]}" but never the locked proposition — "${t.slice(0, 130)}…"`,
      });
    }
  }

  /* P4 — scaffolding */
  const bodyText = strip(html);
  for (const [label, re] of SCAFFOLD_PATTERNS) {
    const m = bodyText.match(re);
    if (m) {
      const at = bodyText.indexOf(m[0]);
      findings.push({
        code: "P4 SCAFFOLD",
        detail: `${label}: "${bodyText.slice(Math.max(0, at - 60), at + 110)}"`,
      });
    }
  }

  /* P5 — section opening mid-sentence */
  for (const sec of secs) {
    const firstP = sec.match(/<p[^>]*>[\s\S]*?<\/p>/)?.[0];
    if (!firstP) continue;
    const t = strip(firstP);
    if (t.length < 80) continue;
    if (/^[a-z]/.test(t) || /^(and|but|which|because|that)\b/i.test(t)) {
      findings.push({ code: "P5 FRAGMENT", detail: `section opens mid-sentence: "${t.slice(0, 120)}…"` });
    }
  }

  /* P7 — explicit subject-string search. Presence in the canonical rejected
   * section is legitimate; every other occurrence is candidate contamination.
   * This deliberately catches fluent, source-traceable sibling copy that P1
   * cannot distinguish from the selected proposition's own evidence. */
  for (const probe of ctx.probes ?? []) {
    const probeN = norm(probe);
    if (!probeN) continue;
    for (const sec of secs) {
      const text = strip(sec);
      const textN = norm(text);
      if (!textN.includes(probeN)) continue;
      const heading = text.slice(0, 100).replace(/\s+/g, " ").trim();
      const legitimate = /^(?:0?7\s+)?what was rejected|considered and set aside|not carried forward/i.test(heading);
      if (!legitimate) {
        findings.push({
          code: "P7 SIBLING OCCURRENCE",
          detail: `“${probe}” appears outside a legitimate rejected-proposition list in section “${heading}”`,
        });
      }
    }
  }

  /* P8 — no heading may be followed immediately by another heading or the
   * end of its appendix block. This is the orphan-fragment shape that allowed
   * “The Quiet Rebellion / The Permission Price Point — Validated” through. */
  const orphanHeadings = html.match(/<h3[^>]*>[^<]+<\/h3>\s*(?=<h3|<\/div>)/g) ?? [];
  for (const orphan of orphanHeadings) {
    findings.push({ code: "P8 ORPHAN HEADING", detail: `heading has no attached evidence: “${strip(orphan)}”` });
  }

  return findings;
}

function stringOccurrences(html: string, probes: string[]): StringOccurrence[] {
  const sections = html.split(/<div class="section/).slice(1);
  const out: StringOccurrence[] = [];
  for (const probe of probes) {
    const needle = norm(probe);
    for (const sec of sections) {
      const text = strip(sec);
      const haystack = norm(text);
      const count = needle ? haystack.split(needle).length - 1 : 0;
      if (!count) continue;
      const section = text.slice(0, 100).replace(/\s+/g, " ").trim();
      out.push({
        value: probe,
        section,
        count,
        legitimateRejectedList: /^(?:0?7\s+)?what was rejected|considered and set aside|not carried forward/i.test(section),
      });
    }
  }
  return out;
}

/* ── run ────────────────────────────────────────────────────────────── */

const { data: rows, error } = await sb.from("sessions").select("*").order("created_at", { ascending: false });
if (error) throw error;
const { data: intel } = await sb.from("intelligence_sessions").select("*").eq("status", "complete");

const prevHashes: Record<string, string> = existsSync(`${OUT}/hashes.json`)
  ? JSON.parse(readFileSync(`${OUT}/hashes.json`, "utf8"))
  : {};
const hashes: Record<string, string> = {};

const report: string[] = ["# Document provenance audit", ""];
let docCount = 0;
let clean = 0;
const tally: Record<string, number> = {};

for (const row of (rows ?? []) as Row[]) {
  if (row.is_preflight_test) continue;
  const smp = String(row.selected_smp ?? "").trim();
  if (!smp) continue;
  const brand = String(row.brand_name);

  const intelligenceSourceId = intelligenceSourceIdFromBrief(
    typeof row.brief_text === "string" ? row.brief_text : null,
  );
  const ir = (intel ?? []).find((i) => i.id === intelligenceSourceId);

  const corpusParts = SESSION_TEXT_COLUMNS(row);
  if (ir?.final_report) corpusParts.push(String(ir.final_report));
  const corpusShingles = new Set<string>();
  for (const part of corpusParts) {
    const w = norm(part).split(" ").filter(Boolean);
    for (let i = 0; i + 12 <= w.length; i++) corpusShingles.add(w.slice(i, i + 12).join(" "));
    for (let i = 0; i + 6 <= w.length; i++) corpusShingles.add(w.slice(i, i + 6).join(" "));
  }

  const corpusNorm = norm(corpusParts.join(" \n "));
  const stagesNamingSmp = new Set<string>();
  for (const def of PIPELINE_APPENDIX) {
    const v = String(row[def.key] ?? "");
    if (v && norm(v).includes(norm(smp))) stagesNamingSmp.add(def.title);
  }

  const siblings = [
    ...parseScoredCandidates(String(row.stage_10_output ?? "")).map((c) => c.name),
    ...(String(row.stage_12_output ?? "").match(/^\*\*(.+?)\*\*$/gm) ?? []).map((s) =>
      s.replace(/\*\*/g, "").trim(),
    ),
  ].filter((s) => s && norm(s) !== norm(smp) && s.split(" ").length <= 12);
  const danMurphysPdfProbes = ["Confidence Paradox", "Quiet Rebellion"];

  const docs: Record<string, string> = {};
  const safe = (name: string, fn: () => string) => {
    try {
      docs[name] = fn();
    } catch (e) {
      report.push(`## ${brand} · ${name}\n\n- **THREW** ${(e as Error).message}\n`);
    }
  };
  safe("Board Strategy Recommendation", () => buildBoardStrategyDocument(row as never));
  safe("Brand Strategy and Creative Intelligence Summary", () => buildExecSummaryDocument(row as never, {} as never));
  safe("Consulting Delivery", () => buildConsultingDeliveryDocument(row as never));
  safe("Master Detonation Brief", () => buildMasterDetonationDocument(row as never));
  if (ir?.final_report) {
    safe("Document 00A", () =>
      buildDocument00AMinto({
        brandName: ir.brand_name,
        category: ir.category ?? "",
        briefType: "commercial",
        completedAt: ir.completed_at ?? null,
        sourceRunId: ir.id,
        report: JSON.parse(ir.final_report as string),
      } as never),
    );
  }

  for (const [name, html] of Object.entries(docs)) {
    // Regression requested against the regenerated Dan Murphy's Strategy
    // Executive Summary PDF. Other document types can legitimately reuse a
    // later selected creative territory with the same historical label.
    const regressionProbes = /dan murphy/i.test(brand) && name === "Brand Strategy and Creative Intelligence Summary"
      ? danMurphysPdfProbes
      : [];
    docCount++;
    const key = `${row.id}__${name}`;
    const h = createHash("sha256").update(html).digest("hex").slice(0, 16);
    hashes[key] = h;
    const drift = prevHashes[key] ? (prevHashes[key] === h ? "unchanged" : "changed") : "new";
    writeFileSync(`${OUT}/${String(row.id)}__${name.replace(/\W+/g, "_")}.html`, html);

    const findings = auditDocument(html, {
      smp,
      siblings,
      corpusText: corpusNorm,
      stagesNamingSmp,
      owned: [
        String(row.locked_campaign_line ?? ""),
        String(row.locked_big_idea ?? ""),
        String(row.stage_18_detonation_line ?? ""),
      ].filter(Boolean),
      corpusShingles,
      probes: regressionProbes,
    });
    const occurrences = stringOccurrences(html, regressionProbes);
    for (const f of findings) tally[f.code] = (tally[f.code] ?? 0) + 1;
    if (!findings.length) clean++;

    report.push(`## ${brand} · ${name}`);
    report.push(`\`${String(row.id).slice(0, 8)}\` · locked SMP: “${smp}” · sha ${h} (${drift})`);
    if (!findings.length) report.push("- clean");
    for (const occurrence of occurrences) {
      report.push(`- **STRING SEARCH** — “${occurrence.value}” ×${occurrence.count} in “${occurrence.section}” · ${occurrence.legitimateRejectedList ? "legitimate rejected-proposition list" : "outside rejected-proposition list"}`);
    }
    for (const probe of regressionProbes.filter((value) => !occurrences.some((o) => o.value === value))) {
      report.push(`- **STRING SEARCH** — “${probe}” ×0`);
    }
    for (const f of findings.slice(0, 12)) report.push(`- **${f.code}** — ${f.detail}`);
    if (findings.length > 12) report.push(`- …and ${findings.length - 12} more`);
    report.push("");
  }
}

writeFileSync(`${OUT}/hashes.json`, JSON.stringify(hashes, null, 2));
const summary = [
  "",
  "## Summary",
  `- documents audited: ${docCount}`,
  `- clean: ${clean}`,
  `- with findings: ${docCount - clean}`,
  ...Object.entries(tally).map(([k, v]) => `- ${k}: ${v}`),
];
report.push(...summary);
mkdirSync("/mnt/documents", { recursive: true });
writeFileSync("/mnt/documents/document-audit.md", report.join("\n"));
console.log(summary.join("\n"));
