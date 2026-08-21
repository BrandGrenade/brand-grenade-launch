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

/** Source text is raw transcript: markdown scaffolding must never survive. */
function tidySentence(s: string): string {
  return s
    .replace(/^[#>*\-—•\s]+/, "")
    .replace(/[#*_`|]/g, "")
    .replace(/\s+/g, " ")
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

export interface CurrentStateModel {
  /** Quoted, attributed statements of what is already happening. */
  existing: { text: string; source: string }[];
  /** Recommendation asks that the corpus already evidences in some form. */
  madeExplicit: { text: string; echo: string; source: string }[];
  /** Recommendation asks with no corresponding activity in the corpus. */
  genuinelyNew: string[];
  /** True when no source material described current activity at all. */
  noBaseline: boolean;
}

export function deriveCurrentState(input: CurrentStateInput): CurrentStateModel {
  const limit = input.limit ?? 6;
  const mined: { text: string; source: string }[] = [];
  const seen = new Set<string>();

  for (const { text, source } of input.knownActivity ?? []) {
    const clean = tidySentence(text ?? "");
    const key = clean.toLowerCase().slice(0, 60);
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    mined.push({ text: clean, source });
  }

  for (const src of input.evidence) {
    if (!src?.text) continue;
    for (const s of sentences(src.text)) {
      const t = tidySentence(s);
      if (t.length < 60 || t.length > 340) continue;
      if (!ACTIVITY_RE.test(t)) continue;
      if (NOT_ACTIVITY_RE.test(t)) continue;
      const key = t.toLowerCase().slice(0, 60);
      if (seen.has(key)) continue;
      seen.add(key);
      mined.push({ text: t, source: src.label });
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
      madeExplicit.push({ text: action, echo: best.m.text, source: best.m.source });
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

  const intro = `<p>This section separates what ${escapeHtml(
    input.brand,
  )} is already doing from what this recommendation actually changes, so the proposal is not read as if it were being made in a vacuum. Existing activity is quoted from the research ingested for this session and attributed to its source.</p>`;

  const existingHtml = model.existing.length
    ? callout(
        "Already in market — what the research records",
        `<ul>${model.existing
          .map(
            (e) =>
              `<li>${inlineMd(e.text)} <span class="muted">— ${escapeHtml(e.source)}</span></li>`,
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
              `<li>${inlineMd(e.text)}<br><span class="muted">Builds on: ${inlineMd(
                e.echo,
              )} — ${escapeHtml(e.source)}</span></li>`,
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

  return intro + existingHtml + explicitHtml + newHtml;
}
