// BRAND GRENADE — SHARED DELIVERABLES DESIGN SYSTEM
// ============================================================================
// One stylesheet and one set of primitives for every document type the
// platform exports. Before this file, six builders each carried their own
// near-identical copy of the Bebas/Inter/A4 block and they had already
// drifted apart. Everything visual now lives here.
//
// This module is deliberately environment-neutral (no server-only imports,
// no DOM access) so both `.server.ts` builders and client-side builders can
// use it. Rendering/printing helpers stay in their existing homes.
//
// Design tokens are the Brand Grenade 5-value system:
//   void #0A0908 · ash #1C1A18 · paper #EDE8E0 · smoke #8B8680
//   detonation #C81E1E  (+ two paper-side tints so surfaces read on paper)
//
// Page breaks are explicitly controlled here — never left to the renderer.
// The classes `.doc-break`, `.keep-together`, and `.allow-break` are the only
// sanctioned break controls; document builders must not invent their own.

export const TOKENS = {
  void: "#0A0908",
  ash: "#1C1A18",
  paper: "#EDE8E0",
  smoke: "#8B8680",
  detonation: "#C81E1E",
  surface: "#E1DCD4",
  rule: "#C2BCB5",
} as const;

/* ─────────────────────────────────────────────────── text helpers ── */

export function escapeHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Normalises smart punctuation that renders unreliably in headless print. */
export function sanitiseText(s: unknown): string {
  return String(s ?? "")
    .replace(/\u2014/g, "—")
    .replace(/\u2013/g, "–")
    .replace(/\u201C/g, '"')
    .replace(/\u201D/g, '"')
    .replace(/\u2018/g, "'")
    .replace(/\u2019/g, "'")
    .replace(/\u2026/g, "...");
}

/** Inline markdown (bold/italic) → HTML, escaped first. */
export function inlineMd(line: string): string {
  let s = escapeHtml(line);
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|\s)\*(?!\s)(.+?)\*(?!\w)/g, "$1<em>$2</em>");
  // Underscore emphasis used widely by the stage prompts (_note_).
  s = s.replace(/(^|[\s(])_(?!\s)([^_]+?)_(?=$|[\s.,;:)!?])/g, "$1<em>$2</em>");
  return s;
}

/**
 * Removes markdown headings that have lost their body.
 *
 * Stage transcripts are filtered before they render — run-count bookkeeping is
 * dropped, sibling-candidate blocks are scoped out, condensation cuts to a
 * budget. Any of those can leave a heading standing over nothing, which the
 * document gate correctly refuses to publish. A heading directly above a
 * DEEPER heading is a parent and is kept; a heading followed by a
 * same-or-shallower heading, or by the end of the text, is dropped along with
 * the rule that separated it.
 */
export function pruneEmptyHeadings(md: string): string {
  if (!md.trim()) return md;
  const lines = md.split("\n");
  const level = (l: string) => l.trim().match(/^#{1,6}(?=\s)/)?.[0].length ?? 0;
  const isRule = (l: string) => /^\s*(?:[*\-_]{3,}|—+)\s*$/.test(l);
  const keep = lines.map(() => true);
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!level(lines[i])) continue;
    let j = i + 1;
    while (j < lines.length && (!keep[j] || !lines[j].trim() || isRule(lines[j]))) j++;
    if (j < lines.length && level(lines[j]) > level(lines[i])) continue;
    if (j < lines.length && !level(lines[j])) continue;
    keep[i] = false;
    // drop the rules/blank run that belonged to the removed heading
    for (let k = i + 1; k < j; k++) if (isRule(lines[k])) keep[k] = false;
  }
  return lines
    .filter((_, i) => keep[i])
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Block-level markdown → HTML, rendered into the shared document classes.
 * Lives here (not in a builder) so every migrated document type renders body
 * copy identically.
 */

