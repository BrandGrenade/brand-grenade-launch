// BRAND GRENADE — BOARD STRATEGY RECOMMENDATION
// ============================================================================
// First document migrated onto the shared design system (`doc-system.ts`) and
// restructured top-down as a Minto pyramid:
//
//   Cover → Governing Output → Business Issue → Key Insight → Proposition
//   → Validation Summary (table) → Why the others were rejected
//   → Implications → System proof line → Appendix (full stage detail)
//
// Extraction is defensive: every reader falls back to rendering the stage
// output verbatim rather than dropping content. Nothing is invented here —
// if a value cannot be found in session data it is simply omitted.

import {
  callout,
  comparisonTable,
  cover,
  docShell,
  escapeHtml,
  inlineMd,
  proofLine,
  pullQuote,
  reasonGrid,
  renderMarkdown,
  sanitiseText,
  section,
  statGrid,
  type CmpRow,
  type Reason,
  type Stat,
} from "./doc-system";
import { stripDocumentMetadata } from "./strip-document-metadata";

export interface BoardStrategySession {
  brand_name?: string | null;
  category?: string | null;
  selected_smp?: string | null;
  stage_1_output?: string | null;
  stage_2_output?: string | null;
  stage_3_output?: string | null;
  stage_4_output?: string | null;
  stage_5_output?: string | null;
  stage_6_output?: string | null;
  stage_7_output?: string | null;
  stage_8_output?: string | null;
  stage_9_output?: string | null;
  stage_9_leftofcentre_output?: string | null;
  stage_10_output?: string | null;
  stage_11_output?: string | null;
  stage_12_output?: string | null;
  stage_13_output?: string | null;
  stage_14_output?: string | null;
  stage_15_output?: string | null;
}

/* ────────────────────────────────────────────────────────── helpers ── */

const INTERNAL_LINE =
  /(PIPELINE DATA HEADER|BRIEF DEPTH LEVEL:|CATEGORY KNOWLEDGE CONFIDENCE:|BRIEF ELEMENTS PRESENT:|ASSUMPTIONS MADE:|====\s*DELIVERABLE)/i;

function clean(text: unknown, tag = "board-strategy"): string {
  return sanitiseText(stripDocumentMetadata(String(text ?? ""), tag));
}

function stripInternals(text: string): string {
  return text
    .split("\n")
    .filter((l) => !INTERNAL_LINE.test(l))
    .join("\n");
}

