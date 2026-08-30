// BRAND GRENADE — UNIVERSAL DOCUMENT STANDARD (shared safeguards)
// ============================================================================
// One place, applied to every document type, enforcing the two generation
// safeguards and the universal-structure rules:
//
//   S1  No raw internal field value, enum string or system code may render
//       into client-facing prose. Tokens are humanised through a shared
//       registry (or generically) before the document is returned, and any
//       survivor fails the gate rather than shipping.
//
//   S2  A section presenting non-primary options may never use that option's
//       own verdict label as its stated rationale. A verdict-only rationale is
//       replaced with an honest line saying no comparative rationale exists.
//
//   U1  Every document must carry a Background and Context section.
//   U2  Every document must end with a decisive Recommendation / Next Step.
//
// Pure string functions over rendered HTML so they apply identically to the
// Minto documents and to the three builders that own their own shell.

/** Known internal enums, mapped to the words a client should read. */
export const SYSTEM_TOKEN_MAP: Record<string, string> = {
  // Intelligence Lab — territory verdicts and types
  claim: "Claim",
  do_not_claim: "Do not claim",
  claim_with_conditions: "Claim with conditions",
  adjacent_response: "Adjacent response",
  category_leadership: "Category leadership",
  white_space: "White space",
  // Named for the crab that occupies a shell another animal has left. Spelled
  // out because the bare term means nothing to a reader outside the method.
  hermit_crab: "Vacated-territory reoccupation (hermit crab)",

  first_mover: "First-mover advantage",
  brand_permission: "Brand permission",
  historical_validation: "Historical validation",
  cultural_adaptation: "Cultural adaptation",
  measurement_framework: "Measurement framework",
  recommendation_rationale: "Recommendation rationale",
  prebrief_for_briefing_room: "Briefing Room pre-brief",
  strategic_recommendation: "Strategic recommendation",
  completeness_assessment: "Completeness assessment",
  government_addendum: "Government addendum",
  is_gateway_territory: "Gateway territory",
  cald_mapping: "CALD mapping",
  negative_space_flags: "Negative-space flags",
  risk_classification: "Risk classification",
  window_duration: "Window duration",
  competitive_response_scenario: "Competitive response scenario",
  // Horizon buckets
  immediate_0_4_weeks: "Immediate (0–4 weeks)",
  medium_term_12_24_months: "Medium term (12–24 months)",
  // Pipeline
  selected_smp: "Selected proposition",
  locked_big_idea: "Locked creative idea",
  locked_campaign_line: "Locked campaign line",
};

const SNAKE = /\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/g;
const SCREAM = /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g;

function humaniseToken(token: string): string {
  const key = token.toLowerCase();
  const mapped = SYSTEM_TOKEN_MAP[key];
  if (mapped) return mapped;
  const words = key.split("_").filter(Boolean).join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Walks the text nodes of the rendered HTML only — tag names, attributes,
 * class names, CSS and script bodies are left untouched — and rewrites every
 * internal token into readable words.
 */
export function humaniseSystemTokens(html: string): string {
  return mapTextNodes(html, (text) =>
    text.replace(SNAKE, (m) => humaniseToken(m)).replace(SCREAM, (m) => humaniseToken(m)),
  );
}

/** Any internal token still present in client-facing prose. */
export function findSystemTokens(html: string): string[] {
  const found = new Set<string>();
  mapTextNodes(html, (text) => {
    for (const m of text.match(SNAKE) ?? []) found.add(m);
    for (const m of text.match(SCREAM) ?? []) found.add(m);
    return text;
  });
  return [...found];
}

const SKIP_TAGS = /^(script|style|pre|code)$/i;

/** Applies `fn` to every text node outside script/style/pre/code. */
function mapTextNodes(html: string, fn: (text: string) => string): string {
  let out = "";
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt === -1) {
      out += fn(html.slice(i));
      break;
    }
    out += fn(html.slice(i, lt));
    const gt = html.indexOf(">", lt);
    if (gt === -1) {
      out += html.slice(lt);
      break;
    }
    const tag = html.slice(lt, gt + 1);
    out += tag;
    i = gt + 1;
    const name = /^<\s*([a-zA-Z0-9]+)/.exec(tag)?.[1];
    if (name && SKIP_TAGS.test(name) && !tag.endsWith("/>")) {
      const close = html.toLowerCase().indexOf(`</${name.toLowerCase()}`, i);
      if (close !== -1) {
        out += html.slice(i, close);
        i = close;
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// S2 — verdict-as-rationale

export const NO_COMPARATIVE_RATIONALE =
  "No comparative rationale was recorded for this option. It is shown here because it was assessed and not carried forward as the recommendation — not because a reason against it was captured.";

const VERDICT_WORDS = [
  "claim",
  "do not claim",
  "claim with conditions",
  "not carried forward",
  "not recommended",
  "rejected",
  "eliminated",
  "pass",
  "fail",
  "no",
  "yes",
  "assessed",
];

const stripTags = (h: string) =>
  h
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();

/** True when a "reason" is nothing more than a restatement of the verdict. */
export function isVerdictOnlyRationale(text: string): boolean {
  const t = stripTags(text)
    .toLowerCase()
    .replace(/[.\s]+$/, "")
    .trim();
  if (!t || t.length > 48) return false;
  return VERDICT_WORDS.includes(t);
}

/**
 * Rewrites any rationale/detail block whose whole text is a verdict label into
 * the honest line. Applies to reason-grid details, list items and paragraphs,
 * so it covers every builder's markup without knowing any of them.
 */
export function repairVerdictRationales(html: string): string {
  return html.replace(
    /<(p|li|div)([^>]*)>([\s\S]*?)<\/\1>/g,
    (whole, tag: string, attrs: string, inner: string) => {
      if (/<(p|li|div|ul|ol|table)\b/i.test(inner)) return whole;
      if (!isVerdictOnlyRationale(inner)) return whole;
      // Only detail/rationale slots, never a table cell or a verdict column.
      if (!/class="[^"]*\b(d|detail|rationale|reason-detail)\b[^"]*"/.test(attrs) && tag !== "li") {
        return whole;
      }
      return `<${tag}${attrs}>${NO_COMPARATIVE_RATIONALE}</${tag}>`;
    },
  );
}

// ---------------------------------------------------------------------------
// U1 / U2 — universal sections

const BACKGROUND_RE = /\bbackground\b/i;
const NEXT_STEP_RE = /next step|recommendation\s*(?:and|&amp;|&)\s*next step|decisive recommendation/i;

export function universalStructureFailures(html: string): string[] {
  const text = stripTags(html);
  const failures: string[] = [];
  if (!BACKGROUND_RE.test(text)) failures.push('missing universal section "Background and context"');
  if (!NEXT_STEP_RE.test(text)) failures.push('missing universal closing section "Next step"');
  return failures;
}

/** S1 + S2, in the order they must be applied. */
export function applyUniversalSafeguards(html: string): string {
  return repairVerdictRationales(humaniseSystemTokens(html));
}
