// Phase 2 output sanitiser.
//
// Strips raw markdown punctuation from model output so it can be rendered as
// clean prose. Heading markers (#, ##, ###) and bold-only heading lines
// (**…**) are preserved as their inner text on their own line so downstream
// components (e.g. RichOutput) can still recognise heading lines if desired,
// but the raw punctuation characters are removed.
//
//   ** … **        → … (bold markers stripped)
//   _ … _          → … (italic markers stripped)
//   ###/##/# foo   → foo (heading marker stripped; text preserved)
//   --- on a line  → removed entirely (divider handled via CSS)
//   * item / - item → item (raw list bullets stripped, text preserved)
//
// Pure function. Safe to call on null/undefined.
export function sanitiseOutput(input: string | null | undefined): string {
  if (!input) return "";
  const lines = input.split("\n");
  const out: string[] = [];
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    // Horizontal rule line → drop entirely.
    if (/^\s*-{3,}\s*$/.test(line) || /^\s*\*{3,}\s*$/.test(line)) continue;
    let l = line;
    // Strip leading heading markers (# ## ### ####) but keep the text.
    l = l.replace(/^\s*#{1,6}\s+/, "");
    // Strip leading list bullets (* / - / •) followed by a space.
    l = l.replace(/^\s*[*\-•]\s+/, "");
    // Strip bold markers anywhere on the line.
    l = l.replace(/\*\*([^*]+)\*\*/g, "$1");
    // Strip stray double-asterisks left over from malformed pairs.
    l = l.replace(/\*\*/g, "");
    // Strip underscore-italics: _text_ → text. Avoid touching snake_case_words
    // by requiring whitespace or string-boundaries around the markers.
    l = l.replace(/(^|[\s(])_([^_ \n]+)_(?=[\s).,;:!?]|$)/g, "$1$2");
    // Strip single leading/trailing asterisks used as inline emphasis.
    l = l.replace(/(^|[\s(])\*([^* \n]+)\*(?=[\s).,;:!?]|$)/g, "$1$2");
    out.push(l);
  }
  return out.join("\n").trim();
}

export default sanitiseOutput;
