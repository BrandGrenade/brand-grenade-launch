// Platform-wide document verification harness.
// Renders every Minto document type for every real session and audits the
// rendered HTML (not the underlying data) for the six failure classes.

import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "fs";
import { buildBoardStrategyDocument } from "../src/lib/board-strategy-document";
import { buildExecSummaryDocument } from "../src/lib/exec-summary-document";
import { buildConsultingDeliveryDocument } from "../src/lib/consulting-delivery-document";
import { buildMasterDetonationDocument } from "../src/lib/master-detonation-document";
import { buildDocument00AMinto } from "../src/lib/intelligence/doc-00A-minto";
import { MINTO_SECTIONS } from "../src/lib/minto";
import { intelligenceSourceIdFromBrief } from "../src/lib/document-source-authority";

const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const OUT = "/tmp/docaudit";
mkdirSync(OUT, { recursive: true });

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Split rendered HTML into the ten canonical sections. */
function sections(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  const marks = MINTO_SECTIONS.map((d) => ({
    id: d.id,
    at: html.indexOf(`<span class="idx">${d.index}</span>${esc(d.kicker)}`),
  })).filter((m) => m.at >= 0);
  marks.sort((a, b) => a.at - b.at);
  for (let i = 0; i < marks.length; i++) {
    out[marks[i].id] = html.slice(marks[i].at, i + 1 < marks.length ? marks[i + 1].at : undefined);
  }
  return out;
}

const text = (h: string) =>
  h.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();

/* audits ------------------------------------------------------------------ */

function auditFallbacks(sec: Record<string, string>) {
  return Object.entries(sec)
    .filter(([, h]) => h.includes('class="minto-missing"'))
    .map(([id]) => id);
}

/** Repeated substantial blocks anywhere in the front matter (excl. appendix). */
function auditDuplicates(sec: Record<string, string>) {
  const seen = new Map<string, string>();
  const dupes: string[] = [];
  for (const [id, h] of Object.entries(sec)) {
    if (id === "appendix") continue;
    const blocks = h.match(/<(p|li|h3|blockquote)[^>]*>[\s\S]*?<\/\1>/g) ?? [];
    for (const b of blocks) {
      const t = text(b).toLowerCase();
      if (t.length < 40) continue;
      if (seen.has(t)) dupes.push(`"${t.slice(0, 70)}…" in ${seen.get(t)} + ${id}`);
      else seen.set(t, id);
    }
  }
  return [...new Set(dupes)];
}

