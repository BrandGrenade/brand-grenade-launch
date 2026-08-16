/**
 * THE Brand Strategy and Creative Intelligence Summary builder.
 *
 * One canonical builder, one 21-section spec, every session. Nothing in here
 * is brand-specific: every value is read from the session row and the creative
 * engine tables. There is no second Executive Summary code path.
 *
 * Structure: 21 numbered sections plus a table of contents on page one,
 * workflow folded into the body in sequence (no appendix), plain-language
 * descriptors under every system-jargon heading, and the locked creative idea
 * rendered complete and verbatim.
 *
 * Every render is passed through `gateSummary` (summary-gate.ts) before it is
 * returned, so a document that breaks any of the standing rules throws instead
 * of reaching a reader.
 */

import {
  cover,
  docShell,
  section,
  statGrid,
  pullQuote,
  comparisonTable,
  reasonGrid,
  callout,
  renderMarkdown,
  escapeHtml,
  inlineMd,
  type Stat,
} from "./doc-system";
import { condenseStage } from "./minto-content";
import { stripDocumentMetadata } from "./strip-document-metadata";
import { stripSelectionArtifacts } from "./document-gate";
import { gateSummary, looksCut, type GateSectionInput } from "./summary-gate";
import {
  extractBrandArchitecture,
  extractChannelRole,
  extractDetonationCandidates,
  extractImpossibilityAnalysis,

  extractRecognitionTest,
  extractWinnerScores,
  labelledBlocks,
  mdBlock,
  mdBlocks,
  normaliseMd,
  safeClamp,
  sentences,
} from "./summary-sources";
import {
  clean,
  firstSentencesOf,
  extractBusinessIssue,
  extractFindings,
  extractResearch,
  extractPropositionsField,
  extractWinning,
  extractVerification,
  extractScoring,
  extractRecommendations,
  type ExecSessionRow,
} from "./exec-summary-sections";

/* ─────────────────────────────────────────────────────────── inputs ── */

export type ExecSummarySession = {
  brand_name?: string | null;
  category?: string | null;
  selected_smp?: string | null;
} & ExecSessionRow;

export interface SummaryShortlistItem {
  lens: string;
  line: string;
  expression?: string | null;
  ambition?: string | null;
  fame?: string | null;
  compliance?: string | null;
  winner?: boolean;
}

export interface SummaryCreativeExtras {
  lensesSwept: number;
  directionsGenerated: number;
  directionsRated: number;
  promptsWritten?: number;
  guidance?: string | null;
  shortlist: SummaryShortlistItem[];
  /** Rating rationales recorded against the winning direction. */
  winnerReasons?: Array<{ title: string; detail?: string }>;
  /** Channel name → its strategic role in the plan (one line, from the brief). */
  channels?: Array<{ name: string; role?: string | null }>;
  intelligenceReportPresent?: boolean;
  researchSources?: number;
  /** Propositions, lines and territories owned by OTHER sessions. Checked at
   *  generation time so no foreign content can reach this document. */
  foreignMarkers?: string[];
}

const EMPTY_EXTRAS: SummaryCreativeExtras = {
  lensesSwept: 0,
  directionsGenerated: 0,
  directionsRated: 0,
  shortlist: [],
};

/* ─────────────────────────────────────────────────────────── helpers ── */

/**
 * Briefing Room anchors and prompt scaffolding are internal instructions to the
 * model, never client-facing copy. They are stripped at the source layer so no
 * section can inherit them.
 */
