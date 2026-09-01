/**
 * THE Brand Strategy and Creative Development Summary builder.
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

import { expandAcronymsFirstUse } from "./acronyms";
import { buildCurrentStateSection } from "./current-state";
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
import { condenseStage, smpScoreProvenance } from "./minto-content";
import { arrivedAtReasoningHtml, overAlternativesHtml } from "./proposition-rationale";
import { stripDocumentMetadata } from "./strip-document-metadata";
import { stripSelectionArtifacts } from "./document-gate";
import { gateSummary, type GateSectionInput } from "./summary-gate";
import { closeIncompleteTail } from "./content-integrity";
import {
  extractBrandArchitecture,
  extractChannelRole,
  extractAuditFlags,
  extractDetonationCandidates,
  extractImpossibilityAnalysis,
  extractTerritoryBlocks,

  extractRecognitionTest,
  extractSelectedDetonation,
  extractTerritoryNames,
  extractTerritoryOutcomes,
  outcomeFor,
  outcomeLabel,


  extractWinnerScores,
  labelledBlocks,
  mdBlock,
  mdBlocks,
  normaliseMd,
  safeClamp,
  sentences,
} from "./summary-sources";
import { HUMAN_CHECKPOINT_COUNT } from "./platform-metrics";
import { relabelScoreScale, SCORE_CEILING } from "./appendix-humanise";
import { TOTAL_PIPELINE_STEPS } from "./stage-manifest";
import { LENS_COUNT } from "./stimulus/lenses";
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
/**
 * Source-side typos the pipeline inherited from the brief. A document is a
 * client deliverable: a misspelling in stored input is corrected on the way
 * out, never left on the page. Corrections are spelling-only — no wording,
 * meaning or emphasis is changed.
 */
const SOURCE_TYPOS: Array<[RegExp, string]> = [
  [/\bC[gh]{1,2}heapest\b/gi, "Cheapest"],
  [/\bopportunty\b/gi, "opportunity"],
  [/\bopportunties\b/gi, "opportunities"],
  [/\bCombank\b/g, "CommBank"],
  [/\bCommbank\b/g, "CommBank"],
  [/\bteh\b/gi, "the"],
  [/\brecieve\b/gi, "receive"],
  [/\brecieved\b/gi, "received"],
  [/\bseperate\b/gi, "separate"],
  [/\bseperately\b/gi, "separately"],

  [/\boccured\b/gi, "occurred"],
  [/\bconsistant\b/gi, "consistent"],
  [/\bdefinately\b/gi, "definitely"],
];

export function fixSourceTypos(text: string): string {
  let out = text;
  for (const [re, rep] of SOURCE_TYPOS) out = out.replace(re, rep as string);
  return out;
}

/**
 * The same underlying finding must read the same way wherever it is quoted.
 * The coherence audit records a soft, category-generic paragraph as failing
 * the brand-name-removal test; a later stage describes the same fault as copy
 * that "survives" the test. Both mean the brand is removable, so the wording
 * is normalised to the audit's own polarity everywhere it appears.
 */
function normalisePhrasing(text: string): string {
  return text.replace(
    /\bsurvives?\b(\s+(?:the\s+)?brand[\s-]name[\s-]removal\s+test)/gi,
    (_m, tail: string) => `fails${tail}`,
  );
}

const NUM_WORD = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight"];

function normTerm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * The closing recommendation quotes the coherence audit by name. A claim it
 * attributes to the audit ("X fails the brand name removal test") is only
 * printed when the audit's own finding for that item actually makes it: an
 * attribution the reader can check against Section 15 and find missing is a
 * defect, so the unsupported item is dropped from the sentence rather than
 * left standing.
 */
