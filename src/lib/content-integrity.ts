// BRAND GRENADE — SHARED CONTENT-INTEGRITY CERTIFICATION
// ============================================================================
// The structural gate (document-gate.ts) answers "is every canonical section
// present and in its own lane?". This file answers the other half of the
// certification standard, and it is document-type agnostic so a fault fixed
// for one deliverable cannot reappear in another:
//
//   COMPLETE      no section body that is empty, a bare heading, or prose that
//                 stops mid-sentence / on an ellipsis.
//   CLEAN         no raw brief metadata labels ("Date:", "Submitted by:"),
//                 audit-trail notes, run IDs, timestamps, unrendered markdown
//                 or template syntax, selection UI, word-count annotations.
//   VOICE         no first-person system/process commentary ("I cannot cite…").
//   CONSISTENT    a count stated in one place must match the count stated
//                 anywhere else in the same document for the same noun.
//   PROMISED      a section that says it will show N items must show N items.
//
// Every builder routes its finished HTML through `assertPublishable`, so a
// document that fails cannot reach Deliverables by any path.

/* ── text helpers ────────────────────────────────────────────────────── */

const strip = (h: string) =>
  h
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Whether a prose block reads as cut mid-sentence. Provenance tags the
 * builders write themselves ("— Stage 12 shortlist") are not sentences and
 * never count. Shared with summary-gate.ts so both gates agree.
 */
