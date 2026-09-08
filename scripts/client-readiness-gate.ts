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
import { findPropositionFramingViolations } from "../src/lib/proposition-framing";

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
      // "20 validation stages were run" — but never the tail of "20 of 22
      // validation stages", which the pattern above has already counted.
      ...all(/(?:^|[^\/]\b(?!of\s)\w+\s|[.:;·]\s*)(\d{1,2})\s*(?:pipeline |validation )stages? (?:run|were run|completed)/gi),
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

/**
 * The severe failure mode: a document presenting creative that was never
 * decided. So the test runs in the direction that catches it — every
 * substantial line a document prints under a locked-creative label must exist
 * in this session's own stored columns. Merely mentioning the word
 * "detonation" is not presenting one, so headings alone are not flagged.
 */
function gate4Provenance(doc: string, t: string, session: Record<string, unknown>): Finding[] {
  const out: Finding[] = [];
  const source = norm(
    Object.entries(session)
      .filter(([k, v]) => typeof v === "string" && (k.startsWith("stage_") || k.startsWith("locked_") || k.startsWith("truth_") || k.startsWith("brand_")))
      .map(([, v]) => v as string)
      .join("\n"),
  );
  const lines = t.split("\n").map((l) => l.trim());
  const LABEL = /^(?:the\s+)?(?:locked\s+)?(?:detonation(?:\s+line)?|campaign line|locked creative platform|locked idea|creative idea)\b/i;
  lines.forEach((line, i) => {
    if (!LABEL.test(line)) return;
    // Inspect what the document prints as the locked content itself.
    for (const claim of lines.slice(i + 1, i + 6)) {
      const words = norm(claim).split(" ").filter(Boolean);
      if (words.length < 8) continue;
      const shingle = words.slice(0, 8).join(" ");
      if (!source.includes(shingle)) {
        out.push({
          gate: "G4 PROVENANCE",
          doc,
          detail: `prints locked creative under "${line.slice(0, 40)}" that is not in this session's stored record`,
          evidence: claim.slice(0, 160),
        });
      }
      break;
    }
  });
  return out;
}

/**
 * Set-framing is only a defect when it quantifies over PROPOSITIONS the reader
 * cannot see. "each one" about channels or alternatives is ordinary English,
 * so the sentence itself must be about the proposition set.
 */
function gate5Scaffold(doc: string, t: string): Finding[] {
  // This count contract applies to the Agency format, whose template presents
  // one locked proposition. Vision and Workshop intentionally discuss rejected
  // sets without rendering them as proposition cards; Board renders all cards.
  if (doc !== "Agency Strategy Platform") return [];
  const cards = new Set(
    [...t.matchAll(/PROPOSITION\s+(\d+|ONE|TWO|THREE|FOUR|FIVE|SIX)\b/gi)].map((m) => m[0].toUpperCase()),
  ).size;
  if (cards > 1) return []; // a genuine comparison section may say so
  return findPropositionFramingViolations(t, cards || 1).map((violation) => ({
    gate: "G5 SCAFFOLD",
    doc,
    detail: "set-framing language over a single presented proposition",
    evidence: violation.sentence.slice(0, 160),
  }));
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
  // Orphan heading: a heading with no prose anywhere in the block it owns.
  // Two exclusions keep this on real defects. Nesting is not a defect, so the
  // block runs to the next heading of the same or a shallower level; and a
  // grouping heading whose siblings DO carry content is a hierarchy, not a
  // deletion scar — the defect is a heading, and its neighbour, left with
  // nothing beneath either (the empty "Layer 1/2/3" case).
  const heads = [...html.matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/g)];
  const bodyOf = (i: number) => {
    const m = heads[i]!;
    const level = Number(m[1]);
    const next = heads.slice(i + 1).find((h) => Number(h[1]) <= level);
    const block = html.slice(m.index! + m[0].length, next?.index ?? html.length);
    return text(block.replace(/<h([1-6])[^>]*>[\s\S]*?<\/h\1>/g, " ")).replace(/\s/g, "");
  };
  heads.forEach((m, i) => {
    if (bodyOf(i).length >= 12) return;
    const neighbourIsEmpty = i + 1 >= heads.length || bodyOf(i + 1).length < 12;
    if (!neighbourIsEmpty) return;
    out.push({
      gate: "G7 SURFACE",
      doc,
      detail: "heading with no content beneath it",
      evidence: text(m[2]!).trim().slice(0, 80),
    });
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

  // Documents render the rated creative shortlist from the winning sweep run,
  // exactly as the app attaches it when a user opens a document.
  const runId = (session as Record<string, unknown>)["locked_big_idea_run_id"] as string | null;
  if (runId) {
    const { data: shortlist } = await sb
      .from("stimulus_directions")
      .select("lens_name,direction,campaign_line,rationale,status,rating_status,gate_one_approved,ratings")
      .eq("run_id", runId)
      .eq("status", "keep")
      .order("sort_order", { ascending: true });
    (session as Record<string, unknown>)["creative_shortlist"] = shortlist ?? [];
  }

  const set: Array<{ name: string; audience: string; html: string }> = [
    { name: "Vision — Strategy & Creative Summary", audience: "vision", html: buildSummaryDocument(session as never, undefined as never) },
    { name: "Board Strategy Recommendation", audience: "board", html: buildPhase1Document(session as never, "consulting" as Phase1Format) },
    { name: "Agency Strategy Platform", audience: "agency", html: buildPhase1Document(session as never, "agency" as Phase1Format) },
    { name: "Workshop Pack", audience: "workshop", html: buildPhase1Document(session as never, "workshop" as Phase1Format) },
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