export function reconcileAuditClaims(
  text: string,
  flags: Array<{ label: string; detail?: string }>,
): string {
  const TEST = /brand[\s-]?name[\s-]?removal\s+test/i;
  if (!TEST.test(text)) return text;

  const supports = (term: string): boolean => {
    const t = normTerm(term);
    if (!t) return false;
    return flags.some((f) => {
      const body = normTerm(`${f.label} ${f.detail ?? ""}`);
      return body.includes(t) && /brand name removal test/.test(body);
    });
  };

  // The claim lives in one sentence, and inside that sentence only in the
  // clause that carries the test — items named in earlier clauses (poison
  // words, tone drift) are other findings and are never touched.
  const sentences = text.split(/(?<=\.)\s+/);
  const out = sentences.map((sentence) => {
    const at = sentence.search(TEST);
    if (at < 0) return sentence;
    const comma = sentence.lastIndexOf(", ", at);
    const start = comma >= 0 ? comma + 2 : 0;
    const head = sentence.slice(0, start);
    let clause = sentence.slice(start);

    const claimed = [...clause.matchAll(/["“”']([^"“”']{3,60})["“”']/g)]
      .map((m) => m[1])
      .filter((t) => /[a-z]/i.test(t));
    if (!claimed.length) return sentence;
    const unsupported = claimed.filter((t) => !supports(t));
    if (!unsupported.length) return sentence;
    const supported = claimed.filter((t) => supports(t));

    if (!supported.length) {
      // Nothing in the audit supports the claim: the whole clause goes.
      const cut = `${head.replace(/,?\s*(?:and\s+)?$/, "")}.`;
      return cut.replace(/\s+([,.])/g, "$1").replace(/,\s*\./, ".").trim();
    }

    for (const term of unsupported) {
      const esc = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      clause = clause.replace(
        new RegExp(
          `(?:\\s+and)?\\s*(?:the\\s+)?["“”']${esc}["“”'][^,.]*?(?=\\s+and\\s|\\s+soften|,|\\.)`,
          "i",
        ),
        "",
      );
    }
    const before = claimed.length;
    const after = supported.length;
    if (NUM_WORD[before]) {
      clause = clause.replace(
        new RegExp(`\\b${NUM_WORD[before]}\\s+specificity\\s+failures?\\b`, "i"),
        `${NUM_WORD[after] ?? after} specificity failure${after === 1 ? "" : "s"}`,
      );
    }
    if (after === 1) clause = clause.replace(/\bsoften\b/g, "softens");
    return `${head}${clause}`.replace(/\s{2,}/g, " ").replace(/\s+([,.])/g, "$1").trim();
  });


  return out.join(" ");
}