function sanitiseSource(text: string): string {
  return normaliseMd(stripDocumentMetadata(text))
    .replace(/={3,}[^=\n]*={3,}/g, " ")
    .replace(/The following inputs have been[^.]*\.\s*/gi, "")
    .replace(/Stage \d+[a-z]? must treat these[^.]*\.\s*/gi, "")
    .replace(/\(see system prompt\)\.?\s*/gi, "")
    .replace(/\bFRAME SELECTED:\s*[A-Z ]+\s*/g, "")
    .replace(/\bREAL PROBLEM:\s*/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function str(session: ExecSessionRow, key: string): string {
  const v = session[key];
  return typeof v === "string" ? sanitiseSource(v) : "";
}

function p(text?: string | null): string {
  const t = (text ?? "").trim();
  return t ? `<p>${inlineMd(t)}</p>` : "";
}

function list(items: Array<string | null | undefined>): string {
  const rows = items.map((i) => (i ?? "").trim()).filter(Boolean);
  if (!rows.length) return "";
  return `<ul>${rows.map((r) => `<li>${inlineMd(r)}</li>`).join("")}</ul>`;
}

function defList(rows: Array<{ label: string; body?: string | null }>): string {
  const items = rows.filter((r) => (r.body ?? "").trim());
  if (!items.length) return "";
  return `<div class="deflist">${items
    .map(
      (r) =>
        `<div class="defrow keep-together"><div class="defterm">${escapeHtml(
          r.label,
        )}</div><div class="defbody">${inlineMd((r.body ?? "").trim())}</div></div>`,
    )
    .join("")}</div>`;
}

/**
 * Hard character clamp on a condensed block. `condenseStage` budgets by line,
 * so a stage stored as one long paragraph blows straight through it — this cuts
 * at the last sentence boundary inside the budget instead.
 */
const clampText = safeClamp;

/** `clean` collapses all whitespace, so it is applied line by line — a stage
 * flattened to a single line loses every heading boundary. */
function cleanBlock(text: string): string {
  return text
    .split("\n")
    .map((line) => clean(line))
    // pipeline bookkeeping fields ("AUDIT DATE — …", "TOTAL FLAGS RAISED — 6")
    .filter((line) => !/^[A-Z][A-Z /()-]{4,40}\s*[—–-]\s/.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * The generated proposition a later refinement came out of. Scored on the
 * winning proposition's own Stage 10 re-score rationale: the candidate whose
 * distinctive words the reviewers kept reaching for is its antecedent.
 * Returns null when nothing in the field is close enough to claim lineage.
 */
function nearestAntecedent(
  locked: string,
  field: Array<{ proposition: string }>,
  stage10: string,
): string | null {
  if (!locked || !field.length) return null;
  // The re-score block runs from the first mention of the locked proposition
  // to the end of the stage output; the earlier candidate list is excluded so
  // a candidate cannot match itself.
  const at = stage10.indexOf(locked);
  if (at < 0) return null;
  const rationale = stage10.slice(at + locked.length).toLowerCase();
  if (!rationale.trim()) return null;
  const words = (s: string) =>
    [...new Set(s.toLowerCase().match(/[a-z]{5,}/g) ?? [])].filter(
      (w) => !["their", "which", "there", "these", "those", "about", "field"].includes(w),
    );
  let best: { text: string; score: number } | null = null;
  for (const item of field) {
    const w = words(item.proposition);
    if (!w.length) continue;
    const hits = w.filter((x) => rationale.includes(x.slice(0, 5))).length / w.length;
    if (!best || hits > best.score) best = { text: item.proposition, score: hits };
  }
  return best && best.score >= 0.6 ? best.text : null;
}

function stageBlock(session: ExecSessionRow, key: string, units: number, chars: number): string {
  const raw = cleanBlock(str(session, key));
  if (!raw) return "";
  // condenseStage can pull a heading onto the end of the previous line; put it
  // back on its own line so no raw "## Heading" markup reaches the page.
  const condensed = condenseStage(raw, { maxUnits: units, maxChars: chars })
    .replace(/([^\n])\s+(#{2,4}\s)/g, "$1\n\n$2")
    .split("\n\n")
    .map((block) => (block.startsWith("### ") ? block : clampText(block, Math.round(chars * 0.6))))
    .join("\n\n");
  return dropDanglingLabel(renderMarkdown(clampText(condensed, chars)));
}

/**
 * A clamp can land immediately after a label line ("A Reveal Everyone Is
 * Already Watching — Validated") and cut the body it introduced. A trailing
 * label with nothing beneath it is not content, so it is removed rather than
 * left on the page as a fragment.
 */
function dropDanglingLabel(html: string): string {
  let out = html.replace(/(?:\s*<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>)+\s*$/, "");
  const trailing = out.match(/<p>((?:(?!<\/p>)[\s\S])*)<\/p>\s*$/);
  if (trailing) {
    const text = strip(trailing[1]);
    if (text.length < 130 && !/[.!?:]$/.test(text)) out = out.slice(0, trailing.index).trimEnd();
  }
  return out.trim();
}

/**
 * A stage that writes the same analysis block once per candidate can put two
 * phrasings of one argument on the page. The second and later repeats of a
 * named analysis heading — and everything under them — are dropped.
 */
function dedupeRepeatedAnalysis(html: string): string {
  const marker = /strategic[\s-]?impossibility/i;
  const heads = [...html.matchAll(/<(h[1-6])[^>]*>([\s\S]*?)<\/\1>|<p>((?:(?!<\/p>)[\s\S])*)<\/p>/g)];
  const seen = heads.filter((m) => marker.test(strip(m[2] ?? m[3] ?? "")));
  if (seen.length < 2) return html;
  return dropDanglingLabel(html.slice(0, seen[1].index));
}



const strip = (h: string) =>
  h
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();

const normTitle = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/**
 * Whole sentences only, up to `count` sentences and a soft character budget.
 * A rationale is never cut mid-sentence: if the first sentence alone exceeds
 * the budget it is still rendered complete, because a scoring rationale that
 * stops at "…Rivian on adventure and…" is worse than a long one.
 */
function wholeSentences(text: string, count: number, budget: number): string {
  const parts = text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean)
    .slice(0, count);
  const out: string[] = [];
  for (const s of parts) {
    if (out.length && out.join(" ").length + s.length > budget) break;
    out.push(s);
  }
  return (out.length ? out : parts.slice(0, 1)).join(" ").trim();
}


function nothing(what: string): string {
  return `<p class="muted">${escapeHtml(what)}</p>`;
}

interface SectionDef {
  index: string;
  kicker: string;
  title: string;
  /** Plain-language descriptor rendered under the heading. */
  lede: string;
  body: string;
}

const BREAK_BEFORE = new Set(["01", "04", "16", "19"]);

/**
 * Generic section seal, applied to every section body BEFORE assembly.
 *
 * A section may contain only its own designated content: if a heading inside
 * the body names a different canonical section of this document, everything
 * from that heading onward belongs to that section and is cut. Trailing
 * headings with no body beneath them are dropped. Because this runs on the
 * body — not on the finished document string — nothing downstream of the last
 * section (the footer, the closing markup) can ever be moved or truncated.
 */
function sealBody(bodyHtml: string, ownTitle: string, otherTitles: Set<string>): string {
  let out = stripSelectionArtifacts(bodyHtml);
  const own = normTitle(ownTitle);
  const re = /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(out))) {
    const t = normTitle(strip(m[1]));
    if (!t || t === own) continue;
    if (otherTitles.has(t)) {
      out = out.slice(0, m.index);
      break;
    }
  }
  return dropDanglingLabel(out).trim();
}

/**
 * Some stored stage outputs were themselves cut off mid-sentence when the
 * pipeline wrote them. A cut sentence is never shown to a reader and is never
 * completed by guessing: the incomplete tail is dropped and the gap is stated.
 */
const CUT_NOTE = `<p class="note">The stored output for this stage ends mid-sentence in the pipeline record. Nothing has been invented to complete it.</p>`;

function closeIncompleteTail(bodyHtml: string): string {
  // The final prose block of the section: a paragraph, or the last item of a
  // trailing list. Never anything else — tables and stat cards end on labels.
  const openAt = Math.max(bodyHtml.lastIndexOf("<p"), bodyHtml.lastIndexOf("<li"));
  if (openAt < 0) return bodyHtml;
  const tag = bodyHtml.startsWith("<li", openAt) ? "li" : "p";
  const closeAt = bodyHtml.indexOf(`</${tag}>`, openAt);
  if (closeAt < 0) return bodyHtml;
  const inner = bodyHtml.slice(bodyHtml.indexOf(">", openAt) + 1, closeAt);
  if (!looksCut(strip(inner), tag === "li")) return bodyHtml;
  // The incomplete block is removed whole — never re-cut, never completed.
  const after = bodyHtml.slice(closeAt + `</${tag}>`.length);
  return `${bodyHtml.slice(0, openAt)}${after}${CUT_NOTE}`;
}

function renderSections(defs: SectionDef[]): { html: string; sealed: GateSectionInput[] } {
  const titles = new Set(defs.map((d) => normTitle(d.title)));
  const sealed: GateSectionInput[] = [];
  const html = defs
    .map((d) => {
      const others = new Set([...titles].filter((t) => t !== normTitle(d.title)));
      const body = closeIncompleteTail(sealBody(d.body, d.title, others));
      sealed.push({ index: d.index, title: d.title, html: body });
      return section(
        { kicker: d.kicker, index: d.index, title: d.title, breakBefore: BREAK_BEFORE.has(d.index) },
        `<p class="lede">${escapeHtml(d.lede)}</p>${body || nothing("No stored output for this stage.")}`,
      );
    })
    .join("\n");
  return { html, sealed };
}


function tableOfContents(defs: SectionDef[]): string {
  return `<div class="toc keep-together">
    <p class="kicker"><span class="idx">00</span>Contents</p>
    <ol class="toc-list">${defs
      .map(
        (d) =>
          `<li><span class="toc-n">${escapeHtml(d.index)}</span><span class="toc-t">${escapeHtml(
            d.title,
          )}</span></li>`,
      )
      .join("")}</ol>
  </div>`;
}

const EXTRA_CSS = `
.lede { color: var(--muted, #8a8a8a); font-size: 12.5px; line-height: 1.5; margin: 0 0 14px; max-width: 62ch; }
.toc { border-top: 2px solid currentColor; padding-top: 14px; margin: 0 0 28px; }
.toc-list { list-style: none; margin: 10px 0 0; padding: 0; columns: 2; column-gap: 34px; }
.toc-list li { break-inside: avoid; display: flex; gap: 10px; padding: 3px 0; font-size: 12px; }
.toc-n { opacity: .55; font-variant-numeric: tabular-nums; }
.deflist { display: grid; gap: 10px; margin: 12px 0; }
.defrow { display: grid; grid-template-columns: 190px 1fr; gap: 16px; }
.defterm { font-size: 10.5px; letter-spacing: .12em; text-transform: uppercase; opacity: .6; padding-top: 2px; }
.defbody { font-size: 13px; line-height: 1.55; }
.statband { margin: 14px 0 4px; }
.statband > h4 { font-size: 10.5px; letter-spacing: .14em; text-transform: uppercase; opacity: .6; margin: 0 0 8px; }
/* Chromium fragments a multi-row CSS grid badly when it crosses a printed page
   boundary: later rows are painted after content that follows the grid, which
   is what put Section 19/20 material below the closing footer line. In print,
   the definition list and reason grid are laid out in normal block flow, which
   fragments correctly. */
@media print {
  .defrow { grid-template-columns: 160px 1fr; }
  .deflist { display: block; }
  .deflist > .defrow + .defrow { margin-top: 10px; }
  .reasons { display: block; }
  .reasons > * + * { margin-top: 12pt; }
}
`;

function band(title: string, stats: Stat[]): string {
  const grid = statGrid(stats);
  if (!grid) return "";
  return `<div class="statband keep-together"><h4>${escapeHtml(title)}</h4>${grid}</div>`;
}

/* ─────────────────────────────────────────────────────────── builder ── */

export function buildSummaryDocument(
  session: ExecSessionRow,
  extras: SummaryCreativeExtras = EMPTY_EXTRAS,
): string {
  const brand = (str(session, "brand_name") || "Brand").trim();
  const category = str(session, "category").trim();

  const research = extractResearch(session);
  const findings = extractFindings(session);
  const field = extractPropositionsField(session);
  const winning = extractWinning(session);
  const verification = extractVerification(session);
  const scoring = extractScoring(session);
  const recs = extractRecommendations(session);

  const lockedLine = str(session, "locked_campaign_line").trim();
  const lockedLens = str(session, "locked_big_idea_lens").trim();
  const lockedIdea = str(session, "locked_big_idea").trim();

  const channels = (extras.channels?.length
    ? extras.channels
    : recs.channels.map((c) => ({ name: c, role: null }))
  ).filter((c) => (c.name ?? "").trim());

  const checkpoints = ["a", "b", "c", "d", "e", "f"].filter(
    (k) => session[`checkpoint_${k}_confirmed`] === true,
  ).length;

  /* 01 — Background */
  const briefLead = firstSentencesOf(str(session, "brief_text"), 4);
  const issue = extractBusinessIssue(session);
  const backgroundHtml = `${p(briefLead)}${p(issue)}${
    briefLead || issue ? "" : nothing("No brief text stored for this session.")
  }`;

  /* 02 — What we know about the brand */
  // Brand facts live either in the flat columns or in the `brand_intelligence`
  // JSON captured at brief time — read both, column first.
  const intelJson = (session["brand_intelligence"] ?? {}) as Record<string, unknown>;
  const fact = (key: string, jsonKey: string, n = 3) => {
    const raw = clean(str(session, key)) || clean(String(intelJson[jsonKey] ?? ""));
    return firstSentencesOf(raw, n);
  };
  const brandFactsHtml = defList([
    { label: "Positioning today", body: fact("brand_positioning", "positioning", 4) },
    { label: "Product truth", body: fact("brand_product_truth", "product", 4) },
    { label: "Audience relationship", body: fact("brand_audience_relationship", "audience", 4) },
    { label: "Tone of voice", body: fact("brand_tone_of_voice", "tone", 3) },
    { label: "Constraints", body: fact("brand_constraints", "constraints", 4) },
    { label: "Organisational context", body: fact("brand_organisational_context", "org", 4) },
  ]);

  /* 03 — How this was built */
  const buildHtml = `${band("Strategy", [
    { value: 28, label: "pipeline stages run" },
    { value: checkpoints, suffix: "/6", label: "human checkpoints signed off" },
    { value: field.length, label: "propositions considered" },
    { value: scoring.rows.length, label: "scoring dimensions applied" },
  ])}${band("Intelligence", [
    { value: research.length, label: "research inputs drawn on" },
    {
      value: extras.intelligenceReportPresent ? "Yes" : "In-pipeline",
      label: "external intelligence run",
    },
    {
      value: verification.tests.length || (str(session, "stage_13b_output") ? "Complete" : 0),
      label: "fact-verification pass",
    },
  ])}${band("Creative", [
    { value: extras.lensesSwept || 37, label: "creative lenses swept" },
    { value: extras.directionsGenerated, label: "directions generated" },
    { value: extras.directionsRated, label: "directions fully rated" },
    { value: extras.shortlist.length, label: "shortlisted for judgement" },
  ])}${band("Executional", [
    { value: channels.length, label: "channel briefs written" },
    { value: extras.promptsWritten ?? 0, label: "production prompts written" },
    { value: 5, label: "documents produced" },
  ])}`;

  /* 04 — Category intelligence */
  const categoryHtml = `${stageBlock(session, "stage_2_output", 14, 2200)}${list(
    research.slice(0, 6).map((r) => `**${r.label}.** ${r.body}`),
  )}`;

  /* 05 — Category insight. The display treatment carries the insight itself;
     anything past the opening statement reads as body copy, not a pull quote. */
  // Display treatment carries whole clauses only — never a cut mid-phrase.
  const insightFirst = findings ? (findings.match(/^[\s\S]*?\.(?=\s|$)/)?.[0] ?? findings) : "";
  const insightHead =
    insightFirst.length > 380
      ? insightFirst.slice(
          0,
          Math.max(
            insightFirst.slice(0, 300).lastIndexOf(" — ") + 1,
            insightFirst.slice(0, 300).lastIndexOf(", ") + 1,
          ) || 300,
        ).trim()
      : insightFirst.trim();
  const insightRest =
    findings && insightHead && findings.startsWith(insightHead)
      ? findings.slice(insightHead.length).trim()
      : "";

  const insightHtml = findings
    ? `${pullQuote(insightHead, {
        label: "Category-level insight — true of the category, not of this brand alone",
        variant: "hero",
      })}${insightRest ? renderMarkdown(insightRest) : ""}${p(
        "This is what the whole category believes and behaves on. The strategy that follows is built to break it, not to restate it.",
      )}`
    : "";


  /* 06 — Synthesis */
  const synthesisHtml = `${stageBlock(session, "stage_4_output", 10, 1600)}${stageBlock(session, "stage_6_output", 7, 900)}`;

  /* 07 — Proposition generation.
     The locked proposition must be traceable here. When it was refined after
     the shortlist (so it never appears as a generated candidate), it is listed
     explicitly and its closest antecedent in the generated field is named. */
  const lockedSmp = winning.smp?.trim() ?? "";
  const propKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const lockedInField =
    !!lockedSmp &&
    field.some((f) => {
      const a = propKey(f.proposition);
      const b = propKey(lockedSmp);
      return !!a && !!b && (a.includes(b) || b.includes(a));
    });
  const antecedent = lockedInField ? null : nearestAntecedent(lockedSmp, field, str(session, "stage_10_output"));
  const generationHtml = `${list([
    ...field.slice(0, 10).map((f) => `**${f.proposition}** — ${f.origin}`),
    lockedInField || !lockedSmp
      ? null
      : `**${lockedSmp}** — Refined out of the shortlist above after Stage 12, then re-scored independently at Stage 10 on its own wording. This is the locked proposition carried through the rest of this document.`,
  ])}${
    lockedInField || !lockedSmp
      ? ""
      : callout(
          "How the winning proposition got here",
          `${p(
            `"${lockedSmp}" is not a standalone entry in the generated field. It is a refinement written after the shortlist had been scored${
              antecedent ? `, closest to the shortlisted candidate "${antecedent}"` : ""
            } — the same concealment truth, compressed into a shorter, ownable form.`,
          )}${p(
            "Because it was written after the original Stage 10 pass, it was put back through the full six-dimension framework and the same hard floors as an independent re-score, recorded in the following sections.",
          )}`,
        )
  }`;


  /* 08 — Distinctiveness testing.
     Read structurally, one candidate block at a time. Condensing the raw stage
     output used to cut the rival list after its first bullet, deleting the
     Porsche, Mercedes, BMW, Lucid/Rivian and Bentley arguments; the list is now
     rendered whole under its own heading. */
  const impossibility = extractImpossibilityAnalysis(
    str(session, "stage_9_output"),
    str(session, "selected_smp"),
  );
  const distinctHtml = impossibility
    ? `${p(
        impossibility.generic
          ? ""
          : `Candidate pressure-tested: **${impossibility.heading.replace(/\.$/, "")}**`,
      )}${p(
        impossibility.foundation,
      )}${
        impossibility.rivals.length
          ? `<h3>Strategic-impossibility analysis — why no rival can run this</h3>${list(
              impossibility.rivals,
            )}`
          : ""
      }${
        impossibility.proof
          ? pullQuote(impossibility.proof, { label: "The distinctiveness test, stated plainly" })
          : ""
      }`
    : dedupeRepeatedAnalysis(stageBlock(session, "stage_9_output", 8, 1200));




  /* 09 — Scoring */
  const selectedSmp = str(session, "selected_smp").trim();
  const winnerScores = extractWinnerScores(str(session, "stage_10_output"), selectedSmp);
  const scoreRows = winnerScores.length
    ? winnerScores.map((r) => ({
        dimension: r.dimension,
        score: r.score,
        note: wholeSentences(r.rationale, 3, 900),
      }))
    : scoring.rows;

  const scoringHtml = scoreRows.length
    ? `${comparisonTable(
        [
          { key: "d", label: "Dimension" },
          { key: "s", label: "Score", numeric: true },
          { key: "n", label: "Why it scored there" },
        ],
        scoreRows.map((r) => ({ cells: { d: r.dimension, s: r.score, n: r.note } })),
        selectedSmp ? `Scored against: ${selectedSmp}` : scoring.scoredSmp ? `Scored against: ${scoring.scoredSmp}` : undefined,
      )}${
        scoring.composite || scoring.verdict
          ? statGrid(
              [
                scoring.composite ? { value: scoring.composite, label: "composite score" } : null,
                scoring.verdict ? { value: scoring.verdict, label: "stage 10 verdict" } : null,
              ].filter(Boolean) as Stat[],
            )
          : ""
      }`
    : "";

  /* 10 — The winning proposition */
  const topScore = [...scoreRows].sort(
    (a, b) => parseInt(b.score ?? "0", 10) - parseInt(a.score ?? "0", 10),
  )[0];
  const whyItWon = [
    scoring.verdict === "PASS"
      ? `It is the only proposition to clear both hard floors and be carried through Stage 10 scoring${scoring.composite ? ` on a composite of ${scoring.composite}` : ""}.`
      : "",
    topScore?.note
      ? `Its strongest dimension is ${topScore.dimension.toLowerCase()} (${topScore.score}): ${topScore.note}`
      : "",
  ]
    .filter(Boolean)
    .join(" ");
  const winnerHtml = winning.smp
    ? `${pullQuote(winning.smp, { label: "The proposition that won", variant: "hero" })}${p(
        winning.owns,
      )}${p(winning.alignment)}${
        whyItWon ? callout("Why this proposition won", p(whyItWon)) : ""
      }`
    : "";

  /* 11 — Not carried forward */
  const rejected = field.filter((f) => !f.selected);
  const rejectedHtml = rejected.length
    ? list(
        rejected.slice(0, 8).map((f) => {
          // The stored note is a pressure-test observation, not a rejection
          // reason. It is labelled as what it is, so a positive note can never
          // read as the reason a proposition was set aside.
          const note = firstSentencesOf(f.reason ?? "", 1);
          return `**${f.proposition}** — Not carried forward at proposition lock.${
            note ? ` Pressure test recorded: ${note}` : ""
          }`;
        }),
      )
    : "";

  /* 12 — Integrity and fact verification */
  const verifyHtml = verification.tests.length
    ? `${verification.verdict ? p(`**Verdict:** ${verification.verdict}`) : ""}${comparisonTable(
        [
          { key: "t", label: "Test" },
          { key: "v", label: "Verdict" },
          { key: "n", label: "Note" },
        ],
        verification.tests.map((t) => ({ cells: { t: t.name, v: t.verdict, n: t.note } })),
      )}`
    : stageBlock(session, "stage_13b_output", 9, 1400);

  /* 13 — Brand fit */
  const s13 = str(session, "stage_13_output");
  const fitVerdict = mdBlock(s13, /Brand Fit Verdict/i);
  const fitGuardrails = mdBlock(s13, /Communication Guardrails/i);
  const fitHtml = fitVerdict || fitGuardrails
    ? `${fitVerdict ? renderMarkdown(safeClamp(fitVerdict, 2000)) : ""}${
        fitGuardrails
          ? `<h3>Communication guardrails</h3>${renderMarkdown(fitGuardrails)}`
          : ""
      }`
    : stageBlock(session, "stage_13_output", 9, 1400);

  /* 14 — Territory mapping */
  const s17 = str(session, "stage_17_output");
  const s18 = str(session, "stage_18_output");
  const chosenTerritoryName =
    (s18.match(/^#{0,4}\s*([A-Z][A-Z '’—-]{4,60}?)\s*[—-]\s*THE DETONATION/m)?.[1] ?? "").trim();
  const territoryBlocks = mdBlocks(s17);
  const territory =
    (chosenTerritoryName
      ? territoryBlocks.find(
          (b) => b.heading.toUpperCase().trim() === chosenTerritoryName.toUpperCase(),
        )
      : undefined) ?? territoryBlocks[0];
  const territoryFields = territory ? labelledBlocks(territory.body) : {};
  const detonations = extractDetonationCandidates(s18);
  const territoryHtml = territory
    ? `${p(`Territory taken forward: **${territory.heading}**`)}${defList([
        {
          label: "Why it serves the proposition",
          body: safeClamp(
            (territoryFields["WHY THIS TERRITORY SERVES THE SMP"] ?? "").replace(/\s+/g, " "),
            900,
          ),
        },
        {
          label: "The territory described",
          body: safeClamp(
            (territoryFields["TERRITORY DESCRIPTION"] ?? "").replace(/\s+/g, " "),
            1100,
          ),
        },
      ])}${
        detonations.length
          ? `<h3>The ${
              ["", "one", "two", "three"][detonations.length] ?? detonations.length
            } Detonation candidates written against this territory</h3>${defList(
              detonations.map((d) => ({
                label: d.line || d.label,
                body: safeClamp(d.statement, 520),
              })),
            )}`
          : ""
      }`
    : stageBlock(session, "stage_17_output", 10, 1600);

  /* 15 — Coherence audit */
  const coherenceHtml = stageBlock(session, "stage_15_output", 8, 1200);

  /* 16 — Creative sweep */
  const sweepHtml = `${statGrid([
    { value: extras.lensesSwept || 37, label: "lenses applied" },
    { value: extras.directionsGenerated, label: "directions generated" },
    { value: extras.directionsRated, label: "taken to full rating" },
  ])}${
    extras.guidance
      ? callout("Creative guidance given to the sweep", p(extras.guidance))
      : ""
  }${
    extras.shortlist.length
      ? comparisonTable(
          [
            { key: "lens", label: "Lens" },
            { key: "line", label: "Candidate master line" },
            { key: "amb", label: "Ambition" },
            { key: "fame", label: "Fame" },
            { key: "comp", label: "Strategic fit" },
          ],
          extras.shortlist.map((s) => ({
            win: s.winner,
            cells: {
              lens: s.lens,
              line: s.line,
              amb: s.ambition,
              fame: s.fame,
              comp: s.compliance,
            },
          })),
          "Rated shortlist — the winning line is highlighted",
        )
      : ""
  }`;

  /* 17 — The winning creative idea (verbatim, complete) */
  const recognitionTest = extractRecognitionTest(str(session, "stage_22_output"));
  const creativeHtml = lockedIdea || lockedLine
    ? `${
        lockedLine
          ? pullQuote(lockedLine, {
              label: `Locked campaign line${lockedLens ? ` — ${lockedLens}` : ""}`,
              variant: "hero",
            })
          : ""
      }${lockedIdea ? renderMarkdown(lockedIdea) : ""}${
        recognitionTest
          ? `<h3>The recognition test</h3>${renderMarkdown(recognitionTest)}`
          : ""
      }`
    : "";

  /* 18 — Why it won */
  const whyHtml = extras.winnerReasons?.length ? reasonGrid(extras.winnerReasons) : "";

  /* 19 — Channels */
  const channelHtml = channels.length
    ? defList(
        channels.map((c) => ({
          label: c.name,
          body:
            c.role ||
            "Carries the strategy into market with a dedicated detonation brief.",
        })),
      )
    : "";

  /* 20 — Brand architecture and distinctive assets */
  const arch = extractBrandArchitecture(str(session, "stage_22_output"));
  const architectureHtml = `${p(
    arch.personality ? `Brand personality: ${arch.personality}` : "",
  )}${p(arch.reflection ? `Reflection: ${arch.reflection}` : "")}${
    arch.assets.length
      ? `<h3>Recommended distinctive assets</h3>${list(arch.assets)}`
      : ""
  }${
    arch.principles.length
      ? `<h3>Deployment principles</h3>${list(arch.principles)}`
      : ""
  }`;

  /* 21 — Next step */
  const nextHtml = `${p(recs.condition ? `Condition on activation: ${recs.condition}` : "")}${p(
    recs.nextStep ? `Next step: ${recs.nextStep}` : "",
  )}`;

  const defs: SectionDef[] = [
    {
      index: "01",
      kicker: "Background",
      title: "Background",
      lede: "Why this project exists, and the commercial tension it was set up to resolve.",
      body: backgroundHtml,
    },
    {
      index: "02",
      kicker: "Inputs",
      title: "What we know about the brand",
      lede: "The brand facts the pipeline was given before any thinking started.",
      body: brandFactsHtml,
    },
    {
      index: "03",
      kicker: "Method",
      title: "How this was built",
      lede: "The volume of work behind the recommendation, grouped by the kind of work it was.",
      body: buildHtml,
    },
    {
      index: "04",
      kicker: "Evidence",
      title: "Category intelligence",
      lede: "What the category currently believes, and the evidence base that establishes it.",
      body: categoryHtml,
    },
    {
      index: "05",
      kicker: "Insight",
      title: "The category insight",
      lede: "The single belief the whole category runs on — the thing this strategy attacks.",
      body: insightHtml,
    },
    {
      index: "06",
      kicker: "Synthesis",
      title: "Synthesis — turning evidence into strategic territory",
      lede: "Where the research is converted into a defensible place for the brand to stand.",
      body: synthesisHtml,
    },
    {
      index: "07",
      kicker: "Generation",
      title: "Proposition generation",
      lede: "Every strategic proposition the system generated and considered.",
      body: generationHtml,
    },
    {
      index: "08",
      kicker: "Pressure test",
      title: "Distinctiveness testing",
      lede: "Left-of-Centre engines and validation checks — testing whether each proposition is genuinely ownable.",
      body: distinctHtml,
    },
    {
      index: "09",
      kicker: "Scoring",
      title: "Proposition scoring",
      lede: "How the leading proposition scored, dimension by dimension.",
      body: scoringHtml,
    },
    {
      index: "10",
      kicker: "Decision",
      title: "The winning proposition",
      lede: "The proposition that won, stated plainly, and what it gives the brand to own.",
      body: winnerHtml,
    },
    {
      index: "11",
      kicker: "Decision",
      title: "Propositions not carried forward",
      lede: "The alternatives considered, and why each one was set aside.",
      body: rejectedHtml,
    },
    {
      index: "12",
      kicker: "Assurance",
      title: "Integrity and fact verification",
      lede: "Checks that every claim in the strategy is supportable and nothing was invented.",
      body: verifyHtml,
    },
    {
      index: "13",
      kicker: "Assurance",
      title: "Brand fit",
      lede: "Whether the brand can credibly make this claim today, given what it is and does.",
      body: fitHtml,
    },
    {
      index: "14",
      kicker: "Expression",
      title: "Territory mapping",
      lede: "The territory the strategy occupies, and the Detonation candidates written within it.",
      body: territoryHtml,
    },
    {
      index: "15",
      kicker: "Assurance",
      title: "Coherence audit",
      lede: "A final read across every stage to confirm the strategy holds together end to end.",
      body: coherenceHtml,
    },
    {
      index: "16",
      kicker: "Creative intelligence",
      title: "The creative sweep",
      lede: "The full creative search: every lens applied, every direction generated, and the shortlist that survived rating.",
      body: sweepHtml,
    },
    {
      index: "17",
      kicker: "Creative intelligence",
      title: "The winning creative idea",
      lede: "The locked idea, reproduced in full and word for word as it was written and approved.",
      body: creativeHtml,
    },
    {
      index: "18",
      kicker: "Creative intelligence",
      title: "Why this idea won",
      lede: "The judgement recorded against the winning idea at the point it was locked.",
      body: whyHtml,
    },
    {
      index: "19",
      kicker: "Activation",
      title: "Channels this strategy activates through",
      lede: "The channels carrying the work, and the strategic role each one plays. Per-channel creative sits in the Channel Detonation Briefs.",
      body: channelHtml,
    },
    {
      index: "20",
      kicker: "Activation",
      title: "Brand architecture and distinctive assets",
      lede: "What becomes permanent brand property beyond this campaign.",
      body: architectureHtml,
    },
    {
      index: "21",
      kicker: "Next",
      title: "Next step",
      lede: "What has to happen before this strategy goes to market.",
      body: nextHtml,
    },
  ];

  // Assembly order is literal and final: cover, contents, every sealed section
  // in order, then the shell — which writes the footer after the body, always
  // last. Nothing is inserted at a fixed position and no pass rewrites the
  // finished string, so no content can appear after the closing footer line.
  const rendered = renderSections(defs);
  const body = [
    cover({
      brand: "BRAND GRENADE",
      label: "Brand Strategy and Creative Intelligence Summary",
      title: `${brand} — Brand Strategy and Creative Intelligence Summary`,
      subtitle: category || undefined,
      confidential: true,
    }),
    tableOfContents(defs),
    rendered.html,
  ].join("\n");

  const html = docShell(
    {
      title: `Brand Strategy and Creative Intelligence Summary — ${brand}`,
      toolbarNote: `${brand} — Brand Strategy and Creative Intelligence Summary`,
      extraCss: EXTRA_CSS,
      footerHtml:
        "Brand Grenade Strategy Intelligence System — Confidential. Assembled from stored session data only; the locked creative idea is reproduced verbatim.",
    },
    body,
  );

  // Standing gate. Every rule this document has ever broken is checked here,
  // on every render, for every session.
  return gateSummary(rendered.sealed, html, {
    order: defs.map((d) => d.index),
    lockedSmp: (winning.smp?.trim() || selectedSmp || "").replace(/^["“”\s]+|["“”\s.]+$/g, ""),
    lockedIdea,
    foreignMarkers: extras.foreignMarkers,
    requiredProse: ["09", "13", "17"],
  });
}