export function renderMarkdown(text: string): string {
  if (!text) return "";
  const out: string[] = [];
  let inUl = false;
  const closeUl = () => {
    if (inUl) {
      out.push("</ul>");
      inUl = false;
    }
  };
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line) {
      // A blank line between two bullets is spacing, not the end of the list.
      // Closing on it produced a run of single-item lists that read as a
      // run-on instead of one readable list.
      let j = i + 1;
      while (j < lines.length && !lines[j].trim()) j++;
      const next = j < lines.length ? lines[j].trim() : "";
      if (!(inUl && /^[-—•]\s+/.test(next))) closeUl();
      continue;
    }

    if (line.startsWith("> ")) {
      closeUl();
      out.push(`<blockquote>${inlineMd(line.replace(/^>\s+/, ""))}</blockquote>`);
      continue;
    }
    // Heading depth is flattened for typography (everything below h4 renders
    // as h3) but the markdown level is preserved as data-md-level, so the
    // document gate can tell a parent heading followed by its own subheading
    // apart from a heading that genuinely lost its body.
    if (/^####\s+/.test(line)) {
      closeUl();
      out.push(`<h4 data-md-level="4">${inlineMd(line.replace(/^####\s+/, ""))}</h4>`);
      continue;
    }
    if (/^###\s+/.test(line)) {
      closeUl();
      out.push(`<h3 data-md-level="3">${inlineMd(line.replace(/^###\s+/, ""))}</h3>`);
      continue;
    }
    if (/^##\s+/.test(line)) {
      closeUl();
      out.push(`<h3 data-md-level="2">${inlineMd(line.replace(/^##\s+/, ""))}</h3>`);
      continue;
    }
    if (/^#\s+/.test(line)) {
      closeUl();
      out.push(`<h3 data-md-level="1">${inlineMd(line.replace(/^#\s+/, ""))}</h3>`);
      continue;
    }

    if (/^[-—•]\s+/.test(line)) {
      if (!inUl) {
        out.push("<ul>");
        inUl = true;
      }
      out.push(`<li>${inlineMd(line.replace(/^[-—•]\s+/, ""))}</li>`);
      continue;
    }
    if (/^[*\-_]{3,}$/.test(line)) {
      closeUl();
      out.push("<hr>");
      continue;
    }
    closeUl();
    out.push(`<p>${inlineMd(line)}</p>`);
  }
  closeUl();
  return out.join("\n");
}

/* ─────────────────────────────────────────────── the stylesheet ── */

export interface StyleOptions {
  /** Screen chrome (toolbar, page shadow) — omit for headless PDF rendering. */
  screen?: boolean;
}

