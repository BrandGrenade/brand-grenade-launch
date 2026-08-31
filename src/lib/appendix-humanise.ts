// BRAND GRENADE — APPENDIX HUMANISATION (shared, mode-independent)
// ============================================================================
// The appendix runs in two modes. "condensed" passes every line through
// condenseStage, which drops machine banners as a side effect. "full" passes
// the stored stage output straight through — which is how raw internal
// banners, templated score blocks and self-negating audit bullets reached a
// client-facing document.
//
// Everything in this module is applied to BOTH modes, before condensing, so a
// defect can never be fixed in one path and left live in the other.

/* ─────────────────────────────────────────── 1. machine banners → prose ── */

/**
 * Internal pipeline banners written in `==== SHOUTING ====` form. They are
 * real section markers, so they are rewritten rather than deleted — a reader
 * still needs to know where one block of evidence ends and the next begins.
 */
const BANNER_PROSE: Array<{ match: RegExp; prose: string }> = [
  {
    match: /code[- ]computed\s+stage\s*10\s+summary/i,
    prose:
      "Stage 10 summary — scores computed in code against the six-dimension framework. Where the model's written verdict and the computed result disagree, the computed result stands.",
  },
  {
    match: /left[- ]of[- ]centre\s+candidates/i,
    prose:
      "Left-of-Centre candidates — Stage 9 distinctiveness pass, assessed against the same rubric as the Funnel batch.",
  },
  { match: /deliverable\s*\d*\s*[—–-]?\s*presentation\s+document/i, prose: "Presentation document." },
  { match: /presentation\s+order(?:\s+log)?/i, prose: "Presentation order." },
];

/** Strips `====`/`═══` decoration from a banner line and returns its label. */
function bannerLabel(line: string): string | null {
  const m = line.match(/^\s*(?:[=═]{2,})\s*(.+?)\s*(?:[=═]{2,})\s*$/);
  if (!m) return null;
  const label = m[1].trim();
  return label.length >= 3 ? label : null;
}

/**
 * Rewrites machine banners as plain prose headings. A banner with no known
 * mapping is sentence-cased rather than shipped in shouting caps.
 */
export function humaniseBanners(text: string): string {
  return text
    .split("\n")
    .map((raw) => {
      const label = bannerLabel(raw);
      if (label === null) return raw;
      for (const { match, prose } of BANNER_PROSE) {
        if (match.test(label)) return prose;
      }
      // Unknown banner: keep the information, drop the shouting.
      const cleaned = label
        .replace(/\s*\([^)]*\)\s*$/, "")
        .replace(/\s*[—–-]\s*(?:AUTHORITATIVE|OVERRIDES[^—–-]*)$/i, "")
        .trim();
      if (!cleaned) return "";
      const cased = /[a-z]/.test(cleaned)
        ? cleaned
        : cleaned.charAt(0) + cleaned.slice(1).toLowerCase();
      return `${cased.replace(/\.$/, "")}.`;
    })
    .join("\n");
}

/* ───────────────────────────────────── 2. honest scoring-scale labelling ── */

/**
 * The six dimension weights total 90, not 100, so a composite can never
 * exceed 90. Printing it as "/100" overstates the ceiling. The scale is
 * relabelled at every point of display rather than silently rebalanced,
 * because rebalancing would change every historical score on record.
 */
export const SCORE_CEILING = 90;
export const SCALE_NOTE = `on the 90-point weighted scale (six weights total 90 by design)`;

export function relabelScoreScale(text: string): string {
  return text
    .replace(
      /\b(\d+(?:\.\d+)?)\s*\/\s*100\b(\s*weighted)?/gi,
      (_m, n: string, w: string | undefined) =>
        `${n}/${SCORE_CEILING}${w ? " weighted" : ""}`,
    )
    .replace(
      /\bcomposite\s+(?:out\s+of|\/)\s*100\b/gi,
      `composite on the ${SCORE_CEILING}-point weighted scale`,
    )
    .replace(
      /\bweighted\s+into\s+a\s+single\s+figure\s+on\s+a\s+100-point\s+scale\b/gi,
      `weighted into a single figure on a ${SCORE_CEILING}-point scale`,
    );
}

/* ───────────────────────────────── 3. self-negating audit findings ── */

