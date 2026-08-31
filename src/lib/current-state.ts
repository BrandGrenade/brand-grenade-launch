// BRAND GRENADE — CURRENT STATE VS RECOMMENDED CHANGE (shared derivation)
// ============================================================================
// One derivation, used by every document type, answering the question no
// deliverable previously answered: what is the client already doing, what does
// the recommendation make explicit that is currently implicit or fragmented,
// and what is genuinely new and not happening at all today.
//
// Hard rule: nothing here is invented. Bucket 1 is quoted from the ingested
// research corpus (claims, brief, disclosures) and attributed to the document
// it came from. Buckets 2 and 3 are the recommendation's own asks, sorted by
// whether the corpus already evidences related activity. When the corpus
// carries no statement of current activity, the section says exactly that
// rather than assembling a plausible-sounding baseline.

import { callout, escapeHtml, inlineMd } from "./doc-system";

export interface EvidenceSource {
  /** Named source document — printed as the attribution. */
  label: string;
  text: string;
}

export interface CurrentStateInput {
  brand: string;
  /** Ingested research / claims corpus, per named source. */
  evidence: EvidenceSource[];
  /** What the recommendation asks for — one plain line each. */
  proposedActions: string[];
  /** Structured, already-known activity that need not be text-mined. */
  knownActivity?: { text: string; source: string }[];
  /** Cap on quoted existing-activity lines. */
  limit?: number;
}

/** Language that marks a sentence as a statement of activity already happening. */
const ACTIVITY_RE =
  /\b(campaign|advertis\w*|launch\w*|relaunch\w*|sponsor\w*|in market|currently|already|to date|rolled out|roll-out|runs?|running|has been|have been|since \d{4}|in \d{4}|disclos\w*|states|reports?|claims to|packaging|labell?ing|sourc\w*|partnership|activation|promot\w*|owns?|operates?)\b/i;

/** Language that marks a sentence as forecast, opinion or instruction, not activity. */
const NOT_ACTIVITY_RE =
  /\b(should|must|could|recommend\w*|opportunity|we believe|potential|would|may|might|consider)\b/i;

const STOP = new Set([
  "about","above","across","after","against","among","around","because","before","behind","between","brand","brands",
  "could","during","every","from","into","other","should","their","there","these","those","through","under",
  "where","which","while","with","would","that","this","than","then","they","them","have","been","being","more",
  "most","such","only","also","both","each","into","over","upon","what","when","will","your","ours","must","make",
  "makes","made","need","needs","used","using","use","the","and","for","are","was","were","its","it's",
]);

/**
 * Verification status expressed in the source corpus as icons or internal
 * status labels. Rendered as plain wording, never as an icon or raw label.
 */
export type VerificationStatus =
  | "independently confirmed"
  | "not independently verified"
  | "as supplied by the client, unconfirmed"
  | null;

const EMOJI_RE =
  /[\u2190-\u21FF\u2300-\u27BF\u2B00-\u2BFF\uFE0F\u{1F000}-\u{1FAFF}]/gu;

function detectStatus(raw: string): VerificationStatus {
  const t = raw.toLowerCase();
  if (/client[-\s]?(supplied|provided|stated|reported)|per (the )?client|as supplied by the client/.test(t))
    return "as supplied by the client, unconfirmed";
  if (
    /\u26A0|not (independently )?(verified|confirmed)|unverified|unconfirmed|could not be (re-?)?(verified|confirmed)|no (independent )?source/.test(
      raw.toLowerCase(),
    ) || /\u26A0/.test(raw)
  )
    return "not independently verified";
  if (/\u2705|\u2714|independently (confirmed|verified)|\bverified\b|\bconfirmed\b/.test(raw.toLowerCase()) || /[\u2705\u2714]/.test(raw))
    return "independently confirmed";
  return null;
}

/**
 * Removes internal citation plumbing — filenames, "Source:" fragments, status
 * icons, "Note:" interjections — so the sentence reads as client-facing prose.
 */
