/**
 * Jaguar-only rebuild of the Brand Strategy and Creative Intelligence Summary.
 *
 * Structural redesign, approved outline: 21 numbered sections plus a table of
 * contents on page one, workflow folded into the body in sequence (no
 * appendix), plain-language descriptors under every system-jargon heading, and
 * the locked creative idea rendered complete and verbatim.
 *
 * This builder is deliberately separate from `exec-summary-document.ts` until
 * the structure is signed off; once approved it becomes the template.
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

export interface JaguarShortlistItem {
  lens: string;
  line: string;
  expression?: string | null;
  ambition?: string | null;
  fame?: string | null;
  compliance?: string | null;
  winner?: boolean;
}

export interface JaguarCreativeExtras {
  lensesSwept: number;
  directionsGenerated: number;
  directionsRated: number;
  promptsWritten?: number;
  guidance?: string | null;
  shortlist: JaguarShortlistItem[];
  /** Rating rationales recorded against the winning direction. */
  winnerReasons?: Array<{ title: string; detail?: string }>;
  /** Channel name → its strategic role in the plan (one line, from the brief). */
  channels?: Array<{ name: string; role?: string | null }>;
  intelligenceReportPresent?: boolean;
  researchSources?: number;
}

const EMPTY_EXTRAS: JaguarCreativeExtras = {
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
  return stripDocumentMetadata(text)
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
function clampText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const head = text.slice(0, maxChars);
  const cut = Math.max(head.lastIndexOf(". "), head.lastIndexOf(".\n"), head.lastIndexOf("\n"));
  return (cut > maxChars * 0.4 ? head.slice(0, cut + 1) : head).trim();
}

