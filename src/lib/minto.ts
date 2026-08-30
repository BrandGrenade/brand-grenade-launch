// BRAND GRENADE — CANONICAL MINTO DOCUMENT STRUCTURE
// ============================================================================
// Single source of truth for the ten-section Minto pyramid every primary
// deliverable must satisfy. No document builder is allowed to invent its own
// ordering, its own section names, or its own idea of which sections are
// optional. Builders supply *content* per section id; this module owns the
// order, the numbering, the labels, the fallbacks and the shell.
//
// Sections (mandatory, ordered):
//   01 Recommendation      — the governing output, stated first
//   02 Business issue      — the problem the recommendation answers
//   03 Key insight         — the truth the recommendation rests on
//   04 Proposition         — the proposition itself
//   05 Why this wins       — the argument for it over the alternatives
//   06 Validation summary  — the evidence, as a table wherever scores exist
//   07 What was rejected   — and the reason each was not carried
//   08 Implications        — what changes if this is adopted
//   09 Next step           — the single decision or action requested
//   10 Appendix            — backing detail
//
// Layout rules enforced here (previously per-document bugs):
//   • stat bands are auto-columned to the number of stats actually present,
//     so a band never renders with an empty cell;
//   • the appendix does NOT force a page break by default, so the front
//     matter never ends on a half-empty page.

import {
  cover,
  docShell,
  escapeHtml,
  section,
  statGrid,
  type CoverOptions,
  type Stat,
} from "./doc-system";
import { gateDocument } from "./document-gate";
import { expandAcronymsFirstUse } from "./acronyms";
import type { DocumentSpec } from "./document-spec";

export const MINTO_SECTION_IDS = [
  "recommendation",
  "background",
  "business_issue",
  "key_insight",
  "proposition",
  "why_this_wins",
  "current_state",
  "validation",
  "rejected",
  "implications",
  "next_step",
  "appendix",
] as const;

export type MintoSectionId = (typeof MINTO_SECTION_IDS)[number];

export interface MintoSectionDef {
  id: MintoSectionId;
  /** Printed index — always two digits, always in this order. */
  index: string;
  /** Kicker label above the section. */
  kicker: string;
  /** Used when a builder has nothing for the slot. Never silently dropped. */
  fallback: string;
}

export const MINTO_SECTIONS: readonly MintoSectionDef[] = [
  {
    id: "recommendation",
    index: "01",
    kicker: "The recommendation",
    fallback: "No recommendation has been resolved for this session yet.",
  },
  {
    id: "background",
    index: "02",
    kicker: "Background and context",
    fallback: "No background was captured for this session.",
  },
  {
    id: "business_issue",
    index: "03",
    kicker: "The business issue",
    fallback: "No business issue was captured in the source material.",
  },
  {
    id: "key_insight",
    index: "04",
    kicker: "The key insight",
    fallback: "No validated insight was available in the source material.",
  },
  {
    id: "proposition",
    index: "05",
    kicker: "The proposition",
    fallback: "No proposition has been selected for this session yet.",
  },
  {
    id: "why_this_wins",
    index: "06",
    kicker: "Why this wins",
    fallback: "The comparative argument could not be derived from session data.",
  },
  {
    id: "current_state",
    index: "07",
    kicker: "Current state versus recommended change",
    fallback:
      "No record of current activity was available in the source material for this session, so no baseline comparison could be drawn.",
  },
  {
    id: "validation",
    index: "08",
    kicker: "Validation summary",
    fallback: "No validation or scoring data was recorded for this session.",
  },
  {
    id: "rejected",
    index: "09",
    kicker: "What was rejected, and why",
    fallback: "No rejected alternatives were recorded for this session.",
  },
  {
    id: "implications",
    index: "10",
    kicker: "Implications",
    fallback: "No downstream implications were recorded for this session.",
  },
  {
    id: "next_step",
    index: "11",
    kicker: "Decisive recommendation — next step",
    fallback: "No next step was recorded for this session.",
  },
  {
    id: "appendix",
    index: "12",
    kicker: "Appendix — backing detail",
    fallback: "No backing detail is available for this session.",
  },
] as const;


/** Section content keyed by canonical id. Missing keys render the fallback. */
export type MintoContent = Partial<Record<MintoSectionId, string>>;