export function docSystemStyles(opts: StyleOptions = {}): string {
  const screen = opts.screen !== false;
  return `@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700&display=swap');
:root {
  --void: ${TOKENS.void};
  --ash: ${TOKENS.ash};
  --paper: ${TOKENS.paper};
  --smoke: ${TOKENS.smoke};
  --detonation: ${TOKENS.detonation};
  --surface: ${TOKENS.surface};
  --rule: ${TOKENS.rule};
}
@page { size: A4; margin: 20mm 22mm 20mm 22mm; }
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { background: ${screen ? "var(--void)" : "var(--paper)"}; }
body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
  font-size: 10.5pt; line-height: 1.75; color: var(--ash);
  padding: ${screen ? "64px 0 64px" : "0"};
  -webkit-font-smoothing: antialiased;
  print-color-adjust: exact; -webkit-print-color-adjust: exact;
}
.page {
  max-width: ${screen ? "760px" : "none"}; margin: 0 auto; background: var(--paper);
  padding: ${screen ? "56pt" : "0"};
  ${screen ? "box-shadow: 0 6px 24px rgba(0,0,0,0.45);" : ""}
}

/* ── screen-only toolbar ─────────────────────────────────────────── */
#toolbar { position: fixed; top: 0; left: 0; right: 0; background: var(--ash); border-bottom: 1px solid #2A2724; padding: 10px 24px; display: flex; justify-content: space-between; align-items: center; z-index: 999; }
#toolbar span { color: var(--smoke); font-size: 13px; }
#toolbar .actions button { background: var(--detonation); color: var(--paper); border: none; padding: 8px 20px; border-radius: 3px; font-family: inherit; font-size: 13px; font-weight: 600; cursor: pointer; margin-left: 8px; }
#toolbar .actions button.close { background: transparent; color: var(--smoke); border: 1px solid #2A2724; }

/* ── explicit page-break control ─────────────────────────────────── */
.doc-break { break-before: page; page-break-before: always; }
.keep-together { break-inside: avoid; page-break-inside: avoid; }
.allow-break { break-inside: auto; page-break-inside: auto; }

@media print {
  #toolbar { display: none; }
  @page { margin: 0; }
  html, body { padding: 0; background: var(--paper); }
  .page { box-shadow: none; max-width: none; padding: 18mm 20mm; background: var(--paper); }
  .cover { break-after: page; page-break-after: always; }
  h1, h2, h3, h4, .kicker { break-after: avoid; page-break-after: avoid; }
  .stat-grid, .stat, .pull, .cmp, .cmp thead, .cmp tr, .callout, .toc, .footer { break-inside: avoid; page-break-inside: avoid; }
  .cmp { break-inside: auto; page-break-inside: auto; }
  .cmp thead { display: table-header-group; break-after: avoid; page-break-after: avoid; }
  /* A repeated header must never be the last thing on a page: keep the first
     body row with it, so no page ends on a column header with no rows. */
  .cmp tbody tr:first-child { break-before: avoid; page-break-before: avoid; }

  p, li { orphans: 3; widows: 3; }
}

/* ── cover ───────────────────────────────────────────────────────── */
.cover { min-height: 74vh; display: flex; flex-direction: column; justify-content: center; padding: 40pt 0; border-bottom: 2pt solid var(--detonation); margin-bottom: 32pt; }
.cover-brand { font-family: 'Bebas Neue', Impact, sans-serif; font-size: 15pt; letter-spacing: 0.06em; color: var(--ash); margin-bottom: 10pt; }
.cover-label { font-size: 9pt; font-weight: 600; letter-spacing: 0.12em; color: var(--detonation); text-transform: uppercase; margin-bottom: 24pt; }
.cover-title { font-family: 'Bebas Neue', Impact, sans-serif; font-size: 40pt; font-weight: 400; color: var(--ash); line-height: 1.02; letter-spacing: 0.01em; margin-bottom: 24pt; }
.cover-rule { width: 40pt; height: 2pt; background: var(--detonation); margin-bottom: 20pt; }
.cover-date { font-size: 9.5pt; color: var(--smoke); }
.cover-confidential { font-size: 9pt; color: var(--smoke); margin-top: 8pt; letter-spacing: 0.06em; }

/* ── structure ───────────────────────────────────────────────────── */
.section { margin-bottom: 30pt; padding-top: 6pt; }
.kicker, .part-label { font-size: 8.5pt; font-weight: 600; letter-spacing: 0.14em; color: var(--detonation); text-transform: uppercase; margin-bottom: 6pt; }
.kicker .idx { color: var(--smoke); margin-right: 8pt; }
h1 { font-family: 'Bebas Neue', Impact, sans-serif; font-weight: 400; font-size: 30pt; line-height: 1.05; color: var(--ash); margin-bottom: 14pt; }
h2 { font-size: 15pt; font-weight: 600; letter-spacing: -0.01em; color: var(--ash); margin-bottom: 12pt; padding-left: 10pt; border-left: 3pt solid var(--detonation); line-height: 1.25; }
h3 { font-size: 11pt; font-weight: 600; color: var(--ash); margin-top: 16pt; margin-bottom: 8pt; }
h4 { font-size: 10pt; font-weight: 600; color: var(--ash); margin-top: 12pt; margin-bottom: 6pt; }
p { margin-bottom: 10pt; }
ul { margin: 10pt 0; padding: 0; list-style: none; }
li { padding-left: 14pt; position: relative; margin-bottom: 5pt; }
li::before { content: '—'; position: absolute; left: 0; color: var(--detonation); }
ol { margin: 10pt 0 10pt 18pt; }
ol li { padding-left: 4pt; }
ol li::before { content: ''; }
hr { border: none; border-top: 0.5pt solid var(--rule); margin: 16pt 0; }
strong { font-weight: 600; } em { font-style: italic; }
blockquote { border-left: 3pt solid var(--detonation); padding: 10pt 14pt; margin: 14pt 0; background: var(--surface); font-style: italic; font-size: 11pt; line-height: 1.6; }

/* ── PRIMITIVE — stat callout ────────────────────────────────────── */
.stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(110pt, 1fr)); gap: 10pt; margin: 16pt 1pt 16pt 0; }
.stat-grid.cols-2 { grid-template-columns: repeat(2, 1fr); }
.stat-grid.cols-3 { grid-template-columns: repeat(3, 1fr); }
.stat-grid.cols-4 { grid-template-columns: repeat(4, 1fr); }
.stat { border: 0.75pt solid var(--rule); border-top: 2pt solid var(--detonation); background: var(--surface); padding: 12pt 12pt 11pt; }
.stat .value { font-family: 'Bebas Neue', Impact, sans-serif; font-size: 27pt; line-height: 0.95; color: var(--ash); letter-spacing: 0.01em; }
.stat .value .suffix { font-family: 'Inter', sans-serif; font-size: 11pt; font-weight: 600; color: var(--smoke); margin-left: 2pt; letter-spacing: 0; }
.stat .label { font-size: 8pt; font-weight: 600; letter-spacing: 0.11em; text-transform: uppercase; color: var(--detonation); margin-top: 8pt; }
.stat .note { font-size: 8.5pt; color: var(--smoke); margin-top: 4pt; line-height: 1.45; }

/* ── PRIMITIVE — pull quote / governing statement ────────────────── */
.pull { margin: 20pt 0; padding: 22pt 24pt; background: var(--surface); border-left: 4pt solid var(--detonation); }
.pull .pull-label { font-size: 8.5pt; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: var(--detonation); margin-bottom: 12pt; }
.pull .pull-body { font-family: 'Bebas Neue', Impact, sans-serif; font-size: 22pt; line-height: 1.12; letter-spacing: 0.01em; color: var(--ash); }
.pull .pull-attr { font-size: 8.5pt; color: var(--smoke); margin-top: 10pt; letter-spacing: 0.05em; }
.pull .pull-caption { font-family: 'Inter', sans-serif; font-size: 8.5pt; font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase; color: var(--smoke); margin-top: 10pt; }
.pull.hero .pull-caption { margin-top: 14pt; }
.pull.hero { text-align: center; border-left: none; border-top: 2pt solid var(--detonation); border-bottom: 2pt solid var(--detonation); background: transparent; padding: 34pt 20pt; }
.pull.hero .pull-body { font-size: 30pt; max-width: 480pt; margin: 0 auto; }
.pull.quiet { background: transparent; border-left: 3pt solid var(--rule); padding: 14pt 18pt; }
.pull.quiet .pull-body { font-family: 'Inter', sans-serif; font-size: 12.5pt; font-weight: 600; line-height: 1.5; }
.pull .pull-body.prose, .pull.hero .pull-body.prose { font-family: 'Inter', sans-serif; font-size: 13pt; font-weight: 500; line-height: 1.55; letter-spacing: 0; text-align: left; max-width: 100%; word-spacing: normal; }

.proposition { text-align: center; padding: 36pt 20pt; border-top: 2pt solid var(--detonation); border-bottom: 2pt solid var(--detonation); margin: 0 0 32pt; }
.proposition .label { font-size: 9pt; font-weight: 600; letter-spacing: 0.18em; color: var(--detonation); text-transform: uppercase; margin-bottom: 14pt; }
.proposition .stmt { font-family: 'Bebas Neue', Impact, sans-serif; font-size: 30pt; line-height: 1.06; letter-spacing: 0.01em; color: var(--ash); font-weight: 400; max-width: 480pt; margin: 0 auto; }

/* ── PRIMITIVE — comparison table ────────────────────────────────── */
.cmp { width: 100%; border-collapse: collapse; margin: 16pt 0; font-size: 9.5pt; }
.cmp caption { caption-side: top; text-align: left; font-size: 8.5pt; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--detonation); padding-bottom: 8pt; }
.cmp th, .cmp td { text-align: left; padding: 7pt 10pt; border-bottom: 0.5pt solid var(--rule); vertical-align: top; line-height: 1.5; }
.cmp th:first-child, .cmp td:first-child { width: 34%; }
.cmp thead th { font-size: 8pt; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--smoke); border-bottom: 1pt solid var(--ash); }
.cmp tbody tr.win { background: var(--surface); }
.cmp tbody tr.win td:first-child { box-shadow: inset 3pt 0 0 var(--detonation); font-weight: 600; }
.cmp td.num, .cmp th.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.cmp td.score { font-weight: 600; color: var(--ash); }
.cmp .muted { color: var(--smoke); }
.cmp tbody tr:last-child td { border-bottom: 1pt solid var(--ash); }

/* ── current-state citations ─────────────────────────────────────── */
.cs-cite { font-size: 7pt; vertical-align: super; line-height: 0; color: var(--smoke); }
.cs-status { color: var(--smoke); font-style: italic; }
.cs-sources { margin: 10pt 0 0; padding-top: 7pt; border-top: 0.75pt solid var(--rule); font-size: 8pt; color: var(--smoke); line-height: 1.5; list-style: none; }
.cs-sources li { margin: 2pt 0; padding-left: 0; }

/* ── supporting blocks ───────────────────────────────────────────── */
.callout { border: 0.75pt solid var(--rule); background: var(--surface); padding: 14pt 16pt; margin: 14pt 0; }
.callout .callout-label { font-size: 8.5pt; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--detonation); margin-bottom: 7pt; }
.reasons { display: grid; grid-template-columns: repeat(auto-fit, minmax(140pt, 1fr)); gap: 12pt; margin: 16pt 0; }
.reason { border-top: 1.5pt solid var(--ash); padding-top: 9pt; }
.reason .n { font-family: 'Bebas Neue', Impact, sans-serif; font-size: 15pt; color: var(--detonation); line-height: 1; }
.reason .t { font-weight: 600; font-size: 10pt; margin: 5pt 0 4pt; }
.reason .d { font-size: 9pt; color: var(--smoke); line-height: 1.5; }
.toc { margin: 24pt 0 32pt; padding: 16pt; border: 1pt solid var(--rule); background: var(--surface); }
.toc h3 { margin-top: 0; color: var(--detonation); letter-spacing: 0.12em; text-transform: uppercase; font-size: 10pt; }
.toc ol { margin: 8pt 0 0 20pt; }
.toc li { margin: 4pt 0; font-size: 10pt; padding-left: 0; }
.toc li::before { content: ''; }
.proof { margin-top: 26pt; padding: 12pt 14pt; border-top: 1.5pt solid var(--ash); font-size: 8.5pt; color: var(--smoke); letter-spacing: 0.04em; }
.proof strong { color: var(--ash); }
.footer { margin-top: 40pt; padding-top: 16pt; border-top: 0.5pt solid var(--rule); font-size: 9pt; color: var(--smoke); text-align: center; line-height: 1.55; }
.appendix-ref { font-size: 8.5pt; color: var(--smoke); font-style: italic; margin-top: 6pt; }
.minto-missing { font-size: 9.5pt; color: var(--smoke); font-style: italic; border-left: 2pt solid var(--rule); padding: 6pt 0 6pt 12pt; margin: 6pt 0 4pt; }
.appendix-ref a { color: var(--detonation); text-decoration: none; }
`;
}

