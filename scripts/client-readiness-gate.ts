/**
 * CLIENT-READINESS GATE
 * =====================
 * Eight gates, run against the LIVE RENDERED delivery set for a session —
 * the same builders the download buttons call — never against a code diff and
 * never against a summary of one. Three audit rounds on the Dan Murphy's run
 * showed the failure was always the same: a fix was verified by reasoning
 * about the change instead of reading the file a client would open. This
 * harness exists so that verification step is mechanical and cannot be
 * self-reported.
 *
 *   G1 CROSS-DOC     one run-level fact = one value in every document stating it
 *   G2 SELF-CONTRA   no document states a fact twice with different values
 *   G3 SCORES        composites are derivable; superseded scales print no number
 *   G4 PROVENANCE    locked creative in a document matches the stored record
 *   G5 SCAFFOLD      set-framing language never sits over a single option
 *   G6 DUPLICATES    one canonical document per audience, no divergent twins
 *   G7 SURFACE       no script artifacts, orphan headings, title/footer drift
 *   G8 OPEN FLAGS    no audit flag shipped still deferred to a later stage
 *
 * Usage:  bun scripts/client-readiness-gate.ts <session-id> [more ids…]
 * Exit code is non-zero if any gate fails, so this can gate a release.
 */

import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "fs";
import { buildPhase1Document, type Phase1Format } from "../src/lib/phase1-document-builder";
import { buildSummaryDocument } from "../src/lib/summary-document";
import { buildConsultingDeliveryDocument } from "../src/lib/consulting-delivery-document";

const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const OUT = "/tmp/client-gate";
mkdirSync(OUT, { recursive: true });

type Finding = { gate: string; doc: string; detail: string; evidence?: string };

/* ── text extraction ────────────────────────────────────────────────── */

const text = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<\/(h[1-6]|p|div|li|tr|section)>/g, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n");

const norm = (s: string) =>
  s.toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/* ── fact extraction: the numbers a client can compare between files ── */

type Facts = Partial<Record<
  "stagesRun" | "stagesTotal" | "considered" | "scored" | "gatesConfirmed" | "gatesTotal" | "composite",
  string[]
>>;

/** Every stated value for each fact, so a document contradicting itself shows up as >1. */
function extractFacts(t: string): Facts {
  const all = (re: RegExp, group = 1) =>
    [...t.matchAll(re)].map((m) => m[group]!).filter(Boolean);
  const uniq = (v: string[]) => [...new Set(v)];
  return {
    stagesRun: uniq([
      ...all(/(\d{1,2})\s*(?:of|\/)\s*\d{1,2}\s*(?:pipeline |validation )?stages?/gi),
      ...all(/(\d{1,2})\s*(?:pipeline |validation )stages? (?:run|were run|completed)/gi),
    ]),
    stagesTotal: uniq(all(/\d{1,2}\s*(?:of|\/)\s*(\d{1,2})\s*(?:pipeline |validation )?stages?/gi)),
    considered: uniq(all(/(\d{1,2})\s*propositions? considered/gi)),
    scored: uniq(all(/(\d{1,2})\s*(?:propositions? )?competitively scored/gi)),
    gatesConfirmed: uniq(all(/(\d{1,2})\s*(?:of|\/)\s*\d{1,2}\s*(?:governance )?gates?/gi)),
    gatesTotal: uniq(all(/\d{1,2}\s*(?:of|\/)\s*(\d{1,2})\s*(?:governance )?gates?/gi)),
    composite: uniq(all(/(\d{1,3}(?:\.\d)?)\s*\/\s*90/g)),
  };
}

/* ── gate implementations ───────────────────────────────────────────── */

function gate2SelfContradiction(doc: string, facts: Facts): Finding[] {
  const out: Finding[] = [];
  for (const [key, values] of Object.entries(facts)) {
    if (key === "composite") continue; // several propositions legitimately carry scores
    if ((values as string[]).length > 1) {
      out.push({
        gate: "G2 SELF-CONTRA",
        doc,
        detail: `states ${key} as ${(values as string[]).join(" and ")} in the same document`,
      });
    }
  }
  return out;
}

const SUPERSEDED_SCALE = /(\d{1,3}(?:\.\d)?)\s*\/\s*(60|100|110)\b/g;

