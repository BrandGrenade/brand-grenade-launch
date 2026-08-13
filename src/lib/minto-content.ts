// BRAND GRENADE — SHARED MINTO CONTENT DERIVATION
// ============================================================================
// One extraction pass over a pipeline session, producing the ten canonical
// Minto sections. Every document type that reports on a strategy run uses
// this — Board Strategy Recommendation, Strategy Executive Summary,
// Consulting Delivery and the Master Detonation Brief — so the argument is
// identical across deliverables and only emphasis and appendix differ.
//
// Nothing is invented. If a value cannot be found in session data the slot is
// left empty and the canonical template renders its declared fallback.

import {
  callout,
  comparisonTable,
  escapeHtml,
  inlineMd,
  proofLine,
  pullQuote,
  reasonGrid,
  renderMarkdown,
  sanitiseText,
  statGrid,
  type CmpRow,
  type Reason,
  type Stat,
} from "./doc-system";
import type { MintoContent } from "./minto";
import { stripDocumentMetadata } from "./strip-document-metadata";

export interface MintoSession {
  brand_name?: string | null;
  category?: string | null;
  selected_smp?: string | null;
  stage_1_output?: string | null;
  stage_2_output?: string | null;
  stage_3_output?: string | null;
  stage_4_output?: string | null;
  stage_5_output?: string | null;
  stage_6_output?: string | null;
  stage_7_output?: string | null;
  stage_8_output?: string | null;
  stage_9_output?: string | null;
  stage_9_leftofcentre_output?: string | null;
  stage_10_output?: string | null;
  stage_11_output?: string | null;
  stage_12_output?: string | null;
  stage_13_output?: string | null;
  stage_14_output?: string | null;
  stage_15_output?: string | null;
  stage_17_selected_territory?: string | null;
  stage_17b_output?: string | null;
  stage_18_selected_detonation?: string | null;
  stage_19_output?: string | null;
  stage_20_output?: string | null;
  stage_22_brand_architecture?: string | null;
  stage_22_distinctive_assets?: string | null;
  /** Room 04 lock — the single winning creative idea and its campaign line. */
  locked_big_idea?: string | null;
  locked_campaign_line?: string | null;
  locked_big_idea_lens?: string | null;
  locked_big_idea_at?: string | null;
  locked_big_idea_run_id?: string | null;
  updated_at?: string | null;
  selection_rationale?: unknown;
}


/* ────────────────────────────────────────────────────────── helpers ── */

const INTERNAL_LINE =
  /(PIPELINE DATA HEADER|BRIEF DEPTH LEVEL:|CATEGORY KNOWLEDGE CONFIDENCE:|BRIEF ELEMENTS PRESENT:|ASSUMPTIONS MADE:|====\s*DELIVERABLE)/i;

export function clean(text: unknown, tag = "minto"): string {
  return sanitiseText(stripDocumentMetadata(String(text ?? ""), tag));
}

export function stripInternals(text: string): string {
  return text
    .split("\n")
    .filter((l) => !INTERNAL_LINE.test(l))
    .join("\n");
}