/* ══════════════════════════════════════════════ PRIMITIVES (HTML) ══ */

/** Consistent section kicker label used across every document type. */
export function kicker(label: string, index?: string | number): string {
  const idx = index === undefined ? "" : `<span class="idx">${escapeHtml(index)}</span>`;
  return `<p class="kicker">${idx}${escapeHtml(label)}</p>`;
}

export interface Stat {
  /** The number itself — never prose. */
  value: string | number;
  /** Small unit appended to the value, e.g. "/100", "%", "min". */
  suffix?: string;
  label: string;
  note?: string;
}

/**
 * Numbers, scores and counts render here — never inline in a sentence.
 * `cols` pins the grid; omit it to let the stats flow responsively.
 */
export function statGrid(stats: Stat[], cols?: 2 | 3 | 4): string {
  const items = stats.filter((s) => s && s.value !== undefined && s.value !== null && String(s.value) !== "");
  if (items.length === 0) return "";
  const cls = cols ? ` cols-${cols}` : "";
  return `<div class="stat-grid${cls}">${items
    .map(
      (s) => `<div class="stat keep-together">
      <div class="value">${escapeHtml(s.value)}${s.suffix ? `<span class="suffix">${escapeHtml(s.suffix)}</span>` : ""}</div>
      <div class="label">${escapeHtml(s.label)}</div>
      ${s.note ? `<div class="note">${escapeHtml(s.note)}</div>` : ""}
    </div>`,
    )
    .join("")}</div>`;
}