const NEGATION_CLAUSE =
  /(?:no (?:true |genuine |actual )?[a-z- ]*instance (?:was )?found[^.]*|was checked and (?:was )?not found[^.]*|is clean[^.]*)/i;

/**
 * Collapses an audit bullet that both denies and confirms a finding into the
 * single confirmed finding. The pipeline's auditor sometimes narrates its own
 * search ("no true banned instance found here … the confirmed second flag
 * is X"); only the confirmed half is a finding, the rest is thinking aloud.
 */
export function resolveSelfNegatingFindings(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      if (!/^\s*[-—•*]/.test(line)) return line;
      const confirmed = line.match(
        /\b(?:the\s+)?confirmed\s+(?:second\s+|only\s+)?(?:flag|finding|instance)\s+is\b/i,
      );
      if (!confirmed) return line;
      if (!NEGATION_CLAUSE.test(line)) return line;

      const bulletMark = line.match(/^\s*[-—•*]\s*/)?.[0] ?? "- ";
      const lead = line.slice(0, confirmed.index ?? 0);
      // Keep the bullet's own label ("**MINOR — Stage 14C …**") — it is the
      // finding's identity, not part of the abandoned search narrative.
      const label = lead.match(/^\s*[-—•*]\s*(\*\*[^*]+\*\*)/)?.[1] ?? "";
      const rest = line.slice(confirmed.index ?? 0).replace(
        /^\s*(?:the\s+)?confirmed\s+(?:second\s+|only\s+)?(?:flag|finding|instance)\s+is\s*/i,
        "",
      );
      const body = rest.charAt(0).toUpperCase() + rest.slice(1);
      return `${bulletMark}${label ? `${label} ` : ""}Confirmed finding: ${body}`;
    })
    .join("\n");
}

/* ──────────────────────────── 4. per-proposition scores from Stage 10 ── */

export interface Stage10Score {
  proposition: string;
  fame: number;
  truth: number;
  impossibility: number;
  permission: number;
  cleanAir: number;
  precedent: number;
  composite: number;
}

function normaliseLine(s: string): string {
  return s
    .replace(/[“”„]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9 ]/gi, "")
    .trim()
    .toLowerCase();
}

const DIM_PATTERNS: Array<[keyof Omit<Stage10Score, "proposition" | "composite">, RegExp]> = [
  ["fame", /^\**Fame:?\**\s*:?\s*\**\s*(\d+(?:\.\d+)?)\s*\/\s*10/im],
  ["truth", /^\**Truth Strength:?\**\s*:?\s*\**\s*(\d+(?:\.\d+)?)\s*\/\s*10/im],
  ["impossibility", /^\**Competitive Impossibility:?\**\s*:?\s*\**\s*(\d+(?:\.\d+)?)\s*\/\s*10/im],
  ["permission", /^\**Brand Permission:?\**\s*:?\s*\**\s*(\d+(?:\.\d+)?)\s*\/\s*10/im],
  ["cleanAir", /^\**Clean Air:?\**\s*:?\s*\**\s*(\d+(?:\.\d+)?)\s*\/\s*10/im],
  ["precedent", /^\**Commercial Precedent:?\**\s*:?\s*\**\s*(\d+(?:\.\d+)?)\s*\/\s*10/im],
];

/** Parses every scored proposition out of a Stage 10 transcript. */
export function parseStage10Scores(stage10: string): Stage10Score[] {
  if (!stage10) return [];
  const out: Stage10Score[] = [];
  const blocks = stage10.split(/\n(?=\**SMP:\s*)/);
  for (const block of blocks) {
    const head = block.match(/^\**SMP:\**\s*["“]?(.+?)["”]?\s*(?:[—–-]\s*FIELD:|$)/m);
    if (!head) continue;
    const proposition = head[1].trim();
    const dims: Record<string, number> = {};
    let ok = true;
    for (const [key, re] of DIM_PATTERNS) {
      const m = block.match(re);
      if (!m) { ok = false; break; }
      dims[key] = Number(m[1]);
    }
    if (!ok) continue;
    const compM = block.match(/CODE COMPOSITE:\s*(\d+(?:\.\d+)?)/i);
    const composite = compM
      ? Number(compM[1])
      : Number(
          (
            dims.fame * 3 +
            dims.truth * 2 +
            dims.impossibility * 1.5 +
            dims.permission * 1 +
            dims.cleanAir * 1 +
            dims.precedent * 0.5
          ).toFixed(2),
        );
    out.push({
      proposition,
      fame: dims.fame,
      truth: dims.truth,
      impossibility: dims.impossibility,
      permission: dims.permission,
      cleanAir: dims.cleanAir,
      precedent: dims.precedent,
      composite,
    });
  }
  return out;
}