function stageBlock(session: ExecSessionRow, key: string, units: number, chars: number): string {
  const raw = clean(str(session, key));
  if (!raw) return "";
  const condensed = condenseStage(raw, { maxUnits: units, maxChars: chars })
    .split("\n\n")
    .map((block) => (block.startsWith("### ") ? block : clampText(block, Math.round(chars * 0.6))))
    .join("\n\n");
  return renderMarkdown(clampText(condensed, chars));
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

const BREAK_BEFORE = new Set(["01", "04", "09", "16", "19"]);

function renderSections(defs: SectionDef[]): string {
  return defs
    .map((d, i) =>
      section(
        { kicker: d.kicker, index: d.index, title: d.title, breakBefore: BREAK_BEFORE.has(d.index) },
        `<p class="lede">${escapeHtml(d.lede)}</p>${d.body || nothing("No stored output for this stage.")}`,
      ),
    )
    .join("\n");
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
@media print { .defrow { grid-template-columns: 160px 1fr; } }
`;

function band(title: string, stats: Stat[]): string {
  const grid = statGrid(stats);
  if (!grid) return "";
  return `<div class="statband keep-together"><h4>${escapeHtml(title)}</h4>${grid}</div>`;
}

/* ─────────────────────────────────────────────────────────── builder ── */

export function buildJaguarSummaryDocument(
  session: ExecSessionRow,
  extras: JaguarCreativeExtras = EMPTY_EXTRAS,
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
    { value: verification.tests.length, label: "fact-verification tests" },
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

  /* 05 — Category insight */
  const insightHtml = findings
    ? `${pullQuote(findings, {
        label: "Category-level insight — true of the category, not of this brand alone",
        variant: "hero",
      })}${p(
        "This is what the whole category believes and behaves on. The strategy that follows is built to break it, not to restate it.",
      )}`
    : "";

  /* 06 — Synthesis */
  const synthesisHtml = `${stageBlock(session, "stage_4_output", 10, 1600)}${stageBlock(session, "stage_6_output", 7, 900)}`;

  /* 07 — Proposition generation */
  const generationHtml = list(
    field.slice(0, 10).map((f) => `**${f.proposition}** — ${f.origin}`),
  );

  /* 08 — Distinctiveness testing */
  const distinctHtml = `${stageBlock(session, "stage_9_leftofcentre_output", 8, 1200)}${stageBlock(
    session,
    "stage_9_output",
    8,
    1200,
  )}${stageBlock(session, "stage_11_output", 8, 1200)}`;


  /* 09 — Scoring */
  const scoringHtml = scoring.rows.length
    ? `${comparisonTable(
        [
          { key: "d", label: "Dimension" },
          { key: "s", label: "Score", numeric: true },
          { key: "n", label: "Assessment" },
        ],
        scoring.rows.map((r) => ({ cells: { d: r.dimension, s: r.score, n: r.note } })),
        scoring.scoredSmp ? `Scored against: ${scoring.scoredSmp}` : undefined,
      )}${
        scoring.composite || scoring.verdict
          ? statGrid(
              [
                scoring.composite ? { value: scoring.composite, label: "composite score" } : null,
                scoring.weighted ? { value: scoring.weighted, label: "weighted score" } : null,
                scoring.verdict ? { value: scoring.verdict, label: "stage 10 verdict" } : null,
              ].filter(Boolean) as Stat[],
            )
          : ""
      }`
    : "";

  /* 10 — The winning proposition */
  const winnerHtml = winning.smp
    ? `${pullQuote(winning.smp, { label: "The proposition that won", variant: "hero" })}${p(
        winning.owns,
      )}${p(winning.alignment)}`
    : "";

  /* 11 — Not carried forward */
  const rejected = field.filter((f) => !f.selected);
  const rejectedHtml = rejected.length
    ? list(
        rejected
          .slice(0, 8)
          .map(
            (f) =>
              `**${f.proposition}** — ${
                firstSentencesOf(f.reason ?? "", 1) ?? "considered, not carried forward"
              }`,
          ),
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
    : stageBlock(session, "stage_13_output", 9, 1400);

  /* 13 — Brand fit */
  const fitHtml = `${stageBlock(session, "stage_14_output", 9, 1400)}${stageBlock(session, "stage_14b_output", 5, 600)}`;

  /* 14 — Territory mapping */
  const territoryHtml = `${stageBlock(session, "stage_17_output", 10, 1600)}${stageBlock(session, "stage_18_output", 7, 900)}`;

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
  const creativeHtml = lockedIdea || lockedLine
    ? `${
        lockedLine
          ? pullQuote(lockedLine, {
              label: `Locked campaign line${lockedLens ? ` — ${lockedLens}` : ""}`,
              variant: "hero",
            })
          : ""
      }${lockedIdea ? renderMarkdown(lockedIdea) : ""}`
    : "";

  /* 18 — Why it won */
  const whyHtml = extras.winnerReasons?.length ? reasonGrid(extras.winnerReasons) : "";

  /* 19 — Channels */
  const channelHtml = channels.length
    ? defList(
        channels.map((c) => ({
          label: c.name,
          body: c.role || "Carries the strategy into market with a dedicated detonation brief.",
        })),
      )
    : "";

  /* 20 — Brand architecture and distinctive assets */
  const architectureHtml = `${stageBlock(session, "stage_22_output", 8, 1200)}${p(firstSentencesOf(str(session, "stage_22_distinctive_assets"), 4))}`;

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
      lede: "The territory the strategy occupies, and the detonation point chosen within it.",
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

  const body = `${cover({
    brand: "BRAND GRENADE",
    label: "Brand Strategy and Creative Intelligence Summary",
    title: `${brand} — Brand Strategy and Creative Intelligence Summary`,
    subtitle: category || undefined,
    confidential: true,
  })}
${tableOfContents(defs)}
${renderSections(defs)}`;

  return stripSelectionArtifacts(
    docShell(
    {
      title: `Brand Strategy and Creative Intelligence Summary — ${brand}`,
      toolbarNote: `${brand} — Brand Strategy and Creative Intelligence Summary`,
      extraCss: EXTRA_CSS,
      footerHtml:
        "Brand Grenade Strategy Intelligence System — Confidential. Assembled from stored session data only; the locked creative idea is reproduced verbatim.",
    },
      body,
    ),
  );
}