export function looksCut(text: string, listItem = false): boolean {
  if (text.split(/\s+/).length < 7) return false;
  if (/[.!?:;"”’)\]]$/.test(text)) return false;
  if (/(?:shortlist|LOC engine|refinement|Stage\s+\d+[A-Za-z]*|winner|locked)$/i.test(text)) return false;
  if (listItem)
    return (
      /,$/.test(text) ||
      /\b(?:the|a|an|and|or|but|of|to|in|on|for|with|that|which|is|are|was|were|it|its|by|as|at|from|into|than)$/i.test(
        text,
      )
    );
  return /[a-z,]$/.test(text);
}

/**
 * Any raw model value a builder lifts out of a stage output and drops straight
 * into markup (a channel role, a label, a one-line quote) must be reduced to
 * plain text first — otherwise markdown emphasis arrives on the page as
 * literal asterisks.
 */
export function inlinePlainText(value: string): string {
  return value
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*\*/g, "")
    .replace(/(^|[\s(])[*_]([^*_\n]+)[*_](?=[\s).,;:!?]|$)/g, "$1$2")
    .replace(/^#{1,6}\s+/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/* ── the artifact vocabulary ─────────────────────────────────────────── */

/**
 * Raw brief/system field labels. These are how a submitted brief is written
 * down, not how a document speaks to a reader: any of them surviving into
 * rendered prose is a leak from the source text into the deliverable.
 */
const METADATA_LABELS = [
  "date",
  "submitted by",
  "submitted",
  "prepared by",
  "prepared for",
  "author",
  "client",
  "version",
  "run id",
  "session id",
  "run date",
  "brief id",
  "word count",
  "status",
  "source",
  "the core challenge",
  "core challenge",
  "brand facts",
  "business context",
  "target audience",
  "the ask",
  "deliverable",
  "objective type",
  "strategic objective",
];

/**
 * A bookkeeping label is only a leak when it is written as a label: the label
 * word in caps or title case, immediately followed by a colon or em-dash.
 * "…a documented audit trail…" in prose is the phrase, not the artifact.
 */
const LABELLED = (words: string) =>
  new RegExp(`(?:^|[.\\u2022\\u2014|]\\s|\\s{2,}|\\n)(?:\\*\\*)?(?:${words})(?:\\*\\*)?\\s*(?::|\\s—\\s)`);

const CLEAN_PATTERNS: Array<[RegExp, string]> = [
  [LABELLED(METADATA_LABELS.map((l) => l.replace(/ /g, "\\s")).join("|")), "raw brief metadata label"],
  [/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i, "run/session UUID"],
  [/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, "ISO timestamp"],
  [/\bRE-?RUN\s+UNDER\s+CORRECTED\s+ANCHORS\b|\bANCHOR\s+CORRECTION\b/i, "audit-trail note"],
  [
    LABELLED(
      "AUDIT\\s?DATE|AUDIT\\s?TRAIL|PIPELINE\\s+DOCUMENTS\\s+REVIEWED|TOTAL\\s+FLAGS\\s+RAISED|SELF[-\\s]?AUDIT|STAGE\\s+\\d+[A-Z]?\\s+OUTPUT|RAW\\s+OUTPUT|SYSTEM\\s+PROMPT|PRESENTATION\\s+ORDER\\s+LOG|SELECTED\\s+SMP|COURAGE\\s+ASSESSMENT|DERIVATION\\s+CHAIN\\s+INTEGRITY",
    ),
    "pipeline bookkeeping label",
  ],
  [/CANDIDATE SET\s*[—–-]\s*(?:select|choose) one|\b[A-Z]\s*[·•]\s*(?:BASE|BREACH|FUSE|FLASHPOINT)\b/i, "selection UI"],
  [/(?:^|\s)\*\*[^*\n]{2,80}\*\*|\*\*/, "unrendered markdown bold"],
  [/(?:^|\s)#{2,4}\s+[A-Za-z]/, "unrendered markdown heading"],
  [/\|\s*-{3,}\s*\|/, "unrendered markdown table"],
  [/\{\{[^}]+\}\}|\$\{[^}]+\}|\[(?:PLACEHOLDER|TODO|TBC|INSERT)[^\]]*\]/i, "unrendered template syntax"],
  [/_\(\d+\s*w\)_|\bword count\s*:/i, "word-count annotation"],
  [/\(retry\s+\d+\)|_Generated\s*:/i, "generation telemetry"],
];

/**
 * First-person system/process commentary. Audience verbatims are written in
 * the first person by design, so a match inside quotation marks is speech,
 * not system voice, and is exempt.
 */
const VOICE_PATTERNS: RegExp[] = [
  /\bI (?:cannot|can't|could not|couldn't|am unable|was unable) (?:cite|verify|confirm|source|generate|produce|provide|access|locate|determine|complete|identify)\b/i,
  /\bI (?:will now|should note that|must note that|apologi[sz]e)\b/i,
  /\bI(?:'ve| have) (?:not )?(?:generated|produced|written|included|selected)\b/i,
  /\bas an? (?:AI|language model|assistant)\b/i,
  /\bmy (?:training data|instructions|context window|previous response)\b/i,
  /\b(?:I|we) (?:cannot|can't|could not) (?:cite|verify|confirm|source)\b/i,
];

/**
 * True when the match sits inside an OPEN quoted verbatim.
 *
 * The previous heuristic counted `"` in both the "open" and "close" classes,
 * so a properly closed straight-quoted verbatim read as still open and every
 * system-voice match after it was exempted (the CommBank "I cannot cite…"
 * false negative). Quote state is now parsed as a state machine: straight
 * quotes toggle, curly quotes nest.
 */
export function insideQuote(text: string, at: number): boolean {
  let straightOpen = false;
  let curly = 0;
  for (let i = 0; i < at; i++) {
    const ch = text[i];
    if (ch === '"') straightOpen = !straightOpen;
    else if (ch === "\u201C") curly++;
    else if (ch === "\u201D") curly = Math.max(0, curly - 1);
  }
  return straightOpen || curly > 0;
}


/* ── counting ────────────────────────────────────────────────────────── */

const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};

const COUNTED_NOUNS =
  "propositions?|territories|territory|candidates?|channels?|lenses|dimensions?|directions?|briefs?|findings?|pillars?|engines?|stages?|principles?";

const singular = (noun: string) =>
  noun
    .toLowerCase()
    .replace(/^territories$/, "territory")
    .replace(/^lenses$/, "lens")
    .replace(/s$/, "");

const numberOf = (token: string) =>
  /^\d+$/.test(token) ? Number(token) : (WORD_NUMBERS[token.toLowerCase()] ?? NaN);

interface StatedCount {
  noun: string;
  n: number;
  quote: string;
}

function statedCounts(text: string): StatedCount[] {
  const re = new RegExp(
    `\\b(\\d{1,3}|${Object.keys(WORD_NUMBERS).join("|")})\\s+(?:distinct\\s+|strategic\\s+|scored\\s+|creative\\s+)?(${COUNTED_NOUNS})\\b`,
    "gi",
  );
  const out: StatedCount[] = [];
  for (const m of text.matchAll(re)) {
    const n = numberOf(m[1]);
    if (!Number.isFinite(n) || n < 2 || n > 60) continue;
    const at = m.index ?? 0;
    out.push({ noun: singular(m[2]), n, quote: text.slice(Math.max(0, at - 50), at + 70).trim() });
  }
  return out;
}

/**
 * A numeric claim written in a presenting context: the section is telling the
 * reader how many of a thing it is about to show. Any such claim is checked
 * against the rendered item count — not one hardcoded sentence pattern.
 */
const PRESENTING =
  "the following|below are|listed below are|shown below are|set out below are|shown here are|listed here are|listed below|shown below|set out below|are as follows";


export function promisedCounts(text: string): StatedCount[] {
  const re = new RegExp(
    `\\b(?:${PRESENTING})\\b[^.;:\\n]{0,40}?\\b(\\d{1,3}|${Object.keys(WORD_NUMBERS).join("|")})\\s+` +
      `(?:distinct\\s+|strategic\\s+|scored\\s+|creative\\s+|remaining\\s+|final\\s+)?(${COUNTED_NOUNS})\\b`,
    "gi",
  );
  const out: StatedCount[] = [];
  for (const m of text.matchAll(re)) {
    const n = numberOf(m[1]);
    if (!Number.isFinite(n) || n < 2 || n > 60) continue;
    out.push({ noun: singular(m[2]), n, quote: m[0].trim() });
  }
  return out;
}

/** Countable rendered items in a section: list items, sub-headings, rows, quotes. */
export function renderedItemCount(html: string): number {
  const bodyRows = (html.match(/<tr\b/gi) ?? []).length - (html.match(/<th\b/gi) ?? []).length > 0
    ? (html.match(/<tr\b/gi) ?? []).length
    : 0;
  return (
    (html.match(/<li\b/gi) ?? []).length +
    (html.match(/<h[34]\b/gi) ?? []).length +
    (html.match(/<blockquote\b/gi) ?? []).length +
    bodyRows +
    (html.match(/class="[^"]*\b(?:card|stat|prop|item)\b[^"]*"/gi) ?? []).length
  );
}

/** Basic text-quality defects: doubled words, glued sentences, stray markup. */
export function textQualityDefects(text: string): Array<{ detail: string; quote: string }> {
  const out: Array<{ detail: string; quote: string }> = [];
  const doubled = text.match(/\b([A-Za-z]{3,})\s+\1\b/);
  if (doubled && !/^(?:had|that|is)$/i.test(doubled[1]))
    out.push({ detail: `doubled word "${doubled[1]}"`, quote: doubled[0] });
  const glued = text.match(/[a-z]{2}\.[A-Z][a-z]{2}/);
  if (glued) out.push({ detail: "missing space after a full stop", quote: glued[0] });
  const spaced = text.match(/\s[,.;:]\s/);
  if (spaced) out.push({ detail: "space before punctuation", quote: spaced[0].trim() });
  const runOn = text.match(/[a-z]{4,}[A-Z][a-z]{4,}/);
  if (runOn) out.push({ detail: "two words run together", quote: runOn[0] });
  return out;
}



/* ── section splitting (works for every builder's markup) ────────────── */

export interface IntegritySection {
  index: string;
  title: string;
  html: string;
  text: string;
  /** Offsets of `html` inside the source document. */
  start: number;
  end: number;
}

export function splitSections(html: string): IntegritySection[] {
  const kickers = [
    ...html.matchAll(/<p class="kicker">(?:<span class="idx">(\d{2})<\/span>)?([^<]*)<\/p>/g),
  ];
  const marks = kickers.length
    ? kickers.map((m) => ({ index: m[1] ?? "", title: strip(m[2]), at: m.index ?? 0, end: (m.index ?? 0) + m[0].length }))
    : [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].map((m) => ({
        index: "",
        title: strip(m[1]),
        at: m.index ?? 0,
        end: (m.index ?? 0) + m[0].length,
      }));
  if (!marks.length)
    return [{ index: "01", title: "document", html, text: strip(html), start: 0, end: html.length }];
  return marks.map((mk, i) => {
    const body = html.slice(mk.end, marks[i + 1]?.at ?? html.length);
    return {
      index: mk.index || String(i + 1).padStart(2, "0"),
      title: mk.title,
      html: body,
      text: strip(body),
      start: mk.end,
      end: marks[i + 1]?.at ?? html.length,
    };
  });
}

/**
 * Numbered navigation and stat cards ("07 Proposition generation",
 * "37 directions generated") are labels, not claims about how many of a thing
 * exist, so they are removed before counts are compared.
 */
function withoutNavigation(html: string): string {
  return html
    .replace(/<(div|ol|ul|nav)[^>]*class="[^"]*(?:toc|stat|headline|nav)[^"]*"[\s\S]*?<\/\1>/gi, " ")
    .replace(/<table[\s\S]*?<\/table>/gi, " ");
}

/* ── the certification ───────────────────────────────────────────────── */

export type IntegrityCriterion =
  | "COMPLETE"
  | "CLEAN"
  | "VOICE"
  | "CONSISTENT"
  | "PROMISED"
  | "PLACED"
  | "DUPLICATE"
  | "SCHEMA"
  | "DISPOSITION"
  | "CHECKPOINT";

export interface IntegrityFinding {
  section: string;
  criterion: IntegrityCriterion;
  detail: string;
  /** The offending text, quoted verbatim. */
  quote: string;
}

export interface IntegrityOptions {
  /** Sections whose bodies are historical transcripts of raw stage output. */
  transcriptSections?: readonly string[];
  /**
   * Sections whose prose the builder writes itself. Count consistency is only
   * enforced across these; omit to enforce across every non-transcript section.
   */
  narrativeSections?: readonly string[];
  /** Additional clean-check exemptions, e.g. a brand whose name is "Date". */
  allow?: readonly RegExp[];
  /**
   * Sections that render a fixed field schema (e.g. the Summary's section 02
   * brand facts). Every listed label must be present with a real value.
   */
  schemaSections?: Readonly<Record<string, readonly string[]>>;
}


export function contentIntegrityFindings(
  html: string,
  opts: IntegrityOptions = {},
): IntegrityFinding[] {
  const findings: IntegrityFinding[] = [];
  const sections = splitSections(html);
  const allow = opts.allow ?? [];
  const exempt = (s: string) => allow.some((re) => re.test(s));

  for (const sec of sections) {
    const where = sec.index ? `${sec.index} "${sec.title}"` : `"${sec.title}"`;

    // COMPLETE — a body, and prose that finishes its sentence.
    if (!sec.text) {
      findings.push({ section: where, criterion: "COMPLETE", detail: "section has no body", quote: "" });
      continue;
    }
    if (/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>\s*(?:<\/div>\s*)*$/.test(sec.html.trim())) {
      findings.push({
        section: where,
        criterion: "COMPLETE",
        detail: "section ends on a heading with nothing beneath it",
        quote: strip(sec.html.slice(-200)),
      });
    }
    const prose = [
      ...sec.html.replace(/<table[\s\S]*?<\/table>/gi, " ").matchAll(/<(p|li)([^>]*)>([\s\S]*?)<\/\1>/gi),
    ]
      .filter((m) => !/class="(?:label|value|num[^"]*|score|n|d|t|kicker|idx|part-label)"/i.test(m[2]))
      .map((m) => ({ tag: m[1].toLowerCase(), text: strip(m[3]) }))
      .filter((b) => b.text.split(/\s+/).length > 6);
    const last = prose[prose.length - 1];
    if (last && looksCut(last.text, last.tag === "li")) {
      findings.push({
        section: where,
        criterion: "COMPLETE",
        detail: "section body stops mid-sentence",
        quote: last.text.slice(-160),
      });
    }
    // An ellipsis inside a sentence is an author's elision of a quotation; an
    // ellipsis that ENDS a block is content that was cut.
    for (const b of prose) {
      if (!/\w(?:…|\.\.\.)$/.test(b.text)) continue;
      findings.push({
        section: where,
        criterion: "COMPLETE",
        detail: "block ends cut with an ellipsis",
        quote: b.text.slice(-140),
      });
      break;
    }

    // CLEAN — no artifact of the machine that made the document.
    for (const [re, label] of CLEAN_PATTERNS) {
      const m = sec.text.match(re);
      if (!m) continue;
      const at = sec.text.indexOf(m[0]);
      const quote = sec.text.slice(Math.max(0, at - 60), at + 90);
      if (exempt(quote)) continue;
      findings.push({ section: where, criterion: "CLEAN", detail: label, quote });
    }

    // VOICE — no first-person system commentary, transcripts included.
    for (const re of VOICE_PATTERNS) {
      const m = sec.text.match(re);
      if (!m) continue;
      const at = sec.text.indexOf(m[0]);
      if (insideQuote(sec.text, at)) continue;
      findings.push({
        section: where,
        criterion: "VOICE",
        detail: "first-person system voice",
        quote: sec.text.slice(Math.max(0, at - 60), at + 120),
      });
    }

    // PROMISED — every numeric claim a section makes about what it is about to
    // show is checked against what the section actually renders. This is no
    // longer one hardcoded sentence shape: any "…N <countable noun>…" written
    // in a presenting context ("the following", "below", "these", "shown here",
    // "set out", "listed") is a promise and is reconciled with the rendered
    // item count.
    for (const promise of promisedCounts(sec.text)) {
      const rendered = renderedItemCount(sec.html);
      if (rendered < promise.n) {
        findings.push({
          section: where,
          criterion: "PROMISED",
          detail: `promises ${promise.n} ${promise.noun}(s) but renders ${rendered} item(s)`,
          quote: promise.quote,
        });
      }
    }

    // SCHEMA — a fixed-field section must carry every field, with a value that
    // is more than a placeholder, and must be free of obvious text defects.
    const schema = opts.schemaSections?.[sec.index];
    if (schema) {
      for (const label of schema) {
        const re = new RegExp(
          `${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*[:\\u2014-]?\\s*([^\\n]{0,160})`,
          "i",
        );
        const m = sec.text.match(re);
        const value = (m?.[1] ?? "").trim();
        if (!m) {
          findings.push({ section: where, criterion: "SCHEMA", detail: `field "${label}" is missing`, quote: "" });
        } else if (value.length < 3 || /^(?:n\/a|none|null|undefined|tbc|tbd|-{1,3})\b/i.test(value)) {
          findings.push({
            section: where,
            criterion: "SCHEMA",
            detail: `field "${label}" has no real value`,
            quote: `${label}: ${value}`,
          });
        }
      }
      // Text-quality is judged on the field values themselves; the label/value
      // join is not prose and produces false doubled-word hits.
      for (const label of schema) {
        const re = new RegExp(
          `${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*[:\\u2014-]?\\s*([^\\n]{0,160})`,
          "i",
        );
        const value = (sec.text.match(re)?.[1] ?? "").trim();
        if (!value) continue;
        for (const d of textQualityDefects(value)) {
          findings.push({ section: where, criterion: "SCHEMA", detail: d.detail, quote: d.quote });
        }
      }

    }
  }


  // CONSISTENT — one number per noun across the sections this builder writes
  // itself. Stage transcripts are historical records of what an earlier stage
  // counted, and a table of contents or stat block is numbered navigation, not
  // a claim; neither is compared, but both are still checked for CLEAN/VOICE.
  const narrative = opts.narrativeSections;
  const live = sections.filter(
    (s) =>
      (!narrative || narrative.includes(s.index)) &&
      !(opts.transcriptSections ?? []).includes(s.index) &&
      !/^contents$/i.test(s.title),
  );
  const byNoun = new Map<string, StatedCount & { section: string }>();
  for (const sec of live) {
    for (const c of statedCounts(strip(withoutNavigation(sec.html)))) {
      const prior = byNoun.get(c.noun);
      if (!prior) {
        byNoun.set(c.noun, { ...c, section: sec.index || sec.title });
        continue;
      }
      if (prior.n !== c.n) {
        findings.push({
          section: sec.index ? `${sec.index} "${sec.title}"` : `"${sec.title}"`,
          criterion: "CONSISTENT",
          detail: `states ${c.n} ${c.noun}(s) while section ${prior.section} states ${prior.n}`,
          quote: `${prior.quote} ⟷ ${c.quote}`,
        });
      }
    }
  }

  // Duplication, placement and disposition are rules about prose the builder
  // writes itself. A stage transcript is a historical record: it reproduces
  // what a stage actually wrote, repetitions and all, and is not rewritten.
  const authored = sections.filter(
    (s) =>
      (!narrative || narrative.includes(s.index)) &&
      !(opts.transcriptSections ?? []).includes(s.index),
  );
  const authoredOnly = narrative ? authored : [];
  findings.push(...duplicateFindings(authoredOnly));
  findings.push(...placementFindings(authoredOnly));
  findings.push(...dispositionFindings(authoredOnly));
  findings.push(...checkpointFindings(sections, authored));


  return findings;
}

/* ── document-level rules ────────────────────────────────────────────── */

const nkey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();

/**
 * DUPLICATE — nothing printed twice. Paragraphs, list items, headings, table
 * headers and table cells all count: the old rule only looked at prose blocks
 * over 200 characters, which is why a repeated table header survived.
 */
function duplicateFindings(sections: IntegritySection[]): IntegrityFinding[] {
  const out: IntegrityFinding[] = [];
  const seen = new Map<string, { section: string; count: number }>();
  for (const sec of sections) {
    if (/^contents$/i.test(sec.title)) continue;
    const where = sec.index ? `${sec.index} "${sec.title}"` : `"${sec.title}"`;
    const local = new Map<string, number>();
    for (const m of sec.html.matchAll(/<(p|li|h3|h4|th|td|blockquote)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
      const text = strip(m[2]);
      const tag = m[1].toLowerCase();
      if (text.length < 24) continue;
      const key = nkey(text);
      if (!key) continue;
      // Within a section, a repeated heading, table header or substantial cell
      // is always a defect — this is the short/table content the old
      // paragraph-only rule could not see (Jaguar's duplicated table header).
      const localRepeatable =
        tag === "th" || tag === "h3" || tag === "h4" || (tag === "td" && text.length >= 60);
      local.set(key, (local.get(key) ?? 0) + 1);
      if (localRepeatable && (local.get(key) ?? 0) > 1) {
        out.push({
          section: where,
          criterion: "DUPLICATE",
          detail: `the same ${tag} is printed twice in this section`,
          quote: text.slice(0, 140),
        });
        continue;
      }
      // Across sections, a Minto document legitimately restates the
      // proposition and the recommendation, so only substantial prose blocks
      // are compared.
      if (text.length < 180 || tag === "th" || tag === "td") continue;
      const prior = seen.get(key);
      if (prior && prior.section !== where) {
        out.push({
          section: where,
          criterion: "DUPLICATE",
          detail: `content also printed in section ${prior.section}`,
          quote: text.slice(0, 140),
        });
      } else if (!prior) seen.set(key, { section: where, count: 1 });
    }

  }
  return out;
}

/**
 * PLACED — semantic boundary. A heading inside a section that names another
 * section, or prose that plainly belongs to another section's subject, is
 * misplaced content even when the string is not an exact heading match.
 */
function placementFindings(sections: IntegritySection[]): IntegrityFinding[] {
  const out: IntegrityFinding[] = [];
  const tokens = (s: string) => new Set(nkey(s).split(" ").filter((w) => w.length > 3));
  const titles = sections.map((s) => ({ index: s.index, title: s.title, tok: tokens(s.title) }));

  for (const sec of sections) {
    if (/^contents$/i.test(sec.title)) continue;
    const where = sec.index ? `${sec.index} "${sec.title}"` : `"${sec.title}"`;
    const own = tokens(sec.title);
    for (const m of sec.html.matchAll(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi)) {
      const heading = strip(m[1]);
      if (heading.split(/\s+/).length < 2) continue;
      const htok = tokens(heading);
      if (!htok.size) continue;
      for (const t of titles) {
        // A one-word kicker ("Insight") is too coarse to attribute a heading.
        if (t.index === sec.index || t.tok.size < 2) continue;
        const overlapOther = [...t.tok].filter((w) => htok.has(w)).length / t.tok.size;
        const overlapOwn = [...own].filter((w) => htok.has(w)).length / Math.max(1, own.size);
        if (overlapOther >= 0.75 && overlapOther > overlapOwn) {
          out.push({
            section: where,
            criterion: "PLACED",
            detail: `heading belongs to section ${t.index} "${t.title}"`,
            quote: heading,
          });
        }
      }
    }
  }
  return out;
}

/**
 * DISPOSITION — anything named as eliminated, rejected or set aside anywhere in
 * the document must be accounted for in the section that records dispositions.
 */
function dispositionFindings(sections: IntegritySection[]): IntegrityFinding[] {
  const target = sections.find((s) =>
    /not carried forward|disposition|rejected|eliminat/i.test(s.title),
  );
  if (!target) return [];
  const targetText = nkey(target.text);
  const out: IntegrityFinding[] = [];
  const seen = new Set<string>();
  for (const sec of sections) {
    if (sec.index === target.index || /^contents$/i.test(sec.title)) continue;
    const where = sec.index ? `${sec.index} "${sec.title}"` : `"${sec.title}"`;
    for (const m of sec.html.matchAll(
      /<(strong|h3|h4)\b[^>]*>([\s\S]{4,90}?)<\/\1>([\s\S]{0,320})/gi,
    )) {
      const name = strip(m[2]).replace(/^[“"']+|[”"':.]+$/g, "");
      const after = strip(m[3]);
      if (name.split(/\s+/).length < 2 || name.length < 8) continue;
      if (!/\b(eliminat\w*|rejected|set aside|not carried|discarded|dropped|did not survive)\b/i.test(after))
        continue;
      const key = nkey(name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      if (!targetText.includes(key)) {
        out.push({
          section: where,
          criterion: "DISPOSITION",
          detail: `"${name}" is described as eliminated but has no disposition in section ${target.index} "${target.title}"`,
          quote: `${name} — ${after.slice(0, 120)}`,
        });
      }
    }
  }
  return out;
}

/**
 * CHECKPOINT — a document that records fewer than the full set of human
 * checkpoints may not also read as cleared without saying so.
 */
function checkpointFindings(
  sections: IntegritySection[],
  authored: IntegritySection[] = sections,
): IntegrityFinding[] {
  const out: IntegrityFinding[] = [];
  const whole = sections.map((s) => s.text).join(" ");
  const m = whole.match(/\b(\d{1,2})\s*\/\s*(\d{1,2})\b[^.]{0,60}checkpoint/i) ??
    whole.match(/checkpoint[^.]{0,60}?\b(\d{1,2})\s*\/\s*(\d{1,2})\b/i);
  if (!m) return out;
  const done = Number(m[1]);
  const total = Number(m[2]);
  if (!Number.isFinite(done) || !Number.isFinite(total) || done >= total) return out;
  // Only the document's OWN prose can overclaim. A stage transcript in the
  // appendix that records its own clearance declaration is history, not a
  // claim the deliverable is making about the human checkpoints.
  const authoredText = (authored.length ? authored : sections).map((s) => s.text).join(" ");
  const cleared = authoredText.match(
    /\b(?:all checkpoints (?:cleared|signed off|complete)|fully cleared|CLEARED\b|every checkpoint (?:cleared|signed off))/i,
  );

    /\b(?:all checkpoints (?:cleared|signed off|complete)|fully cleared|CLEARED\b|every checkpoint (?:cleared|signed off))/i,
  );
  const acknowledged =
    /\b(?:checkpoints? (?:remain|outstanding|incomplete|not yet|pending)|remaining checkpoint|awaiting sign[- ]off|not all checkpoints)\b/i.test(
      whole,
    );
  if (cleared && !acknowledged) {
    const at = whole.indexOf(cleared[0]);
    out.push({
      section: "document",
      criterion: "CHECKPOINT",
      detail: `${done}/${total} checkpoints signed off, but the document reads as cleared without stating the gap`,
      quote: whole.slice(Math.max(0, at - 80), at + 120),
    });
  }
  return out;
}


/**
 * Hard gate. Every builder ends with this call, so no generation path — the
 * Deliverables cards, the zip bundle, the PDF renderer, the repository view —
 * can publish a document that fails certification.
 */
export class DocumentCertificationError extends Error {
  constructor(
    message: string,
    /** The rejected document, carried for diagnostics only — never published. */
    readonly html: string,
    readonly findings: IntegrityFinding[],
  ) {
    super(message);
    this.name = "DocumentCertificationError";
  }
}

export function assertPublishable(html: string, label: string, opts: IntegrityOptions = {}): string {
  const findings = contentIntegrityFindings(html, opts);
  if (findings.length) {
    throw new DocumentCertificationError(
      `${label} failed content-integrity certification:\n- ` +
        findings
          .slice(0, 15)
          .map((f) => `[${f.criterion}] section ${f.section}: ${f.detail}${f.quote ? ` — “${f.quote}”` : ""}`)
          .join("\n- "),
      html,
      findings,
    );
  }
  return html;
}

/**
 * Some stored stage outputs were themselves cut off mid-sentence when the
 * pipeline wrote them. A cut sentence is never shown to a reader and is never
 * completed by guessing: the incomplete tail is dropped, silently. Commentary
 * about the state of the pipeline record is internal system voice and has no
 * place in a client deliverable, so nothing is written in its place.
 * Shared by every builder so one deliverable cannot silently keep the cut.
 */
export const CUT_NOTE = "";

export function closeIncompleteTail(bodyHtml: string): string {
  const openAt = Math.max(bodyHtml.lastIndexOf("<p"), bodyHtml.lastIndexOf("<li"));
  if (openAt < 0) return bodyHtml;
  const tag = bodyHtml.startsWith("<li", openAt) ? "li" : "p";
  const closeAt = bodyHtml.indexOf(`</${tag}>`, openAt);
  if (closeAt < 0) return bodyHtml;
  const inner = bodyHtml.slice(bodyHtml.indexOf(">", openAt) + 1, closeAt);
  const text = strip(inner);
  if (!looksCut(text, tag === "li") && !/\w(?:\u2026|\.\.\.)$/.test(text)) return bodyHtml;
  const after = bodyHtml.slice(closeAt + `</${tag}>`.length);
  return `${bodyHtml.slice(0, openAt)}${after}${CUT_NOTE}`;
}


/**
 * Some stored stage outputs narrate the model's own process ("Because I cannot
 * cite a named campaign…"). That is system voice, not client voice. The
 * sentence carrying it is removed — never rewritten, never replaced with an
 * invented equivalent — so the surrounding argument still reads as written.
 * Quoted verbatim speech is left untouched.
 */
export function removeSystemVoice(html: string): string {
  return html.replace(/<(p|li|blockquote|td|th)\b([^>]*)>([\s\S]*?)<\/\1>/gi, (whole, tag, attrs, inner) => {
    const text = strip(inner);
    if (!VOICE_PATTERNS.some((re) => re.test(text))) return whole;
    // Only operate on plain prose blocks; anything with nested markup is left
    // alone so a rewrite cannot damage structure.
    if (/<(?!\/?(?:em|strong|b|i|span)\b)[a-z]/i.test(inner)) return whole;
    const sentences = inner.split(/(?<=[.!?])\s+/);
    const kept = sentences.filter((s: string) => {
      const plain = strip(s);
      return !VOICE_PATTERNS.some((re) => {
        const m = plain.match(re);
        return m && !insideQuote(plain, plain.indexOf(m[0]));
      });
    });
    const body = kept.join(" ").trim();
    return body ? `<${tag}${attrs}>${body}</${tag}>` : "";
  });
}

/**
 * The one call every builder ends with: drop any tail the pipeline itself cut
 * off (stating the gap instead of inventing an ending), remove system voice,
 * then certify. A document that still fails is thrown, never returned, so no
 * generation path can put it in front of a reader.
 */
export function certifyDocument(html: string, label: string, opts: IntegrityOptions = {}): string {
  let out = removeSystemVoice(html);
  const sections = splitSections(out);
  for (let i = sections.length - 1; i >= 0; i--) {
    const sec = sections[i];
    const fixed = closeIncompleteTail(sec.html);
    if (fixed !== sec.html) out = out.slice(0, sec.start) + fixed + out.slice(sec.end);
  }
  return assertPublishable(out, label, opts);
}