function sanitiseSource(text: string): string {
  return normalisePhrasing(fixSourceTypos(normaliseMd(stripDocumentMetadata(text))))
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

/**
 * A short list is one unit of argument and is never split across a page
 * boundary: a two-item fragment followed by the next section's heading reads
 * as two different lists. Long lists still fragment, because a list that
 * cannot fit a page must break somewhere.
 */
function list(items: Array<string | null | undefined>, keepTogether = false): string {
  const rows = items.map((i) => (i ?? "").trim()).filter(Boolean);
  if (!rows.length) return "";
  const cls = keepTogether && rows.length <= 10 ? ' class="keep-together"' : "";
  return `<ul${cls}>${rows.map((r) => `<li>${inlineMd(r)}</li>`).join("")}</ul>`;
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

/**
 * Raw pipeline bookkeeping written at the head of a stage output — the brand
 * echo, the framework version, the clearance status line — is internal
 * addressing, not client-facing prose. It is removed wherever it appears,
 * whether written with a dash or a colon after the label.
 */
const METADATA_LABEL =
  /^(?:BRAND|SESSION|SESSION ID|CLIENT|CATEGORY|DATE|AUDIT DATE|REPORT DATE|VERSION|CMM VERSION|STRL VERSION|PROMPT VERSION|MODEL|STAGE|STAGE NUMBER|PIPELINE CLEARANCE STATUS|CLEARANCE STATUS|PIPELINE STATUS|STATUS|TOTAL FLAGS RAISED|FLAGS RAISED|DOCUMENT|PREPARED BY|AUTHOR|OWNER|RUN ID|SMP VERSION)\s*[:—–-]\s*.*$/i;

/** `clean` collapses all whitespace, so it is applied line by line — a stage
 * flattened to a single line loses every heading boundary. */
function cleanBlock(text: string): string {
  return text
    .split("\n")
    .map((line) => clean(line))
    // pipeline bookkeeping fields ("AUDIT DATE — …", "TOTAL FLAGS RAISED — 6")
    .filter((line) => !/^[A-Z][A-Z /()-]{4,40}\s*[—–-]\s/.test(line))
    .filter((line) => !METADATA_LABEL.test(line.replace(/^[#*\s]+/, "").trim()))
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
  return dedupeRepeatedHeadings(dropDanglingLabel(renderMarkdown(clampText(condensed, chars))));
}

/**
 * Condensing a stage can drop a parent heading ("CHECK 2: …") while keeping the
 * sub-label written beneath it ("TESTS APPLIED"), which leaves the same label
 * printed twice with two different lists under it. A repeated identical heading
 * inside one stage block is not a second section, so the later heading tags are
 * removed and their content continues under the first.
 */
function dedupeRepeatedHeadings(html: string): string {
  const seen = new Set<string>();
  return html.replace(/<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/g, (full, _tag, inner: string) => {
    const key = strip(inner).replace(/\s+/g, " ").trim().toLowerCase();
    if (!key) return full;
    if (seen.has(key)) return "";
    seen.add(key);
    return full;
  });
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

// Section 20 carries two short lists that must not be split around Section 21,
// so it starts its own printed page — and Section 21 starts a fresh page after
// it, so no part of Section 21 can be painted between Section 20's lists.
// Section 12 does the same for Section 11's rejected-proposition list, whose
// final entry was otherwise deferred past the Section 12 heading in print.
const BREAK_BEFORE = new Set(["01", "04", "12", "16", "19", "20", "21", "22"]);



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
/**
 * Internal acronyms are expanded the first time a reader meets them, once per
 * document, in document order. An unexplained acronym is a defect in a client
 * deliverable; expanding every instance would be noise.
 */
function renderSections(defs: SectionDef[]): { html: string; sealed: GateSectionInput[] } {
  const acronymsSeen = new Set<string>();
  const titles = new Set(defs.map((d) => normTitle(d.title)));
  const sealed: GateSectionInput[] = [];
  const html = defs
    .map((d) => {
      const others = new Set([...titles].filter((t) => t !== normTitle(d.title)));
      const body = expandAcronymsFirstUse(
        closeIncompleteTail(sealBody(d.body, d.title, others)),
        acronymsSeen,
      );
      sealed.push({ index: d.index, title: d.title, html: body });
      // A short section is one unit: its heading, descriptor and content stay
      // on the same printed page, so a heading is never stranded above a page
      // break with its content appearing to belong to the next section.
      const keepTogether = strip(body).length < 1400;
      return section(
        {
          kicker: d.kicker,
          index: d.index,
          title: d.title,
          breakBefore: BREAK_BEFORE.has(d.index),
          keepTogether,
        },
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
  .section:last-of-type { break-after: avoid; page-break-after: avoid; }
  .section:last-of-type + .footer { break-before: avoid; page-break-before: avoid; }
  /* Each long comparison owns its printed pages. Starting the following
     section on a fresh page prevents Chromium from painting a repeated table
     header and deferred rows into the next section's visual region. */
  .section:has(.cmp) + .section { break-before: page; page-break-before: always; }
  /* Chromium repeats a table-header-group on every page a long table spans,
     and when the table fragments it can paint that repeat inside the following
     paragraph. The header is printed once, with the first rows. */
  .cmp thead { display: table-row-group; }
  /* The closing footer is the last content in the document. It starts its own
     printed page so no fragment of the final sections can be painted after it,
     and the final section is never split across the footer boundary. */
  .footer { break-before: page; page-break-before: always; break-inside: avoid; margin-top: 28pt; padding-top: 14pt; }
  .section:last-of-type { break-after: auto; page-break-after: auto; }
  .section:last-of-type + .footer { break-before: page; page-break-before: always; }
  /* Whatever the fragmentation outcome, the closing line is never glued to the
     last bullet above it. */
  .section + .footer { margin-top: 28pt; }
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
    // Brief fields are typed by hand and are not run through the pipeline, so
    // they are the one place raw source spelling reaches the reader directly.
    const corrected = fixSourceTypos(raw);
    // The schema is fixed: a field with nothing behind it says so rather than
    // disappearing, so a reader can see what the brief did not supply.
    return firstSentencesOf(corrected, n) || "Not supplied in the brief for this session.";
  };

  const brandFactsHtml = defList([
    { label: "Positioning today", body: fact("brand_positioning", "positioning", 4) },
    { label: "Product truth", body: fact("brand_product_truth", "product", 4) },
    { label: "Audience relationship", body: fact("brand_audience_relationship", "audience", 4) },
    { label: "Tone of voice", body: fact("brand_tone_of_voice", "tone", 3) },
    { label: "Constraints", body: fact("brand_constraints", "constraints", 4) },
    { label: "Organisational context", body: fact("brand_organisational_context", "org", 4) },
  ]);

  /* 03 — How this was built.
     Checkpoint language is precise: the count is of the named hard governance
     gates A–F (a fixed six), not of every individual human confirmation made
     across a run — that larger figure is session-specific and includes
     creative-direction approvals that are not governance gates. An unsigned
     gate on a run that nevertheless completed its downstream work is a gate
     held open deliberately, not unfinished work, and is stated as such. */
  const signedGates = ["a", "b", "c", "d", "e", "f"].filter(
    (k) => session[`checkpoint_${k}_confirmed`] === true,
  );
  const runCompleted = Boolean(
    lockedLine || lockedIdea || str(session, "stage_22_output").trim(),
  );
  const gateList = signedGates.map((k) => k.toUpperCase()).join(", ");
  const checkpointNote =
    checkpoints < HUMAN_CHECKPOINT_COUNT
      ? p(
          `${checkpoints} of the ${HUMAN_CHECKPOINT_COUNT} named hard governance gates (A–F) were formally signed off on this run` +
            `${gateList ? ` — ${gateList}` : ""}. That count is of governance gates only; it is not the number of individual human confirmations made during the run, which is larger and includes creative-direction approvals that are not governance gates.` +
            (runCompleted
              ? ` The remaining gates were held open deliberately while the platform itself was being exercised on this session; the work behind them was completed and is reproduced in the sections that follow. This document is a record of a complete run, not of unfinished work.`
              : ` The work behind the remaining gates has not been completed on this run.`),
        )
      : "";
  const buildHtml = `${checkpointNote}${band("Strategy", [
    { value: TOTAL_PIPELINE_STEPS, label: "pipeline stages run" },
    {
      value: checkpoints,
      suffix: `/${HUMAN_CHECKPOINT_COUNT}`,
      label: "governance gates (A–F) signed off",
    },

    { value: field.length, label: "propositions considered" },
    { value: scoring.rows.length, label: "strategic scoring dimensions applied" },
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
    { value: extras.lensesSwept || LENS_COUNT, label: "creative lenses swept" },
    { value: extras.directionsGenerated, label: "directions generated" },
    { value: extras.directionsRated, label: "directions fully rated" },
    { value: extras.shortlist.length, label: "shortlisted for judgement" },
  ])}${band("Executional", [
    { value: channels.length, label: "channel briefs written" },
    { value: extras.promptsWritten ?? 0, label: "production prompts written" },
    { value: 5, label: "documents produced" },
  ])}`;


  /* 04 — Category intelligence */
  // Section 03 states how many research inputs were drawn on; every one of them
  // is listed here, so the two numbers can never disagree.
  const categoryHtml = `${stageBlock(session, "stage_2_output", 14, 2200)}${list(
    research.map((r) => `**${r.label}.** ${r.body}`),
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
  // Every territory's recorded outcome, so a profiled territory always states
  // whether it was carried forward or eliminated, and at which stage.
  const outcomes = extractTerritoryOutcomes(
    str(session, "stage_10_output"),
    str(session, "stage_11_output"),
    extractTerritoryNames(str(session, "stage_7_output")),
  );
  const outcomeLedger = outcomes.length
    ? comparisonTable(
        [
          { key: "t", label: "Territory" },
          { key: "o", label: "Outcome" },
          { key: "r", label: "Why" },
        ],
        outcomes.map((o) => ({
          cells: {
            t: o.name,
            o: outcomeLabel(o),
            r:
              o.status === "eliminated"
                ? wholeSentences(
                    o.reason ??
                      `Did not survive ${o.stage ?? "the pressure test"}; not carried into the scored set.`,
                    2,
                    400,
                  )

                : "Held under pressure testing and carried into scoring.",
          },
        })),
        "Outcome of every strategic territory in this run",
      )
    : "";
  const profiled = impossibility && !impossibility.generic ? outcomeFor(outcomes, impossibility.heading) : undefined;
  // The locked proposition survived by definition, even where the stage text
  // records no per-candidate verdict block.
  const profiledLabel =
    profiled || !lockedSmp || !impossibility
      ? outcomeLabel(profiled)
      : propKey(impossibility.heading).includes(propKey(lockedSmp)) ||
          propKey(lockedSmp).includes(propKey(impossibility.heading))
        ? "Carried forward"
        : outcomeLabel(profiled);

  const distinctHtml = impossibility
    ? `${outcomeLedger}${p(
        impossibility.generic
          ? ""
          : `Candidate pressure-tested: **${impossibility.heading.replace(/\.$/, "")}** — ${profiledLabel}.`,
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
    : `${outcomeLedger}${dedupeRepeatedAnalysis(stageBlock(session, "stage_9_output", 8, 1200))}`;





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

  // Never publish a partial table with a composite calculated from dimensions
  // the reader cannot see. If extraction regresses, generation stops here.
  const expectedScoreDimensions = [
    "Fame",
    "Truth Strength",
    "Competitive Impossibility",
    "Brand Permission",
    "Clean Air",
    "Commercial Precedent",
  ];
  const scoreDimensionKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const presentScoreDimensions = new Set(scoreRows.map((row) => scoreDimensionKey(row.dimension)));
  const missingScoreDimensions = expectedScoreDimensions.filter(
    (dimension) => !presentScoreDimensions.has(scoreDimensionKey(dimension)),
  );
  if ((scoring.composite || scoring.verdict) && missingScoreDimensions.length) {
    throw new Error(
      `Proposition scoring is incomplete; missing ${missingScoreDimensions.join(", ")}`,
    );
  }

  // Provenance guard: when the locked line was written after the competitive
  // scoring pass, no part of this document may present its re-score as a
  // competitive result.
  const scoreProvenance = smpScoreProvenance(str(session, "stage_10_output"), selectedSmp);

  const scoringHtml = scoreRows.length
    ? `${comparisonTable(
        [
          { key: "d", label: "Dimension" },
          { key: "s", label: "Score", numeric: true },
          { key: "n", label: "Why it scored there" },
        ],
        scoreRows.map((r) => ({ cells: { d: r.dimension, s: r.score, n: r.note } })),
        scoreProvenance.postSelection && selectedSmp
          ? `Post-lock re-score of the final wording: ${selectedSmp} — not a competitive rank`
          : selectedSmp ? `Scored against: ${selectedSmp}` : scoring.scoredSmp ? `Scored against: ${scoring.scoredSmp}` : undefined,
      )}${scoreProvenance.html}${
        scoring.composite || scoring.verdict
          ? statGrid(
              [
                scoring.composite
                  ? {
                      value: relabelScoreScale(scoring.composite),
                      label: scoreProvenance.postSelection
                        ? "post-lock re-score (not a rank)"
                        : "composite score",
                    }
                  : null,
                scoring.verdict ? { value: scoring.verdict, label: "stage 10 verdict" } : null,
              ].filter(Boolean) as Stat[],
            )
          : ""
      }${p(
        `Composite scores are on the ${SCORE_CEILING}-point weighted scale: the dimension weights above total ${SCORE_CEILING} points by design, so ${SCORE_CEILING} — not 100 — is the ceiling a perfect card can reach.`,
      )}`
    : "";

  /* 10 — The winning proposition */
  const topScore = [...scoreRows].sort(
    (a, b) => parseInt(b.score ?? "0", 10) - parseInt(a.score ?? "0", 10),
  )[0];
  const whyItWon = [
    scoreProvenance.postSelection
      ? scoreProvenance.topCompetitive?.composite != null
        ? `The territory it expresses was validated competitively: "${scoreProvenance.topCompetitive.name}" — the closest scored expression of that territory — scored ${scoreProvenance.topCompetitive.composite}/${SCORE_CEILING} in a field of ${scoreProvenance.competitive.length} candidates. This line is the refined expression of that territory, locked by human judgement after the competitive pass closed — the system explored and scored, a human made the final call.`
        : `The territory it expresses was validated competitively in the scored field; this line is its refined expression, locked by human judgement after the competitive pass closed.`
      : scoring.verdict === "PASS"
        ? `It is the only proposition to clear both hard floors and be carried through Stage 10 scoring${scoring.composite ? ` on a composite of ${relabelScoreScale(scoring.composite)}` : ""}.`
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
      }${
        // The shared reasoning already ships inside scoreProvenance.html above
        // when a provenance correction applies; otherwise it ships here.
        !scoreProvenance.html && arrivedAtReasoningHtml(selectedSmp)
          ? callout(
              "How this proposition was arrived at",
              arrivedAtReasoningHtml(selectedSmp),
            )
          : ""
      }`
    : "";

  /* 11 — Not carried forward.
     Every alternative states a real, non-contradictory reason. A pressure-test
     note that records no weakness is not a reason to set a proposition aside,
     so it is never printed as one: the reason given is the recorded elimination
     where the pipeline recorded one, and otherwise the comparative decision at
     proposition lock, with the scores that decision was taken against. */
  const rejected = field.filter((f) => !f.selected);
  const winnerComposite = field.find((f) => f.selected)?.composite ?? null;
  const weakness =
    /(wobble|fails?|failed|risk|counter|weak|thin|generic|collaps|vulnerab|eliminat|drift|breach)/i;
  const rejectionReason = (f: (typeof field)[number]): string => {
    const recorded = outcomeFor(outcomes, f.proposition);
    if (recorded?.status === "eliminated" && recorded.reason) {
      return `Eliminated at ${recorded.stage ?? "pressure testing"}: ${wholeSentences(recorded.reason, 2, 380)}`;
    }
    const note = firstSentencesOf(f.reason ?? "", 2);
    if (note && weakness.test(note)) {
      return `Set aside at proposition lock: ${note}`;
    }
    // A comparative score is only printed when it supports the decision. Where
    // the alternative scored higher, the decision was taken on strategic fit at
    // proposition lock, and printing the score alone would misread as a
    // contradiction.
    const num = (v: string | null | undefined) => Number((v ?? "").split("/")[0]) || 0;
    const scores =
      f.composite && winnerComposite && num(f.composite) <= num(winnerComposite)
        ? ` It scored ${f.composite} at Stage 12 against the selected proposition's ${winnerComposite}.`
        : "";
    const winner = lockedSmp ? lockedSmp.replace(/^["“]|["”]$/g, "") : "";
    return (
      `Cleared pressure testing, but only one proposition is carried forward` +
      `${winner ? `, and "${winner}" was judged the stronger strategic platform for this brand` : ""}.${scores}`
    );
  };
  const rejectedHtml = rejected.length
    ? list(
        rejected
          .slice(0, 8)
          .map((f) => `**${f.proposition}** — ${rejectionReason(f)}`),
        true,
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

  /* 14 — Territory mapping.
     The territory taken forward is the one the session recorded as selected;
     a section preamble ("Three Detonation Territories for …") is a count of
     what follows, never the territory itself. */
  const s17 = str(session, "stage_17_output");
  const s18 = str(session, "stage_18_output");
  const selectedTerritoryName = (
    str(session, "stage_17_selected_territory").split("\n")[0] ?? ""
  )
    .replace(/^#{1,4}\s*/, "")
    .replace(/\*\*/g, "")
    .trim();
  const chosenTerritoryName =
    selectedTerritoryName ||
    (s18.match(/^#{0,4}\s*([A-Z][A-Z '’—-]{4,60}?)\s*[—-]\s*THE DETONATION/m)?.[1] ?? "").trim();
  const territoryBlocks = extractTerritoryBlocks(s17);
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
            (territoryFields["TERRITORY DESCRIPTION"] ??
              territory.body.split(/\n(?=[A-Z][A-Z '’/&-]{6,}:)/)[0] ??
              "").replace(/\s+/g, " "),
            1100,
          ),
        },
      ])}${
        detonations.length
          ? `<h3>The ${
              ["", "one", "two", "three"][detonations.length] ?? detonations.length
            } Detonation candidate${detonations.length === 1 ? "" : "s"} written against this territory</h3>${defList(
              detonations.map((d) => ({
                label: d.line || d.label,
                body: safeClamp(d.statement, 520),
              })),
            )}`
          : ""
      }`
    : stageBlock(session, "stage_17_output", 10, 1600);


  /* 15 — Coherence audit.
     Section 21 quotes the audit's findings by name, so the findings themselves
     are rendered here rather than condensed away. */
  const auditFlags = extractAuditFlags(str(session, "stage_15_output"));
  const coherenceHtml = `${stageBlock(session, "stage_15_output", 8, 1200)}${
    auditFlags.length
      ? `<h3>Findings raised by the audit</h3><p class="muted">These are the system's own self-audit notes, recorded verbatim against the working stages that produced this strategy. They are printed unedited so the correction record is visible; each is a note on the drafting stages, not an outstanding action for the client.</p>${defList(
          auditFlags.map((f) => ({ label: f.label, body: f.detail })),
        )}`
      : ""
  }`;

  /* 16 — Creative sweep */
  const sweepHtml = `${statGrid([
    { value: extras.lensesSwept || LENS_COUNT, label: "lenses applied" },
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
  // Sessions that predate the Creative Stimulus Engine locked no idea. Their creative
  // decision is the Detonation selected at Stage 18, which is then read here in
  // full — same template, same section, honestly labelled by its own source.
  const selectedDetonation =
    lockedIdea || lockedLine
      ? null
      : extractSelectedDetonation(
          str(session, "stage_18_output"),
          str(session, "stage_18_selected_detonation"),
          str(session, "stage_18_detonation_line"),
        );
  /* The strategy-to-creative hierarchy is stated explicitly rather than left
     to be inferred: the strategic proposition and the campaign line are
     written in different registers, and a reader comparing them side by side
     should not read the difference as a drift. */
  const hierarchyHtml = defList(
    [
      territory?.heading
        ? { label: "1. Territory", body: `${territory.heading} — the strategic space the brand is claiming.` }
        : null,
      lockedSmp
        ? {
            label: "2. Proposition",
            body: `${lockedSmp} — the strategic articulation. Written to be argued and scored, not to be run as copy.`,
          }
        : null,
      lockedIdea
        ? {
            label: "3. Creative expression",
            body: `${lockedLens ? `${lockedLens} lens — ` : ""}${firstSentencesOf(lockedIdea, 1)}`,
          }
        : null,
      lockedLine
        ? {
            label: "4. Campaign line",
            body: `${lockedLine} — the public-facing register. Ad copy, judged on recognition and memorability, not on strategic completeness.`,
          }
        : null,
      channels.length
        ? {
            label: "5. Execution",
            body: `${channels.map((c) => c.name).join(", ")} — each with its own Channel Detonation Brief.`,
          }
        : null,
    ].filter(Boolean) as Array<{ label: string; body: string }>,
  );
  const hierarchyBlock = hierarchyHtml
    ? callout(
        "How the strategy becomes the creative",
        `${hierarchyHtml}${p(
          "The proposition and the campaign line operate in different registers by design. The proposition is the strategic argument the work has to hold to; the line is the expression that carries it in market. They are not competing statements of the same thing, and neither is a rewrite of the other.",
        )}`,
      )
    : "";
  const creativeHtml = lockedIdea || lockedLine
    ? `${hierarchyBlock}${
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

    : selectedDetonation
      ? `${p(
          "This session was completed before the Creative Stimulus Engine lens sweep existed, so no campaign line was locked in that stage. The creative decision on record is the Detonation selected at Stage 18, reproduced below in full and word for word.",
        )}${
          selectedDetonation.line
            ? pullQuote(selectedDetonation.line, {
                label: "Selected Detonation — Stage 18",
                variant: "hero",
              })
            : ""
        }${
          selectedDetonation.statement
            ? `<h3>The Detonation statement</h3>${p(selectedDetonation.statement)}`
            : ""
        }${
          recognitionTest
            ? `<h3>The recognition test</h3>${renderMarkdown(recognitionTest)}`
            : ""
        }`
      : "";

  /* 18 — Why it won.
     Where the recorded judgement marks the idea down for using a known
     archetype, the honest observation is kept exactly as written and the
     counter-context is added beside it: category precedent and brand-relative
     freshness are two different tests, and only one of them is the question
     this brand actually faces. */
  const uniquenessCritique = (extras.winnerReasons ?? []).some(
    (r) =>
      /unique/i.test(r.title ?? "") &&
      /(archetype|trope|well[- ]trodden|familiar|precedent|been (executed|done)|not (a )?genuinely original)/i.test(
        r.detail ?? "",
      ),
  );
  const brandRelativeNote = uniquenessCritique
    ? callout(
        "Counter-context on the uniqueness judgement",
        p(
          `The uniqueness note above is a category-level test: has this device been used anywhere before. It is recorded as written and is not withdrawn. The test that governs this decision is narrower — has ${brand} used it before. Brand-relative freshness is a legitimate form of distinctiveness: a device that is familiar across advertising but unused by this brand in this category still arrives as new to the audience that matters, and it carries the compensating advantage of a proven mechanic. Both readings are true at once, and the idea was locked with the category-level limitation understood.`,
        ),
      )
    : "";
  const whyHtml = extras.winnerReasons?.length
    ? `${reasonGrid(extras.winnerReasons)}${brandRelativeNote}`

    : selectedDetonation?.rationale
      ? `${p(
          "No lens-sweep ratings exist for this session. The judgement on record is the argument written against the selected Detonation at Stage 18, reproduced verbatim.",
        )}<h3>Why this Detonation serves the proposition</h3>${p(selectedDetonation.rationale)}`
      : lockedIdea || lockedLine
        ? p(
            "The idea was locked by human decision at the Creative Stimulus Engine gate without a recorded rating set; the judgement on record is the lock itself, together with the strategic compliance argument carried in the sections above.",
          )
        : "";


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
  )}${
    arch.assets.length
      ? `<h3>Recommended distinctive assets</h3>${list(arch.assets, true)}`
      : ""
  }${
    arch.principles.length
      ? `<h3>Deployment principles</h3>${list(arch.principles, true)}`
      : ""
  }`;


  /* 21 — Next step.
     Recommendations are read from a separate extractor, so the shared source
     normalisation is applied here too — the same finding must not change
     polarity between Section 15 and this one. */
  const nextHtml = `${p(
    recs.condition ? normalisePhrasing(`Condition on activation: ${recs.condition}`) : "",
  )}${p(
    recs.nextStep
      ? reconcileAuditClaims(normalisePhrasing(`Next step: ${recs.nextStep}`), auditFlags)
      : "",
  )}`;



  /* 21 — Current state versus recommended change. Derived by the shared
     current-state module so every document type answers the same question
     identically: what is already happening, what this makes explicit, and
     what is genuinely new. Existing activity is quoted from the session's own
     brief and brand inputs and attributed — never inferred. */
  const currentStateHtml =
    buildCurrentStateSection({
      brand,
      evidence: [
        { label: "Client brief", text: str(session, "brief_text") },
        { label: "Brand positioning today", text: str(session, "brand_positioning") },
        { label: "Product truth", text: str(session, "brand_product_truth") },
        { label: "Audience relationship", text: str(session, "brand_audience_relationship") },
        { label: "Organisational context", text: str(session, "brand_organisational_context") },
        { label: "Research inputs", text: str(session, "stage_2_output") },
      ].filter((e) => e.text.trim()),
      // Only the durable commitments belong here — the audit verdict and the
      // next-step line are their own sections and must not be re-read as
      // proposed activity.
      // Deployment principles are printed in full in Section 20. Repeating
      // them verbatim here would put the same paragraphs in two sections, so
      // Section 21 carries each one's opening clause only.
      proposedActions: [
        ...arch.assets,
        ...arch.principles.map((principle) => {
          // Longest clause boundary inside the first ~110 characters, so the
          // lead is a readable instruction rather than two words.
          const head = principle.slice(0, 110);
          const cut = Math.max(
            head.lastIndexOf(", "),
            head.lastIndexOf(" because "),
            head.lastIndexOf(" so that "),
            head.lastIndexOf(" so the "),
            head.lastIndexOf(" and never "),
            head.lastIndexOf(" — "),
          );
          // No clause boundary: fall back to the last word break, so a
          // principle is never reprinted verbatim in two sections.
          const fallback = principle.length > 96 ? head.slice(0, head.lastIndexOf(" ")) : head;
          const lead = (cut >= 30 ? head.slice(0, cut) : fallback).trim().replace(/[,;:]$/, "");
          return lead.length >= 30 && lead.length < principle.length - 8
            ? `${lead} (stated in full in Section 20)`
            : principle;
        }),
      ].filter(Boolean),
    }) || nothing("No record of current activity was available for this session.");

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
      kicker: "Creative development",
      title: "The creative sweep",
      lede: "The full creative search: every lens applied, every direction generated, and the shortlist that survived rating.",
      body: sweepHtml,
    },
    {
      index: "17",
      kicker: "Creative development",
      title: "The winning creative idea",
      lede: "The locked idea, reproduced in full and word for word as it was written and approved.",
      body: creativeHtml,
    },
    {
      index: "18",
      kicker: "Creative development",
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
      kicker: "Change",
      title: "Current state versus recommended change",
      lede: "What the brand is already doing, what this recommendation makes explicit, and what is genuinely new.",
      body: currentStateHtml,
    },
    {
      index: "22",
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
      label: "Brand Strategy and Creative Development Summary",
      title: `${brand} — Brand Strategy and Creative Development Summary`,
      subtitle: category || undefined,
      confidential: true,
    }),
    tableOfContents(defs),
    rendered.html,
  ].join("\n");

  const html = docShell(
    {
      title: `Brand Strategy and Creative Development Summary — ${brand}`,
      toolbarNote: `${brand} — Brand Strategy and Creative Development Summary`,
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