function stripPlumbing(s: string): string {
  return (
    s
      .replace(EMOJI_RE, " ")
      // Bare filenames first: "Source: Per Analysis_v2.txt" otherwise had its
      // label consumed up to the dot, leaving an orphaned "Txt:" on the page.
      .replace(/\b[\w .\-]+\.(?:pdf|md|docx?|txt|csv|xlsx?|pptx?|json)\b/gi, " ")
      // "Source: Per BegaMilkResearchFINALv2" and friends.
      .replace(/\(?\b(?:source|sources|ref|reference|citation|file)\s*[:\-—]\s*[^.;)\]]*\)?/gi, " ")
      // Any residual extension token left behind by an earlier pass.
      .replace(/(^|[\s(])(?:txt|pdf|md|docx?|csv|xlsx?|pptx?|json)\s*:\s*/gi, "$1")
      // Internal status labels. The separator must be a colon or a dash with
      // spacing around it — a bare hyphen matched inside ordinary hyphenated
      // words and silently ate copy ("not a flag-waving exercise").
      .replace(
        /\b(?:status|verification|confidence|flag)\s*(?::|\s+[-—–]\s+)\s*[A-Za-z_ ]{0,40}/gi,
        " ",
      )
      .replace(/\[(?:verified|unverified|client[-\s]?supplied|unconfirmed)\]/gi, " ")
      // "Note:" interjections, leading or mid-sentence.
      .replace(/^\s*(?:note|caveat|nb)\s*[:\-—]\s*/i, "")
      .replace(/[;,.]?\s*\b(?:note|nb)\s*[:\-—]\s*/gi, ". ")
      .replace(/\s*[—–-]\s*$/, "")
      .replace(/\s+([.,;:])/g, "$1")
      .replace(/\.\s*\./g, ".")
      .replace(/\(\s*\)/g, "")
      .replace(/\s{2,}/g, " ")
      .trim()
  );
}