export interface PullQuoteOptions {
  label?: string;
  attribution?: string;
  /**
   * Qualifying status set beneath the headline in small, light caption type.
   * Never concatenate a verdict or status into the headline itself.
   */
  caption?: string;
  /** hero = full-bleed rules, cover-adjacent. quiet = supporting emphasis. */
  variant?: "default" | "hero" | "quiet";
}

/** The governing recommendation / key insight / why-it-wins treatment. */
export function pullQuote(body: string, opts: PullQuoteOptions = {}): string {
  const text = sanitiseText(body).trim();
  if (!text) return "";
  const variant = opts.variant && opts.variant !== "default" ? ` ${opts.variant}` : "";
  // Bebas Neue is a condensed display face: at 30pt a short line reads as a
  // statement, but a full sentence of prose reads as words running together.
  // Anything longer than a headline is set in the body face instead.
  const proseClass = text.length > 150 ? " prose" : "";
  return `<div class="pull${variant} keep-together">
    ${opts.label ? `<div class="pull-label">${escapeHtml(opts.label)}</div>` : ""}
    <div class="pull-body${proseClass}">${escapeHtml(text)}</div>
    ${opts.caption ? `<div class="pull-caption">${escapeHtml(sanitiseText(opts.caption).trim())}</div>` : ""}
    ${opts.attribution ? `<div class="pull-attr">${escapeHtml(opts.attribution)}</div>` : ""}
  </div>`;
}


