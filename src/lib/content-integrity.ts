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

/** True when the match sits inside a quoted verbatim. */
function insideQuote(text: string, at: number): boolean {
  const before = text.slice(0, at);
  const opens = (before.match(/["“]/g) ?? []).length;
  const closes = (before.match(/["”]/g) ?? []).length;
  return opens > closes || /["“][^"”]{0,400}$/.test(before);
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

export interface IntegrityFinding {
  section: string;
  criterion: "COMPLETE" | "CLEAN" | "VOICE" | "CONSISTENT" | "PROMISED";
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

    // PROMISED — "the following three principles" must be followed by three.
    const promise = sec.text.match(
      new RegExp(
        `\\b(?:the following|below are|listed below are|shown below are)\\s+(\\d{1,2}|${Object.keys(
          WORD_NUMBERS,
        ).join("|")})\\s+(${COUNTED_NOUNS})\\b`,
        "i",
      ),
    );
    if (promise) {
      const n = numberOf(promise[1]);
      const rendered = ["<li", "<h3", "<h4", "<tr", "<blockquote"].reduce(
        (t, tag) => t + (sec.html.split(tag).length - 1),
        0,
      );
      if (Number.isFinite(n) && n >= 2 && rendered < n) {
        findings.push({
          section: where,
          criterion: "PROMISED",
          detail: `promises ${n} ${promise[2]} but renders ${rendered} item(s)`,
          quote: promise[0],
        });
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

  return findings;
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
 * completed by guessing: the incomplete tail is dropped and the gap is stated.
 * Shared by every builder so one deliverable cannot silently keep the cut.
 */
export const CUT_NOTE = `<p class="note">The stored output for this stage ends mid-sentence in the pipeline record. Nothing has been invented to complete it.</p>`;

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
 * The one call every builder ends with: drop any tail the pipeline itself cut
 * off (stating the gap instead of inventing an ending), then certify. A
 * document that still fails is thrown, never returned, so no generation path
 * can put it in front of a reader.
 */
export function certifyDocument(html: string, label: string, opts: IntegrityOptions = {}): string {
  let out = html;
  const sections = splitSections(out);
  for (let i = sections.length - 1; i >= 0; i--) {
    const sec = sections[i];
    const fixed = closeIncompleteTail(sec.html);
    if (fixed !== sec.html) out = out.slice(0, sec.start) + fixed + out.slice(sec.end);
  }
  return assertPublishable(out, label, opts);
}