/** Paragraphs of running prose, ignoring headings, bullets and label lines. */
export function prose(text: string, limit: number): string[] {
  const out: string[] = [];
  for (const raw of text.split(/\n\s*\n/)) {
    const p = raw.trim().replace(/\s+/g, " ");
    if (!p) continue;
    if (/^[#>*\-—•=]/.test(p)) continue;
    if (/^[A-Z0-9 .—–:'"()/]{0,60}:\s*$/.test(p)) continue;
    if (p.length < 90) continue;
    out.push(p);
    if (out.length >= limit) break;
  }
  return out;
}

/** Text under a heading-ish marker, up to the next marker. */
export function blockAfter(text: string, marker: RegExp): string {
  const lines = text.split("\n");
  const start = lines.findIndex((l) => marker.test(l));
  if (start === -1) return "";
  const body: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i];
    if (/^\s*(SECTION\s+\d|#{1,4}\s|={3,}|-{3,})/.test(l) && body.join("").trim()) break;
    body.push(l);
    if (body.length > 60) break;
  }
  return body.join("\n").trim();
}

export function bullets(text: string, limit: number): string[] {
  const out: string[] = [];
  for (const raw of text.split("\n")) {
    const m = raw.trim().match(/^[-—•]\s+(.{20,})$/);
    if (!m) continue;
    out.push(m[1].replace(/\s+/g, " "));
    if (out.length >= limit) break;
  }
  return out;
}

/* ──────────────────────────────────────────── Stage 10 score parsing ── */

export interface ScoredCandidate {
  name: string;
  composite: number | null;
  verdict: "PASS" | "FAIL" | null;
  verdictNote: string;
  dims: Record<string, number>;
}

export const DIMENSIONS = [
  "Fame",
  "Truth Strength",
  "Competitive Impossibility",
  "Brand Permission",
  "Clean Air",
  "Commercial Precedent",
] as const;

export function parseScoredCandidates(stage10: string): ScoredCandidate[] {
  const out: ScoredCandidate[] = [];
  let current: ScoredCandidate | null = null;
  const push = () => {
    if (current && current.name) out.push(current);
  };
  for (const raw of stage10.split("\n")) {
    const line = raw.trim();
    const smp = line.match(/^SMP:\s*[""]?(.+?)[""]?\s*(?:—\s*FIELD:.*)?$/i);
    if (smp) {
      push();
      current = { name: smp[1].trim(), composite: null, verdict: null, verdictNote: "", dims: {} };
      continue;
    }
    if (!current) continue;
    for (const dim of DIMENSIONS) {
      const m = line.match(new RegExp(`^${dim}:\\s*(\\d+(?:\\.\\d+)?)\\s*/\\s*10`, "i"));
      if (m) current.dims[dim] = Number(m[1]);
    }
    const comp = line.match(/CODE COMPOSITE:\s*(\d+(?:\.\d+)?)\s*\/\s*100/i);
    if (comp) current.composite = Number(comp[1]);
    const verdict = line.match(/CODE VERDICT:\s*(PASS|FAIL)\s*(?:—\s*(.*))?/i);
    if (verdict) {
      current.verdict = verdict[1].toUpperCase() as "PASS" | "FAIL";
      current.verdictNote = (verdict[2] ?? "").trim();
    }
  }
  push();
  return out;
}

function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findWinner(candidates: ScoredCandidate[], smp: string): ScoredCandidate | null {
  const target = normalise(smp);
  if (!target) return null;
  const exact = candidates.find((c) => normalise(c.name) === target);
  if (exact) return exact;
  return (
    candidates.find(
      (c) => target.includes(normalise(c.name)) || normalise(c.name).includes(target),
    ) ?? null
  );
}

/* ─────────────────────────────────────────────── appendix condensing ── */

export const PIPELINE_APPENDIX: Array<{ title: string; key: string }> = [
  { title: "Brief & Context", key: "stage_1_output" },
  { title: "Category Intelligence", key: "stage_2_output" },
  { title: "Strategic Frameworks", key: "stage_3_output" },
  { title: "Strategic Universes", key: "stage_4_output" },
  { title: "Insight Generation", key: "stage_5_output" },
  { title: "Insight Validation", key: "stage_6_output" },
  { title: "Territory Synthesis", key: "stage_7_output" },
  { title: "Proposition Generation", key: "stage_8_output" },
  { title: "Distinctiveness Check", key: "stage_9_output" },
  { title: "Proposition Scoring", key: "stage_10_output" },
  { title: "Integrity Testing", key: "stage_11_output" },
  { title: "Proposition Selection", key: "stage_12_output" },
  { title: "Brand Fit Validation", key: "stage_13_output" },
  { title: "Territory Mapping", key: "stage_14_output" },
  { title: "Coherence Audit", key: "stage_15_output" },
];

export const DETONATION_APPENDIX: Array<{ title: string; key: string }> = [
  { title: "Detonation Territory", key: "stage_17_selected_territory" },
  { title: "Detonation Intelligence", key: "stage_17b_output" },
  { title: "The Detonation", key: "stage_18_selected_detonation" },
  { title: "Activation Architecture", key: "stage_19_output" },
  { title: "Master Brief Detail", key: "stage_20_output" },
  { title: "Brand Architecture", key: "stage_22_brand_architecture" },
];

/** Process scaffolding that carries no evidence for a board reader. */
const SCAFFOLD_LINE =
  /^(ok[,.]|understood|here (is|are)|i('| wi)ll |let me |as requested|below (is|are)|note:|reminder:|continuing|proceeding|end of (stage|section)|word count|token|instruction)/i;

/**
 * Condenses one stage output into appendix evidence: headings kept as
 * structure, the strongest substantive lines kept beneath them, everything
 * else dropped. Nothing is rewritten — lines are kept verbatim or cut.
 */
export function condenseStage(
  raw: string,
  opts: { maxUnits?: number; maxChars?: number } = {},
): string {
  const maxUnits = opts.maxUnits ?? 22;
  const maxChars = opts.maxChars ?? 2600;
  const out: string[] = [];
  let chars = 0;
  let units = 0;
  let sinceHeading = 0;

  const isHeading = (l: string) =>
    /^#{1,4}\s/.test(l) ||
    /^(SECTION|STAGE|PART)\b/i.test(l) ||
    /^[A-Z0-9 .,'&()/–—-]{6,70}:?$/.test(l);

  for (const rawLine of raw.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/^[=_*-]{3,}$/.test(line)) continue;
    if (SCAFFOLD_LINE.test(line)) continue;

    if (isHeading(line)) {
      if (units >= maxUnits || chars >= maxChars) continue;
      if (out.length && out[out.length - 1].startsWith("### ")) out.pop();
      out.push(`### ${line.replace(/^#{1,4}\s+/, "").replace(/:$/, "")}`);
      sinceHeading = 0;
      continue;
    }
    if (units >= maxUnits || chars >= maxChars) continue;
    if (sinceHeading >= 4) continue;
    if (line.length < 25 && !/^[-—•]/.test(line)) continue;

    out.push(line);
    sinceHeading++;
    units++;
    chars += line.length;
  }
  while (out.length && out[out.length - 1].startsWith("### ")) out.pop();
  return out.join("\n\n");
}

export interface AppendixOptions {
  sections?: Array<{ title: string; key: string }>;
  mode?: "condensed" | "full" | "brief";
  intro?: string;
}

export function buildAppendix(session: MintoSession, opts: AppendixOptions = {}): string {
  const defs = opts.sections ?? PIPELINE_APPENDIX;
  const mode = opts.mode ?? "condensed";
  const budget =
    mode === "brief" ? { maxUnits: 8, maxChars: 900 } : { maxUnits: 22, maxChars: 2600 };

  const blocks = defs
    .map((s, i) => {
      let raw = clean((session as Record<string, unknown>)[s.key]);
      if (s.key === "stage_9_output") raw += `\n${clean(session.stage_9_leftofcentre_output)}`;
      raw = stripInternals(raw);
      if (!raw.trim()) return "";
      const body = mode === "full" ? raw : condenseStage(raw, budget);
      if (!body.trim()) return "";
      return `<div class="section keep-together"><p class="kicker"><span class="idx">${String(
        i + 1,
      ).padStart(2, "0")}</span>${escapeHtml(s.title)}</p>${renderMarkdown(body)}</div>`;
    })
    .filter(Boolean);

  if (!blocks.length) return "";
  const intro =
    opts.intro ??
    (mode === "full"
      ? "Every stage output behind the recommendation above, in pipeline order. The front matter is the decision; this is the evidence."
      : "The load-bearing evidence from each validation stage, in pipeline order. Cut to what supports the decision; the complete transcripts remain in the session record.");
  return `<p>${escapeHtml(intro)}</p>` + blocks.join("\n");
}

/* ───────────────────────────────────────────────────── derivation ── */

export interface DerivedMinto {
  brand: string;
  category: string;
  smp: string;
  candidates: ScoredCandidate[];
  winner: ScoredCandidate | null;
  stagesRun: number;
  /** Room 04 lock block — locked campaign line and winning idea, or "". */
  lockedIdeaHtml: string;
  headlineStats: Stat[];
  content: MintoContent;
}

export interface DeriveOptions {
  appendix?: AppendixOptions;
  /** Extra HTML appended inside the "why this wins" section. */
  extraWhyHtml?: string;
}

export function deriveMintoContent(session: MintoSession, opts: DeriveOptions = {}): DerivedMinto {
  const brand = (session.brand_name ?? "Untitled Brand").trim();
  const category = (session.category ?? "").trim();
  const smp = clean(session.selected_smp).trim();

  const s1 = stripInternals(clean(session.stage_1_output));
  const s5 = clean(session.stage_5_output);
  const s10 = clean(session.stage_10_output);
  const s11 = clean(session.stage_11_output);
  const s12 = clean(session.stage_12_output);
  const s13 = clean(session.stage_13_output);
  const s14 = clean(session.stage_14_output);
  const s15 = clean(session.stage_15_output);

  const candidates = parseScoredCandidates(s10);
  const winner = findWinner(candidates, smp);
  const passed = candidates.filter((c) => c.verdict === "PASS");
  const rejected = candidates.filter((c) => c !== winner);
  const stagesRun = PIPELINE_APPENDIX.filter((s) =>
    String((session as Record<string, unknown>)[s.key] ?? "").trim(),
  ).length;

  /* Room 04 lock — authoritative campaign line and winning idea. Stage 14/15
   * text predates the lock, so the lock is stated first and verbatim. */
  const lockedLine = (session.locked_campaign_line ?? "").trim();
  const lockedIdea = clean(session.locked_big_idea).trim();
  const lockedLens = (session.locked_big_idea_lens ?? "").trim();
  const lockedIdeaHtml =
    lockedLine || lockedIdea
      ? (lockedLine
          ? pullQuote(lockedLine, {
              label: lockedLens ? `Locked campaign line — ${lockedLens}` : "Locked campaign line",
            })
          : "") +
        (lockedIdea
          ? callout(
              lockedLens ? `Locked creative idea — ${lockedLens}` : "Locked creative idea",
              `<p>${inlineMd(lockedIdea.slice(0, 900))}</p>`,
            )
          : "")
      : "";

  const sourceStamp = session.locked_big_idea_at
    ? `Room 04 winning idea resolved from the locked run at ${new Date(session.locked_big_idea_at).toLocaleString("en-AU")}${session.locked_big_idea_run_id ? ` · run ${escapeHtml(session.locked_big_idea_run_id.slice(0, 8))}` : ""}.`
    : `No Room 04 winning idea was locked when this document was rendered.`;



  /* 01 — recommendation */
  const recommendation = smp
    ? pullQuote(smp, { label: "The recommendation", variant: "hero" })
    : "";

  const headlineStats: Stat[] = [];
  if (winner?.composite != null) {
    headlineStats.push({
      value: winner.composite,
      suffix: "/100",
      label: "Recommended SMP score",
      note: "Weighted composite across six scoring dimensions.",
    });
  }
  if (candidates.length) {
    headlineStats.push({
      value: candidates.length,
      label: "Propositions scored",
      note: `${passed.length} cleared the hard floors.`,
    });
  }
  headlineStats.push({
    value: stagesRun,
    label: "Validation stages run",
    note: "Each stage is evidenced in the appendix.",
  });

  /* 02 — business issue */
  const issueSource = blockAfter(s12, /SECTION\s+1\s*[—-]\s*PRESENTATION CONTEXT/i) || s1;
  const issueParas = prose(issueSource, 2);
  const business_issue = issueParas.length
    ? issueParas.map((p) => `<p>${inlineMd(p)}</p>`).join("")
    : renderMarkdown(issueSource.slice(0, 1800));

  /* 03 — key insight */
  const insightSource = blockAfter(s5, /INSIGHT|^##/i) || s5;
  const insightParas = prose(insightSource, 1);
  const key_insight = insightParas.length
    ? pullQuote(insightParas[0], { label: "The insight it rests on", variant: "quiet" })
    : renderMarkdown(insightSource.slice(0, 1200));

  /* 04 — proposition */
  const proposition = smp
    ? pullQuote(smp, { label: "Strategic Master Proposition" }) +
      (winner
        ? statGrid(
            DIMENSIONS.filter((d) => winner.dims[d] != null).map((d) => ({
              value: winner.dims[d],
              suffix: "/10",
              label: d,
            })),
            3,
          )
        : "")
    : "";

  /* 05 — why this wins */
  const runnerUp = candidates
    .filter((c) => c !== winner && c.composite != null)
    .sort((a, b) => (b.composite ?? 0) - (a.composite ?? 0))[0];
  const whyReasons: Reason[] = [];
  if (winner) {
    const strongest = Object.entries(winner.dims).sort((a, b) => b[1] - a[1])[0];
    if (strongest) {
      whyReasons.push({
        title: `Strongest on ${strongest[0].toLowerCase()}`,
        detail: `Scores ${strongest[1]}/10 on the dimension that carries the campaign.`,
      });
    }
    if (runnerUp?.composite != null && winner.composite != null) {
      whyReasons.push({
        title: "Clears the field",
        detail: `${winner.composite}/100 against ${runnerUp.composite}/100 for the next-best candidate (${runnerUp.name}).`,
      });
    }
  }
  const integrityLine = prose(s11, 1)[0];
  if (integrityLine) {
    whyReasons.push({ title: "Survives integrity testing", detail: integrityLine.slice(0, 260) });
  }
  const fitLine = prose(s13, 1)[0];
  if (fitLine) {
    whyReasons.push({ title: "Brand has permission", detail: fitLine.slice(0, 260) });
  }
  const whyFallbackBullets = bullets(s12, 4);
  const why_this_wins =
    (whyReasons.length
      ? reasonGrid(whyReasons)
      : whyFallbackBullets.length
        ? `<ul>${whyFallbackBullets.map((b) => `<li>${inlineMd(b)}</li>`).join("")}</ul>`
        : "") + (opts.extraWhyHtml ?? "");

  /* 06 — validation summary */
  const tableRows: CmpRow[] = candidates
    .slice()
    .sort((a, b) => (b.composite ?? -1) - (a.composite ?? -1))
    .slice(0, 12)
    .map((c) => ({
      win: c === winner,
      cells: {
        name: c.name,
        fame: c.dims["Fame"],
        truth: c.dims["Truth Strength"],
        impossibility: c.dims["Competitive Impossibility"],
        cleanAir: c.dims["Clean Air"],
        composite: c.composite,
        verdict: c.verdict ?? "",
      },
    }));
  const validationTable = comparisonTable(
    [
      { key: "name", label: "Proposition" },
      { key: "fame", label: "Fame", numeric: true },
      { key: "truth", label: "Truth", numeric: true },
      { key: "impossibility", label: "Impossibility", numeric: true },
      { key: "cleanAir", label: "Clean air", numeric: true },
      { key: "composite", label: "Score /100", numeric: true },
      { key: "verdict", label: "Verdict" },
    ],
    tableRows,
    winner
      ? "Scored candidate set — highlighted row is the recommendation"
      : "Scored candidate set — Stage 10 scoring, ranked",
  );
  const selectionNote =
    !winner && smp && candidates.length
      ? callout(
          "How the recommendation relates to this set",
          `<p>The recommended proposition was resolved at selection, after the scored set above was tested for integrity and brand fit. It is not a row in the Stage 10 table.</p>`,
        )
      : "";
  const fitNote = prose(s13, 1)[0];
  const validation =
    (validationTable || renderMarkdown(s10.slice(0, 2000)) || "") +
    selectionNote +
    (fitNote ? callout("Brand fit validation", `<p>${inlineMd(fitNote)}</p>`) : "");

  /* 07 — rejected */
  const isFailureNote = (n?: string) =>
    !!n && /fail|reject|below|does not|doesn't|not carried|weak|breach/i.test(n);
  const rationaleText = (() => {
    const raw = session.selection_rationale;
    if (!raw) return "";
    if (typeof raw === "string") return raw;
    try { return JSON.stringify(raw); } catch { return ""; }
  })();
  const liveReasonFor = (name: string): string | null => {
    if (!rationaleText) return null;
    const key = normalise(name);
    const entries = typeof session.selection_rationale === "object" && session.selection_rationale
      ? Object.entries(session.selection_rationale as Record<string, unknown>)
      : [];
    const hit = entries.find(([k, value]) => {
      const haystack = normalise(`${k} ${typeof value === "string" ? value : JSON.stringify(value)}`);
      return key.length > 5 && (haystack.includes(key) || key.includes(haystack.slice(0, key.length)));
    });
    if (!hit) return null;
    const value = hit[1];
    if (typeof value === "string") return value;
    if (value && typeof value === "object") {
      const row = value as Record<string, unknown>;
      const reason = row.reason ?? row.rationale ?? row.note ?? row.rejection_reason;
      return typeof reason === "string" ? reason : null;
    }
    return null;
  };
  const rejectReasons: Reason[] = rejected
    .slice()
    .sort((a, b) => (a.composite ?? 999) - (b.composite ?? 999))
    .slice(0, 4)
    .map((c) => {
      const weakest = Object.entries(c.dims).sort((a, b) => a[1] - b[1])[0];
      const currentSelectionReason = liveReasonFor(c.name);
      const detail = currentSelectionReason
        ? currentSelectionReason
        : isFailureNote(c.verdictNote)
        ? (c.verdictNote as string)
        : weakest
          ? `Not carried forward. Weakest on ${weakest[0].toLowerCase()} (${weakest[1]}/10)${
              c.composite != null ? ` · ${c.composite}/100 composite` : ""
            }.`
          : "Not carried forward at selection.";
      return { title: c.name, detail };
    });
  const rejectedHtml = rejectReasons.length ? reasonGrid(rejectReasons) : "";

  /* 08 — implications */
  const implicationItems = bullets(s14, 5).length ? bullets(s14, 5) : bullets(s15, 5);
  const brandArchitecture = (session.stage_22_brand_architecture ?? "").trim();
  const distinctiveAssets = (session.stage_22_distinctive_assets ?? "").trim();
  const implications =
    lockedIdeaHtml +
    (implicationItems.length
      ? `<ul>${implicationItems.map((b) => `<li>${inlineMd(b)}</li>`).join("")}</ul>`
      : renderMarkdown((s14 || s15).slice(0, 1600))) +
    (brandArchitecture
      ? callout("Current brand architecture", renderMarkdown(brandArchitecture.slice(0, 1400)))
      : "") +
    (distinctiveAssets
      ? callout("Current distinctive assets", renderMarkdown(distinctiveAssets.slice(0, 1000)))
      : "");


  /* 09 — next step */
  const nextCandidates = [
    ...bullets(blockAfter(s15, /NEXT STEP|RECOMMENDED ACTION|IMMEDIATE/i), 3),
    ...bullets(blockAfter(s14, /NEXT STEP|RECOMMENDED ACTION|ACTIVATION/i), 3),
  ].slice(0, 3);
  const decisionAsk = smp
    ? `<p>The decision requested is a single one: adopt <strong>${escapeHtml(
        smp,
      )}</strong> as the Strategic Master Proposition for ${escapeHtml(brand)}, and release it into creative development.</p>`
    : "";
  const next_step =
    decisionAsk +
    (nextCandidates.length
      ? `<ul>${nextCandidates.map((b) => `<li>${inlineMd(b)}</li>`).join("")}</ul>`
      : "") +
    callout(
      "On approval",
      `<p>Sign-off releases the proposition to the Detonation phase — territory, activation architecture and channel briefs are generated against this proposition and no other.</p>`,
    );

  /* 10 — appendix */
  const appendix =
    buildAppendix(session, opts.appendix) +
    callout("Source authority", `<p>${sourceStamp}</p><p>Strategic stage outputs in the appendix are historical snapshots. The selected SMP and Room 04 lock above are resolved from their current authoritative fields at render time.</p>`) +
    proofLine({
      stagesRun,
      documents: stagesRun ? PIPELINE_APPENDIX.length : undefined,
      extra: candidates.length ? `${candidates.length} propositions scored` : undefined,
    });

  return {
    brand,
    category,
    smp,
    candidates,
    winner,
    stagesRun,
    lockedIdeaHtml,
    headlineStats,
    content: {
      recommendation,
      business_issue,
      key_insight,
      proposition,
      why_this_wins,
      validation,
      rejected: rejectedHtml,
      implications,
      next_step,
      appendix,
    },
  };
}