export interface MintoDocumentSpec {
  /** Document title (window title + toolbar). */
  title: string;
  /** Cover metadata. */
  cover: CoverOptions;
  /** Headline numbers under the governing statement. Auto-columned. */
  headlineStats?: Stat[];
  content: MintoContent;
  screen?: boolean;
  footerHtml?: string;
  /** Document-specific CSS appended to the shared stylesheet. */
  extraCss?: string;
  /**
   * Start the appendix on a fresh page. Off by default — forcing the break
   * was what left the front matter ending on a half-empty page.
   */
  appendixOnNewPage?: boolean;
  /**
   * Canonical section spec for this document type. When supplied, the
   * rendered output is gated: a missing canonical section or an orphaned
   * heading throws rather than shipping a document that looks complete.
   */
  canonical?: DocumentSpec;
  /**
   * Plain statement of what this document is, where it came from and what
   * decision it serves. Used to render section 02 when the builder has no
   * richer background of its own — the universal standard never allows the
   * background to be assumed obvious.
   */
  purpose?: {
    /** e.g. "Board Strategy Recommendation". */
    what: string;
    /** e.g. "pipeline session 1a2b3c for Jaguar". */
    source: string;
    /** e.g. "a decision to adopt the recommended proposition". */
    decision: string;
  };
}


/**
 * Auto-columned stat band. Never renders a partially filled row: the column
 * count always equals the number of stats that actually carry a value.
 */
export function statBand(stats: Stat[]): string {
  const present = stats.filter(
    (s) => s && s.value !== undefined && s.value !== null && String(s.value).trim() !== "",
  );
  if (present.length === 0) return "";
  const cols = present.length >= 4 ? 4 : present.length === 3 ? 3 : 2;
  return statGrid(present.slice(0, 4), present.length === 1 ? 2 : (cols as 2 | 3 | 4));
}

function missingBlock(text: string): string {
  return `<p class="minto-missing">${escapeHtml(text)}</p>`;
}

/** Standard background paragraph, used when a builder supplies no richer one. */
function purposeBlock(spec: MintoDocumentSpec): string {
  const p = spec.purpose;
  if (!p) return "";
  return (
    `<p>This document is the <strong>${escapeHtml(p.what)}</strong> for ${escapeHtml(
      spec.cover.title.replace(/\s*—.*$/, ""),
    )}. It was generated by the Brand Grenade Strategy Intelligence System from ${escapeHtml(
      p.source,
    )}, and reproduces only what that source material contains.</p>` +
    `<p>It exists to serve one decision: ${escapeHtml(p.decision)}. Everything that follows is ordered to that decision — the recommendation is stated first, the reasoning and evidence behind it follow, and the document closes with the action requested.</p>`
  );
}

/**
 * Renders the canonical eleven-section document. Every section is emitted in
 * order, whether or not the builder supplied content — completeness is a
 * property of the template, not of any individual document.
 */
export function buildMintoDocument(spec: MintoDocumentSpec): string {
  const body: string[] = [cover(spec.cover)];
  // Acronyms are expanded on first use across the whole document, not per
  // section — the appendix path used to miss this entirely.
  const acronymsSeen = new Set<string>();

  for (const def of MINTO_SECTIONS) {
    const supplied =
      (spec.content[def.id] ?? "").trim() || (def.id === "background" ? purposeBlock(spec) : "");
    const html = expandAcronymsFirstUse(supplied || missingBlock(def.fallback), acronymsSeen);

    const isAppendix = def.id === "appendix";
    body.push(
      section(
        {
          kicker: def.kicker,
          index: def.index,
          breakBefore: isAppendix ? spec.appendixOnNewPage === true : false,
        },
        html,
      ),
    );
    // The governing statement carries the headline numbers directly beneath it.
    if (def.id === "recommendation" && spec.headlineStats?.length) {
      body.push(statBand(spec.headlineStats));
    }
  }

  const html = docShell(
    {
      title: spec.title,
      toolbarNote: spec.title,
      screen: spec.screen,
      extraCss: spec.extraCss,
      footerHtml: spec.footerHtml,
    },
    body.join("\n"),
  );

  return spec.canonical ? gateDocument(html, spec.canonical) : html;
}

export interface MintoAudit {
  present: MintoSectionId[];
  /** Sections rendered from the fallback rather than real content. */
  empty: MintoSectionId[];
  complete: boolean;
}

/**
 * Structural audit used by tests and the render harness: confirms all ten
 * canonical sections appear, in order, and flags any rendered from fallback.
 */
export function auditMintoDocument(html: string): MintoAudit {
  const present: MintoSectionId[] = [];
  const empty: MintoSectionId[] = [];
  let cursor = 0;
  for (const def of MINTO_SECTIONS) {
    const needle = `<span class="idx">${def.index}</span>${escapeHtml(def.kicker)}`;
    const at = html.indexOf(needle, cursor);
    if (at === -1) continue;
    present.push(def.id);
    cursor = at + needle.length;
    const next = html.indexOf('<p class="kicker">', cursor);
    const chunk = html.slice(cursor, next === -1 ? undefined : next);
    if (chunk.includes('class="minto-missing"')) empty.push(def.id);
  }
  return { present, empty, complete: present.length === MINTO_SECTIONS.length };
}