export interface CmpColumn {
  key: string;
  label: string;
  /** Right-aligned tabular numerals — use for every score or count column. */
  numeric?: boolean;
}

export interface CmpRow {
  /** Marks the winning / selected row. */
  win?: boolean;
  cells: Record<string, string | number | null | undefined>;
}

/**
 * Comparative content is always a table — never a paragraph describing a
 * comparison. Used for winner-vs-rejected, before/after, scoring dimensions.
 */
export function comparisonTable(
  columns: CmpColumn[],
  rows: CmpRow[],
  caption?: string,
): string {
  if (columns.length === 0 || rows.length === 0) return "";
  const head = columns
    .map((c) => `<th${c.numeric ? ' class="num"' : ""}>${escapeHtml(c.label)}</th>`)
    .join("");
  const body = rows
    .map((r) => {
      const tds = columns
        .map((c) => {
          const raw = r.cells[c.key];
          const empty = raw === null || raw === undefined || String(raw).trim() === "";
          const cls = [c.numeric ? "num score" : "", empty ? "muted" : ""].filter(Boolean).join(" ");
          return `<td${cls ? ` class="${cls}"` : ""}>${empty ? "—" : inlineMd(sanitiseText(raw))}</td>`;
        })
        .join("");
      return `<tr${r.win ? ' class="win"' : ""}>${tds}</tr>`;
    })
    .join("");
  return `<table class="cmp">${caption ? `<caption>${escapeHtml(caption)}</caption>` : ""}<thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

export interface Reason {
  title: string;
  detail?: string;
}

/** The 3–4 supporting reasons under a proposition. Capped at four by design. */
export function reasonGrid(reasons: Reason[]): string {
  const items = reasons.filter((r) => r && r.title).slice(0, 4);
  if (items.length === 0) return "";
  return `<div class="reasons">${items
    .map(
      // A long card kept together can push the whole grid onto the next page
      // and strand half a page of white space, so only short cards are pinned.
      (r, i) => `<div class="reason ${(r.detail ?? "").length > 420 ? "allow-break" : "keep-together"}">
      <div class="n">${String(i + 1).padStart(2, "0")}</div>
      <div class="t">${inlineMd(sanitiseText(r.title))}</div>
      ${r.detail ? `<div class="d">${inlineMd(sanitiseText(r.detail))}</div>` : ""}
    </div>`,
    )
    .join("")}</div>`;

}

/** Bordered supporting block — rejected-and-why, caveats, short notes. */
export function callout(label: string, bodyHtml: string): string {
  if (!bodyHtml.trim()) return "";
  return `<div class="callout keep-together"><div class="callout-label">${escapeHtml(label)}</div>${bodyHtml}</div>`;
}

/** Standard section wrapper — kicker + heading + content, one idea per block. */
export function section(
  opts: { kicker?: string; index?: string | number; title?: string; breakBefore?: boolean; keepTogether?: boolean },
  bodyHtml: string,
): string {
  const cls = [
    "section",
    opts.breakBefore ? "doc-break" : "",
    opts.keepTogether ? "keep-together" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return `<div class="${cls}">
    ${opts.kicker ? kicker(opts.kicker, opts.index) : ""}
    ${opts.title ? `<h2>${escapeHtml(opts.title)}</h2>` : ""}
    ${bodyHtml}
  </div>`;
}

export interface CoverOptions {
  brand: string;
  label: string;
  title: string;
  subtitle?: string;
  confidential?: boolean;
}

export function cover(opts: CoverOptions): string {
  const date = new Date().toLocaleDateString("en-AU", { month: "long", year: "numeric" });
  return `<div class="cover">
    <div class="cover-brand">${escapeHtml(opts.brand)}</div>
    <div class="cover-label">${escapeHtml(opts.label)}</div>
    <div class="cover-title">${escapeHtml(opts.title)}</div>
    <div class="cover-rule"></div>
    ${opts.subtitle ? `<p class="cover-date">${escapeHtml(opts.subtitle)}</p>` : ""}
    <div class="cover-date">Brand Grenade Strategy Intelligence System — ${escapeHtml(date)}</div>
    ${opts.confidential === false ? "" : `<div class="cover-confidential">CONFIDENTIAL</div>`}
  </div>`;
}

export interface ProofLine {
  stagesRun?: number | string;
  runtime?: string;
  documents?: number | string;
  extra?: string;
}

/** "System proof line" — stages run, time, documents produced. */
export function proofLine(p: ProofLine): string {
  const bits = [
    p.stagesRun ? `<strong>${escapeHtml(p.stagesRun)}</strong> stages run` : "",
    p.runtime ? `<strong>${escapeHtml(p.runtime)}</strong> elapsed` : "",
    p.documents ? `<strong>${escapeHtml(p.documents)}</strong> documents produced` : "",
    p.extra ? escapeHtml(p.extra) : "",
  ].filter(Boolean);
  if (bits.length === 0) return "";
  return `<div class="proof keep-together">SYSTEM PROOF — ${bits.join(" · ")}</div>`;
}

/** Cross-reference from a primary document to its backing appendix document. */
export function appendixRef(label: string, href?: string): string {
  const text = escapeHtml(label);
  return `<p class="appendix-ref">Backing detail: ${href ? `<a href="${escapeHtml(href)}">${text}</a>` : text}</p>`;
}

/* ─────────────────────────────────────────────────── document shell ── */

export interface ShellOptions {
  title: string;
  /** Screen chrome + print button. False when rendering headlessly for PDF. */
  screen?: boolean;
  /** Toolbar caption on screen. */
  toolbarNote?: string;
  /** Document-specific CSS appended after the shared system stylesheet. */
  extraCss?: string;
  footerHtml?: string;
}

export function docShell(opts: ShellOptions, bodyHtml: string): string {
  const screen = opts.screen !== false;
  const toolbar = screen
    ? `<div id="toolbar">
        <span>${escapeHtml(opts.toolbarNote ?? opts.title)}</span>
        <div class="actions">
          <button onclick="window.print()">Print / Save as PDF</button>
          <button class="close" onclick="window.close()">Close</button>
        </div>
      </div>`
    : "";
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(opts.title)}</title>
<style>${docSystemStyles({ screen })}${opts.extraCss ?? ""}</style>
</head><body>
${toolbar}
<div class="page">
${bodyHtml}
${opts.footerHtml ? `<div class="footer">${opts.footerHtml}</div>` : ""}
</div>
</body></html>`;
}