function gate3Scores(doc: string, t: string): Finding[] {
  const out: Finding[] = [];
  for (const m of t.matchAll(SUPERSEDED_SCALE)) {
    out.push({
      gate: "G3 SCORES",
      doc,
      detail: `prints a number on a superseded scale (${m[0]})`,
      evidence: t.slice(Math.max(0, m.index! - 90), m.index! + 90).replace(/\n/g, " "),
    });
  }
  // "the six contributions above add to X" must equal the stated composite.
  for (const m of t.matchAll(/contributions? above add to\s*(\d{1,3}(?:\.\d)?)/gi)) {
    const stated = m[1]!;
    const before = t.slice(Math.max(0, m.index! - 1200), m.index!);
    const composite = [...before.matchAll(/(\d{1,3}(?:\.\d)?)\s*\/\s*90/g)].pop()?.[1];
    if (composite && composite !== stated) {
      out.push({
        gate: "G3 SCORES",
        doc,
        detail: `composite ${composite}/90 does not equal its own stated contribution total ${stated}`,
      });
    }
  }
  return out;
}

const LOCKED_FIELDS: Array<{ column: string; label: string }> = [
  { column: "locked_campaign_line", label: "campaign line" },
  { column: "stage_18_selected_detonation", label: "detonation" },
  { column: "locked_big_idea", label: "locked idea" },
];

/** Any locked creative a document prints must be present in the stored record. */
function gate4Provenance(doc: string, t: string, session: Record<string, unknown>): Finding[] {
  const out: Finding[] = [];
  const nt = norm(t);
  for (const { column, label } of LOCKED_FIELDS) {
    const raw = typeof session[column] === "string" ? (session[column] as string) : "";
    if (!raw.trim()) continue;
    // Headline of the stored record: the sentence a document would quote.
    const headline = raw.split("\n").map((l) => l.trim()).filter(Boolean)[0] ?? "";
    if (!headline || headline.length < 12) continue;
    const key = norm(headline).split(" ").slice(0, 8).join(" ");
    const mentionsLabel = new RegExp(`\\b${label.split(" ")[0]}\\b`, "i").test(t);
    if (mentionsLabel && key && !nt.includes(key)) {
      out.push({
        gate: "G4 PROVENANCE",
        doc,
        detail: `refers to the ${label} but does not reproduce the stored one`,
        evidence: headline.slice(0, 120),
      });
    }
  }
  return out;
}

const SET_FRAMING = [
  /each of (?:these|the) (?:\w+ )?propositions/i,
  /all (?:\w+ )?propositions/i,
  /\beach one\b/i,
  /\bthese propositions\b/i,
  /\bboth propositions\b/i,
  /compare (?:the|these) (?:propositions|options)/i,
];

function gate5Scaffold(doc: string, t: string): Finding[] {
  const cards = new Set(
    [...t.matchAll(/PROPOSITION\s+(\d+|ONE|TWO|THREE|FOUR|FIVE|SIX)\b/gi)].map((m) => m[0].toUpperCase()),
  ).size;
  if (cards > 1) return []; // a genuine comparison section may say so
  const out: Finding[] = [];
  for (const line of t.split("\n")) {
    for (const re of SET_FRAMING) {
      if (re.test(line)) {
        out.push({
          gate: "G5 SCAFFOLD",
          doc,
          detail: "set-framing language over a single presented proposition",
          evidence: line.trim().slice(0, 160),
        });
        break;
      }
    }
  }
  return out;
}

function gate7Surface(doc: string, t: string, html: string): Finding[] {
  const out: Finding[] = [];
  const cjk = t.match(/[\u3400-\u9FFF\uF900-\uFAFF\u3040-\u30FF]+/g);
  if (cjk) {
    out.push({ gate: "G7 SURFACE", doc, detail: `script artifact in body text`, evidence: cjk.slice(0, 5).join(" ") });
  }
  if (/[ÃÂ]\s?[\u0080-\u00BF]/.test(t)) {
    out.push({ gate: "G7 SURFACE", doc, detail: "mojibake / broken encoding in body text" });
  }
  // Orphan heading: a rendered heading whose element is followed by another
  // heading (or the end of the document) with no prose between them.
  const heads = [...html.matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/g)];
  heads.forEach((m, i) => {
    const after = html.slice(m.index! + m[0].length, heads[i + 1]?.index ?? html.length);
    if (text(after).replace(/\s/g, "").length < 25) {
      out.push({
        gate: "G7 SURFACE",
        doc,
        detail: "heading with no content beneath it",
        evidence: text(m[2]!).trim().slice(0, 80),
      });
    }
  });
  return out;
}

const DEFERRED_FLAG =
  /(will be (?:corrected|resolved|addressed)|deferred|to be (?:corrected|resolved)) (?:at|in|to) stage\s*\d+/gi;

function gate8OpenFlags(doc: string, t: string): Finding[] {
  return [...t.matchAll(DEFERRED_FLAG)].map((m) => ({
    gate: "G8 OPEN FLAGS",
    doc,
    detail: "ships an audit flag still deferred to a later stage",
    evidence: t.slice(Math.max(0, m.index! - 120), m.index! + 120).replace(/\n/g, " "),
  }));
}

/* ── run ────────────────────────────────────────────────────────────── */