/** Source text is raw transcript: markdown scaffolding must never survive. */
function tidySentence(s: string): string {
  const cleaned = stripPlumbing(
    s
      .replace(/^[#>*\-—•\s]+/, "")
      .replace(/[#*_`|]/g, "")
      .replace(/\s+/g, " "),
  )
    // Stripping "Note:" / "Source:" labels can leave an orphaned leading
    // fragment such as ".: " — never let that reach the page.
    .replace(/^[\s.,;:•\-—]+/, "")
    .trim();
  return cleaned.replace(/^[a-z]/, (c) => c.toUpperCase());
}

/**
 * Pipeline field lines — machine labels and enum payloads that live in the
 * research corpus for the system's own use ("PROBLEM SHAPE(S): …",
 * "Frame: problem Why it matters: …", "Step 1 gap: …"). They are internal
 * plumbing, never client-facing statements of current activity.
 */
const MACHINE_FIELD_RE =
  /^(?:[A-Z][A-Z0-9 ()\/&-]{3,}\s*:|frame\s*:|step\s*\d+\s+(?:gap|check|note)\s*:|problem shape|why it matters\s*:|verdict\s*:|evidence\s*:|confidence\s*:)/i;

/** Run-together enum tokens ("favourabilitydecline") betray a machine payload. */
const ENUM_TOKEN_RE = /\b[a-z]{12,}\b/;

function isMachineField(s: string): boolean {
  if (MACHINE_FIELD_RE.test(s.trim())) return true;
  if (/\bwhy it matters\s*:/i.test(s)) return true;
  const words = s.split(/\s+/);
  const enumish = words.filter((w) => ENUM_TOKEN_RE.test(w.replace(/[^a-z]/gi, "")) && !/[A-Z]/.test(w.slice(1)));
  return enumish.length >= 2;
}

/**
 * A sentence that only certifies another claim ("Confirmed by multiple
 * sources…", "Verified against…") has no subject of its own. It must never
 * become its own bullet: it is folded onto the claim it verifies, or dropped.
 */
function isVerificationFragment(s: string): boolean {
  return /^(?:confirmed|verified|corroborated|cross[-\s]?checked|substantiated|re[-\s]?confirmed|checked|sourced|supported)\b/i.test(
    s.trim(),
  );
}

/** Trailing raw citation digits from the source must not collide with ours. */
function stripTrailingCitation(s: string): string {
  return s
    .replace(/[\u00B2\u00B3\u00B9\u2070-\u209F]+/g, "")
    .replace(/[\s,;:.]*\[?\d{1,2}\]?$/, "")
    .trim();
}

function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z"“'(])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 4 && !STOP.has(w)),
  );
}

function overlap(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const t of a) if (b.has(t)) n += 1;
  return n;
}

export interface CurrentStateFact {
  text: string;
  source: string;
  /**
   * Secondary sources from verification notes folded onto this claim, cited
   * alongside the primary source instead of forming their own bullet.
   */
  extraSources?: string[];
  /** Verification wording derived from the corpus, never an icon or raw label. */
  status: VerificationStatus;
}

export interface CurrentStateModel {
  /** Quoted, attributed statements of what is already happening. */
  existing: CurrentStateFact[];
  /** Recommendation asks that the corpus already evidences in some form. */
  madeExplicit: { text: string; echo: string; source: string; status: VerificationStatus }[];
  /** Recommendation asks with no corresponding activity in the corpus. */
  genuinelyNew: string[];
  /** True when no source material described current activity at all. */
  noBaseline: boolean;
}

export function deriveCurrentState(input: CurrentStateInput): CurrentStateModel {
  const limit = input.limit ?? 6;
  const mined: CurrentStateFact[] = [];
  const seen = new Set<string>();

  /**
   * A verification-only fragment is folded onto the claim immediately above
   * it — its source becomes a second citation on that claim. With no parent
   * claim it is dropped outright: never rendered as a headless bullet.
   */
  const add = (text: string, source: string, raw: string, parent: CurrentStateFact | null) => {
    if (!text) return null;
    if (isVerificationFragment(text)) {
      if (parent) {
        const clean = (source || "").trim();
        if (clean && clean !== parent.source && !(parent.extraSources ?? []).includes(clean)) {
          parent.extraSources = [...(parent.extraSources ?? []), clean];
        }
        if (!parent.status) parent.status = detectStatus(raw);
      }
      return parent;
    }
    const key = text.toLowerCase().slice(0, 60);
    if (seen.has(key)) return parent;
    seen.add(key);
    const fact: CurrentStateFact = { text, source, status: detectStatus(raw) };
    mined.push(fact);
    return fact;
  };

  let last: CurrentStateFact | null = null;
  for (const { text, source } of input.knownActivity ?? []) {
    last = add(tidySentence(text ?? ""), source, text ?? "", last);
  }

  for (const src of input.evidence) {
    if (!src?.text) continue;
    last = null;
    // Source text is transcript markdown: headings and list items carry no
    // terminal punctuation, so sentence-splitting the whole blob glued a
    // heading onto the paragraph beneath it ("The Category This Brand
    // Operates In What does the category currently believe? ..."). Blocks are
    // separated by line breaks first, and each block is split on its own.
    const blocks = src.text.split(/\n+/).map((b) => b.trim()).filter(Boolean);
    for (const s of blocks.flatMap((b) => sentences(b))) {
      const t = tidySentence(s);
      if (!t) continue;
      // Verification notes are folded onto the claim above before any of the
      // activity filters, which would otherwise discard the note silently.
      if (isVerificationFragment(t)) {
        add(t, src.label, s, last);
        continue;
      }
      if (t.length < 60 || t.length > 340) continue;
      if (!ACTIVITY_RE.test(t)) continue;
      if (NOT_ACTIVITY_RE.test(t)) continue;
      last = add(t, src.label, s, last);
    }
  }

  const existing = mined.slice(0, limit);
  const corpusIndex = mined.map((m) => ({ ...m, tok: tokens(m.text) }));

  const madeExplicit: CurrentStateModel["madeExplicit"] = [];
  const genuinelyNew: string[] = [];

  for (const action of input.proposedActions.map((a) => tidySentence(a)).filter(Boolean)) {
    const at = tokens(action);
    let best: { m: (typeof corpusIndex)[number]; n: number } | null = null;
    for (const m of corpusIndex) {
      const n = overlap(at, m.tok);
      if (n >= 2 && (!best || n > best.n)) best = { m, n };
    }
    if (best) {
      madeExplicit.push({
        text: action,
        echo: best.m.text,
        source: best.m.source,
        status: best.m.status,
      });
    } else {
      genuinelyNew.push(action);
    }
  }

  return { existing, madeExplicit, genuinelyNew, noBaseline: mined.length === 0 };
}

const NO_BASELINE =
  "The source material ingested for this session contains no statement of what is currently in market for this brand. Nothing has been assumed in its place: the change below is stated against an unrecorded baseline, and confirming current activity is part of the next step.";

function bulletList(items: string[]): string {
  return `<ul>${items.map((i) => `<li>${inlineMd(i)}</li>`).join("")}</ul>`;
}

/**
 * Renders the shared "Current state vs recommended change" section. Returns an
 * empty string only when there is neither a baseline nor a recommendation ask,
 * in which case the canonical template renders its declared fallback.
 */
export function buildCurrentStateSection(input: CurrentStateInput): string {
  const model = deriveCurrentState(input);
  if (model.noBaseline && !model.madeExplicit.length && !model.genuinelyNew.length) return "";

  // Footnote registry — sources are cited by number, never dropped into prose.
  const order: string[] = [];
  const cite = (source: string): string => {
    const clean = (source || "Session research").trim();
    let i = order.indexOf(clean);
    if (i === -1) i = order.push(clean) - 1;
    return `<span class="cs-cite">${i + 1}</span>`;
  };

  /** One claim, one citation marker — several sources read as "1, 2". */
  const citeAll = (primary: string, extra?: string[]): string => {
    const seenSrc: string[] = [];
    for (const s of [primary, ...(extra ?? [])]) {
      const clean = (s || "Session research").trim();
      if (clean && !seenSrc.includes(clean)) seenSrc.push(clean);
    }
    const nums = seenSrc.map((s) => {
      const clean = s;
      let i = order.indexOf(clean);
      if (i === -1) i = order.push(clean) - 1;
      return i + 1;
    });
    return `<span class="cs-cite">${nums.join(", ")}</span>`;
  };

  const statusPhrase = (s: VerificationStatus): string =>
    s ? ` <span class="cs-status">(${s})</span>` : "";

  const sentence = (t: string): string => {
    const trimmed = stripTrailingCitation(t.trim());
    return trimmed.replace(/[\s,;:.!?]+$/, "");
  };

  const intro = `<p>This section separates what ${escapeHtml(
    input.brand,
  )} is already doing from what this recommendation actually changes, so the proposal is not read as if it were being made in a vacuum. Existing activity is drawn from the research ingested for this session; sources are numbered and listed beneath, and each point states plainly how far it has been verified.</p>`;

  const existingHtml = model.existing.length
    ? callout(
        "Already in market — what the research records",
        `<ul>${model.existing
          .map(
            (e) =>
              `<li>${inlineMd(sentence(e.text))}${citeAll(e.source, e.extraSources)}${statusPhrase(e.status)}.</li>`,
          )
          .join("")}</ul>`,
      )
    : callout("Already in market", `<p>${NO_BASELINE}</p>`);

  const explicitHtml = model.madeExplicit.length
    ? callout(
        "Currently implicit or fragmented — what the recommendation makes explicit",
        `<ul>${model.madeExplicit
          .map(
            (e) =>
              `<li>${inlineMd(sentence(e.text))}. Builds on existing activity: ${inlineMd(
                sentence(e.echo),
              )}${cite(e.source)}${statusPhrase(e.status)}.</li>`,
          )
          .join("")}</ul>`,
      )
    : "";

  const newHtml = model.genuinelyNew.length
    ? callout(
        "Genuinely new — not happening today",
        bulletList(model.genuinelyNew) +
          `<p class="muted">No activity matching these appears anywhere in the ingested research. They are new commitments, not reframings of existing work.</p>`,
      )
    : "";

  const sourcesHtml = order.length
    ? `<ul class="cs-sources">${order
        .map((s, i) => `<li><span class="cs-num">${i + 1}.</span> ${escapeHtml(s)}</li>`)
        .join("")}</ul>`
    : "";

  return intro + existingHtml + explicitHtml + newHtml + sourcesHtml;
}
