// BRAND GRENADE — SUMMARY DOCUMENT GATE
// ============================================================================
// Every fault found during the Jaguar rebuild is encoded here as an automated
// check. `buildSummaryDocument` runs this on every render, for every session,
// and throws rather than return a document that breaks a rule. Nothing in this
// file is brand-specific.

export interface GateSectionInput {
  index: string;
  title: string;
  /** Sealed body HTML, exactly as it will be printed. */
  html: string;
}

export interface GateContext {
  /** Expected section indices, in printed order. */
  order: readonly string[];
  /** The locked proposition. Must be traceable in the generation section. */
  lockedSmp?: string;
  /** The locked creative idea, which section 17 must carry in full. */
  lockedIdea?: string;
  /** Propositions / lines / territories belonging to OTHER sessions. */
  foreignMarkers?: readonly string[];
  /** Sections that must never render as an empty placeholder. */
  requiredProse?: readonly string[];
}

const strip = (h: string) =>
  h
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const norm = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/** Internal system artifacts that must never reach a reader. */
const ARTIFACTS: Array<[RegExp, string]> = [
  [/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i, "run/session UUID"],
  [/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, "ISO timestamp"],
  [/\b(AUDIT DATE|TOTAL FLAGS RAISED|STAGE \d+[A-Z]? OUTPUT|RAW OUTPUT|SYSTEM PROMPT)\b/i, "pipeline bookkeeping label"],
  [/CANDIDATE SET\s*[—–-]\s*(?:select|choose) one/i, "selection UI"],
  [/(?:^|\s)\*\*[^*\n]{2,80}\*\*/, "unrendered markdown bold"],
  [/(?:^|\s)#{2,4}\s+[A-Za-z]/, "unrendered markdown heading"],
  [/\bword count\s*:/i, "word-count annotation"],
];

function truncationFaults(text: string): string[] {
  const out: string[] = [];
  // safeClamp's ellipsis is only legitimate after a complete word AND is not
  // permitted at all in a finished document: it means content was cut.
  if (/\w…/.test(text) || /\w\.\.\.(?:\s|$)/.test(text)) out.push("text cut with an ellipsis");
  // A body that stops on a conjunction is a mid-sentence cut.
  if (/\b(and|or|but|with|the|of|to|on|in|for|that|which)\s*$/i.test(text))
    out.push("body ends mid-sentence");
  return out;
}

export function summaryGateFailures(
  sections: GateSectionInput[],
  fullHtml: string,
  ctx: GateContext,
): string[] {
  const fail: string[] = [];
  const titles = new Map(sections.map((s) => [norm(s.title), s.index]));

  // C1 — every canonical section present, in order, with a body.
  const got = sections.map((s) => s.index).join(",");
  if (got !== ctx.order.join(",")) fail.push(`section order is ${got}`);

  for (const sec of sections) {
    const text = strip(sec.html);
    if (!text) {
      fail.push(`section ${sec.index} "${sec.title}" has no body`);
      continue;
    }

    // C2 — no other canonical section's heading inside this body.
    for (const m of sec.html.matchAll(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/g)) {
      const t = norm(strip(m[1]));
      const owner = titles.get(t);
      if (owner && owner !== sec.index)
        fail.push(`section ${sec.index} carries section ${owner}'s heading "${strip(m[1])}"`);
    }

    // C3 — no orphaned heading with nothing beneath it.
    if (/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>\s*$/.test(sec.html.trim()))
      fail.push(`section ${sec.index} ends on an orphaned heading`);

    // C4 — no truncation.
    for (const f of truncationFaults(text)) fail.push(`section ${sec.index}: ${f}`);

    // C5 — no internal artifacts.
    for (const [re, label] of ARTIFACTS)
      if (re.test(text)) fail.push(`section ${sec.index} contains ${label}`);

    // C6 — no foreign-session content.
    for (const marker of ctx.foreignMarkers ?? []) {
      const m = marker.trim();
      if (m.length > 12 && text.toLowerCase().includes(m.toLowerCase()))
        fail.push(`section ${sec.index} contains another session's content: "${m.slice(0, 60)}"`);
    }
  }

  // C7 — nothing silently duplicated across two sections.
  const seen = new Map<string, string>();
  for (const sec of sections) {
    for (const m of sec.html.matchAll(/<(p|li)[^>]*>([\s\S]*?)<\/\1>/g)) {
      const t = strip(m[2]);
      if (t.length < 200) continue;
      const prior = seen.get(t);
      if (prior && prior !== sec.index)
        fail.push(`sections ${prior} and ${sec.index} both print the same paragraph`);
      else seen.set(t, sec.index);
    }
  }

  // C8 — the declared winner is traceable to where it was generated.
  const gen = sections.find((s) => s.index === "07");
  if (ctx.lockedSmp && gen && !strip(gen.html).toLowerCase().includes(ctx.lockedSmp.toLowerCase()))
    fail.push(`section 07 does not trace the locked proposition "${ctx.lockedSmp}"`);

  // C9 — the locked creative idea renders complete and verbatim.
  const creative = sections.find((s) => s.index === "17");
  if (ctx.lockedIdea && creative) {
    const body = strip(creative.html);
    const source = strip(ctx.lockedIdea);
    const tail = source.slice(-80);
    if (tail && !body.includes(tail))
      fail.push("section 17 does not carry the locked creative idea to its last line");
  }

  // C10 — prose sections may never be an empty placeholder.
  for (const idx of ctx.requiredProse ?? []) {
    const sec = sections.find((s) => s.index === idx);
    if (!sec || strip(sec.html).length < 200)
      fail.push(`section ${idx} must carry full prose but is empty or a stub`);
  }

  // C11 — the footer is the true last content of the document.
  const footerAt = fullHtml.lastIndexOf("<footer");
  if (footerAt < 0) fail.push("document has no footer");
  else {
    const after = fullHtml.slice(fullHtml.indexOf("</footer>", footerAt));
    if (/<div class="section|<h[1-6]|<p[ >]/.test(after))
      fail.push("content renders after the closing footer");
    const lastSection = fullHtml.lastIndexOf('<div class="section');
    if (lastSection > footerAt) fail.push("a section is assembled after the footer");
  }

  return fail;
}

export function gateSummary(
  sections: GateSectionInput[],
  fullHtml: string,
  ctx: GateContext,
): string {
  const fail = summaryGateFailures(sections, fullHtml, ctx);
  if (fail.length)
    throw new Error(
      `Brand Strategy and Creative Intelligence Summary failed its gate:\n- ${fail.join("\n- ")}`,
    );
  return fullHtml;
}
