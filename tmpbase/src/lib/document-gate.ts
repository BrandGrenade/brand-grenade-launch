// BRAND GRENADE — RUNTIME DOCUMENT GATE
// ============================================================================
// Structural half of the audit, enforced at render time so a document can
// never be handed to a reader while silently missing a canonical section or
// carrying an orphaned heading. The provenance/foreign-content half needs the
// whole database and runs in scripts/audit-documents.ts.
//
// Every primary builder returns its HTML through `gateDocument`.

import type { DocumentSpec } from "./document-spec";
import { certifyDocument } from "./content-integrity";

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
  /** Offset of the section's kicker in the source HTML. */
  at: number;
  /** Offset immediately after the kicker — where the body starts. */
  bodyAt: number;
}

export function renderedSections(html: string): GateSection[] {
  const re = /<p class="kicker"><span class="idx">(\d{2})<\/span>([^<]*)<\/p>/g;
  const marks: Array<{ index: string; title: string; end: number; at: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) marks.push({ index: m[1], title: strip(m[2]), at: m.index, end: re.lastIndex });
  return marks.map((mk, i) => {
    const bodyHtml = html.slice(mk.end, marks[i + 1]?.at ?? html.length);
    return { index: mk.index, title: mk.title, bodyHtml, text: strip(bodyHtml), at: mk.at, bodyAt: mk.end };
  });
}

/**
 * Internal selection UI that only ever belonged to the pipeline screens:
 * the Stage 8 candidate chooser and its A · / B · option rows, plus the
 * word-count annotations the chooser prints. A rendered document that shows
 * these is asking a client to make an internal selection.
 */
const SELECTION_UI_HTML: RegExp[] = [
  // heading row of a candidate chooser, plus every option row beneath it
  /<h[1-6][^>]*>\s*(?:[^<]*\b(?:CANDIDATE SET|SELECT ONE|CHOOSE ONE)\b[^<]*)<\/h[1-6]>(?:\s*<(p|ul|ol|blockquote)[^>]*>[\s\S]*?<\/\1>)*?(?=\s*(?:<h[1-6]|<\/div>|$))/gi,
  // a stray option row that survived without its heading
  /<p[^>]*>\s*<strong>\s*[A-Z]\s*[·•.]\s*(?:BASE|BREACH|FUSE|FLASHPOINT|LOC|OPTION)\b[\s\S]*?<\/p>/gi,
];

/** Removes internal selection-UI artifacts from rendered document HTML. */
export function stripSelectionArtifacts(html: string): string {
  let out = html;
  for (const re of SELECTION_UI_HTML) out = out.replace(re, "");
  return out;
}

/**
 * Where a section's body starts carrying the NEXT canonical section's content.
 * A heading that names the following section, appearing after this section has
 * already said something of its own, is a boundary bleed. A recap heading that
 * names a distant section is legitimate and is left alone.
 */
function bleedOffset(sections: GateSection[], i: number): number {
  const sec = sections[i];
  const next = sections[i + 1];
  if (!next) return -1;
  const nextTitle = norm(next.title);
  if (!nextTitle || nextTitle === norm(sec.title)) return -1;
  for (const m of sec.bodyHtml.matchAll(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/g)) {
    if (norm(strip(m[1])) !== nextTitle) continue;
    const before = strip(sec.bodyHtml.slice(0, m.index)).length;
    if (before > 200) return m.index!;
  }
  return -1;
}

/**
 * Section-boundary seal. A section body may only contain its own content:
 * if a heading inside a section names a DIFFERENT canonical section of the
 * same document, everything from that heading onward is another section's
 * content and is cut. Applied to every section of every document type, so a
 * bleed cannot reappear in one builder after being fixed in another.
 */
export function sealSectionBoundaries(html: string, spec: DocumentSpec): string {

  const sections = renderedSections(html);
  let out = html;
  // last → first so earlier offsets stay valid
  for (let i = sections.length - 1; i >= 0; i--) {
    const cutAt = bleedOffset(sections, i);
    if (cutAt < 0) continue;
    const sec = sections[i];
    const tail = /((?:\s*<\/div>)+\s*)$/.exec(sec.bodyHtml)?.[1] ?? "";
    const kept = sec.bodyHtml.slice(0, cutAt).replace(/\s+$/, "") + tail;
    out = out.slice(0, sec.bodyAt) + kept + out.slice(sec.bodyAt + sec.bodyHtml.length);
  }
  return out;
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
    // C5 — internal selection UI must never reach a rendered document.
    if (/CANDIDATE SET\s*[—–-]\s*(?:select|choose) one|\b[A-Z]\s*[·•]\s*(?:BASE|BREACH|FUSE|FLASHPOINT)\b/.test(sec.text)) {
      failures.push(`internal selection artifact in section ${sec.index} "${sec.title}"`);
    }
    // C6 — boundary: a section may not run on into the next canonical section.
    if (bleedOffset(rendered, rendered.indexOf(sec)) >= 0) {
      failures.push(`section ${sec.index} "${sec.title}" runs on into the next section`);
    }
  }
  return failures;
}

/**
 * Hard gate. The document is first cleaned at the shared layer — internal
 * selection UI stripped, section boundaries sealed — and only then checked.
 * A document that still fails the canonical structure is not returned.
 */
export function gateDocument(html: string, spec: DocumentSpec): string {
  const cleaned = sealSectionBoundaries(stripSelectionArtifacts(html), spec);
  const failures = checkDocumentStructure(cleaned, spec);
  if (failures.length) {
    throw new Error(
      `${spec.label} failed the canonical document gate:\n- ${failures.slice(0, 12).join("\n- ")}`,
    );
  }

  // Structure is only half of publishable. The shared content-integrity layer
  // certifies the other half — clean, complete, consistent, client voice.
  return certifyDocument(cleaned, spec.label, {
    narrativeSections: spec.frontMatter.map((f) => f.index),
    transcriptSections: spec.appendix.map((a) => a.index),
  });
}