const PRAISE = /\b(strong(est)?|compelling|powerful|excellent|impressive|wins|best|outstanding|distinctive and|clears the field)\b/i;
const REJECTION = /\b(not carried|not the lead|never|weakest|below|fails?|rejected|does not|doesn't|eliminated|considered|superseded|narrower|less)\b/i;

function auditRejected(sec: Record<string, string>) {
  const h = sec["rejected"] ?? "";
  if (!h) return ["section missing entirely"];
  if (h.includes('class="minto-missing"')) return ["renders fallback"];
  const items = h.match(/<(li|div class="reason")[\s\S]*?<\/(li|div)>/g) ?? [];
  const bad: string[] = [];
  const body = text(h);
  if (!REJECTION.test(body)) bad.push("no rejection language anywhere in section");
  for (const it of items) {
    const t = text(it);
    if (t.length < 40) continue;
    if (!REJECTION.test(t) && PRAISE.test(t)) bad.push(`praise-only entry: "${t.slice(0, 90)}…"`);
  }
  return bad;
}

const FOREIGN_NEXT =
  /(deployment principle|brand architecture|distinctive asset|masterbrand|endorsed brand|house of brands)/i;

function auditNextStep(sec: Record<string, string>) {
  const h = sec["next_step"] ?? "";
  const bad: string[] = [];
  if (!h) return ["section missing entirely"];
  if (h.includes('class="minto-missing"')) bad.push("renders fallback");
  const t = text(h);
  const m = t.match(FOREIGN_NEXT);
  if (m) bad.push(`foreign field content: "${m[0]}" — "${t.slice(Math.max(0, t.indexOf(m[0]) - 60), t.indexOf(m[0]) + 90)}"`);
  return bad;
}

function auditVerdict(html: string, sec: Record<string, string>) {
  const scored = /\/100|\/10\b/.test(text(sec["validation"] ?? "") + text(sec["proposition"] ?? ""));
  if (!scored) return { scored: false, verdict: null as string | null, ok: true };
  const v = text(sec["validation"] ?? "") + " " + text(sec["proposition"] ?? "");
  const m = v.match(/\b(PASS|FAIL|ELIMINATED)\b/);
  return { scored: true, verdict: m?.[0] ?? null, ok: !!m };
}

function auditFramework(html: string, sec: Record<string, string>) {
  const bad: string[] = [];
  const t = text(sec["validation"] ?? "") + " " + text(sec["proposition"] ?? "") + " " + text(sec["recommendation"] ?? "");
  if (/\/\s*110\b/.test(t)) bad.push("deprecated /110 composite rendered");
  const dims = [
    "Fame",
    "Truth",
    "Impossibility",
    "Clean air",
    "Brand Permission",
    "Commercial Precedent",
  ].filter((d) => new RegExp(d, "i").test(t));
  return { bad, dimsSeen: dims };
}

/* run ---------------------------------------------------------------------- */

const { data: rows, error } = await sb
  .from("sessions")
  .select("*")
  .order("created_at", { ascending: false });
if (error) throw error;

const picked: Record<string, Record<string, unknown>> = {};
for (const r of rows ?? []) {
  // Only sessions with a selected proposition have strategy documents. Draft
  // rows are not "generated documents" and must not be reported as failures.
  if (r.is_preflight_test || !String(r.selected_smp ?? "").trim()) continue;
  picked[r.id] = r as Record<string, unknown>;
}

const { data: intel } = await sb
  .from("intelligence_sessions")
  .select("*")
  .eq("status", "complete")
  .order("updated_at", { ascending: false });

const report: string[] = [];
for (const [key, s] of Object.entries(picked)) {
  const brand = String(s.brand_name);
  const docs: Record<string, string> = {};
  const safe = (name: string, fn: () => string) => {
    try {
      docs[name] = fn();
    } catch (e) {
      report.push(`### ${brand} · ${name}\n  THREW: ${(e as Error).message}`);
    }
  };
  safe("Board Strategy Recommendation", () => buildBoardStrategyDocument(s as never));
  safe("Brand Strategy and Creative Intelligence Summary", () => buildExecSummaryDocument(s as never, {} as never));
  safe("Consulting Delivery", () => buildConsultingDeliveryDocument(s as never));
  safe("Master Detonation Brief", () => buildMasterDetonationDocument(s as never));

  const intelligenceSourceId = intelligenceSourceIdFromBrief(
    typeof s.brief_text === "string" ? s.brief_text : null,
  );
  const ir = (intel ?? []).find((i) => i.id === intelligenceSourceId);
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
    const slug = `${key}__${name.replace(/\W+/g, "_")}`;
    writeFileSync(`${OUT}/${slug}.html`, html);
    const sec = sections(html);
    const fb = auditFallbacks(sec);
    const dup = auditDuplicates(sec);
    const rej = auditRejected(sec);
    const nxt = auditNextStep(sec);
    const ver = auditVerdict(html, sec);
    const fw = auditFramework(html, sec);
    const lines = [`### ${brand} · ${name}`];
    lines.push(`  sections rendered: ${Object.keys(sec).length}/10`);
    lines.push(`  1 why-this-wins: ${fb.includes("why_this_wins") ? "FALLBACK ❌" : "content ✓"}`);
    if (fb.length) lines.push(`    other fallback sections: ${fb.join(", ")}`);
    lines.push(`  2 duplicates: ${dup.length ? `❌ ${dup.length}\n      ${dup.slice(0, 4).join("\n      ")}` : "none ✓"}`);
    lines.push(`  3 next step: ${nxt.length ? `❌ ${nxt.join(" | ")}` : "clean ✓"}`);
    lines.push(`  4 rejected: ${rej.length ? `❌ ${rej.slice(0, 3).join(" | ")}` : "genuine ✓"}`);
    lines.push(
      `  5 verdict: ${ver.scored ? (ver.ok ? `${ver.verdict} ✓` : "MISSING ❌") : "n/a (unscored)"}`,
    );
    lines.push(`  6 framework: ${fw.bad.length ? `❌ ${fw.bad.join(", ")}` : `ok ✓ (dims: ${fw.dimsSeen.join(", ") || "none"})`}`);
    report.push(lines.join("\n"));
  }
}
console.log(report.join("\n\n"));