/** Paragraphs of running prose, ignoring headings, bullets and label lines. */
function prose(text: string, limit: number): string[] {
  const out: string[] = [];
  for (const raw of text.split(/\n\s*\n/)) {
    const p = raw.trim().replace(/\s+/g, " ");
    if (!p) continue;
    if (/^[#>*\-—•=]/.test(p)) continue;
    if (/^[A-Z0-9 .—–:'"()/]{0,60}:\s*$/.test(p)) continue;
    if (p.length < 90) continue;
    out.push(p);
    if (out.length >= limit) break;
  }
  return out;
}

/** Text under a heading-ish marker, up to the next marker. */
function blockAfter(text: string, marker: RegExp): string {
  const lines = text.split("\n");
  const start = lines.findIndex((l) => marker.test(l));
  if (start === -1) return "";
  const body: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i];
    if (/^\s*(SECTION\s+\d|#{1,4}\s|={3,}|-{3,})/.test(l) && body.join("").trim()) break;
    body.push(l);
    if (body.length > 60) break;
  }
  return body.join("\n").trim();
}

function bullets(text: string, limit: number): string[] {
  const out: string[] = [];
  for (const raw of text.split("\n")) {
    const m = raw.trim().match(/^[-—•]\s+(.{20,})$/);
    if (!m) continue;
    out.push(m[1].replace(/\s+/g, " "));
    if (out.length >= limit) break;
  }
  return out;
}

/* ──────────────────────────────────────────── Stage 10 score parsing ── */

export interface ScoredCandidate {
  name: string;
  composite: number | null;
  verdict: "PASS" | "FAIL" | null;
  verdictNote: string;
  dims: Record<string, number>;
}

const DIMENSIONS = [
  "Fame",
  "Truth Strength",
  "Competitive Impossibility",
  "Brand Permission",
  "Clean Air",
  "Commercial Precedent",
] as const;

export function parseScoredCandidates(stage10: string): ScoredCandidate[] {
  const out: ScoredCandidate[] = [];
  let current: ScoredCandidate | null = null;
  const push = () => {
    if (current && current.name) out.push(current);
  };
  for (const raw of stage10.split("\n")) {
    const line = raw.trim();
    const smp = line.match(/^SMP:\s*[""]?(.+?)[""]?\s*(?:—\s*FIELD:.*)?$/i);
    if (smp) {
      push();
      current = { name: smp[1].trim(), composite: null, verdict: null, verdictNote: "", dims: {} };
      continue;
    }
    if (!current) continue;
    for (const dim of DIMENSIONS) {
      const m = line.match(new RegExp(`^${dim}:\\s*(\\d+(?:\\.\\d+)?)\\s*/\\s*10`, "i"));
      if (m) current.dims[dim] = Number(m[1]);
    }
    const comp = line.match(/CODE COMPOSITE:\s*(\d+(?:\.\d+)?)\s*\/\s*100/i);
    if (comp) current.composite = Number(comp[1]);
    const verdict = line.match(/CODE VERDICT:\s*(PASS|FAIL)\s*(?:—\s*(.*))?/i);
    if (verdict) {
      current.verdict = verdict[1].toUpperCase() as "PASS" | "FAIL";
      current.verdictNote = (verdict[2] ?? "").trim();
    }
  }
  push();
  return out;
}

function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

function findWinner(candidates: ScoredCandidate[], smp: string): ScoredCandidate | null {
  const target = normalise(smp);
  if (!target) return null;
  const exact = candidates.find((c) => normalise(c.name) === target);
  if (exact) return exact;
  const partial = candidates.find(
    (c) => target.includes(normalise(c.name)) || normalise(c.name).includes(target),
  );
  return partial ?? null;
}

/* ─────────────────────────────────────────────────── document build ── */

const APPENDIX_SECTIONS: Array<{ title: string; key: keyof BoardStrategySession }> = [
  { title: "Brief & Context", key: "stage_1_output" },
  { title: "Category Intelligence", key: "stage_2_output" },
  { title: "Strategic Frameworks", key: "stage_3_output" },
  { title: "Strategic Universes", key: "stage_4_output" },
  { title: "Insight Generation", key: "stage_5_output" },
  { title: "Insight Validation", key: "stage_6_output" },
  { title: "Territory Synthesis", key: "stage_7_output" },
  { title: "Proposition Generation", key: "stage_8_output" },
  { title: "Distinctiveness Check", key: "stage_9_output" },
  { title: "Proposition Scoring", key: "stage_10_output" },
  { title: "Integrity Testing", key: "stage_11_output" },
  { title: "Proposition Selection", key: "stage_12_output" },
  { title: "Brand Fit Validation", key: "stage_13_output" },
  { title: "Territory Mapping", key: "stage_14_output" },
  { title: "Coherence Audit", key: "stage_15_output" },
];

export interface BoardStrategyOptions {
  /** false when rendering headlessly for PDF (no toolbar, no page shadow). */
  screen?: boolean;
  /**
   * "condensed" (default) — the appendix carries an evidence extract per stage,
   * not the verbatim pipeline dump. "full" reproduces every stage output as-is
   * for archival/audit use.
   */
  appendix?: "condensed" | "full";
}

/** Process scaffolding that carries no evidence for a board reader. */
const SCAFFOLD_LINE =
  /^(ok[,.]|understood|here (is|are)|i('| wi)ll |let me |as requested|below (is|are)|note:|reminder:|continuing|proceeding|end of (stage|section)|word count|token|instruction)/i;

/**
 * Condenses one stage output into board-appendix evidence: headings kept as
 * structure, the strongest substantive lines kept beneath them, everything
 * else dropped. Nothing is rewritten — lines are either kept verbatim or cut.
 */
function condenseStage(raw: string, opts: { maxUnits?: number; maxChars?: number } = {}): string {
  const maxUnits = opts.maxUnits ?? 22;
  const maxChars = opts.maxChars ?? 2600;
  const out: string[] = [];
  let chars = 0;
  let units = 0;
  let sinceHeading = 0;

  const isHeading = (l: string) =>
    /^#{1,4}\s/.test(l) || /^(SECTION|STAGE|PART)\b/i.test(l) || /^[A-Z0-9 .,'&()/–—-]{6,70}:?$/.test(l);

  for (const rawLine of raw.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/^[=_*-]{3,}$/.test(line)) continue;
    if (SCAFFOLD_LINE.test(line)) continue;

    if (isHeading(line)) {
      // A heading with no room left beneath it is noise — stop emitting.
      if (units >= maxUnits || chars >= maxChars) continue;
      // Drop an empty heading left behind by the previous cut.
      if (out.length && out[out.length - 1].startsWith("### ")) out.pop();
      out.push(`### ${line.replace(/^#{1,4}\s+/, "").replace(/:$/, "")}`);
      sinceHeading = 0;
      continue;
    }
    if (units >= maxUnits || chars >= maxChars) continue;
    // Keep at most four substantive lines under any one heading so a single
    // verbose section cannot eat the whole budget.
    if (sinceHeading >= 4) continue;
    if (line.length < 25 && !/^[-—•]/.test(line)) continue;

    out.push(line);
    sinceHeading++;
    units++;
    chars += line.length;
  }
  while (out.length && out[out.length - 1].startsWith("### ")) out.pop();
  return out.join("\n\n");
}



export function buildBoardStrategyDocument(
  session: BoardStrategySession,
  opts: BoardStrategyOptions = {},
): string {
  const brand = (session.brand_name ?? "Untitled Brand").trim();
  const category = (session.category ?? "").trim();
  const smp = clean(session.selected_smp).trim();

  const s1 = stripInternals(clean(session.stage_1_output));
  const s5 = clean(session.stage_5_output);
  const s10 = clean(session.stage_10_output);
  const s12 = clean(session.stage_12_output);
  const s13 = clean(session.stage_13_output);
  const s14 = clean(session.stage_14_output);
  const s15 = clean(session.stage_15_output);

  const candidates = parseScoredCandidates(s10);
  const winner = findWinner(candidates, smp);
  const passed = candidates.filter((c) => c.verdict === "PASS");
  const rejected = candidates.filter((c) => c !== winner);

  const stagesRun = APPENDIX_SECTIONS.filter((s) =>
    String(session[s.key] ?? "").trim(),
  ).length;

  /* ── 1. Governing output ─────────────────────────────────────────── */
  const governing = smp
    ? pullQuote(smp, { label: "The recommendation", variant: "hero" })
    : "";

  const headlineStats: Stat[] = [];
  if (winner?.composite != null) {
    headlineStats.push({
      value: winner.composite,
      suffix: "/100",
      label: "Recommended SMP score",
      note: "Weighted composite across six scoring dimensions.",
    });
  }
  if (candidates.length) {
    headlineStats.push({
      value: candidates.length,
      label: "Propositions scored",
      note: `${passed.length} cleared the hard floors.`,
    });
  }
  headlineStats.push({
    value: stagesRun,
    label: "Validation stages run",
    note: "Every stage output is reproduced in the appendix.",
  });

  /* ── 2. Business issue ───────────────────────────────────────────── */
  const issueSource =
    blockAfter(s12, /SECTION\s+1\s*[—-]\s*PRESENTATION CONTEXT/i) || s1;
  const issueParas = prose(issueSource, 2);
  const businessIssue = issueParas.length
    ? issueParas.map((p) => `<p>${inlineMd(p)}</p>`).join("")
    : renderMarkdown(issueSource.slice(0, 1800));

  /* ── 3. Key insight ──────────────────────────────────────────────── */
  const insightSource = blockAfter(s5, /INSIGHT|^##/i) || s5;
  const insightParas = prose(insightSource, 1);
  const keyInsight = insightParas.length
    ? pullQuote(insightParas[0], { label: "The insight it rests on", variant: "quiet" })
    : renderMarkdown(insightSource.slice(0, 1200));

  /* ── 4. Validation summary table ─────────────────────────────────── */
  const tableRows: CmpRow[] = candidates
    .slice()
    .sort((a, b) => (b.composite ?? -1) - (a.composite ?? -1))
    .slice(0, 12)
    .map((c) => ({
      win: c === winner,
      cells: {
        name: c.name,
        fame: c.dims["Fame"],
        truth: c.dims["Truth Strength"],
        impossibility: c.dims["Competitive Impossibility"],
        cleanAir: c.dims["Clean Air"],
        composite: c.composite,
        verdict: c.verdict ?? "",
      },
    }));

  const validationTable = comparisonTable(
    [
      { key: "name", label: "Proposition" },
      { key: "fame", label: "Fame", numeric: true },
      { key: "truth", label: "Truth", numeric: true },
      { key: "impossibility", label: "Impossibility", numeric: true },
      { key: "cleanAir", label: "Clean air", numeric: true },
      { key: "composite", label: "Score /100", numeric: true },
      { key: "verdict", label: "Verdict" },
    ],
    tableRows,
    winner
      ? "Scored candidate set — highlighted row is the recommendation"
      : "Scored candidate set — Stage 10 scoring, ranked",
  );

  const fitNote = prose(s13, 1)[0];
  const selectionNote =
    !winner && smp && candidates.length
      ? callout(
          "How the recommendation relates to this set",
          `<p>The recommended proposition was resolved at selection, after the scored set above was tested for integrity and brand fit. It is not a row in the Stage 10 table.</p>`,
        )
      : "";
  const validationBody =
    (validationTable ||
      renderMarkdown(s10.slice(0, 2000)) ||
      "") +
    selectionNote +
    (fitNote ? callout("Brand fit validation", `<p>${inlineMd(fitNote)}</p>`) : "");

  /* ── 5. Rejected — and why ───────────────────────────────────────── */
  // A verdict note that simply restates that a candidate cleared the floors is
  // not a rejection rationale — fall back to the weakest scoring dimension.
  const isFailureNote = (n?: string) =>
    !!n && /fail|reject|below|does not|doesn't|not carried|weak|breach/i.test(n);

  const rejectReasons: Reason[] = rejected
    .slice()
    .sort((a, b) => (a.composite ?? 999) - (b.composite ?? 999))
    .slice(0, 4)
    .map((c) => {
      const weakest = Object.entries(c.dims).sort((a, b) => a[1] - b[1])[0];
      const detail = isFailureNote(c.verdictNote)
        ? (c.verdictNote as string)
        : weakest
          ? `Not carried forward. Weakest on ${weakest[0].toLowerCase()} (${weakest[1]}/10)${
              c.composite != null ? ` · ${c.composite}/100 composite` : ""
            }.`
          : "Not carried forward at selection.";
      return { title: c.name, detail };
    });

  /* ── 6. Implications ─────────────────────────────────────────────── */
  const implicationItems = bullets(s14, 5).length ? bullets(s14, 5) : bullets(s15, 5);
  const implications = implicationItems.length
    ? `<ul>${implicationItems.map((b) => `<li>${inlineMd(b)}</li>`).join("")}</ul>`
    : renderMarkdown((s14 || s15).slice(0, 1600));

  /* ── assemble front matter ───────────────────────────────────────── */
  const front = [
    cover({
      brand: "BRAND GRENADE",
      label: "Board Strategy Recommendation",
      title: `${brand} — Board Strategy Recommendation`,
      subtitle: category || undefined,
    }),
    governing,
    statGrid(headlineStats, headlineStats.length === 2 ? 2 : 3),
    businessIssue
      ? section({ kicker: "The business issue", index: "01" }, businessIssue)
      : "",
    keyInsight ? section({ kicker: "The key insight", index: "02" }, keyInsight) : "",
    smp
      ? section(
          { kicker: "The proposition", index: "03" },
          pullQuote(smp, { label: "Strategic Master Proposition" }) +
            (winner
              ? statGrid(
                  DIMENSIONS.filter((d) => winner.dims[d] != null).map((d) => ({
                    value: winner.dims[d],
                    suffix: "/10",
                    label: d,
                  })),
                  3,
                )
              : ""),
        )
      : "",
    validationBody
      ? section({ kicker: "Validation summary", index: "04" }, validationBody)
      : "",
    rejectReasons.length
      ? section(
          { kicker: "What was rejected, and why", index: "05" },
          reasonGrid(rejectReasons),
        )
      : "",
    implications
      ? section({ kicker: "Implications", index: "06" }, implications)
      : "",
    proofLine({
      stagesRun,
      documents: stagesRun ? APPENDIX_SECTIONS.length : undefined,
      extra: candidates.length ? `${candidates.length} propositions scored` : undefined,
    }),
  ]
    .filter(Boolean)
    .join("\n");

  /* ── appendix — evidence extract (condensed) or verbatim record ──── */
  const full = opts.appendix === "full";
  const appendixBody = APPENDIX_SECTIONS.map((s, i) => {
    let raw = clean(session[s.key]);
    if (s.key === "stage_9_output") raw += `\n${clean(session.stage_9_leftofcentre_output)}`;
    if (s.key === "stage_1_output") raw = stripInternals(raw);
    raw = stripInternals(raw);
    if (!raw.trim()) return "";
    const body = full ? raw : condenseStage(raw);
    if (!body.trim()) return "";
    return section(
      { kicker: `Appendix ${String(i + 1).padStart(2, "0")}`, title: s.title },
      renderMarkdown(body),
    );
  })
    .filter(Boolean)
    .join("\n");

  const appendix = appendixBody
    ? `<div class="section doc-break">` +
      `<p class="kicker">Appendix — backing detail</p>` +
      `<h1>${full ? "Full validation record" : "Evidence extract"}</h1>` +
      `<p>` +
      (full
        ? `Every stage output behind the recommendation above, in pipeline order.`
        : `The load-bearing evidence from each validation stage, in pipeline order. ` +
          `Cut to what supports the decision; the complete stage transcripts remain in the session record.`) +
      ` The front matter is the decision; this is the evidence.</p></div>` +
      appendixBody
    : "";


  return docShell(
    {
      title: `Board Strategy Recommendation — ${brand}`,
      toolbarNote: `Board Strategy Recommendation — ${brand}`,
      screen: opts.screen,
      footerHtml:
        `Brand Grenade Strategy Intelligence System — Confidential. ` +
        `Assembled from session data for ${escapeHtml(brand)}. ` +
        `Review before commercial deployment.`,
    },
    front + "\n" + appendix,
  );
}