const FACT_LABEL: Record<string, string> = {
  stagesRun: "stages run",
  stagesTotal: "total stages",
  considered: "propositions considered",
  scored: "propositions competitively scored",
  gatesConfirmed: "gates confirmed",
  gatesTotal: "total gates",
};

async function auditSession(id: string) {
  const { data: session, error } = await sb.from("sessions").select("*").eq("id", id).maybeSingle();
  if (error || !session) throw new Error(`session ${id} not loadable: ${error?.message}`);
  const brand = (session as Record<string, unknown>)["brand_name"] as string;

  const set: Array<{ name: string; audience: string; html: string }> = [
    { name: "Vision — Strategy & Creative Summary", audience: "vision", html: buildSummaryDocument(session as never, undefined as never) },
    { name: "Board Strategy Recommendation", audience: "board", html: buildPhase1Document(session as never, "consulting" as Phase1Format) },
    { name: "Agency Strategy Platform", audience: "agency", html: buildPhase1Document(session as never, "agency" as Phase1Format) },
    { name: "Workshop Pack", audience: "workshop", html: buildPhase1Document(session as never, "workshop" as Phase1Format) },
    { name: "Consulting Delivery", audience: "board", html: buildConsultingDeliveryDocument(session as never) },
  ];

  const findings: Finding[] = [];
  const factsByDoc = new Map<string, Facts>();
  const byAudience = new Map<string, string[]>();

  for (const d of set) {
    const t = text(d.html);
    writeFileSync(`${OUT}/${id}.${d.audience}.${d.name.replace(/\W+/g, "_")}.txt`, t);
    const facts = extractFacts(t);
    factsByDoc.set(d.name, facts);
    byAudience.set(d.audience, [...(byAudience.get(d.audience) ?? []), d.name]);
    findings.push(
      ...gate2SelfContradiction(d.name, facts),
      ...gate3Scores(d.name, t),
      ...gate4Provenance(d.name, t, session as Record<string, unknown>),
      ...gate5Scaffold(d.name, t),
      ...gate7Surface(d.name, t, d.html),
      ...gate8OpenFlags(d.name, t),
    );
  }

  // G1 — the same fact, stated in two documents, must be the same value.
  for (const key of Object.keys(FACT_LABEL)) {
    const stated = new Map<string, string[]>();
    for (const [doc, facts] of factsByDoc) {
      for (const v of (facts as Record<string, string[]>)[key] ?? []) {
        stated.set(v, [...(stated.get(v) ?? []), doc]);
      }
    }
    if (stated.size > 1) {
      findings.push({
        gate: "G1 CROSS-DOC",
        doc: "delivery set",
        detail: `${FACT_LABEL[key]} disagrees across documents: ${[...stated]
          .map(([v, docs]) => `${v} (${docs.join(", ")})`)
          .join(" vs ")}`,
      });
    }
  }

  // G6 — one canonical document per audience.
  for (const [audience, docs] of byAudience) {
    if (docs.length > 1) {
      findings.push({
        gate: "G6 DUPLICATES",
        doc: "delivery set",
        detail: `${docs.length} documents target the "${audience}" audience: ${docs.join(", ")}`,
      });
    }
  }

  return { id, brand, findings, docs: set.map((d) => d.name) };
}

const ids = process.argv.slice(2);
if (!ids.length) {
  console.error("usage: bun scripts/client-readiness-gate.ts <session-id> [...]");
  process.exit(2);
}

let failed = false;
const report: string[] = ["# Client-Readiness Gate", ""];
for (const id of ids) {
  const r = await auditSession(id);
  report.push(`## ${r.brand} (${r.id})`, "", `Documents rendered: ${r.docs.join(" · ")}`, "");
  if (!r.findings.length) {
    report.push("**PASS** — all eight gates clear on the live render.", "");
    console.log(`PASS  ${r.brand}`);
  } else {
    failed = true;
    console.log(`FAIL  ${r.brand} — ${r.findings.length} findings`);
    const byGate = new Map<string, Finding[]>();
    for (const f of r.findings) byGate.set(f.gate, [...(byGate.get(f.gate) ?? []), f]);
    for (const [gate, list] of [...byGate].sort()) {
      report.push(`### ${gate} — ${list.length}`, "");
      for (const f of list) {
        report.push(`- **${f.doc}**: ${f.detail}`);
        if (f.evidence) report.push(`  > ${f.evidence.replace(/\s+/g, " ").trim()}`);
      }
      report.push("");
      console.log(`  ${gate}: ${list.length}`);
    }
  }
}
mkdirSync("/mnt/documents", { recursive: true });
writeFileSync("/mnt/documents/client-readiness-gate.md", report.join("\n"));
console.log("report: /mnt/documents/client-readiness-gate.md");
process.exit(failed ? 1 : 0);
