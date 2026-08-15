// BRAND GRENADE — RUNTIME DOCUMENT GATE
// ============================================================================
// Structural half of the audit, enforced at render time so a document can
// never be handed to a reader while silently missing a canonical section or
// carrying an orphaned heading. The provenance/foreign-content half needs the
// whole database and runs in scripts/audit-documents.ts.
//
// Every primary builder returns its HTML through `gateDocument`.

import type { DocumentSpec } from "./document-spec";

const strip = (h: string) =>
  h
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

export interface GateSection {
  index: string;
  title: string;
  bodyHtml: string;
  text: string;
}

export function renderedSections(html: string): GateSection[] {
  const re = /<p class="kicker"><span class="idx">(\d{2})<\/span>([^<]*)<\/p>/g;
  const marks: Array<{ index: string; title: string; end: number; at: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) marks.push({ index: m[1], title: strip(m[2]), at: m.index, end: re.lastIndex });
  return marks.map((mk, i) => {
    const bodyHtml = html.slice(mk.end, marks[i + 1]?.at ?? html.length);
    return { index: mk.index, title: mk.title, bodyHtml, text: strip(bodyHtml) };
  });
}

/** C1 completeness + C4 orphan checks. Returns human-readable failures. */
export function checkDocumentStructure(html: string, spec: DocumentSpec): string[] {
  const rendered = renderedSections(html);
  const seen = new Set(rendered.map((s) => `${s.index}|${norm(s.title)}`));
  const failures: string[] = [];

  for (const f of spec.frontMatter) {
    if (!seen.has(`${f.index}|${norm(f.kicker)}`)) failures.push(`missing section ${f.index} "${f.kicker}"`);
  }
  for (const a of spec.appendix) {
    if (!seen.has(`${a.index}|${norm(a.title)}`)) failures.push(`missing section ${a.index} "${a.title}"`);
  }
  for (const sec of rendered) {
    if (!sec.text.trim()) failures.push(`section ${sec.index} "${sec.title}" has no body`);
    const orphans = sec.bodyHtml.match(/<h[23][^>]*>[^<]*<\/h[23]>\s*(?=<h[23]|<\/div>|$)/g) ?? [];
    for (const o of orphans) failures.push(`orphan heading "${strip(o)}" in section ${sec.index}`);
  }
  return failures;
}

/**
 * Hard gate. A document that fails the canonical structure is not returned:
 * silently shipping an incomplete document is what allowed a missing
 * "Brand Fit Validation" card to be reported as a clean pass.
 */
export function gateDocument(html: string, spec: DocumentSpec): string {
  const failures = checkDocumentStructure(html, spec);
  if (failures.length) {
    throw new Error(
      `${spec.label} failed the canonical document gate:\n- ${failures.slice(0, 12).join("\n- ")}`,
    );
  }
  return html;
}