const SCORE_BLOCK =
  /^[ \t]*\**Fame:?\**\s*:?\s*\**\s*\d+(?:\.\d+)?\/10\s*\(30%\)[\s\S]*?Weighted Composite:\s*\d+(?:\.\d+)?\s*\/\s*\d+/gim;

/**
 * Replaces the templated score block inside each Stage 12 proposition card
 * with that proposition's real Stage 10 scores.
 *
 * Stage 12 is written by the model after scoring and repeats one card's score
 * block verbatim under every card. Stage 10 is the authoritative record, so
 * the block is re-derived per card rather than trusted as written.
 */
export function injectStage10Scores(stage12: string, stage10: string): string {
  const scores = parseStage10Scores(stage10);
  if (!scores.length || !stage12) return stage12;

  const byKey = new Map<string, Stage10Score>();
  for (const s of scores) byKey.set(normaliseLine(s.proposition), s);

  const lines = stage12.split("\n");
  // Walk the document; remember the most recent quoted proposition line so a
  // score block can be attributed to the card it sits inside.
  let current: Stage10Score | null = null;
  const rendered: string[] = [];

  const isQuotedLine = (l: string) => /^\s*["“][^"”]{4,160}["”]\s*$/.test(l.trim());

  for (const line of lines) {
    if (isQuotedLine(line)) {
      const key = normaliseLine(line);
      current = byKey.get(key) ?? null;
      if (!current) {
        for (const [k, v] of byKey) {
          if (k && (k.includes(key) || key.includes(k))) { current = v; break; }
        }
      }
    }
    rendered.push(line);
  }

  // Second pass — rewrite each score block using the card it belongs to.
  const text = rendered.join("\n");
  let cursor: Stage10Score | null = null;
  const outLines: string[] = [];
  const src = text.split("\n");
  for (let i = 0; i < src.length; i++) {
    const line = src[i];
    if (isQuotedLine(line)) {
      const key = normaliseLine(line);
      cursor = byKey.get(key) ?? null;
      if (!cursor) {
        for (const [k, v] of byKey) {
          if (k && (k.includes(key) || key.includes(k))) { cursor = v; break; }
        }
      }
    }
    const isBlockStart = /^[ \t]*\**Fame:?\**\s*:?\s*\**\s*\d+(?:\.\d+)?\/10\s*\(30%\)/i.test(line);
    if (isBlockStart && cursor) {
      // Consume through the composite line.
      let j = i;
      let end = -1;
      while (j < src.length && j < i + 6) {
        if (/Weighted Composite:/i.test(src[j])) { end = j; break; }
        j++;
      }
      if (end !== -1) {
        const s = cursor;
        outLines.push(
          `Fame: ${s.fame}/10 (30%) | Truth Strength: ${s.truth}/10 (20%) | Competitive Impossibility: ${s.impossibility}/10 (15%)`,
        );
        outLines.push(
          `Brand Permission: ${s.permission}/10 (10%) | Clean Air: ${s.cleanAir}/10 (10%) | Commercial Precedent: ${s.precedent}/10 (5%)`,
        );
        outLines.push(`Weighted Composite: ${s.composite}/${SCORE_CEILING}`);
        i = end;
        continue;
      }
    }
    outLines.push(line);
  }
  return outLines.join("\n");
}

/** Everything above, applied in order. Safe to run on any stage output. */
export function humaniseStageOutput(
  key: string,
  raw: string,
  session: { stage_10_output?: string | null } = {},
): string {
  let text = raw;
  if (key === "stage_12_output") {
    text = injectStage10Scores(text, String(session.stage_10_output ?? ""));
  }
  text = humaniseBanners(text);
  text = resolveSelfNegatingFindings(text);
  text = relabelScoreScale(text);
  return text;
}

void SCORE_BLOCK;
